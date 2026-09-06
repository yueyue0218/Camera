import { EnvironmentConfig } from '../common/config/EnvironmentConfig';
import { AuthSessionManager } from '../auth/AuthSessionManager';
import { ApiService } from '../network/ApiService';
import { AuthInterceptor } from '../network/AuthInterceptor';
import { AuthenticationExpiredHandler, HttpClient } from '../network/HttpClient';
import { AssetCredentialStore } from '../storage/AssetCredentialStore';

class SessionExpiredHandler implements AuthenticationExpiredHandler {
  private sessionManager?: AuthSessionManager;

  bind(sessionManager: AuthSessionManager): void {
    this.sessionManager = sessionManager;
  }

  async onExpired(): Promise<void> {
    if (this.sessionManager !== undefined) {
      await this.sessionManager.markExpired();
    }
  }
}

/** One composition root keeps HTTP authentication and persisted session state in sync. */
export class AppClient {
  static readonly shared: AppClient = new AppClient();

  readonly sessionManager: AuthSessionManager;
  readonly apiService: ApiService;
  private restorePromise?: Promise<void>;

  private constructor() {
    const environment = EnvironmentConfig.current();
    const authInterceptor = new AuthInterceptor();
    const credentialStore = new AssetCredentialStore(environment.name, environment.cacheNamespace);
    const expiredHandler = new SessionExpiredHandler();
    const httpClient = new HttpClient(authInterceptor, expiredHandler);
    this.sessionManager = new AuthSessionManager(httpClient, credentialStore, environment.name);
    expiredHandler.bind(this.sessionManager);
    this.apiService = new ApiService(httpClient);
  }

  restoreSession(): Promise<void> {
    if (this.restorePromise === undefined) {
      const version = this.sessionManager.beginRestore();
      this.restorePromise = this.sessionManager.restore(version);
    }
    return this.restorePromise;
  }
}
