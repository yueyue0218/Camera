import { FileImageService } from '../network/FileImageService';
import { common } from '@kit.AbilityKit';
import { PrivacyConsentStore } from '../privacy/PrivacyConsentStore';
import { DeviceIdentityStore } from '../storage/DeviceIdentityStore';
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
  readonly fileImages: FileImageService;
  private privacySuspended: boolean = false;
  private abilityContext?: common.UIAbilityContext;
  private readonly privacyListeners: Set<() => void> = new Set<() => void>();
  private httpClient: HttpClient;
  private restorePromise?: Promise<void>;
  private restoreStarted: boolean = false;
  private restoreVersion: number = 0;
  private deviceId: string = '';

  private constructor() {
    const environment = EnvironmentConfig.current();
    const authInterceptor = new AuthInterceptor();
    const credentialStore = new AssetCredentialStore(environment.name, environment.cacheNamespace);
    const expiredHandler = new SessionExpiredHandler();
    const httpClient = new HttpClient(authInterceptor, expiredHandler);
    this.httpClient = httpClient;
    this.fileImages = new FileImageService(httpClient);
    this.apiService = new ApiService(httpClient);
    this.sessionManager = new AuthSessionManager(httpClient, credentialStore, environment.name, this.apiService);
    expiredHandler.bind(this.sessionManager);
    this.restoreVersion = this.sessionManager.getSessionVersion();
  }

  bindContext(context: common.UIAbilityContext): void { this.abilityContext = context; }
  hasRequiredPrivacyConsent(): boolean { return !this.privacySuspended && this.abilityContext !== undefined && PrivacyConsentStore.hasCurrentConsent(this.abilityContext); }
  canUseBusinessNetwork(): boolean { return this.hasRequiredPrivacyConsent(); }
  observePrivacyAccess(listener: () => void): void { this.privacyListeners.add(listener); }
  unobservePrivacyAccess(listener: () => void): void { this.privacyListeners.delete(listener); }
  private notifyPrivacy(): void { Array.from(this.privacyListeners).forEach((listener: () => void) => { try { listener(); } catch (_) {} }); }
  preparePrivacyIdentity(): void {
    if (!this.hasRequiredPrivacyConsent() || this.abilityContext === undefined) { throw new Error('请先完成隐私授权'); }
    this.setDeviceId(DeviceIdentityStore.getOrCreate(this.abilityContext));
  }
  acceptRequiredPrivacyConsent(): void {
    if (this.abilityContext === undefined) { throw new Error('隐私授权上下文不可用'); }
    PrivacyConsentStore.acceptCurrent(this.abilityContext, Date.now());
    this.privacySuspended = false;
    this.setDeviceId(DeviceIdentityStore.getOrCreate(this.abilityContext)); this.notifyPrivacy();
  }
  withdrawRequiredPrivacyConsent(): void {
    if (this.abilityContext === undefined) { throw new Error('隐私授权上下文不可用'); }
    this.privacySuspended = true; this.httpClient.cancelAllRequests();
    try { PrivacyConsentStore.clear(this.abilityContext); } finally { this.notifyPrivacy(); }
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

  private async restoreAndRelease(version: number): Promise<void> {
    try {
      await this.sessionManager.restore(version);
    } finally {
      this.restorePromise = undefined;
    }
  }
}
