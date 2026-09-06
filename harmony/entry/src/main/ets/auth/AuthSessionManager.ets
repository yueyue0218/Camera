import { AuthInterceptor } from '../network/AuthInterceptor';
import { CredentialStore, StoredCredential } from '../storage/CredentialStore';

export enum AuthStatus {
  RESTORING = 'restoring',
  GUEST = 'guest',
  AUTHENTICATED = 'authenticated',
  EXPIRED = 'expired'
}

export interface AuthSession {
  readonly accessToken: string;
  readonly environment: string;
}

export class AuthSessionManager {
  private readonly authInterceptor: AuthInterceptor;
  private readonly credentialStore?: CredentialStore;
  private status: AuthStatus = AuthStatus.GUEST;
  private session: AuthSession | null = null;
  private restoreVersion: number = 0;

  constructor(authInterceptor: AuthInterceptor = new AuthInterceptor(), credentialStore?: CredentialStore) {
    this.authInterceptor = authInterceptor;
    this.credentialStore = credentialStore;
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

  /** Starts one restore operation and returns its version for stale-result protection. */
  beginRestore(): number {
    this.restoreVersion += 1;
    this.status = AuthStatus.RESTORING;
    return this.restoreVersion;
  }

  async restore(version: number): Promise<void> {
    if (this.credentialStore === undefined || version !== this.restoreVersion) {
      return;
    }

    const credential = await this.credentialStore.load();
    if (version !== this.restoreVersion) {
      return;
    }

    if (credential === null || credential.accessToken.trim().length === 0) {
      this.status = AuthStatus.GUEST;
      this.session = null;
      this.authInterceptor.clearAccessToken();
      return;
    }

    this.applyAuthenticated(credential);
  }

  async signIn(accessToken: string, environment: string): Promise<boolean> {
    const normalizedToken = accessToken.trim();
    if (normalizedToken.length === 0 || environment.trim().length === 0) {
      return false;
    }

    const credential: StoredCredential = {
      accessToken: normalizedToken,
      environment: environment.trim()
    };

    if (this.credentialStore !== undefined) {
      await this.credentialStore.save(credential);
    }
    this.applyAuthenticated(credential);
    return true;
  }

  async signOut(): Promise<void> {
    this.restoreVersion += 1;
    if (this.credentialStore !== undefined) {
      await this.credentialStore.clear();
    }
    this.session = null;
    this.status = AuthStatus.GUEST;
    this.authInterceptor.clearAccessToken();
  }

  markExpired(): void {
    this.restoreVersion += 1;
    this.session = null;
    this.status = AuthStatus.EXPIRED;
    this.authInterceptor.clearAccessToken();
  }

  private applyAuthenticated(credential: StoredCredential): void {
    this.session = {
      accessToken: credential.accessToken,
      environment: credential.environment
    };
    this.status = AuthStatus.AUTHENTICATED;
    this.authInterceptor.setAccessToken(credential.accessToken);
  }
}
