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

  async refreshSession(): Promise<boolean> {
    return this.sessionManager === undefined ? false : this.sessionManager.refreshAccessToken();
  }
}

/** One composition root keeps HTTP authentication and persisted session state in sync. */
export class AppClient {
  static readonly shared: AppClient = new AppClient();

  readonly sessionManager: AuthSessionManager;
  readonly apiService: ApiService;
  private restorePromise?: Promise<void>;
  private restoreStarted: boolean = false;
  private deviceId: string = '';

  private constructor() {
    const environment = EnvironmentConfig.current();
    const authInterceptor = new AuthInterceptor();
    const credentialStore = new AssetCredentialStore(environment.name, environment.cacheNamespace);
    const expiredHandler = new SessionExpiredHandler();
    const httpClient = new HttpClient(authInterceptor, expiredHandler);
    this.apiService = new ApiService(httpClient);
    this.sessionManager = new AuthSessionManager(httpClient, credentialStore, environment.name, this.apiService);
    expiredHandler.bind(this.sessionManager);
  }

  restoreSession(): Promise<void> {
    if (this.restorePromise !== undefined) {
      return this.restorePromise;
    }
    if (this.restoreStarted || this.sessionManager.isAuthenticated()) {
      return Promise.resolve();
    }
    this.restoreStarted = true;

    const version = this.sessionManager.beginRestore();
    const restore = this.restoreAndRelease(version);
    this.restorePromise = restore;
    return restore;
  }

  setDeviceId(deviceId: string): void {
    this.deviceId = deviceId;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  private async restoreAndRelease(version: number): Promise<void> {
    try {
      await this.sessionManager.restore(version);
    } finally {
      this.restorePromise = undefined;
    }
  }
}
