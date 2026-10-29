import { EnvironmentConfig, EnvironmentName } from '../common/config/EnvironmentConfig';
import { AuthInterceptor } from '../network/AuthInterceptor';
import { CredentialOperation, CredentialStore, CredentialStoreError, StoredCredential } from '../storage/CredentialStore';
import { ErrorMapper, PortraError } from '../network/ErrorMapper';
import { NativeSessionResponse } from '../model/ApiModels';
import { AuthTokenController } from './AuthTokenController';
import { NativeSessionApi } from './NativeSessionApi';

export enum AuthStatus {
  RESTORING = 'restoring',
  GUEST = 'guest',
  AUTHENTICATED = 'authenticated',
  EXPIRED = 'expired'
}

export interface AuthSession {
  readonly accessToken: string;
  readonly environment: EnvironmentName;
}

export class AuthSessionManager {
  private readonly authTokenController: AuthTokenController;
  private readonly credentialStore?: CredentialStore;
  private readonly environment: EnvironmentName;
  private readonly nativeSessionApi?: NativeSessionApi;
  private status: AuthStatus = AuthStatus.GUEST;
  private session: AuthSession | null = null;
  private restoreVersion: number = 0;
  private credentialError: CredentialStoreError | null = null;
  private expirationPromise?: Promise<boolean>;
  private refreshPromise?: Promise<boolean>;
  private refreshVersion: number = -1;
  // Asset operations are ordered across refresh, login, logout and expiration.
  private credentialQueue: Promise<void> = Promise.resolve();
  // A server rotation must never be repeated just because secure persistence failed.
  // This response is retained only in memory until Asset Store accepts it or identity changes.
  private pendingRotation?: NativeSessionResponse;
  private pendingRotationVersion: number = -1;

  constructor(authTokenController: AuthTokenController = new AuthInterceptor(), credentialStore?: CredentialStore,
    environment: EnvironmentName = EnvironmentConfig.current().name, nativeSessionApi?: NativeSessionApi) {
    this.authTokenController = authTokenController;
    this.credentialStore = credentialStore;
    this.environment = environment;
    this.nativeSessionApi = nativeSessionApi;
  }

  getStatus(): AuthStatus {
    return this.status;
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  /** Identity generation; ordinary token rotation does not invalidate page caches. */
  getSessionVersion(): number {
    return this.restoreVersion;
  }

  isAuthenticated(): boolean {
    return this.status === AuthStatus.AUTHENTICATED && this.session !== null;
  }

  getCredentialError(): CredentialStoreError | null {
    return this.credentialError;
  }

  async notifyIdentityChanged(): Promise<boolean> {
    const version = this.restoreVersion;
    // A role switch must not discard a rotating refresh credential in flight.
    while (this.refreshPromise !== undefined && this.refreshVersion === version) {
      try {
        await this.refreshPromise;
      } catch {
        break;
      }
    }
    if (version !== this.restoreVersion) {
      return false;
    }
    if (this.pendingRotationVersion === version && this.pendingRotation !== undefined) {
      await this.refreshForVersion(version);
    }
    if (version !== this.restoreVersion) {
      return false;
    }
    if (!this.isAuthenticated() || this.session === null) {
      return false;
    }
    const token = this.session.accessToken;
    this.invalidateIdentity();
    this.authTokenController.setAccessToken(token);
    return true;
  }

  beginRestore(): number {
    this.invalidateIdentity();
    this.session = null;
    this.status = AuthStatus.RESTORING;
    this.credentialError = null;
    this.authTokenController.clearAccessToken();
    return this.restoreVersion;
  }

  async restore(version: number): Promise<void> {
    if (version !== this.restoreVersion) {
      return;
    }
    if (this.status === AuthStatus.GUEST) {
      this.status = AuthStatus.RESTORING;
      this.credentialError = null;
    }
    try {
      await this.refreshForVersion(version);
    } catch {
      // Preserve stored credentials on transport, parse, config, 403 and storage failures.
      // A later explicit restore / next application launch may try again.
    } finally {
      if (version === this.restoreVersion && this.status === AuthStatus.RESTORING) {
        this.status = AuthStatus.GUEST;
      }
    }
  }

  refreshAccessToken(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return Promise.resolve(false);
    }
    return this.refreshForVersion(this.restoreVersion);
  }

  private refreshForVersion(version: number): Promise<boolean> {
    if (this.refreshPromise !== undefined && this.refreshVersion === version) {
      return this.refreshPromise;
    }
    this.refreshVersion = version;
    const refresh = this.performRefresh(version);
    this.refreshPromise = refresh;
    // Both branches consume the settlement; no rejected finally() promise is left unhandled.
    refresh.then(() => this.finishRefresh(refresh), () => this.finishRefresh(refresh));
    return refresh;
  }

  private finishRefresh(refresh: Promise<boolean>): void {
    if (this.refreshPromise === refresh) {
      this.refreshPromise = undefined;
    }
  }

  private async performRefresh(version: number): Promise<boolean> {
    if (version !== this.restoreVersion || this.nativeSessionApi === undefined ||
      this.credentialStore === undefined) {
      return false;
    }
    let refreshed = this.pendingRotationVersion === version ? this.pendingRotation : undefined;
    if (refreshed === undefined) {
      let credential: StoredCredential | null;
      try {
        credential = await this.enqueueCredential<StoredCredential | null>(async () => {
          if (version === this.restoreVersion && this.credentialStore !== undefined) {
            return this.credentialStore.load();
          }
          return null;
        });
      } catch (error) {
        if (version === this.restoreVersion) {
          this.credentialError = this.normalizeCredentialError(error, CredentialOperation.LOAD);
        }
        throw this.normalizeThrownError(error);
      }
      if (version !== this.restoreVersion) {
        throw ErrorMapper.stale();
      }
      if (credential === null) {
        return false;
      }
      if (credential.environment !== this.environment || credential.refreshToken.trim().length === 0) {
        this.credentialError = new CredentialStoreError(CredentialOperation.LOAD);
        throw this.credentialError;
      }
      try {
        // Public POST: never recursively renew or automatically replay this rotation.
        refreshed = await this.nativeSessionApi.refresh(credential.refreshToken);
      } catch (error) {
        if (version !== this.restoreVersion) {
          throw ErrorMapper.stale();
        }
        if (error instanceof PortraError && ErrorMapper.isAuthenticationExpired(error)) {
          await this.markExpired();
        }
        throw this.normalizeThrownError(error);
      }
      if (version !== this.restoreVersion) {
        throw ErrorMapper.stale();
      }
      this.pendingRotation = refreshed;
      this.pendingRotationVersion = version;
    }
    if (refreshed.accessToken.trim().length === 0 || refreshed.refreshToken.trim().length === 0) {
      throw ErrorMapper.parse();
    }
    const saved = await this.saveCredential({
      refreshToken: refreshed.refreshToken.trim(), environment: this.environment
    }, version);
    if (!saved || version !== this.restoreVersion) {
      throw ErrorMapper.stale();
    }
    this.pendingRotation = undefined;
    this.credentialError = null;
    this.applyAuthenticated(refreshed.accessToken.trim(), true);
    return true;
  }

  async signIn(accessToken: string, refreshToken: string): Promise<boolean> {
    const token = accessToken.trim();
    const refresh = refreshToken.trim();
    if (token.length === 0 || refresh.length === 0) {
      return false;
    }
    const version = this.invalidateIdentity();
    this.session = null;
    this.status = AuthStatus.RESTORING;
    this.credentialError = null;
    this.authTokenController.clearAccessToken();
    try {
      // Remove the previous account before saving. A failed save must not restore it later.
      if (!await this.clearStoredCredential(version)) {
        if (version === this.restoreVersion) {
          this.status = AuthStatus.GUEST;
        }
        return false;
      }
      if (!await this.saveCredential({ refreshToken: refresh, environment: this.environment }, version)) {
        return false;
      }
    } catch {
      if (version === this.restoreVersion) {
        this.status = AuthStatus.GUEST;
      }
      return false;
    }
    if (version !== this.restoreVersion) {
      // Never clear here: a newer sign-in may already own the stored credential.
      return false;
    }
    this.applyAuthenticated(token, false);
    return true;
  }

  async signOut(): Promise<boolean> {
    // Capture the old bearer synchronously. Logout never renews and never replays.
    // Remote completion cannot mutate a newer local identity.
    if (this.isAuthenticated() && this.nativeSessionApi !== undefined) {
      this.nativeSessionApi.logout().catch(() => false);
    }
    const version = this.invalidateIdentity();
    this.session = null;
    this.status = AuthStatus.GUEST;
    this.credentialError = null;
    this.authTokenController.clearAccessToken();
    return this.clearStoredCredential(version);
  }

  markExpired(): Promise<boolean> {
    if (this.expirationPromise !== undefined) {
      return this.expirationPromise;
    }
    if (this.status !== AuthStatus.AUTHENTICATED && this.status !== AuthStatus.RESTORING) {
      return Promise.resolve(true);
    }
    const version = this.invalidateIdentity();
    this.session = null;
    this.status = AuthStatus.EXPIRED;
    this.credentialError = null;
    this.authTokenController.clearAccessToken();
    this.expirationPromise = this.clearStoredCredential(version);
    return this.expirationPromise;
  }

  private invalidateIdentity(): number {
    this.restoreVersion += 1;
    this.expirationPromise = undefined;
    this.pendingRotation = undefined;
    this.pendingRotationVersion = -1;
    return this.restoreVersion;
  }

  private applyAuthenticated(accessToken: string, rotation: boolean): void {
    this.session = { accessToken: accessToken, environment: this.environment };
    this.status = AuthStatus.AUTHENTICATED;
    if (rotation) {
      this.authTokenController.replaceAccessToken(accessToken);
    } else {
      this.authTokenController.setAccessToken(accessToken);
    }
  }

  private enqueueCredential<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.credentialQueue.then(operation);
    this.credentialQueue = queued.then(() => {}, () => {});
    return queued;
  }

  private async saveCredential(credential: StoredCredential, version: number): Promise<boolean> {
    try {
      await this.enqueueCredential(async () => {
        if (version === this.restoreVersion && this.credentialStore !== undefined) {
          await this.credentialStore.save(credential);
        }
      });
    } catch (error) {
      if (version === this.restoreVersion) {
        this.credentialError = this.normalizeCredentialError(error, CredentialOperation.SAVE);
      }
      throw this.normalizeThrownError(error);
    }
    return version === this.restoreVersion;
  }

  private async clearStoredCredential(version: number): Promise<boolean> {
    try {
      await this.enqueueCredential(async () => {
        if (version === this.restoreVersion && this.credentialStore !== undefined) {
          await this.credentialStore.clear();
        }
      });
      return version === this.restoreVersion;
    } catch (error) {
      if (version === this.restoreVersion) {
        this.credentialError = this.normalizeCredentialError(error, CredentialOperation.CLEAR);
      }
      return false;
    }
  }

  private normalizeCredentialError(error: Object, operation: CredentialOperation): CredentialStoreError {
    return error instanceof CredentialStoreError ? error : new CredentialStoreError(operation);
  }

  private normalizeThrownError(error: Object): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
