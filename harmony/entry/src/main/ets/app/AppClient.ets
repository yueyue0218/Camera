import { common } from '@kit.AbilityKit';
import { EnvironmentConfig } from '../common/config/EnvironmentConfig';
import { AuthSessionManager } from '../auth/AuthSessionManager';
import { ApiService } from '../network/ApiService';
import { FileImageService } from '../network/FileImageService';
import { AuthInterceptor } from '../network/AuthInterceptor';
import { AuthenticationExpiredHandler, HttpClient } from '../network/HttpClient';
import { AssetCredentialStore } from '../storage/AssetCredentialStore';
import { DeviceIdentityStore } from '../storage/DeviceIdentityStore';
import { PrivacyConsentStore, PrivacyConsentSnapshot, CROSS_BORDER_CONSENT_VERSION,
  PRIVACY_POLICY_VERSION } from '../privacy/PrivacyConsentStore';
import { PrivacyRequestGuard } from '../privacy/PrivacyRequestGuard';
import { PrivacyApi, ServerConsent, ConsentUpdate } from '../privacy/PrivacyApi';
import { ConversationDraftStore } from '../features/conversation/ConversationDraftStore';
import { QuoteDraftStore } from '../features/conversation/QuoteDraftStore';
import { AftercareDraftStore } from '../features/aftercare/AftercareDraftStore';

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
  readonly privacyApi: PrivacyApi;
  private readonly httpClient: HttpClient;
  private readonly privacyGuard: PrivacyRequestGuard;
  private readonly privacyRestrictions: Set<() => void> = new Set<() => void>();
  private restorePromise?: Promise<void>;
  private restoreStarted: boolean = false;
  private restoreVersion: number = 0;
  private deviceId: string = '';
  private abilityContext?: common.UIAbilityContext;
  private explicitConsentAt: number = 0;

  private constructor() {
    const environment = EnvironmentConfig.current();
    const authInterceptor = new AuthInterceptor();
    const credentialStore = new AssetCredentialStore(environment.name, environment.cacheNamespace);
    const expiredHandler = new SessionExpiredHandler();
    this.privacyGuard = new PrivacyRequestGuard(() => this.consentEvidence(), () => {
      this.privacyRestrictions.forEach((listener: () => void) => listener());
    });
    const httpClient = new HttpClient(authInterceptor, expiredHandler, this.privacyGuard);
    this.httpClient = httpClient;
    this.privacyApi = new PrivacyApi(httpClient);
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
    this.explicitConsentAt = acceptedAtEpochMs;
  }

  observePrivacyRestriction(listener: () => void): void { this.privacyRestrictions.add(listener); }
  unobservePrivacyRestriction(listener: () => void): void { this.privacyRestrictions.delete(listener); }
  observePrivacyAccess(listener: () => void): void { this.privacyGuard.observe(listener); }
  unobservePrivacyAccess(listener: () => void): void { this.privacyGuard.unobserve(listener); }
  canUseBusinessNetwork(): boolean { return this.privacyGuard.allowed(this.sessionManager.isAuthenticated()); }

  private consentEvidence(): PrivacyConsentSnapshot {
    return this.abilityContext === undefined ? {
      current: false, acceptedAtEpochMs: 0, crossBorderConsentVersion: CROSS_BORDER_CONSENT_VERSION,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION, installationId: '', status: 'NOT_RECORDED', pendingServerGrant: false,
      consentType: 'CROSS_BORDER_HK', statusChangedAtEpochMs: 0
    } : PrivacyConsentStore.read(this.abilityContext);
  }

  private consentUpdate(status: string): ConsentUpdate {
    const value = this.consentEvidence();
    return { status: status, privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      crossBorderConsentVersion: CROSS_BORDER_CONSENT_VERSION,
      installationId: value.installationId || this.deviceId, acceptedAtEpochMs: value.acceptedAtEpochMs };
  }

  async synchronizePrivacyConsent(): Promise<void> {
    if (!this.sessionManager.isAuthenticated()) { this.privacyGuard.verified(); return; }
    const version = this.sessionManager.getSessionVersion();
    let result = await this.privacyApi.consent();
    if (version !== this.sessionManager.getSessionVersion()) { throw new Error('登录身份已变化，请重试'); }
    const value = this.consentEvidence();
    // Only a new explicit checkbox action may grant; startup must respect remote withdrawal.
    if (value.current && value.pendingServerGrant &&
      (result.status !== 'WITHDRAWN' || this.explicitConsentAt === value.acceptedAtEpochMs)) {
      result = await this.privacyApi.updateConsent(this.consentUpdate('GRANTED'));
      if (version !== this.sessionManager.getSessionVersion()) { throw new Error('登录身份已变化，请重试'); }
    }
    if (result.status !== 'GRANTED' || result.crossBorderConsentVersion !== CROSS_BORDER_CONSENT_VERSION ||
      result.privacyPolicyVersion !== PRIVACY_POLICY_VERSION) {
      this.privacyGuard.violate();
      PrivacyConsentStore.recordStatus(this.requireContext(), result.status === 'WITHDRAWN' ? 'WITHDRAWN' : 'NOT_RECORDED');
      throw new Error('请重新确认中国香港个人信息出境授权');
    }
    PrivacyConsentStore.acknowledgeServer(this.requireContext());
    this.privacyGuard.verified();
  }

  async withdrawRequiredPrivacyConsent(): Promise<ServerConsent> {
    this.privacyGuard.suspend();
    this.httpClient.cancelAllRequests();
    // Keep authentication for necessary rights channels; withdrawal is a server operation.
    const result = await this.privacyApi.updateConsent(this.consentUpdate('WITHDRAWN'));
    if (result.status !== 'WITHDRAWN') { throw new Error('服务端尚未确认撤回，请查询状态后重试'); }
    PrivacyConsentStore.recordStatus(this.requireContext(), 'WITHDRAWN');
    return result;
  }

  recordPrivacyRefusal(): void {
    this.privacyGuard.suspend();
    PrivacyConsentStore.recordStatus(this.requireContext(), 'DENIED');
  }

  async restoreForPrivacyRights(): Promise<void> {
    if (this.deviceId.length === 0) { this.deviceId = this.consentEvidence().installationId; }
    await this.restoreSession();
  }

  async finishAccountClosure(): Promise<void> {
    this.privacyGuard.suspend();
    this.httpClient.cancelAllRequests();
    await this.sessionManager.markExpired();
    this.privacyGuard.verified();
  }

  bootstrapAfterPrivacyConsent(): Promise<void> {
    const context = this.requireContext();
    if (!PrivacyConsentStore.hasCurrentConsent(context)) {
      return Promise.reject(new Error('Current privacy consent is required'));
    }
    ConversationDraftStore.configure(context);
    QuoteDraftStore.configure(context);
    AftercareDraftStore.configure(context);
    if (this.deviceId.length === 0) {
      this.setDeviceId(DeviceIdentityStore.getOrCreate(context));
    }
    return this.restoreSession().then(() => this.synchronizePrivacyConsent());
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
