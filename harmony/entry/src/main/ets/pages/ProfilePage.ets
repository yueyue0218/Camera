import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraButton } from '../common/components/PortraButton';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { MomentCard } from '../features/moments/MomentCard';
import { MomentFeedFormatter } from '../features/moments/MomentFeedModels';
import { AccountCancellationSummary, MomentSummary, SocialUserBrief, UserProfileSummary } from '../model/ApiModels';
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
  @State private loading: boolean = true;
  @State private signingOut: boolean = false;
  @State private switchingRole: boolean = false;
  @State private nickname: string = '';
  @State private role: string = '';
  @State private userId: number = 0;
  @State private errorMessage: string = '';
  @State private requiresLogin: boolean = false;
  @State private signOutCleanupFailed: boolean = false;
  @State private profile: UserProfileSummary | null = null;
  @State private moments: MomentSummary[] = [];
  @State private favorites: MomentSummary[] = [];
  @State private followers: SocialUserBrief[] = [];
  @State private following: SocialUserBrief[] = [];
  @State private momentPage: number = 1;
  @State private momentTotal: number = 0;
  @State private favoritePage: number = 1;
  @State private favoriteTotal: number = 0;
  @State private loadingMoreMoments: boolean = false;
  @State private loadingMoreFavorites: boolean = false;
  @State private privacyCenterVisible: boolean = false;
  @State private cancellationInfoVisible: boolean = false;
  @State private withdrawalConfirmVisible: boolean = false;
  @State private withdrawingConsent: boolean = false;
  @State private activeLegalDocument: LegalDocumentKind = LegalDocumentKind.NONE;
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
  onRequireLogin?: () => void;
  onOpenCredit?: () => void;
  onOpenOrders?: () => void;
  onOpenMessages?: () => void;
  onOpenPublish?: () => void;
  onPrivacyConsentWithdrawn?: () => void;

  aboutToAppear(): void {
    this.signingOut = false;
    this.switchingRole = false;
    this.load();
  }

  aboutToDisappear(): void {
    this.loadVersion++;
    this.cancellationRequestVersion++;
    this.roleSwitchVersion++;
    this.appClient.apiService.cancelCurrentSession();
    this.appClient.apiService.cancelUserSystemRequests(this.userId);
    this.appClient.apiService.cancelAccountCancellationRequests();
  }

  private async load(): Promise<void> {
    const version = ++this.loadVersion;
    const sessionVersion = this.appClient.sessionManager.getSessionVersion();
    this.loading = true;
    this.errorMessage = '';
    this.requiresLogin = false;
    this.signOutCleanupFailed = false;
    this.nickname = '';
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
    try {
      const profile: UserProfileSummary = await this.appClient.apiService.getMyProfile();
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (profile === null || !Number.isSafeInteger(profile.id) || profile.id <= 0 ||
        (profile.currentRole !== 'CUSTOMER' && profile.currentRole !== 'PROVIDER')) {
        throw new Error('个人资料格式异常');
      }
      this.profile = profile;
      this.role = profile.currentRole;
      this.userId = profile.id;
      this.nickname = this.profileNickname(profile);

      const momentPage = await this.appClient.apiService.listProfileMoments(profile.id, profile.currentRole, 1, 4);
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (!Array.isArray(momentPage.records) || !Number.isSafeInteger(momentPage.total) || momentPage.total < 0 ||
        momentPage.records.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item))) {
        throw new Error('用户动态格式异常');
      }
      this.moments = MomentFeedFormatter.deduplicate(momentPage.records);
      this.momentTotal = momentPage.total;

      const favoritePage = await this.appClient.apiService.listFavoriteMoments(1, 4);
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (!Array.isArray(favoritePage.records) || !Number.isSafeInteger(favoritePage.total) || favoritePage.total < 0 ||
        favoritePage.records.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item))) {
        throw new Error('收藏列表格式异常');
      }
      this.favorites = MomentFeedFormatter.deduplicate(favoritePage.records);
      this.favoriteTotal = favoritePage.total;

      const followers = await this.appClient.apiService.listFollowers(profile.id, profile.currentRole);
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      this.followers = this.validSocialUsers(followers);

      const customerFollowing = await this.appClient.apiService.listFollowing(profile.id, 'CUSTOMER');
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      const providerFollowing = await this.appClient.apiService.listFollowing(profile.id, 'PROVIDER');
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      this.following = this.mergeSocialUsers(
        this.validSocialUsers(customerFollowing), this.validSocialUsers(providerFollowing));
    } catch (error) {
      if (version === this.loadVersion &&
        sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
        const mapped = error as PortraError;
        this.requiresLogin = mapped.httpStatus === 401 || mapped.businessCode === 40101;
        this.errorMessage = mapped.message || '资料加载失败，请稍后重试';
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
      const result = await this.appClient.apiService.listProfileMoments(this.userId, this.role, nextPage, 4);
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

  private async switchRole(): Promise<void> {
    if (this.switchingRole || (this.role !== 'CUSTOMER' && this.role !== 'PROVIDER')) {
      return;
    }
    const targetRole = this.role === 'PROVIDER' ? 'CUSTOMER' : 'PROVIDER';
    const roleOperation = ++this.roleSwitchVersion;
    const version = this.loadVersion;
    let sessionVersion = this.appClient.sessionManager.getSessionVersion();
    this.switchingRole = true;
    this.errorMessage = '';
    try {
      const result = await this.appClient.apiService.switchRole(targetRole);
      if (version !== this.loadVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (result === null || result.id !== this.userId || result.currentRole !== targetRole) {
        throw new Error('角色切换结果异常');
      }
      if (!await this.appClient.sessionManager.notifyIdentityChanged()) {
        return;
      }
      // notifyIdentityChanged advances exactly one generation. Do not load for
      // another account if it changed again while this continuation was queued.
      if (version !== this.loadVersion ||
        this.appClient.sessionManager.getSessionVersion() !== sessionVersion + 1) {
        return;
      }
      sessionVersion = this.appClient.sessionManager.getSessionVersion();
      await this.load();
    } catch (error) {
      if (roleOperation !== this.roleSwitchVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      this.errorMessage = (error as PortraError).message || '角色切换失败';
    } finally {
      if (roleOperation === this.roleSwitchVersion) {
        this.switchingRole = false;
      }
    }
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
      if (version !== this.cancellationRequestVersion) {
        return;
      }
      this.applyCancellationSummary(result);
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
    if (this.cancellationSubmitting || this.cancellationStatus !== 'NOT_REQUESTED' &&
      this.cancellationStatus !== 'REJECTED') {
      return;
    }
    const version = ++this.cancellationRequestVersion;
    this.cancellationSubmitting = true;
    this.privacyActionError = '';
    try {
      const result = await this.appClient.apiService.requestAccountCancellation(this.cancellationReason);
      if (version !== this.cancellationRequestVersion) {
        return;
      }
      this.applyCancellationSummary(result);
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
    const validStatus = summary !== null && ['NOT_REQUESTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED']
      .includes(summary.status);
    const validRequestId = summary.status === 'NOT_REQUESTED' ||
      (Number.isSafeInteger(summary.requestId) && (summary.requestId ?? 0) > 0);
    if (!validStatus || !validRequestId) {
      throw new Error('账号注销申请状态异常');
    }
    this.cancellationStatus = summary.status;
    this.cancellationReason = summary.reason?.trim() ?? '';
    this.cancellationRequestedAt = summary.requestedAt?.trim() ?? '';
    this.cancellationResolutionNote = summary.resolutionNote?.trim() ?? '';
  }

  private cancellationStatusLabel(): string {
    if (this.cancellationStatus === 'PENDING') {
      return '申请已提交，等待核验';
    }
    if (this.cancellationStatus === 'PROCESSING') {
      return '申请正在处理中';
    }
    if (this.cancellationStatus === 'COMPLETED') {
      return '账号注销已完成';
    }
    if (this.cancellationStatus === 'REJECTED') {
      return '申请暂未通过';
    }
    return '尚未提交注销申请';
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
        ForEach(items.slice(0, 6), (item: SocialUserBrief) => {
          Row({ space: 10 }) {
            PortraAvatar({ displayName: item.nickname ?? '', avatarSize: 36 })
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
          MomentCard({ item: item })
        }, (item: MomentSummary) => item.momentId.toString())
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  private PrivacyCenter() {
    Column() {
      PortraPageHeading({ title: '隐私与协议', eyebrow: 'PRIVACY CENTER', onBack: () => {
        this.privacyCenterVisible = false;
        this.privacyActionError = '';
      } })

      Scroll() {
        Column({ space: 18 }) {
          Column() {
            this.MenuRow('Portra 用户协议', '查看当前版本与服务规则',
              () => this.activeLegalDocument = LegalDocumentKind.USER_AGREEMENT)
            Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
            this.MenuRow('Portra 隐私政策', '了解个人信息的收集、使用与保存',
              () => this.activeLegalDocument = LegalDocumentKind.PRIVACY_POLICY)
            Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
            this.MenuRow('个人信息出境单独同意书', '查看中国香港服务器相关说明',
              () => this.activeLegalDocument = LegalDocumentKind.CROSS_BORDER_CONSENT)
          }
          .width('100%')
          .backgroundColor(PortraTheme.surface)
          .borderRadius(8)
          .clip(true)
          .border({ width: 1, color: PortraTheme.border })

          Column({ space: 8 }) {
            Text('您的隐私权利')
              .width('100%')
              .fontSize(17)
              .fontWeight(FontWeight.Bold)
              .fontColor(PortraTheme.primaryText)
            Text('您可以申请查阅、更正或删除个人信息，也可以撤回隐私及出境同意。撤回后将退出登录，依赖中国香港服务器的核心功能无法继续使用。')
              .width('100%')
              .fontSize(13)
              .lineHeight(21)
              .fontColor(PortraTheme.secondaryText)
          }
          .width('100%')
          .padding(16)
          .alignItems(HorizontalAlign.Start)
          .backgroundColor(PortraTheme.primarySoft)
          .borderRadius(8)

          Column() {
            this.MenuRow('撤回隐私及出境同意', '退出登录并返回首次同意页面', () => {
              this.privacyActionError = '';
              this.withdrawalConfirmVisible = true;
            })
            Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
            this.MenuRow('申请注销账号', '在线提交申请并查询处理状态',
              () => this.openCancellationInformation())
          }
          .width('100%')
          .backgroundColor(PortraTheme.surface)
          .borderRadius(8)
          .clip(true)
          .border({ width: 1, color: PortraTheme.border })

          if (this.privacyActionError.length > 0) {
            Text(this.privacyActionError)
              .width('100%')
              .fontSize(13)
              .fontColor(PortraTheme.danger)
          }

          Text('运营者：王雯 · 联系邮箱：3336578810@qq.com')
            .width('100%')
            .fontSize(11)
            .textAlign(TextAlign.Center)
            .fontColor(PortraTheme.mutedText)
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 20, bottom: 36 })
        .alignItems(HorizontalAlign.Start)
      }
      .layoutWeight(1)
      .scrollBar(BarState.Auto)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  private LegalDocumentView() {
    Column() {
      PortraPageHeading({ title: this.legalDocumentTitle(), eyebrow: 'LEGAL DOCUMENT',
        onBack: () => this.activeLegalDocument = LegalDocumentKind.NONE })
      Scroll() {
        Column({ space: 22 }) {
          ForEach(this.legalDocumentSections(), (section: LegalSection) => {
            Column({ space: 8 }) {
              Text(section.title)
                .width('100%')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .fontColor(PortraTheme.primaryText)
              Text(section.body)
                .width('100%')
                .fontSize(13)
                .lineHeight(22)
                .fontColor(PortraTheme.secondaryText)
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
          }, (section: LegalSection) => section.title)

          Button('阅读完成，返回')
            .width('100%')
            .height(48)
            .fontSize(15)
            .fontColor(PortraTheme.white)
            .backgroundColor(PortraTheme.primary)
            .borderRadius(PortraTheme.radius)
            .margin({ top: 8, bottom: 32 })
            .onClick(() => this.activeLegalDocument = LegalDocumentKind.NONE)
        }
        .width('100%')
        .padding({ left: 24, right: 24, top: 24 })
        .alignItems(HorizontalAlign.Start)
      }
      .layoutWeight(1)
      .scrollBar(BarState.Auto)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  private WithdrawalConfirmation() {
    Column() {
      PortraPageHeading({ title: '撤回同意', eyebrow: 'WITHDRAW CONSENT', onBack: () => {
        if (!this.withdrawingConsent) {
          this.withdrawalConfirmVisible = false;
          this.privacyActionError = '';
        }
      } })
      Scroll() {
        Column({ space: 18 }) {
          Text('撤回后的影响')
            .width('100%')
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor(PortraTheme.primaryText)
          Text('Portra 的核心服务运行在中国香港服务器。确认撤回后，本机会退出登录并清除隐私及出境同意记录，随后返回首次同意页面。您将无法继续使用账号、消息、订单和文件等依赖服务器的功能。')
            .width('100%')
            .fontSize(14)
            .lineHeight(23)
            .fontColor(PortraTheme.secondaryText)
          Text('撤回不影响撤回前处理活动的合法性。依法需要继续保存的订单、争议和安全记录，将仅在法定或必要期限内保存。')
            .width('100%')
            .fontSize(13)
            .lineHeight(21)
            .fontColor(PortraTheme.secondaryText)
            .padding(16)
            .backgroundColor(PortraTheme.primarySoft)
            .borderRadius(8)

          if (this.privacyActionError.length > 0) {
            Text(this.privacyActionError)
              .width('100%')
              .fontSize(13)
              .fontColor(PortraTheme.danger)
          }

          Button(this.withdrawingConsent ? '正在撤回…' : '确认撤回并退出登录')
            .width('100%')
            .height(48)
            .fontSize(15)
            .fontColor(PortraTheme.white)
            .backgroundColor(PortraTheme.danger)
            .borderRadius(PortraTheme.radius)
            .enabled(!this.withdrawingConsent)
            .onClick(() => this.withdrawPrivacyConsent())
          Button('暂不撤回')
            .width('100%')
            .height(46)
            .fontSize(14)
            .fontColor(PortraTheme.primaryText)
            .backgroundColor(Color.Transparent)
            .enabled(!this.withdrawingConsent)
            .onClick(() => {
              this.withdrawalConfirmVisible = false;
              this.privacyActionError = '';
            })
        }
        .width('100%')
        .padding({ left: 24, right: 24, top: 30, bottom: 36 })
        .alignItems(HorizontalAlign.Start)
      }
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  private CancellationInformation() {
    Column() {
      PortraPageHeading({ title: '申请注销账号', eyebrow: 'ACCOUNT CANCELLATION',
        onBack: () => this.closeCancellationInformation() })
      Scroll() {
        Column({ space: 18 }) {
          Text(this.cancellationStatusLabel())
            .width('100%')
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor(PortraTheme.primaryText)
          Text('提交后申请会保存到 Portra 服务器，并进入人工核验。为避免误删未完成订单、争议证据或他人权益相关记录，申请通过前不会直接删除账号。')
            .width('100%')
            .fontSize(14)
            .lineHeight(23)
            .fontColor(PortraTheme.secondaryText)

          if (this.cancellationLoading) {
            PortraLoading({ label: '正在查询注销申请' })
          } else {
            Column({ space: 9 }) {
              Text('当前处理状态')
                .width('100%')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .fontColor(PortraTheme.primaryText)
              Text(this.cancellationStatusLabel())
                .width('100%')
                .fontSize(14)
                .fontColor(PortraTheme.primary)
              if (this.cancellationRequestedAt.length > 0) {
                Text(`提交时间：${this.cancellationRequestedAt}`)
                  .width('100%')
                  .fontSize(12)
                  .fontColor(PortraTheme.secondaryText)
              }
              if (this.cancellationResolutionNote.length > 0) {
                Text(`处理说明：${this.cancellationResolutionNote}`)
                  .width('100%')
                  .fontSize(13)
                  .lineHeight(21)
                  .fontColor(PortraTheme.secondaryText)
              }
            }
            .width('100%')
            .padding(16)
            .alignItems(HorizontalAlign.Start)
            .backgroundColor(PortraTheme.primarySoft)
            .borderRadius(8)
          }

          if (!this.cancellationLoading &&
            (this.cancellationStatus === 'NOT_REQUESTED' || this.cancellationStatus === 'REJECTED')) {
            Text('注销原因（选填）')
              .width('100%')
              .fontSize(14)
              .fontWeight(FontWeight.Medium)
              .fontColor(PortraTheme.primaryText)

            TextArea({ text: this.cancellationReason, placeholder: '可简要说明原因，不超过 500 字' })
              .width('100%')
              .height(110)
              .maxLength(500)
              .enabled(!this.cancellationSubmitting)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding(12)
              .onChange((value: string) => {
                this.cancellationReason = value;
                this.privacyActionError = '';
              })

            Button(this.cancellationSubmitting ? '正在提交…' :
              this.cancellationStatus === 'REJECTED' ? '重新提交注销申请' : '提交注销申请')
              .width('100%')
              .height(48)
              .fontSize(15)
              .fontColor(PortraTheme.white)
              .backgroundColor(PortraTheme.danger)
              .borderRadius(PortraTheme.radius)
              .enabled(!this.cancellationSubmitting)
              .onClick(() => this.submitCancellationRequest())
          }

          if (this.privacyActionError.length > 0) {
            Text(this.privacyActionError)
              .width('100%')
              .fontSize(13)
              .fontColor(PortraTheme.danger)
            Button('重新查询')
              .width('100%')
              .height(44)
              .fontSize(14)
              .fontColor(PortraTheme.primary)
              .backgroundColor(PortraTheme.primarySoft)
              .enabled(!this.cancellationLoading && !this.cancellationSubmitting)
              .onClick(() => this.loadCancellationStatus())
          }

          Text('核验通过且不存在依法需要先处理的事项后，我们原则上在 15 个工作日内完成账号注销及相应个人信息删除或匿名化。未完成订单、未解决争议以及依法需要保存的交易和安全记录，将在必要期限内限制处理并继续保存。')
            .width('100%')
            .fontSize(13)
            .lineHeight(22)
            .fontColor(PortraTheme.secondaryText)
          Text('如在线提交暂时不可用，可联系 3336578810@qq.com。请勿在普通邮件中发送完整身份证件、验证码或密码。')
            .width('100%')
            .fontSize(12)
            .lineHeight(20)
            .fontColor(PortraTheme.mutedText)

          Button('返回隐私与协议')
            .width('100%')
            .height(48)
            .fontSize(15)
            .fontColor(PortraTheme.white)
            .backgroundColor(PortraTheme.primary)
            .borderRadius(PortraTheme.radius)
            .onClick(() => this.closeCancellationInformation())
        }
        .width('100%')
        .padding({ left: 24, right: 24, top: 30, bottom: 36 })
        .alignItems(HorizontalAlign.Start)
      }
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  private ProfileContent() {
    Column() {
      PortraPageHeading({ title: '我的主页', eyebrow: 'PERSONAL ARCHIVE', onBack: this.onBack })

      if (this.loading) {
        PortraLoading({ label: '正在加载账号' })
      } else if (this.signOutCleanupFailed) {
        Column({ space: 16 }) {
          Text(this.errorMessage)
            .fontSize(14)
            .fontColor(PortraTheme.danger)
          PortraButton({ label: '重试退出', loading: this.signingOut,
            onAction: () => this.signOut() })
        }
        .width('100%')
        .padding(24)
      } else if (this.requiresLogin) {
        Column({ space: 16 }) {
          Text('登录状态已失效')
            .fontSize(16)
            .fontColor(PortraTheme.primaryText)
          Button('重新登录')
            .height(44)
            .fontColor(PortraTheme.white)
            .backgroundColor(PortraTheme.primary)
            .borderRadius(PortraTheme.radius)
            .onClick(() => this.onRequireLogin?.())
        }
        .width('100%')
        .padding(24)
      } else if (this.errorMessage.length > 0 && this.nickname.length === 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() })
      } else {
        Scroll() {
          Column({ space: 18 }) {
            Column({ space: 18 }) {
              Row({ space: 14 }) {
                PortraAvatar({ displayName: this.nickname, avatarSize: 68 })
                Column({ space: 7 }) {
                  Text(this.nickname)
                    .fontSize(22)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(PortraTheme.primaryText)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text(`用户编号 ${this.userId}`)
                    .fontSize(12)
                    .fontColor(PortraTheme.secondaryText)
                  if (this.profileBio().length > 0) {
                    Text(this.profileBio())
                      .fontSize(12)
                      .fontColor(PortraTheme.secondaryText)
                      .maxLines(3)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                  }
                }
                .layoutWeight(1)
                .alignItems(HorizontalAlign.Start)
              }
              .width('100%')
              Divider().color(PortraTheme.border)
              Row() {
                Text(this.roleLabel())
                  .fontSize(12)
                  .fontWeight(FontWeight.Medium)
                  .fontColor(PortraTheme.primary)
                  .padding({ left: 10, right: 10, top: 6, bottom: 6 })
                  .backgroundColor(PortraTheme.primarySoft)
                  .borderRadius(6)
                Blank()
                Button(this.switchingRole ? '切换中' :
                  this.role === 'PROVIDER' ? '切换到约拍用户' : '切换到摄影师')
                  .height(34)
                  .fontSize(11)
                  .fontColor(PortraTheme.primary)
                  .backgroundColor(PortraTheme.primarySoft)
                  .enabled(!this.switchingRole)
                  .onClick(() => this.switchRole())
              }
              .width('100%')
              if (this.profile !== null) {
                Column({ space: 5 }) {
                  if (this.profile.locationVisible !== false && this.profile.locationDisplay?.trim()) {
                    Text(`地点  ${this.profile.locationDisplay}`)
                      .fontSize(12).fontColor(PortraTheme.secondaryText)
                  }
                  if (this.profile.genderVisible !== false && this.profile.gender?.trim()) {
                    Text(`性别  ${this.profile.gender}`)
                      .fontSize(12).fontColor(PortraTheme.secondaryText)
                  }
                  if (this.profile.school?.trim()) {
                    Text(`学校  ${this.profile.school}`)
                      .fontSize(12).fontColor(PortraTheme.secondaryText)
                  }
                }
                .width('100%')
                .alignItems(HorizontalAlign.Start)
              }
            }
            .width('100%')
            .padding(18)
            .alignItems(HorizontalAlign.Start)
            .backgroundColor(PortraTheme.surface)
            .borderRadius(8)
            .border({ width: 1, color: PortraTheme.border })

            Text('我的约拍')
              .width('100%')
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor(PortraTheme.primaryText)
              .margin({ top: 9 })

            Column() {
              this.MenuRow('我的订单', '查看合作进度', () => this.onOpenOrders?.())
              Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
              this.MenuRow('消息', '与约拍对象保持联系', () => this.onOpenMessages?.())
                Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
                this.MenuRow('信用分', '查看合作表现与分数变化', () => this.onOpenCredit?.())
              if (this.role === 'CUSTOMER') {
                Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
                this.MenuRow('发布需求', '记录新的拍摄想法', () => this.onOpenPublish?.())
              }
            }
            .width('100%')
            .backgroundColor(PortraTheme.surface)
            .borderRadius(8)
            .clip(true)
            .border({ width: 1, color: PortraTheme.border })

            if (this.errorMessage.length > 0) {
              Text(this.errorMessage)
                .width('100%')
                .fontSize(13)
                .fontColor(PortraTheme.danger)
            }

            this.SocialPreview('我的关注', this.following)
            this.SocialPreview('关注我的人', this.followers)
            this.MomentPreview('当前身份动态', this.moments)
            if (this.moments.length < this.momentTotal) {
              Button(this.loadingMoreMoments ? '加载中' : '加载更多动态')
                .width('100%').height(42).enabled(!this.loadingMoreMoments)
                .backgroundColor(PortraTheme.primarySoft).fontColor(PortraTheme.primary)
                .onClick(() => this.loadMoreMoments())
            }
            this.MomentPreview('我的动态收藏', this.favorites)
            if (this.favorites.length < this.favoriteTotal) {
              Button(this.loadingMoreFavorites ? '加载中' : '加载更多收藏')
                .width('100%').height(42).enabled(!this.loadingMoreFavorites)
                .backgroundColor(PortraTheme.primarySoft).fontColor(PortraTheme.primary)
                .onClick(() => this.loadMoreFavorites())
            }

            Text('账号与隐私')
              .width('100%')
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor(PortraTheme.primaryText)
              .margin({ top: 9 })
            Column() {
              this.MenuRow('隐私与协议', '协议查看、同意撤回与账号注销', () => {
                this.privacyCenterVisible = true;
                this.privacyActionError = '';
              })
            }
            .width('100%')
            .backgroundColor(PortraTheme.surface)
            .borderRadius(8)
            .clip(true)
            .border({ width: 1, color: PortraTheme.border })

            Button(this.signingOut ? '退出中…' : '退出登录')
              .width('100%')
              .height(48)
              .fontSize(14)
              .fontColor(PortraTheme.danger)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .enabled(!this.signingOut)
              .margin({ top: 12 })
              .onClick(() => this.signOut())
          }
          .width('100%')
          .padding({ left: 20, right: 20, top: 16, bottom: 32 })
          .alignItems(HorizontalAlign.Start)
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }

  build() {
    if (this.activeLegalDocument !== LegalDocumentKind.NONE) {
      this.LegalDocumentView()
    } else if (this.withdrawalConfirmVisible) {
      this.WithdrawalConfirmation()
    } else if (this.cancellationInfoVisible) {
      this.CancellationInformation()
    } else if (this.privacyCenterVisible) {
      this.PrivacyCenter()
    } else {
      this.ProfileContent()
    }
  }
}
