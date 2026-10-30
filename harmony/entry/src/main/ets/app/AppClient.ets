import { common } from '@kit.AbilityKit';
import { EnvironmentConfig } from '../common/config/EnvironmentConfig';
import { AuthSessionManager } from '../auth/AuthSessionManager';
import { ApiService } from '../network/ApiService';
import { FileImageService } from '../network/FileImageService';
import { AuthInterceptor } from '../network/AuthInterceptor';
import { AuthenticationExpiredHandler, HttpClient } from '../network/HttpClient';
import { AssetCredentialStore } from '../storage/AssetCredentialStore';
import { DeviceIdentityStore } from '../storage/DeviceIdentityStore';
import { PrivacyConsentStore } from '../privacy/PrivacyConsentStore';

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
  readonly fileImages: FileImageService;
  private restorePromise?: Promise<void>;
  private restoreStarted: boolean = false;
  private restoreVersion: number = 0;
  private deviceId: string = '';
  private abilityContext?: common.UIAbilityContext;

  private constructor() {
    const environment = EnvironmentConfig.current();
    const authInterceptor = new AuthInterceptor();
    const credentialStore = new AssetCredentialStore(environment.name, environment.cacheNamespace);
    const expiredHandler = new SessionExpiredHandler();
    const httpClient = new HttpClient(authInterceptor, expiredHandler);
    this.apiService = new ApiService(httpClient);
    this.fileImages = new FileImageService(httpClient);
    this.sessionManager = new AuthSessionManager(httpClient, credentialStore, environment.name, this.apiService);
    expiredHandler.bind(this.sessionManager);
    this.restoreVersion = this.sessionManager.getSessionVersion();
  }

  bindContext(context: common.UIAbilityContext): void {
    this.abilityContext = context;
  }

  hasRequiredPrivacyConsent(): boolean {
    if (this.abilityContext === undefined) {
      return false;
    }
    return PrivacyConsentStore.hasCurrentConsent(this.abilityContext);
  }

  acceptRequiredPrivacyConsent(acceptedAtEpochMs: number): void {
    PrivacyConsentStore.acceptCurrent(this.requireContext(), acceptedAtEpochMs);
  }

  withdrawRequiredPrivacyConsent(): void {
    PrivacyConsentStore.clear(this.requireContext());
  }

  bootstrapAfterPrivacyConsent(): Promise<void> {
    const context = this.requireContext();
    if (!PrivacyConsentStore.hasCurrentConsent(context)) {
      return Promise.reject(new Error('Current privacy consent is required'));
    }
    if (this.deviceId.length === 0) {
      this.setDeviceId(DeviceIdentityStore.getOrCreate(context));
    }
    return this.restoreSession();
  }

  terminateApplication(): Promise<void> {
    try {
      return this.requireContext().terminateSelf();
    } catch {
      return Promise.reject(new Error('Application could not be terminated'));
    }
  }

  restoreSession(): Promise<void> {
    if (this.restorePromise !== undefined) {
      return this.restorePromise;
    }
    // A changed generation belongs to login, logout or expiration, not startup retry.
    if (this.sessionManager.isAuthenticated() ||
      this.restoreVersion !== this.sessionManager.getSessionVersion()) {
      return Promise.resolve();
    }

    if (!this.restoreStarted) {
      this.restoreVersion = this.sessionManager.beginRestore();
      this.restoreStarted = true;
    }
    // Keep the same generation so a rotated credential awaiting persistence is reused.
    const restore = this.restoreAndRelease(this.restoreVersion);
    this.restorePromise = restore;
    return restore;
  }

  setDeviceId(deviceId: string): void {
    this.deviceId = deviceId;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  private requireContext(): common.UIAbilityContext {
    if (this.abilityContext === undefined) {
      throw new Error('Application context is unavailable');
    }
    return this.abilityContext;
  }

  private async restoreAndRelease(version: number): Promise<void> {
    try {
      await this.sessionManager.restore(version);
    } finally {
      this.restorePromise = undefined;
    }
  }
}
