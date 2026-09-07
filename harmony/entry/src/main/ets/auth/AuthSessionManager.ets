import { EnvironmentConfig, EnvironmentName } from '../common/config/EnvironmentConfig';
import { AuthInterceptor } from '../network/AuthInterceptor';
import { CredentialOperation, CredentialStore, CredentialStoreError, StoredCredential } from '../storage/CredentialStore';
import { AuthTokenController } from './AuthTokenController';

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
  private status: AuthStatus = AuthStatus.GUEST;
  private session: AuthSession | null = null;
  private restoreVersion: number = 0;
  private credentialError: CredentialStoreError | null = null;
  private expirationPromise?: Promise<boolean>;

  constructor(authTokenController: AuthTokenController = new AuthInterceptor(), credentialStore?: CredentialStore,
    environment: EnvironmentName = EnvironmentConfig.current().name) {
    this.authTokenController = authTokenController;
    this.credentialStore = credentialStore;
    this.environment = environment;
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

    if (credential.environment !== this.environment || credential.accessToken.trim().length === 0) {
      this.credentialError = new CredentialStoreError(CredentialOperation.LOAD);
      this.status = AuthStatus.GUEST;
      this.session = null;
      this.authTokenController.clearAccessToken();
      return;
    }

    this.applyAuthenticated(credential);
  }

  async signIn(accessToken: string): Promise<boolean> {
    const normalizedToken = accessToken.trim();
    if (normalizedToken.length === 0) {
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
      accessToken: normalizedToken,
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
      return false;
    }
    this.applyAuthenticated(credential);
    return true;
  }

  async signOut(): Promise<boolean> {
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

  private applyAuthenticated(credential: StoredCredential): void {
    this.session = {
      accessToken: credential.accessToken,
      environment: this.environment
    };
    this.status = AuthStatus.AUTHENTICATED;
    this.authTokenController.setAccessToken(credential.accessToken);
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
