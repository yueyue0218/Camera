import { EnvironmentConfig, EnvironmentName } from '../common/config/EnvironmentConfig';
import { AuthInterceptor } from '../network/AuthInterceptor';
import { CredentialOperation, CredentialStore, CredentialStoreError, StoredCredential } from '../storage/CredentialStore';
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

  isAuthenticated(): boolean {
    return this.status === AuthStatus.AUTHENTICATED && this.session !== null;
  }

  getCredentialError(): CredentialStoreError | null {
    return this.credentialError;
  }

  /** Starts one restore operation and returns its version for stale-result protection. */
  beginRestore(): number {
    this.restoreVersion += 1;
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
    if (this.credentialStore === undefined) {
      this.status = AuthStatus.GUEST;
      return;
    }

    let credential: StoredCredential | null;
    try {
      credential = await this.credentialStore.load();
    } catch (error) {
      if (version === this.restoreVersion) {
        this.credentialError = this.normalizeCredentialError(error, CredentialOperation.LOAD);
        this.status = AuthStatus.GUEST;
        this.session = null;
        this.authTokenController.clearAccessToken();
      }
      return;
    }
    if (version !== this.restoreVersion) {
      return;
    }

    if (credential === null) {
      this.status = AuthStatus.GUEST;
      this.session = null;
      this.authTokenController.clearAccessToken();
      return;
    }

    if (credential.environment !== this.environment || credential.refreshToken.trim().length === 0 ||
      this.nativeSessionApi === undefined) {
      this.credentialError = new CredentialStoreError(CredentialOperation.LOAD);
      this.status = AuthStatus.GUEST;
      this.session = null;
      this.authTokenController.clearAccessToken();
      return;
    }

    try {
      const refreshed = await this.nativeSessionApi.refresh(credential.refreshToken);
      if (version !== this.restoreVersion) {
        return;
      }
      await this.persistAndApply(refreshed.accessToken, refreshed.refreshToken, version);
    } catch {
      if (version === this.restoreVersion) {
        await this.clearStoredCredential();
        this.status = AuthStatus.EXPIRED;
        this.session = null;
        this.authTokenController.clearAccessToken();
      }
    }
  }

  async signIn(accessToken: string, refreshToken: string): Promise<boolean> {
    const normalizedToken = accessToken.trim();
    const normalizedRefreshToken = refreshToken.trim();
    if (normalizedToken.length === 0 || normalizedRefreshToken.length === 0) {
      return false;
    }
    if (this.expirationPromise !== undefined) {
      await this.expirationPromise;
    }
    const operationVersion = ++this.restoreVersion;

    this.session = null;
    this.status = AuthStatus.RESTORING;
    this.credentialError = null;
    this.authTokenController.clearAccessToken();

    const credential: StoredCredential = {
      refreshToken: normalizedRefreshToken,
      environment: this.environment
    };

    try {
      if (this.credentialStore !== undefined) {
        await this.credentialStore.save(credential);
      }
    } catch (error) {
      if (operationVersion === this.restoreVersion) {
        this.credentialError = this.normalizeCredentialError(error, CredentialOperation.SAVE);
        this.status = AuthStatus.GUEST;
      }
      return false;
    }
    if (operationVersion !== this.restoreVersion) {
      await this.clearStoredCredential();
      return false;
    }
    this.applyAuthenticated(normalizedToken);
    return true;
  }

  async signOut(): Promise<boolean> {
    if (this.isAuthenticated() && this.nativeSessionApi !== undefined) {
      try {
        await this.nativeSessionApi.logout();
      } catch {
        // Local sign-out remains authoritative for privacy; the server session
        // will still expire and can be revoked from another authenticated device.
      }
    }
    this.restoreVersion += 1;
    this.session = null;
    this.status = AuthStatus.GUEST;
    this.credentialError = null;
    this.authTokenController.clearAccessToken();
    return this.clearStoredCredential();
  }

  markExpired(): Promise<boolean> {
    if (this.expirationPromise !== undefined) {
      return this.expirationPromise;
    }
    if (this.status !== AuthStatus.AUTHENTICATED && this.status !== AuthStatus.RESTORING) {
      return Promise.resolve(true);
    }
    this.restoreVersion += 1;
    this.session = null;
    this.status = AuthStatus.EXPIRED;
    this.credentialError = null;
    this.authTokenController.clearAccessToken();
    const expiration = this.clearStoredCredential();
    this.expirationPromise = expiration;
    expiration.finally(() => {
      if (this.expirationPromise === expiration) {
        this.expirationPromise = undefined;
      }
    });
    return expiration;
  }

  private applyAuthenticated(accessToken: string): void {
    this.session = {
      accessToken: accessToken,
      environment: this.environment
    };
    this.status = AuthStatus.AUTHENTICATED;
    this.authTokenController.setAccessToken(accessToken);
  }

  private async persistAndApply(accessToken: string, refreshToken: string, expectedVersion: number): Promise<void> {
    if (accessToken.trim().length === 0 || refreshToken.trim().length === 0) {
      throw new CredentialStoreError(CredentialOperation.LOAD);
    }
    if (this.credentialStore !== undefined) {
      await this.credentialStore.save({ refreshToken: refreshToken.trim(), environment: this.environment });
    }
    if (expectedVersion !== this.restoreVersion) {
      await this.clearStoredCredential();
      return;
    }
    this.applyAuthenticated(accessToken.trim());
  }

  private async clearStoredCredential(): Promise<boolean> {
    if (this.credentialStore === undefined) {
      return true;
    }
    try {
      await this.credentialStore.clear();
      return true;
    } catch (error) {
      this.credentialError = this.normalizeCredentialError(error, CredentialOperation.CLEAR);
      return false;
    }
  }

  private normalizeCredentialError(error: Object, operation: CredentialOperation): CredentialStoreError {
    if (error instanceof CredentialStoreError) {
      return error;
    }
    return new CredentialStoreError(operation);
  }
}
