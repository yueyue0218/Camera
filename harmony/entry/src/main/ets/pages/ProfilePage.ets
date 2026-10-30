import { ProvinceLocation } from '../common/location/ProvinceLocation';
import { common } from '@kit.AbilityKit';
import { UiPerf } from '../common/performance/UiPerf';
import { ProfileIdentity } from '../features/user/ProfileIdentity';
import { ProfileHeader } from '../features/user/ProfileHeader';
import { ProfileWorkspace } from '../features/user/ProfileWorkspace';
import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraImage } from '../common/components/PortraImage';
import { ContentChanges } from '../features/user/ContentChanges';
import { PortraButton } from '../common/components/PortraButton';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { MomentCard } from '../features/moments/MomentCard';
import { MomentFeedFormatter } from '../features/moments/MomentFeedModels';
import { AccountCancellationSummary, DemandSummary, MomentSummary, OrderSummary, ServicePackageSummary, SocialUserBrief, UserProfileSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import {
  CROSS_BORDER_CONSENT_SECTIONS,
  CROSS_BORDER_CONSENT_TITLE,
  LegalDocumentKind,
  LegalSection,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
  USER_AGREEMENT_SECTIONS,
  USER_AGREEMENT_TITLE
} from '../privacy/LegalDocumentContent';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct ProfilePage {
  @Prop @Watch('refreshTab') activeTab: boolean = true;
  @Prop @Watch('refreshTab') sessionEpoch: number = 0;
  private loadedSessionVersion: number = -1;
  @State private section: string = 'home';
  private readonly detailScroller: Scroller = new Scroller();
  @State private socialError: string = '';
  @State private contentTab: string = 'primary';
  @State private interests: ServicePackageSummary[] = [];
  @State private recentDemand: DemandSummary | undefined = undefined;
  @State private previewDemands: DemandSummary[] = [];
  @State private previewServices: ServicePackageSummary[] = [];
  @State private recentService: ServicePackageSummary | undefined = undefined;
  @State private myPublishedTotal: number | undefined = undefined;
  @State private myOrderTotal: number | undefined = undefined;
  @State private completedOrderTotal: number | undefined = undefined;
  @State private ongoingOrderTotal: number | undefined = undefined;
  @State private interestError: string = '';
  @State private interestLoading: boolean = false;
  private interestGeneration: number = 0;
  @State private interestTotal: number = 0;
  @State private interestPage: number = 0;
  @State private favoriteLoaded: boolean = false;
  @State private socialLoaded: boolean = false;
  private readonly changed: (kind?: string) => void = (kind?: string) => {
    if (!this.activeTab || this.section === 'settings') { return; }
    if (kind === 'relations') { this.loadSocial(); } else { this.load(false); }
  };
  private socialGeneration: number = 0;

  private refreshTab(): void {
    if (this.activeTab && this.loadedSessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
      this.load();
    }
  }

  @State private loading: boolean = true;
  @State private signingOut: boolean = false;
  @State private switchingRole: boolean = false;
  @State private roleSwitchError: string = '';
  @State private partialProfile: boolean = false;
  @State private nickname: string = '';
  @State private role: string = '';
  @State private userId: number = 0;
  @State private errorMessage: string = '';
  @State private requiresLogin: boolean = false;
  @State private signOutCleanupFailed: boolean = false;
  @State private profile: UserProfileSummary | null = null;
  @State private moments: MomentSummary[] = [];
  @State private favorites: MomentSummary[] = [];
  @State private likedMoments: MomentSummary[] = [];
  @State private likedPage: number = 1;
  @State private likedTotal: number = 0;
  @State private likedLoading: boolean = false;
  @State private likedError: string = '';
  private likedGeneration: number = 0;
  @State private followers: SocialUserBrief[] = [];
  @State private following: SocialUserBrief[] = [];
  @State private momentPage: number = 1;
  @State private momentTotal: number = 0;
  @State private favoritePage: number = 1;
  @State private favoriteTotal: number = 0;
  @State private loadingMoreMoments: boolean = false;
  @State private loadingMoreFavorites: boolean = false;
  @State private activeLegalDocument: LegalDocumentKind = LegalDocumentKind.NONE;
  @State private withdrawalConfirmVisible: boolean = false;
  @State private withdrawingConsent: boolean = false;
  @State private cancellationInfoVisible: boolean = false;
  @State private privacyActionError: string = '';
  @State private cancellationLoading: boolean = false;
  @State private cancellationSubmitting: boolean = false;
  @State private cancellationReason: string = '';
  @State private cancellationStatus: string = 'NOT_REQUESTED';
  @State private cancellationRequestedAt: string = '';
  @State private cancellationResolutionNote: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  private loadVersion: number = 0;
  private cancellationRequestVersion: number = 0;
  private roleSwitchVersion: number = 0;
  onBack?: () => void;
  onSignedOut?: () => void;
  onIdentityChanged?: () => void;
  onRequireLogin?: () => void;
  onOpenCredit?: () => void;
  onOpenOrders?: () => void;
  onOpenMessages?: () => void;
  onOpenPublish?: () => void;
  onOpenDemand?: (id: number) => void;
  onOpenService?: (id: number) => void;
  onOpenMoment?: (id: number) => void;
  onOpenAuthor?: (id: number, role: string) => void;
  onEditDemand?: (id: number) => void;
  onEditService?: (id: number) => void;
  onPrivacyConsentWithdrawn?: () => void;

  @State private locatedRegionLabel: string = '尚未定位';
  private readonly locationChanged: () => void = () => this.readLocatedRegion();
  private readLocatedRegion(): void {
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    this.locatedRegionLabel = ProvinceLocation.cached(context)?.label() ?? '尚未定位';
  }
  aboutToAppear(): void {
    ProvinceLocation.observe(this.locationChanged);
    this.readLocatedRegion();
    ProvinceLocation.refreshAuthorized(this.getUIContext().getHostContext() as common.UIAbilityContext);
    this.signingOut = false;
    this.switchingRole = false;
    ContentChanges.observe(this.changed);
    this.load();
  }

  aboutToDisappear(): void {
    ProvinceLocation.unobserve(this.locationChanged);
    this.loadVersion++;
    this.socialGeneration++;
    this.cancellationRequestVersion++;
    this.roleSwitchVersion++;
    this.interestGeneration++;
    this.likedGeneration++;
    ContentChanges.unobserve(this.changed);
    this.appClient.apiService.cancelCurrentSession();
    this.appClient.apiService.cancelUserSystemRequests(this.userId);
    this.appClient.apiService.cancelAccountCancellationRequests();
  }

  private async load(resetNavigation: boolean = true): Promise<void> {
    this.socialGeneration++;
    this.loadedSessionVersion = this.appClient.sessionManager.getSessionVersion();
    this.signingOut = false;
    const version = ++this.loadVersion;
    const sessionVersion = this.appClient.sessionManager.getSessionVersion();
    this.loading = true;
    this.errorMessage = '';
    this.roleSwitchError = '';
    this.partialProfile = false;
    this.requiresLogin = false;
    this.signOutCleanupFailed = false;
    this.nickname = '';
    this.interestGeneration++;
    this.likedGeneration++;
    this.likedMoments = [];
    this.likedPage = 1;
    this.likedTotal = 0;
    this.likedLoading = false;
    this.likedError = '';
    this.interests = [];
    this.recentDemand = undefined;
    this.previewDemands = [];
    this.previewServices = [];
    this.recentService = undefined;
    this.myPublishedTotal = undefined;
    this.myOrderTotal = undefined;
    this.completedOrderTotal = undefined;
    this.ongoingOrderTotal = undefined;
    this.interestTotal = 0;
    this.interestError = '';
    if (resetNavigation) { this.section = 'home'; this.contentTab = 'primary'; }
    this.role = '';
    this.userId = 0;
    this.profile = null;
    this.moments = [];
    this.favorites = [];
    this.followers = [];
    this.following = [];
    this.loadingMoreMoments = false;
    this.loadingMoreFavorites = false;
    this.momentPage = 1;
    this.momentTotal = 0;
    this.favoritePage = 1;
    this.favoriteTotal = 0;
    this.favoriteLoaded = false;
    this.socialLoaded = false;
    this.socialError = '';
    try {
      let profile: UserProfileSummary;
      let degraded = false;
      try {
        profile = await UiPerf.request('profile.identity', () => this.appClient.apiService.getMyProfile());
      } catch (error) {
        const failure = error as PortraError;
        if (!this.appClient.sessionManager.isAuthenticated() ||
          failure.httpStatus === 401 || failure.businessCode === 40101 ||
          failure.kind === 'stale') {
          throw failure;
        }
        // Recover only identity fields confirmed by the real /auth/session API.
        // Credit, avatar, biography, records and privileges are NOT invented.
        const session = await this.appClient.apiService.currentSession('profile.identityRecovery', false);
        profile = { id: session.userId, nickname: session.nickname, currentRole: session.role };
        degraded = true;
      }
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (profile === null || !Number.isSafeInteger(profile.id) || profile.id <= 0 ||
        (profile.currentRole !== 'CUSTOMER' && profile.currentRole !== 'PROVIDER')) {
        throw new Error('个人资料格式异常');
      }
      this.profile = profile;
      UiPerf.mark('profile.identity.ready');
      this.role = profile.currentRole;
      this.userId = profile.id;
      this.nickname = this.profileNickname(profile);
      this.partialProfile = degraded;
      // Keep the validated identity usable when the larger /users/me payload is
      // unavailable; do not turn a partial read into a fake complete profile.
      this.loading = false;
      if (degraded) {
        this.errorMessage = '个人档案接口暂不可用；当前仅显示服务器确认的身份，资料和统计待恢复。';
        return;
      }

      this.loadSocial();
      // The workspace preview comes from the same authenticated page API as management.
      try {
        if (profile.currentRole === 'CUSTOMER') {
          const published = await this.appClient.apiService.listMyDemands(1);
          if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
          if (!Array.isArray(published.records) || !Number.isSafeInteger(published.total) || published.total < 0 ||
            published.records.some((row: DemandSummary) => row.customerId !== profile.id)) { throw new Error('需求记录异常'); }
          this.myPublishedTotal = published.total;
          this.previewDemands = published.records.slice(0, 2);
          this.recentDemand = published.records.length > 0 ? published.records[0] : undefined;
        } else {
          const published = await this.appClient.apiService.listMyServices(1);
          if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
          if (!Array.isArray(published.records) || !Number.isSafeInteger(published.total) || published.total < 0 ||
            published.records.some((row: ServicePackageSummary) => row.providerId !== profile.id)) { throw new Error('橱窗记录异常'); }
          this.myPublishedTotal = published.total;
          this.previewServices = published.records.slice(0, 2);
          this.recentService = published.records.length > 0 ? published.records[0] : undefined;
        }
      } catch (error) {
        if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
        this.errorMessage = (error as PortraError).message || '发布记录暂不可用';
      }

      try {
        const orders = await this.appClient.apiService.listOrders(profile.currentRole, 'profile.orders');
        if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (!Array.isArray(orders) || orders.some((item: OrderSummary) =>
          !Number.isSafeInteger(item.orderId) || item.orderId <= 0)) { throw new Error('订单概览格式异常'); }
        this.myOrderTotal = orders.length;
        this.completedOrderTotal = orders.filter((item: OrderSummary) => item.status === 'COMPLETED').length;
        this.ongoingOrderTotal = orders.filter((item: OrderSummary) =>
          item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && item.status !== 'REFUNDED').length;
      } catch (error) {
        if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
        this.errorMessage = (error as PortraError).message || '订单概览暂不可用';
      }

      // The identity card is authoritative even if an optional gallery request fails.
      try {
        const momentPage = await this.appClient.apiService.listProfileMoments(profile.id, profile.currentRole, 1, 6);
        if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (!Array.isArray(momentPage.records) || !Number.isSafeInteger(momentPage.total) || momentPage.total < 0 ||
          momentPage.records.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item) ||
            item.authorId !== profile.id || item.authorRole !== profile.currentRole)) {
          throw new Error('用户动态格式异常');
        }
        this.moments = MomentFeedFormatter.deduplicate(momentPage.records);
        this.momentTotal = momentPage.total;
      } catch (error) {
        if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (version === this.loadVersion && sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
          this.errorMessage = (error as PortraError).message || '动态读取失败';
        }
      }
      try {
        const favoritePage = await this.appClient.apiService.listFavoriteMoments(1, 4);
        if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (!Array.isArray(favoritePage.records) || !Number.isSafeInteger(favoritePage.total) || favoritePage.total < 0 ||
          favoritePage.records.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item))) {
          throw new Error('收藏列表格式异常');
        }
        this.favorites = MomentFeedFormatter.deduplicate(favoritePage.records);
        this.favoriteTotal = favoritePage.total;
        this.favoriteLoaded = true;
      } catch (error) {
        if (version !== this.loadVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (version === this.loadVersion && sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
          this.errorMessage = (error as PortraError).message || '收藏读取失败';
        }
      }
      if (this.section === 'intent' && profile.currentRole === 'CUSTOMER' &&
        version === this.loadVersion && sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
        this.loadInterests();
      }
      if (this.section === 'likes' && version === this.loadVersion &&
        sessionVersion === this.appClient.sessionManager.getSessionVersion()) { this.loadLikes(); }
    } catch (error) {
      if (version === this.loadVersion &&
        sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
        const mapped = error as PortraError;
        this.requiresLogin = mapped.httpStatus === 401 || mapped.businessCode === 40101;
        this.errorMessage = this.safeErrorLabel(error, '资料加载失败，请稍后重试');
      }
    } finally {
      if (version === this.loadVersion) {
        this.loading = false;
        if (sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
          this.profile = null;
          this.moments = [];
          this.favorites = [];
          this.followers = [];
          this.following = [];
          this.nickname = '';
          this.role = '';
          this.userId = 0;
          this.requiresLogin = !this.appClient.sessionManager.isAuthenticated();
          this.errorMessage = '账号状态已变化，请重新读取资料';
        }
      }
    }
  }

  private profileNickname(profile: UserProfileSummary): string {
    const roleName = profile.currentRole === 'PROVIDER' ? profile.providerNickname : profile.customerNickname;
    const value = roleName?.trim() || profile.nickname?.trim() || '';
    return value.length > 0 ? value : 'Portra 用户';
  }

  private profileBio(): string {
    if (this.profile === null) {
      return '';
    }
    const roleBio = this.role === 'PROVIDER' ? this.profile.providerBio : this.profile.customerBio;
    return roleBio?.trim() || this.profile.bio?.trim() || '';
  }

  private profileLocationLine(): string { return this.locatedRegionLabel; }

  private mergeSocialUsers(first: SocialUserBrief[], second: SocialUserBrief[]): SocialUserBrief[] {
    const result: SocialUserBrief[] = [];
    first.concat(second).forEach((item: SocialUserBrief) => {
      if (item !== null && Number.isSafeInteger(item.userId) && item.userId > 0 &&
        !result.some((current: SocialUserBrief) => current.userId === item.userId &&
          current.currentRole === item.currentRole)) {
        result.push(item);
      }
    });
    return result;
  }

  private async loadSocial(): Promise<void> {
    const generation = ++this.socialGeneration;
    const started = Date.now();
    UiPerf.mark('profile.relations.start');
    const epoch = this.appClient.sessionManager.getSessionVersion();
    const userId = this.userId, role = this.role;
    if (userId <= 0) { return; }
    this.socialError = '';
    try {
      const followers = await this.appClient.apiService.listFollowers(userId, role);
      if (generation !== this.socialGeneration || epoch !== this.appClient.sessionManager.getSessionVersion()) { return; }
      const customers = await this.appClient.apiService.listFollowing(userId, 'CUSTOMER');
      if (generation !== this.socialGeneration || epoch !== this.appClient.sessionManager.getSessionVersion()) { return; }
      const providers = await this.appClient.apiService.listFollowing(userId, 'PROVIDER');
      if (generation !== this.socialGeneration || epoch !== this.appClient.sessionManager.getSessionVersion() ||
        userId !== this.userId || role !== this.role) { return; }
      if (!Array.isArray(followers) || !Array.isArray(customers) || !Array.isArray(providers)) {
        throw new Error('关注列表格式异常');
      }
      this.followers = this.validSocialUsers(followers);
      this.following = this.mergeSocialUsers(this.validSocialUsers(customers), this.validSocialUsers(providers));
      this.socialLoaded = true;
      UiPerf.elapsed('profile.relations.ready', started);
    } catch (error) {
      if (generation === this.socialGeneration && epoch === this.appClient.sessionManager.getSessionVersion() &&
        userId === this.userId && role === this.role) {
        this.socialError = (error as PortraError).message || '关注信息读取失败';
      }
    }
  }

  private validSocialUsers(source: SocialUserBrief[]): SocialUserBrief[] {
    if (!Array.isArray(source)) {
      return [];
    }
    return source.filter((item: SocialUserBrief) => item !== null && Number.isSafeInteger(item.userId) &&
      item.userId > 0 && (item.currentRole === 'CUSTOMER' || item.currentRole === 'PROVIDER'));
  }

  private async loadMoreMoments(): Promise<void> {
    if (this.loadingMoreMoments || this.userId <= 0 || this.moments.length >= this.momentTotal) {
      return;
    }
    this.loadingMoreMoments = true;
    this.errorMessage = '';
    const version = this.loadVersion;
    const sessionVersion = this.appClient.sessionManager.getSessionVersion();
    const nextPage = this.momentPage + 1;
    try {
      const result = await this.appClient.apiService.listProfileMoments(this.userId, this.role, nextPage, 6);
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (!Array.isArray(result.records) ||
        result.records.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item))) {
        throw new Error('用户动态格式异常');
      }
      this.moments = MomentFeedFormatter.deduplicate(this.moments.concat(result.records));
      this.momentPage = nextPage;
      this.momentTotal = result.total;
    } catch (error) {
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      this.errorMessage = (error as PortraError).message || '更多动态加载失败';
    } finally {
      if (version === this.loadVersion) {
        this.loadingMoreMoments = false;
      }
    }
  }

  private async loadMoreFavorites(): Promise<void> {
    if (this.loadingMoreFavorites || this.favorites.length >= this.favoriteTotal) {
      return;
    }
    this.loadingMoreFavorites = true;
    this.errorMessage = '';
    const version = this.loadVersion;
    const sessionVersion = this.appClient.sessionManager.getSessionVersion();
    const nextPage = this.favoritePage + 1;
    try {
      const result = await this.appClient.apiService.listFavoriteMoments(nextPage, 4);
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (!Array.isArray(result.records) ||
        result.records.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item))) {
        throw new Error('收藏列表格式异常');
      }
      this.favorites = MomentFeedFormatter.deduplicate(this.favorites.concat(result.records));
      this.favoritePage = nextPage;
      this.favoriteTotal = result.total;
    } catch (error) {
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      this.errorMessage = (error as PortraError).message || '更多收藏加载失败';
    } finally {
      if (version === this.loadVersion) {
        this.loadingMoreFavorites = false;
      }
    }
  }

  // Display only HTTP/business status codes, never response bodies or credentials.
  private safeErrorLabel(error: Object, fallback: string): string {
    const failure = error as PortraError;
    const message = failure.message || fallback;
    if (Number.isInteger(failure.businessCode) && failure.businessCode > 0) {
      return `${message}（业务码 ${failure.businessCode}）`;
    }
    if (Number.isInteger(failure.httpStatus) && failure.httpStatus > 0) {
      return `${message}（HTTP ${failure.httpStatus}）`;
    }
    return message;
  }

  private async switchRole(): Promise<void> {
    if (this.switchingRole) { return; }
    if (this.role !== 'CUSTOMER' && this.role !== 'PROVIDER') {
      this.roleSwitchError = '当前身份尚未加载成功，请重新读取账号资料。';
      return;
    }
    const targetRole = this.role === 'PROVIDER' ? 'CUSTOMER' : 'PROVIDER';
    const roleOperation = ++this.roleSwitchVersion;
    const switchingUserId = this.userId;
    let sessionVersion = this.appClient.sessionManager.getSessionVersion();
    this.switchingRole = true;
    this.errorMessage = '';
    this.roleSwitchError = '';
    try {
      const result = await this.appClient.apiService.switchRole(targetRole);
      if (roleOperation !== this.roleSwitchVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (result === null || result.id !== switchingUserId || result.currentRole !== targetRole) {
        throw new Error('角色切换结果异常');
      }
      if (!await this.appClient.sessionManager.notifyIdentityChanged()) {
        if (roleOperation === this.roleSwitchVersion) {
          this.roleSwitchError = '服务端已响应切换，但本地登录状态发生变化；请重新登录核对身份。';
        }
        return;
      }
      // notifyIdentityChanged advances exactly one generation. Do not load for
      // another account if it changed again while this continuation was queued.
      if (roleOperation !== this.roleSwitchVersion ||
        this.appClient.sessionManager.getSessionVersion() !== sessionVersion + 1) {
        return;
      }
      sessionVersion = this.appClient.sessionManager.getSessionVersion();
      // Mark the new identity generation before notifying the shell so the @Watch callback
      // does not start a duplicate profile load. The shell refreshes Hall/Message tabs too.
      this.loadedSessionVersion = sessionVersion;
      this.onIdentityChanged?.();
      await this.load();
    } catch (error) {
      if (roleOperation !== this.roleSwitchVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      this.roleSwitchError = this.safeErrorLabel(error, '角色切换失败');
      this.errorMessage = this.roleSwitchError;
    } finally {
      if (roleOperation === this.roleSwitchVersion) {
        this.switchingRole = false;
      }
    }
  }

  private openSection(section: string): void {
    UiPerf.mark('profile.click.' + section);
    if (section === 'credit') { this.onOpenCredit?.(); return; }
    if (section === 'orders') { this.onOpenOrders?.(); return; }
    if (section === 'messages') { this.onOpenMessages?.(); return; }
    if (section === 'intent' && this.role !== 'CUSTOMER') { return; }
    this.section = section;
    this.detailScroller.scrollTo({ xOffset: 0, yOffset: 0 });
    if (section === 'intent') { this.loadInterests(); }
    if (section === 'likes') { this.loadLikes(); }
  }

  private async loadInterests(append: boolean = false): Promise<void> {
    if (append && this.interestLoading) { return; }
    const page = append ? this.interestPage + 1 : 1;
    const generation = ++this.interestGeneration;
    const epoch = this.appClient.sessionManager.getSessionVersion();
    this.interestLoading = true;
    this.interestError = '';
    if (!append) { this.interests = []; this.interestPage = 0; this.interestTotal = 0; }
    try {
      const result = await this.appClient.apiService.listServicePackageInterests(page, 20);
      if (generation !== this.interestGeneration || epoch !== this.appClient.sessionManager.getSessionVersion()) { return; }
      if (result.page !== page || !Array.isArray(result.records) || !Number.isSafeInteger(result.total) || result.total < 0 ||
        result.records.some((item: ServicePackageSummary) => !Number.isSafeInteger(item.serviceId) || item.serviceId <= 0)) {
        throw new Error('意向列表格式异常');
      }
      this.interests = this.interests.concat(result.records.filter((item: ServicePackageSummary) =>
        !this.interests.some((existing: ServicePackageSummary) => existing.serviceId === item.serviceId)));
      this.interestPage = page;
      this.interestTotal = result.total;
    } catch (error) {
      if (generation === this.interestGeneration && epoch === this.appClient.sessionManager.getSessionVersion()) {
        this.interestError = (error as PortraError).message || '意向列表读取失败';
      }
    } finally { if (generation === this.interestGeneration) { this.interestLoading = false; } }
  }

  private async loadLikes(append: boolean = false): Promise<void> {
    if (append && this.likedLoading) { return; }
    const generation = ++this.likedGeneration;
    const epoch = this.appClient.sessionManager.getSessionVersion();
    const page = append ? this.likedPage + 1 : 1;
    this.likedLoading = true;
    this.likedError = '';
    if (!append) { this.likedMoments = []; this.likedPage = 1; this.likedTotal = 0; }
    try {
      const result = await this.appClient.apiService.listLikedMoments(page, 12);
      if (generation !== this.likedGeneration || epoch !== this.appClient.sessionManager.getSessionVersion()) { return; }
      if (result === null || !Array.isArray(result.records) || result.page !== page ||
        !Number.isSafeInteger(result.total) || result.total < 0 ||
        result.records.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item) ||
          !item.likedByCurrentUser)) { throw new Error('点赞记录格式异常'); }
      this.likedMoments = MomentFeedFormatter.deduplicate(this.likedMoments.concat(result.records));
      this.likedPage = page;
      this.likedTotal = result.total;
    } catch (error) {
      if (generation === this.likedGeneration && epoch === this.appClient.sessionManager.getSessionVersion()) {
        this.likedError = (error as PortraError).message || '点赞记录读取失败';
      }
    } finally { if (generation === this.likedGeneration) { this.likedLoading = false; } }
  }

  private sectionTitle(): string {
    switch (this.section) {
      case 'settings': return '资料与设置';
      case 'following': return '我的关注';
      case 'followers': return '我的粉丝';
      case 'collections': return '我的收藏';
      case 'likes': return '我的点赞';
      case 'intent': return '我的意向';
      case 'works': return this.role === 'PROVIDER' ? '我的作品集' : '我的动态';
      case 'identity': return '使用身份';
      case 'demands': return this.role === 'PROVIDER' ? '橱窗管理' : '我的需求';
      case 'privacy': return '隐私与协议';
    }
    return '我的';
  }

  private roleAvatarId(): number {
    return (this.role === 'PROVIDER' ? this.profile?.providerAvatarFileId :
      this.profile?.customerAvatarFileId) ?? this.profile?.avatarFileId ?? 0;
  }

  private roleLabel(): string {
    if (this.role === 'PROVIDER') {
      return '摄影师';
    }
    if (this.role === 'CUSTOMER') {
      return '约拍用户';
    }
    return '用户';
  }

  private legalDocumentTitle(): string {
    if (this.activeLegalDocument === LegalDocumentKind.USER_AGREEMENT) {
      return USER_AGREEMENT_TITLE;
    }
    if (this.activeLegalDocument === LegalDocumentKind.PRIVACY_POLICY) {
      return PRIVACY_POLICY_TITLE;
    }
    return CROSS_BORDER_CONSENT_TITLE;
  }

  private legalDocumentSections(): LegalSection[] {
    if (this.activeLegalDocument === LegalDocumentKind.USER_AGREEMENT) {
      return USER_AGREEMENT_SECTIONS;
    }
    if (this.activeLegalDocument === LegalDocumentKind.PRIVACY_POLICY) {
      return PRIVACY_POLICY_SECTIONS;
    }
    return CROSS_BORDER_CONSENT_SECTIONS;
  }

  private async withdrawPrivacyConsent(): Promise<void> {
    if (this.withdrawingConsent) {
      return;
    }
    this.withdrawingConsent = true;
    this.privacyActionError = '';
    const signedOut = await this.appClient.sessionManager.signOut();
    if (!signedOut) {
      this.privacyActionError = '本机登录信息清除失败，尚未撤回，请重试';
      this.withdrawingConsent = false;
      return;
    }
    try {
      this.appClient.withdrawRequiredPrivacyConsent();
      this.onPrivacyConsentWithdrawn?.();
    } catch {
      this.privacyActionError = '同意记录清除失败，请检查设备存储后重试';
      this.withdrawingConsent = false;
    }
  }

  private openCancellationInformation(): void {
    this.cancellationInfoVisible = true;
    this.privacyActionError = '';
    this.loadCancellationStatus();
  }

  private closeCancellationInformation(): void {
    this.cancellationRequestVersion++;
    this.appClient.apiService.cancelAccountCancellationRequests();
    this.cancellationInfoVisible = false;
    this.privacyActionError = '';
  }

  private async loadCancellationStatus(): Promise<void> {
    const version = ++this.cancellationRequestVersion;
    this.cancellationLoading = true;
    this.privacyActionError = '';
    try {
      const result = await this.appClient.apiService.getAccountCancellation();
      if (version === this.cancellationRequestVersion) {
        this.applyCancellationSummary(result);
      }
    } catch (error) {
      if (version === this.cancellationRequestVersion) {
        this.privacyActionError = (error as PortraError).message || '注销申请状态加载失败，请重试';
      }
    } finally {
      if (version === this.cancellationRequestVersion) {
        this.cancellationLoading = false;
      }
    }
  }

  private async submitCancellationRequest(): Promise<void> {
    if (this.cancellationSubmitting ||
      this.cancellationStatus !== 'NOT_REQUESTED' && this.cancellationStatus !== 'REJECTED') {
      return;
    }
    const version = ++this.cancellationRequestVersion;
    this.cancellationSubmitting = true;
    this.privacyActionError = '';
    try {
      const result = await this.appClient.apiService.requestAccountCancellation(this.cancellationReason);
      if (version === this.cancellationRequestVersion) {
        this.applyCancellationSummary(result);
      }
    } catch (error) {
      if (version === this.cancellationRequestVersion) {
        this.privacyActionError = (error as PortraError).message || '注销申请提交失败，请重试';
      }
    } finally {
      if (version === this.cancellationRequestVersion) {
        this.cancellationSubmitting = false;
      }
    }
  }

  private applyCancellationSummary(summary: AccountCancellationSummary): void {
    const validStatus = summary !== null &&
      ['NOT_REQUESTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'].includes(summary.status);
    const validRequestId = summary.requestId === null || summary.requestId === undefined ||
      Number.isSafeInteger(summary.requestId) && (summary.requestId ?? 0) > 0;
    if (!validStatus || !validRequestId) {
      throw new Error('账号注销申请状态异常');
    }
    this.cancellationStatus = summary.status;
    this.cancellationReason = summary.reason?.trim() ?? '';
    this.cancellationRequestedAt = summary.requestedAt?.trim() ?? '';
    this.cancellationResolutionNote = summary.resolutionNote?.trim() ?? '';
  }

  private cancellationStatusLabel(): string {
    if (this.cancellationStatus === 'PENDING') { return '申请已提交，等待核验'; }
    if (this.cancellationStatus === 'PROCESSING') { return '申请正在处理中'; }
    if (this.cancellationStatus === 'COMPLETED') { return '账号注销已完成'; }
    if (this.cancellationStatus === 'REJECTED') { return '申请暂未通过'; }
    return '尚未提交注销申请';
  }

  private async signOut(): Promise<void> {
    if (this.signingOut) {
      return;
    }
    this.signingOut = true;
    this.roleSwitchVersion++;
    const viewVersion = ++this.loadVersion;
    this.profile = null;
    this.moments = [];
    this.favorites = [];
    this.followers = [];
    this.following = [];
    const signingOut = this.appClient.sessionManager.signOut();
    const sessionVersion = this.appClient.sessionManager.getSessionVersion();
    const cleared = await signingOut;
    if (viewVersion !== this.loadVersion ||
      sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
      return;
    }
    if (cleared) {
      this.onSignedOut?.();
      return;
    }
    this.errorMessage = '本机登录信息未能清除，请重试退出';
    this.signOutCleanupFailed = true;
    this.signingOut = false;
  }

  @Builder
  private MenuRow(title: string, subtitle: string, onAction: () => void) {
    Row({ space: 10 }) {
      Column({ space: 3 }) {
        Text(title)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.primaryText)
        Text(subtitle)
          .fontSize(11)
          .fontColor(PortraTheme.secondaryText)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      Text('›')
        .fontSize(22)
        .fontColor(PortraTheme.mutedText)
    }
    .width('100%')
    .height(67)
    .padding({ left: 18, right: 18 })
    .backgroundColor(PortraTheme.surface)
    .onClick(() => onAction())
  }

  @Builder
  private SocialPreview(title: string, items: SocialUserBrief[]) {
    Column({ space: 10 }) {
      Text(`${title} · ${items.length}`)
        .width('100%')
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
      if (items.length === 0) {
        Text('暂无记录')
          .width('100%')
          .fontSize(13)
          .fontColor(PortraTheme.secondaryText)
          .padding({ top: 8, bottom: 8 })
      } else {
        ForEach(items, (item: SocialUserBrief) => {
          Row({ space: 10 }) {
            PortraAvatar({ displayName: item.nickname ?? '', fileId: item.avatarFileId ?? 0, avatarSize: 36 })
            Column({ space: 3 }) {
              Text(item.nickname?.trim() || `用户 #${item.userId}`)
                .fontSize(14)
                .fontWeight(FontWeight.Medium)
                .fontColor(PortraTheme.primaryText)
              Text(item.currentRole === 'PROVIDER' ? '摄影师' : '约拍用户')
                .fontSize(11)
                .fontColor(PortraTheme.secondaryText)
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)
          }
          .width('100%')
          .constraintSize({ minHeight: 56 })
          .onClick(() => {
            if (item.userId === this.userId) { this.openSection('home'); }
            else { this.onOpenAuthor?.(item.userId, item.currentRole); }
          })
        }, (item: SocialUserBrief) => `${item.userId}-${item.currentRole}`)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(16)
    .backgroundColor(PortraTheme.surface)
    .borderRadius(8)
    .border({ width: 1, color: PortraTheme.border })
  }

  @Builder
  private MomentPreview(title: string, items: MomentSummary[]) {
    Column({ space: 12 }) {
      Text(title)
        .width('100%')
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
      if (items.length === 0) {
        Text('暂无内容')
          .width('100%')
          .fontSize(13)
          .fontColor(PortraTheme.secondaryText)
          .padding({ top: 8, bottom: 8 })
      } else {
        ForEach(items, (item: MomentSummary) => {
          MomentCard({ item: item, onOpenDetail: (moment: MomentSummary) => this.onOpenMoment?.(moment.momentId),
            onOpenAuthor: (moment: MomentSummary) => this.onOpenAuthor?.(moment.authorId, moment.authorRole) })
        }, (item: MomentSummary) => item.momentId.toString())
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  // v39 reference: profile-detail-header, 58px high, 16px horizontal inset.
  @Builder
  private SubviewHeader() {
    ProfileHeader({ title: this.sectionTitle(), onBack: () => this.section = 'home' })
  }

  // v39 identity statistics are inline, not full-width elevated blocks.
  @Builder
  private StatLink(value: string, label: string, destination: string) {
    Row({ space: 4 }) {
      Text(value).fontSize(14).fontWeight(FontWeight.Bold).fontColor('#2C2D31')
      Text(label).fontSize(10.5).fontColor('#87817B')
    }.padding(0).onClick(() => this.openSection(destination))
  }

  @Builder
  private BusinessStat(value: string, label: string, destination: string) {
    Column({ space: 4 }) {
      Text(value).fontSize(17).fontWeight(FontWeight.Bold).fontColor('#292A2E')
      Text(label).fontSize(10).fontColor('#8E8781')
    }.layoutWeight(1).alignItems(HorizontalAlign.Center)
      .justifyContent(FlexAlign.Center).height(64)
      .onClick(() => this.openSection(destination))
  }

  // v39 utility row: exactly one 52px surface strip on the home screen.
  @Builder
  private QuickLink(title: string, subtitle: string, destination: string) {
    Row({ space: 10 }) {
      Column({ space: 3 }) {
        Text(title).fontSize(11.5).fontWeight(FontWeight.Medium).fontColor('#3D3D41')
        Text(subtitle).fontSize(9.5).fontColor('#9A938D')
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Text('›').fontSize(18).fontColor('#AAA39D')
    }.width('100%').height(52).padding({ left: 13, right: 13 })
      .backgroundColor('#FFFDF9')
      .onClick(() => this.openSection(destination))
  }

  // Three columns with 4vp gaps and portrait cells, matching .profile-v38-grid.
  @Builder
  private PhotoArchive() {
    if (this.moments.length === 0) {
      Column({ space: 9 }) {
        Text('这里还没有公开动态').fontSize(12).fontColor(PortraTheme.secondaryText)
        Button('查看我的动态 ›').height(34).fontSize(12)
          .fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
          .onClick(() => this.openSection('works'))
      }.width('100%').padding({ top: 25, bottom: 25 })
    } else {
      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
        ForEach(this.moments, (item: MomentSummary) => {
          Column() {
            if (MomentFeedFormatter.images(item).length > 0) {
              PortraImage({ source: MomentFeedFormatter.images(item)[0], imageWidth: '100%',
                imageHeight: 154, cornerRadius: 0, fallbackText: '图片无法加载', allowInlineData: true,
                contentDescription: MomentFeedFormatter.title(item) })
            } else {
              Column() {
                Text(MomentFeedFormatter.title(item)).fontSize(11).maxLines(3)
                  .fontColor(PortraTheme.primaryText).textOverflow({ overflow: TextOverflow.Ellipsis })
              }.width('100%').height(154).justifyContent(FlexAlign.Center)
                .backgroundColor('#DDD8D2').padding(10)
            }
          }.width('32.5%').height(154).margin({ right: '0.8%', bottom: 4 })
            .onClick(() => this.onOpenMoment?.(item.momentId))
        }, (item: MomentSummary) => item.momentId.toString())
      }.width('100%').borderRadius(14).clip(true)
      if (this.moments.length < this.momentTotal) {
        Button('查看全部动态 ›').width('100%').height(36).fontSize(11)
          .fontColor(PortraTheme.primary).backgroundColor(Color.Transparent)
          .onClick(() => this.openSection('works'))
      }
    }
  }

  // The small archive on the second tab is not a full editable management list.
  // Management remains in the "我的需求 / 我的橱窗" subview.
  @Builder
  private DemandArchive() {
    Column({ space: 0 }) {
      if (this.role === 'CUSTOMER' && this.previewDemands.length > 0) {
        ForEach(this.previewDemands, (item: DemandSummary) => {
          Row({ space: 11 }) {
            PortraImage({ fileId: item.referenceFileIds?.[0] ?? 0,
              imageWidth: 64, imageHeight: 68, cornerRadius: 10,
              fallbackText: '约拍', contentDescription: '约拍需求封面' })
            Column({ space: 5 }) {
              Text(item.scene?.trim() || `约拍需求 #${item.demandId}`)
                .fontSize(12.5).fontWeight(FontWeight.Medium).fontColor('#313236')
                .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(item.cityCode ?? '地区未填写').fontSize(10).fontColor('#918A84')
              Text(item.status ?? '查看详情').fontSize(9.5).fontColor(PortraTheme.primary)
            }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          }.width('100%').height(88).padding({ left: 12, right: 12 })
            .onClick(() => this.onOpenDemand?.(item.demandId))
          Divider().strokeWidth(1).color('#EEE8E1')
        }, (item: DemandSummary) => item.demandId.toString())
      } else if (this.role === 'PROVIDER' && this.previewServices.length > 0) {
        ForEach(this.previewServices, (item: ServicePackageSummary) => {
          Row({ space: 11 }) {
            PortraImage({ source: item.coverImage ?? '', imageWidth: 64, imageHeight: 68,
              cornerRadius: 10, fallbackText: '橱窗', contentDescription: '橱窗封面' })
            Column({ space: 5 }) {
              Text(item.title?.trim() || `橱窗 #${item.serviceId}`)
                .fontSize(12.5).fontWeight(FontWeight.Medium).fontColor('#313236')
                .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(item.cityCode ?? '地区未填写').fontSize(10).fontColor('#918A84')
              Text(item.status ?? '查看详情').fontSize(9.5).fontColor(PortraTheme.primary)
            }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          }.width('100%').height(88).padding({ left: 12, right: 12 })
            .onClick(() => this.onOpenService?.(item.serviceId))
          Divider().strokeWidth(1).color('#EEE8E1')
        }, (item: ServicePackageSummary) => item.serviceId.toString())
      } else {
        Text(this.role === 'PROVIDER' ? '暂时没有橱窗' : '暂时没有约拍需求')
          .width('100%').textAlign(TextAlign.Center).height(82)
          .fontSize(12).fontColor('#918A84')
      }
      Button(this.role === 'PROVIDER' ? '管理全部橱窗 ›' : '管理全部约拍 ›')
        .height(36).width('100%').fontSize(11).fontColor(PortraTheme.primary)
        .backgroundColor(Color.Transparent).onClick(() => this.openSection('demands'))
    }.width('100%').backgroundColor('#FFFDF9')
      .border({ width: 1, color: '#E5DED7' }).borderRadius(16).clip(true)
  }

  @Builder
  private Home() {
    Column({ space: 0 }) {
      // The bottom nav and OS status bar are owned by the app shell.
      Row({ space: 5 }) {
        Text('我的').fontSize(24).fontWeight(FontWeight.Bold).fontColor('#292A2E')
          .layoutWeight(1)
        Button(this.switchingRole ? '…' : '⇄')
          .width(34).height(34).padding(0).fontSize(18)
          .fontColor('#625D58').backgroundColor('#FFFDF9')
          .borderRadius(11).border({ width: 1, color: '#DCD5CD' })
          .enabled(!this.switchingRole).accessibilityText('切换摄影师或约拍用户身份')
          .onClick(() => this.switchRole())
        Button('⚙').width(38).height(38).padding(0).fontSize(20)
          .fontColor('#625D58').backgroundColor(Color.Transparent)
          .accessibilityText('资料与设置')
          .onClick(() => this.openSection('settings'))
      }.width('100%').height(58).padding({ left: 16, right: 16 })
        .backgroundColor('#F6F3EE')
      if (this.roleSwitchError.length > 0) {
        Text(this.roleSwitchError).fontSize(12).fontColor(PortraTheme.danger)
          .width('100%').padding({ left: 16, right: 16, bottom: 8 })
      }
      if (this.partialProfile) {
        Row({ space: 8 }) {
          Text('资料暂不可用，身份已核实').fontSize(11).fontColor('#805E27').layoutWeight(1)
          Button('重试资料').height(30).fontSize(11).fontColor(PortraTheme.primary)
            .backgroundColor(Color.Transparent).onClick(() => this.load())
        }.width('100%').padding({ left: 16, right: 16, bottom: 6 })
      }
      Scroll() {
        Column({ space: 0 }) {
          ProfileIdentity({ nickname: this.nickname, userId: this.userId, avatarFileId: this.roleAvatarId(),
            identityLine: this.profileLocationLine(), bio: this.profileBio(), owner: true,
            creditLabel: this.profile?.creditScore === null || this.profile?.creditScore === undefined ? '—' : `${this.profile?.creditScore}`,
            onEdit: () => this.openSection('settings'), onOpenCredit: this.onOpenCredit })
          // Social stats belong directly under the profile and above the role-specific workspace.
          Row({ space: 28 }) {
            this.StatLink(this.socialLoaded ? `${this.following.length}` : '—', '关注', 'following')
            this.StatLink(this.socialLoaded ? `${this.followers.length}` : '—', '粉丝', 'followers')
          }.width('100%').margin({ top: 12, bottom: 6 })
          // "我的约拍 / 摄影工作" is the single raised card in the reference.
          Column({ space: 0 }) {
            Row({ space: 12 }) {
              Column({ space: 4 }) {
                Text(this.role === 'PROVIDER' ? '摄影工作' : '我的约拍')
                  .fontSize(16).fontWeight(FontWeight.Bold).fontColor('#292A2E')
                Text(this.role === 'PROVIDER' ? '订单、拍摄与交付一眼掌握' : '最近的约拍进度都在这里')
                  .fontSize(10).fontColor('#918A84')
              }.layoutWeight(1).alignItems(HorizontalAlign.Start)
              Button(this.role === 'PROVIDER' ? '＋ 发布橱窗' : '＋ 发布约拍')
                .height(32).padding({ left: 11, right: 11 })
                .fontSize(10.5).fontWeight(FontWeight.Bold)
                .fontColor(Color.White).backgroundColor('#1735B9').borderRadius(10)
                .onClick(() => this.onOpenPublish?.())
            }.width('100%')
            Divider().strokeWidth(1).color('#EEE8E1').margin({ top: 14 })
            Row({ space: 0 }) {
              this.BusinessStat(this.myPublishedTotal === undefined ? '—' : `${this.myPublishedTotal}`,
                this.role === 'PROVIDER' ? '我的橱窗' : '已发布', 'demands')
              Divider().vertical(true).height(29).color('#EEE8E1')
              this.BusinessStat(this.ongoingOrderTotal === undefined ? '—' : `${this.ongoingOrderTotal}`,
                this.role === 'PROVIDER' ? '进行中' : '进行中', 'orders')
              Divider().vertical(true).height(29).color('#EEE8E1')
              this.BusinessStat(this.completedOrderTotal === undefined ? '—' : `${this.completedOrderTotal}`,
                this.role === 'PROVIDER' ? '已完成' : '已完成', 'orders')
            }.width('100%')
            Divider().strokeWidth(1).color('#EEE8E1')
            if (this.role === 'PROVIDER' && this.recentService !== undefined) {
              Row({ space: 10 }) {
                PortraImage({ source: this.recentService.coverImage ?? '', imageWidth: 48,
                  imageHeight: 52, cornerRadius: 10, fallbackText: '橱窗', contentDescription: '最近橱窗' })
                Column({ space: 3 }) {
                  Text('最近橱窗').fontSize(9).fontColor('#A19A94')
                  Text(this.recentService.title ?? `橱窗 #${this.recentService.serviceId}`)
                    .fontSize(12.5).fontWeight(FontWeight.Medium).fontColor('#35363A')
                    .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text(this.recentService.status ?? '查看详情')
                    .fontSize(9.5).fontColor('#7E7771')
                }.layoutWeight(1).alignItems(HorizontalAlign.Start)
                Text('›').fontSize(18).fontColor('#AAA39D')
              }.width('100%').height(68).margin({ top: 11 })
                .onClick(() => this.onOpenService?.(this.recentService?.serviceId ?? 0))
            } else if (this.role === 'CUSTOMER' && this.recentDemand !== undefined) {
              Row({ space: 10 }) {
                PortraImage({ fileId: this.recentDemand.referenceFileIds?.[0] ?? 0,
                  imageWidth: 48, imageHeight: 52, cornerRadius: 10,
                  fallbackText: '约拍', contentDescription: '最近需求' })
                Column({ space: 3 }) {
                  Text('最近需求').fontSize(9).fontColor('#A19A94')
                  Text(this.recentDemand.scene?.trim() || `需求 #${this.recentDemand.demandId}`)
                    .fontSize(12.5).fontWeight(FontWeight.Medium).fontColor('#35363A')
                    .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text(this.recentDemand.status ?? '查看详情')
                    .fontSize(9.5).fontColor('#7E7771')
                }.layoutWeight(1).alignItems(HorizontalAlign.Start)
                Text('›').fontSize(18).fontColor('#AAA39D')
              }.width('100%').height(68).margin({ top: 11 })
                .onClick(() => this.onOpenDemand?.(this.recentDemand?.demandId ?? 0))
            } else {
              Row() {
                Text('暂时没有最近发布的内容').fontSize(11).fontColor('#918A84')
                  .layoutWeight(1)
                Text('查看 ›').fontSize(11).fontColor('#1735B9')
              }.width('100%').height(68).margin({ top: 11 })
                .onClick(() => this.openSection('demands'))
            }
          }.width('100%').padding(15).margin({ top: 18 })
            .border({ width: 1, color: '#E0D8CF' }).borderRadius(18)
            .backgroundColor('#FFFDF9')
            .shadow({ radius: 28, color: '#10512D2A', offsetY: 9 })
          // Two compact shortcuts sit directly below the role-specific workspace.
          // Intent is customer-only because the backend enforces CUSTOMER for this endpoint.
          Row({ space: 10 }) {
            Row({ space: 7 }) {
              Column({ space: 3 }) {
                Text('我的收藏').fontSize(12).fontWeight(FontWeight.Medium).fontColor('#3D3D41')
                Text('查看收藏内容').fontSize(9.5).fontColor('#9A938D')
                  .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              }.layoutWeight(1).alignItems(HorizontalAlign.Start)
              Text('›').fontSize(18).fontColor('#AAA39D')
            }.layoutWeight(1).height(58).padding({ left: 11, right: 9 })
              .backgroundColor('#FFFDF9').border({ width: 1, color: '#E5DED7' })
              .borderRadius(14).onClick(() => this.openSection('collections'))
            if (this.role === 'CUSTOMER') {
              Row({ space: 7 }) {
                Column({ space: 3 }) {
                  Text('我的意向').fontSize(12).fontWeight(FontWeight.Medium).fontColor('#3D3D41')
                  Text('感兴趣的橱窗').fontSize(9.5).fontColor('#9A938D')
                    .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                }.layoutWeight(1).alignItems(HorizontalAlign.Start)
                Text('›').fontSize(18).fontColor('#AAA39D')
              }.layoutWeight(1).height(58).padding({ left: 11, right: 9 })
                .backgroundColor('#FFFDF9').border({ width: 1, color: '#E5DED7' })
                .borderRadius(14).onClick(() => this.openSection('intent'))
            }
          }.width('100%').margin({ top: 12 })
          // v39 segmented tabs; DO NOT replace with full-width underline tabs.
          Row({ space: 0 }) {
            Row({ space: 4 }) {
              Button(this.role === 'PROVIDER' ? '作品' : '动态')
                .height(30).padding({ left: 11, right: 11 }).fontSize(11.5)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.contentTab === 'primary' ? '#2B2C30' : '#8A837D')
                .backgroundColor(this.contentTab === 'primary' ? '#FFFDF9' : Color.Transparent)
                .borderRadius(9).onClick(() => this.contentTab = 'primary')
              Button(this.role === 'PROVIDER' ? '橱窗' : '约拍')
                .height(30).padding({ left: 11, right: 11 }).fontSize(11.5)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.contentTab === 'secondary' ? '#2B2C30' : '#8A837D')
                .backgroundColor(this.contentTab === 'secondary' ? '#FFFDF9' : Color.Transparent)
                .borderRadius(9).onClick(() => this.contentTab = 'secondary')
            }.padding(3).borderRadius(12).backgroundColor('#EBE6DF')
          }.width('100%').height(40).margin({ top: 20, bottom: 9 })
          if (this.contentTab === 'primary') {
            this.PhotoArchive()
          } else {
            this.DemandArchive()
          }
          Column() {
            this.QuickLink(this.role === 'PROVIDER' ? '摄影订单 · 查看进度' : '约拍订单 · 查看进度', '查看当前身份订单与进度', 'orders')
          }.width('100%').margin({ top: 18 })
            .border({ width: 1, color: '#E5DED7' }).borderRadius(16).clip(true)

        }.width('100%').alignItems(HorizontalAlign.Start)
          .padding({ left: 16, right: 16, bottom: 30 })
      }.layoutWeight(1).scrollBar(BarState.Off)
    }.width('100%').height('100%').backgroundColor('#F6F3EE')
  }

  @Builder
  private PrivacyPageHeader(title: string, onBack: () => void) {
    Row({ space: 10 }) {
      Button('‹').width(38).height(38).padding(0).fontSize(29)
        .fontColor('#625D58').backgroundColor(Color.Transparent)
        .accessibilityText('返回').onClick(() => onBack())
      Text(title).fontSize(22).fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText).layoutWeight(1)
    }.width('100%').height(58).padding({ left: 16, right: 16 })
      .backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  private PrivacyCenter() {
    Column({ space: 13 }) {
      Column() {
        this.MenuRow('Portra 用户协议', '查看当前版本与服务规则',
          () => this.activeLegalDocument = LegalDocumentKind.USER_AGREEMENT)
        Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
        this.MenuRow('Portra 隐私政策', '了解个人信息的收集、使用与保存',
          () => this.activeLegalDocument = LegalDocumentKind.PRIVACY_POLICY)
        Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
        this.MenuRow('个人信息出境单独同意书', '查看中国香港服务器相关说明',
          () => this.activeLegalDocument = LegalDocumentKind.CROSS_BORDER_CONSENT)
      }.width('100%').borderRadius(14).clip(true)
        .border({ width: 1, color: PortraTheme.border })

      Column() {
        this.MenuRow('撤回隐私及出境同意', '退出登录并返回首次同意页面', () => {
          this.privacyActionError = '';
          this.withdrawalConfirmVisible = true;
        })
        Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
        this.MenuRow('申请注销账号', '在线提交申请并查询处理状态',
          () => this.openCancellationInformation())
      }.width('100%').borderRadius(14).clip(true)
        .border({ width: 1, color: PortraTheme.border })

      Text('运营主体联系人：王雯 · 3336578810@qq.com')
        .width('100%').fontSize(12).fontColor(PortraTheme.secondaryText)
      if (this.privacyActionError.length > 0) {
        Text(this.privacyActionError).width('100%').fontSize(12).fontColor(PortraTheme.danger)
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  private LegalDocumentView() {
    Column() {
      this.PrivacyPageHeader(this.legalDocumentTitle(), () => this.activeLegalDocument = LegalDocumentKind.NONE)
      Scroll() {
        Column({ space: 22 }) {
          ForEach(this.legalDocumentSections(), (section: LegalSection) => {
            Column({ space: 8 }) {
              Text(section.title).width('100%').fontSize(17)
                .fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              Text(section.body).width('100%').fontSize(13).lineHeight(22)
                .fontColor(PortraTheme.secondaryText)
            }.width('100%').alignItems(HorizontalAlign.Start)
          }, (section: LegalSection) => section.title)
          Button('阅读完成，返回').width('100%').height(46)
            .fontColor(Color.White).backgroundColor(PortraTheme.primary).borderRadius(12)
            .margin({ top: 8, bottom: 30 })
            .onClick(() => this.activeLegalDocument = LegalDocumentKind.NONE)
        }.width('100%').padding({ left: 18, right: 18, top: 18 })
          .alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).scrollBar(BarState.Off)
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  private WithdrawalConfirmation() {
    Column() {
      this.PrivacyPageHeader('撤回同意', () => {
        if (!this.withdrawingConsent) {
          this.withdrawalConfirmVisible = false;
          this.privacyActionError = '';
        }
      })
      Column({ space: 16 }) {
        Text('撤回后将退出当前账号，并返回首次启动的协议确认页面。在重新同意前，应用不会初始化设备标识或恢复登录会话。')
          .width('100%').fontSize(14).lineHeight(23).fontColor(PortraTheme.primaryText)
        if (this.privacyActionError.length > 0) {
          Text(this.privacyActionError).width('100%').fontSize(12).fontColor(PortraTheme.danger)
        }
        Button(this.withdrawingConsent ? '正在撤回…' : '确认撤回并退出登录')
          .width('100%').height(48).fontColor(Color.White).backgroundColor(PortraTheme.danger)
          .borderRadius(12).enabled(!this.withdrawingConsent)
          .onClick(() => this.withdrawPrivacyConsent())
        Button('暂不撤回').width('100%').height(44).fontColor(PortraTheme.primaryText)
          .backgroundColor(Color.Transparent).enabled(!this.withdrawingConsent)
          .onClick(() => { this.withdrawalConfirmVisible = false; this.privacyActionError = ''; })
      }.width('100%').padding(20).alignItems(HorizontalAlign.Start)
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  private CancellationInformation() {
    Column() {
      this.PrivacyPageHeader('申请注销账号', () => this.closeCancellationInformation())
      Scroll() {
        Column({ space: 16 }) {
          Text(this.cancellationStatusLabel()).width('100%').fontSize(21)
            .fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          if (this.cancellationLoading) {
            PortraLoading({ label: '正在查询注销申请' })
          } else {
            Text(this.cancellationRequestedAt.length > 0 ?
              `提交时间：${this.cancellationRequestedAt}` : '当前没有待处理的注销申请')
              .width('100%').fontSize(13).fontColor(PortraTheme.secondaryText)
            if (this.cancellationResolutionNote.length > 0) {
              Text(`处理说明：${this.cancellationResolutionNote}`)
                .width('100%').fontSize(13).fontColor(PortraTheme.secondaryText)
            }
          }
          if (!this.cancellationLoading &&
            (this.cancellationStatus === 'NOT_REQUESTED' || this.cancellationStatus === 'REJECTED')) {
            Text('注销原因（选填）').width('100%').fontSize(14)
              .fontWeight(FontWeight.Medium).fontColor(PortraTheme.primaryText)
            TextArea({ text: this.cancellationReason, placeholder: '可简要说明原因，不超过 500 字' })
              .width('100%').height(110).maxLength(500).enabled(!this.cancellationSubmitting)
              .backgroundColor(PortraTheme.surface).border({ width: 1, color: PortraTheme.border })
              .borderRadius(12).padding(12)
              .onChange((value: string) => { this.cancellationReason = value; this.privacyActionError = ''; })
            Button(this.cancellationSubmitting ? '正在提交…' :
              this.cancellationStatus === 'REJECTED' ? '重新提交注销申请' : '提交注销申请')
              .width('100%').height(48).fontColor(Color.White).backgroundColor(PortraTheme.danger)
              .borderRadius(12).enabled(!this.cancellationSubmitting)
              .onClick(() => this.submitCancellationRequest())
          }
          if (this.privacyActionError.length > 0) {
            Text(this.privacyActionError).width('100%').fontSize(12).fontColor(PortraTheme.danger)
          }
          Button('刷新处理状态').width('100%').height(44)
            .fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
            .enabled(!this.cancellationLoading && !this.cancellationSubmitting)
            .onClick(() => this.loadCancellationStatus())
          Text('核验通过且不存在依法需要先处理的事项后，我们原则上在 15 个工作日内完成账号注销及相应个人信息删除或匿名化。未完成订单、未解决争议以及依法需要保存的交易和安全记录，将在必要期限内限制处理并继续保存。')
            .width('100%').fontSize(12).lineHeight(20).fontColor(PortraTheme.secondaryText)
        }.width('100%').padding({ left: 18, right: 18, top: 18, bottom: 30 })
          .alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).scrollBar(BarState.Off)
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  private Details() {
    Column({ space: 0 }) {
      this.SubviewHeader()
      Scroll(this.detailScroller) {
        Column({ space: 13 }) {
          if (this.section === 'settings' && this.profile !== null) {
            ProfileWorkspace({ profile: this.profile, editOnly: true,
              onSaved: () => { this.section = 'home'; this.load(); } })
            this.QuickLink('切换身份', this.role === 'PROVIDER' ? '当前摄影师身份' : '当前约拍用户身份', 'identity')
            this.QuickLink('隐私与协议', '协议查看、同意撤回与账号注销', 'privacy')
            Button(this.signingOut ? '退出中…' : '退出登录')
              .width('100%').height(46).fontColor(PortraTheme.danger)
              .backgroundColor(PortraTheme.surface).borderRadius(12)
              .enabled(!this.signingOut).onClick(() => this.signOut())
          } else if (this.section === 'privacy') {
            this.PrivacyCenter()
          } else if (this.section === 'identity') {
            Text(`当前身份：${this.roleLabel()}`).fontSize(15).fontColor(PortraTheme.primaryText)
            Button(this.switchingRole ? '切换中…' : this.role === 'PROVIDER' ? '切换为约拍用户' : '切换为摄影师')
              .width('100%').height(44).enabled(!this.switchingRole).onClick(() => this.switchRole())
            if (this.roleSwitchError.length > 0) {
              Text(this.roleSwitchError).fontSize(12).fontColor(PortraTheme.danger)
            }
          } else if (this.section === 'following' || this.section === 'followers') {
            if (this.socialError.length > 0) {
              Text(this.socialError).fontSize(12).fontColor(PortraTheme.danger)
              Button('重试').onClick(() => this.loadSocial())
            } else if (!this.socialLoaded) {
              Text('正在读取用户列表…').fontColor(PortraTheme.secondaryText)
            }
            if (this.socialLoaded) {
              this.SocialPreview(this.sectionTitle(), this.section === 'following' ? this.following : this.followers)
            }
          } else if (this.section === 'collections') {
            this.MomentPreview('已收藏的动态', this.favorites)
            if (this.favorites.length < this.favoriteTotal) {
              Button(this.loadingMoreFavorites ? '加载中…' : '加载更多收藏').width('100%')
                .enabled(!this.loadingMoreFavorites).onClick(() => this.loadMoreFavorites())
            }
          } else if (this.section === 'works') {
            this.MomentPreview('我的动态', this.moments)
            if (this.moments.length < this.momentTotal) {
              Button(this.loadingMoreMoments ? '加载中…' : '加载更多动态').width('100%')
                .enabled(!this.loadingMoreMoments).onClick(() => this.loadMoreMoments())
            }
          } else if (this.section === 'demands' && this.profile !== null) {
            ProfileWorkspace({ profile: this.profile, onPublish: this.onOpenPublish,
              onOpenDemand: this.onOpenDemand, onOpenService: this.onOpenService,
              onEditDemand: this.onEditDemand, onEditService: this.onEditService,
              onSaved: () => this.load() })
          } else if (this.section === 'intent') {
            Text('加入意向不会自动形成订单').fontSize(12).fontColor(PortraTheme.secondaryText)
            if (this.interestLoading) {
              Text('正在读取我的意向…').fontSize(13)
            } else if (this.interestError.length > 0) {
              Text(this.interestError).fontColor(PortraTheme.danger)
              Button('重试').onClick(() => this.loadInterests())
            } else if (this.interests.length === 0) {
              Text('暂未保存感兴趣的橱窗').fontColor(PortraTheme.secondaryText)
            } else {
              ForEach(this.interests, (item: ServicePackageSummary) => {
                Row({ space: 12 }) {
                  Text(item.title ?? `橱窗 #${item.serviceId}`).fontSize(14).layoutWeight(1)
                    .fontColor(PortraTheme.primaryText)
                  Text('查看 ›').fontColor(PortraTheme.primary).fontSize(12)
                }.width('100%').padding(16).backgroundColor(PortraTheme.surface)
                  .borderRadius(14).onClick(() => this.onOpenService?.(item.serviceId))
              }, (item: ServicePackageSummary) => item.serviceId.toString())
              if (this.interests.length < this.interestTotal) {
                Button('加载更多意向').width('100%').enabled(!this.interestLoading)
                  .onClick(() => this.loadInterests(true))
              }
            }
          } else if (this.section === 'likes') {
            if (this.likedLoading && this.likedMoments.length === 0) {
              Text('正在读取点赞的动态…').fontSize(13).fontColor(PortraTheme.secondaryText)
            }
            if (this.likedError.length > 0) {
              Text(this.likedError).fontSize(12).fontColor(PortraTheme.danger)
              Button('重试').onClick(() => this.loadLikes())
            }
            if (!this.likedLoading && this.likedError.length === 0 && this.likedMoments.length === 0) {
              Text('还没有点赞的动态').fontSize(13).fontColor(PortraTheme.secondaryText)
            }
            this.MomentPreview('已点赞的动态', this.likedMoments)
            if (this.likedMoments.length < this.likedTotal) {
              Button(this.likedLoading ? '加载中…' : '加载更多点赞').width('100%')
                .enabled(!this.likedLoading && this.likedError.length === 0)
                .onClick(() => this.loadLikes(true))
            }
          }
          if (this.errorMessage.length > 0) {
            Text(this.errorMessage).fontSize(12).fontColor(PortraTheme.danger)
          }
        }.width('100%').padding({ left: 16, right: 16, top: 20, bottom: 32 })
          .alignItems(HorizontalAlign.Start)
      }.width('100%').layoutWeight(1).align(Alignment.TopStart).scrollBar(BarState.Off)
        .onAppear(() => this.detailScroller.scrollTo({ xOffset: 0, yOffset: 0 }))
    }.width('100%').height('100%')
      .onAreaChange(() => UiPerf.mark('profile.layout.' + this.section))
  }

  build() {
    if (this.activeLegalDocument !== LegalDocumentKind.NONE) {
      this.LegalDocumentView()
    } else if (this.withdrawalConfirmVisible) {
      this.WithdrawalConfirmation()
    } else if (this.cancellationInfoVisible) {
      this.CancellationInformation()
    } else {
      Column() {
      if (this.loading) {
        PortraLoading({ label: '正在加载个人档案' })
      } else if (this.signOutCleanupFailed) {
        Column({ space: 14 }) {
          Text(this.errorMessage).fontColor(PortraTheme.danger)
          PortraButton({ label: '重试退出', loading: this.signingOut, onAction: () => this.signOut() })
        }.padding(24)
      } else if (this.requiresLogin) {
        Column({ space: 16 }) {
          Text('登录状态已失效').fontColor(PortraTheme.primaryText)
          Button('重新登录').onClick(() => this.onRequireLogin?.())
        }.padding(24)
      } else if (this.profile === null) {
        PortraErrorView({ message: this.errorMessage || '资料读取失败', onRetry: () => this.load() })
      } else if (this.section === 'home') {
        this.Home()
      } else {
        this.Details()
      }
      }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
    }
  }
}
