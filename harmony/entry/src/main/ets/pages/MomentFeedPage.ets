import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraLoading } from '../common/components/PortraLoading';
import { MomentFavoriteWrite } from '../features/moments/MomentFavoriteWrite';
import { MomentCard } from '../features/moments/MomentCard';
import { MomentInteractions, MomentInteractionSnapshot, MomentDetailData } from '../features/moments/MomentInteractions';
import { MomentApiBinding, MomentSessionBinding } from '../features/moments/MomentInteractionBindings';
import { createMomentFeedRequestKey, MomentFeedCache, MomentFeedFormatter } from '../features/moments/MomentFeedModels';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { ReportPanel } from '../features/user/ReportPanel';
import { AppRoute, NavigationRouteParam } from '../model/NavigationModels';
import { MomentSummary } from '../model/ApiModels';
import { ErrorMapper, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct MomentFeedPage {
  @State private loading: boolean = true;
  @State private errorMessage: string = '';
  @State private authenticationRequired: boolean = false;
  @State private items: MomentSummary[] = [];
  @State private favoriteBusyId: number = 0;
  @State private requestInFlight: boolean = false;
  @State private scope: string = 'latest';
  @State private favoriteUncertain: boolean = false;
  @State private currentUserId: number = 0;
  @State private selectedReportId: number = 0;
  @State private reportIdentityLoading: boolean = false;
  @State private reportIdentityError: string = '';
  @State private lifecycleUnavailable: boolean = false;
  @State private interaction: MomentInteractionSnapshot = new MomentInteractionSnapshot();
  @State private detailOpen: boolean = false;
  private detailNavigationPending: boolean = false;
  private interactions?: MomentInteractions;
  private readonly appClient: AppClient = AppClient.shared;
  private readonly cache: MomentFeedCache = MomentFeedCache.shared;
  private requestVersion: number = 0;
  private viewVersion: number = 0;
  private sessionVersion: number = -1;
  private active: boolean = false;
  private readonly listRequestKey: string = createMomentFeedRequestKey();
  private readonly identityRequestKey: string = `${this.listRequestKey}.identity`;
  private lifecycle?: MomentFeedLifecycle;
  onRequireLogin?: () => void;
  onOpenAuthor?: (userId: number, role: string) => void;

  aboutToAppear(): void {
    this.active = true;
    this.synchronizeSession();
    this.ensureInteractions().resume();
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.showAuthenticationRequired();
      return;
    }
    const cached = this.cache.read(Date.now(), this.sessionVersion, this.scope);
    if (cached !== undefined) {
      this.items = cached;
      this.loading = false;
      this.errorMessage = '';
      this.authenticationRequired = false;
    }
    // Cached data may paint immediately, but re-entry must revalidate moderation visibility.
    this.load(true);
  }

  aboutToDisappear(): void {
    this.lifecycle?.stop();
    this.lifecycle = undefined;
    this.suspendFeed(false);
  }

  private observeLifecycle(): void {
    if (this.lifecycle !== undefined) {
      return;
    }
    try {
      this.lifecycleUnavailable = false;
      this.lifecycle = new MomentFeedLifecycle(this.getUIContext(),
        (update?: uiObserver.NavDestinationInfo) => this.isRouteVisible(update),
        (visible: boolean) => this.handleVisibility(visible), () => this.handleLifecycleUnavailable());
      this.lifecycle.start();
    } catch {
      this.handleLifecycleUnavailable();
    }
  }

  private isRouteVisible(update?: uiObserver.NavDestinationInfo): boolean {
    const navigation = this.queryNavigationInfo();
    if (navigation === undefined) {
      throw new Error('Navigation context unavailable');
    }
    let destination = this.queryNavDestinationInfo();
    if (destination === undefined) {
      return navigation.pathStack.size() === 0;
    }
    if (update !== undefined && update.navDestinationId === destination.navDestinationId) {
      destination = update;
    }
    return destination.index === navigation.pathStack.size() - 1 &&
      destination.state !== uiObserver.NavDestinationState.ON_HIDDEN &&
      destination.state !== uiObserver.NavDestinationState.ON_WILL_HIDE &&
      destination.state !== uiObserver.NavDestinationState.ON_DISAPPEAR &&
      destination.state !== uiObserver.NavDestinationState.ON_WILL_DISAPPEAR;
  }

  private handleVisibility(visible: boolean): void {
    if (!visible) {
      if (this.active) {
        this.suspendFeed();
      }
      return;
    }
    if (this.active) {
      return;
    }
    this.active = true;
    this.loading = true;
    this.synchronizeSession();
    this.ensureInteractions().resume();
    this.load(true);
  }

  private handleLifecycleUnavailable(): void {
    this.lifecycle?.stop();
    this.lifecycle = undefined;
    this.suspendFeed();
    this.lifecycleUnavailable = true;
    this.errorMessage = '页面状态监听不可用，请重试。';
  }

  private suspendFeed(clearCache: boolean = true): void {
    this.active = false;
    this.detailNavigationPending = false;
    this.interactions?.suspend();
    this.viewVersion++;
    this.requestVersion++;
    this.requestInFlight = false;
    if (clearCache || this.favoriteBusyId !== 0) {
      this.cache.clear();
    }
    this.favoriteBusyId = 0;
    this.selectedReportId = 0;
    this.currentUserId = 0;
    this.reportIdentityLoading = false;
    this.reportIdentityError = '';
    this.items = [];
    this.loading = false;
    this.errorMessage = '';
    this.appClient.apiService.cancelCurrentSession(this.identityRequestKey);
    this.appClient.apiService.cancelMoments(this.listRequestKey);
  }

  private synchronizeSession(): void {
    const current = this.appClient.sessionManager.getSessionVersion();
    if (current !== this.sessionVersion) {
      if (this.sessionVersion >= 0) {
        this.cache.clear();
      }
      if (this.sessionVersion >= 0) { this.appClient.apiService.cancelCurrentSession(this.identityRequestKey); }
      this.detailNavigationPending = false;
      this.sessionVersion = current;
      this.viewVersion++;
      this.requestVersion++;
      this.requestInFlight = false;
      this.favoriteBusyId = 0;
      this.favoriteUncertain = false;
      this.currentUserId = 0;
      this.selectedReportId = 0;
      this.reportIdentityLoading = false;
      this.reportIdentityError = '';
      this.items = [];
      this.errorMessage = '';
      this.interactions?.suspend();
      if (this.active) {
        this.interactions?.resume();
      }
    }
  }

  private isCurrent(viewVersion: number, sessionVersion: number): boolean {
    if (!this.active || viewVersion !== this.viewVersion) {
      return false;
    }
    if (sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
      this.synchronizeSession();
      this.loading = false;
      if (!this.appClient.sessionManager.isAuthenticated()) {
        this.showAuthenticationRequired();
      } else {
        this.errorMessage = '身份已变化，请刷新动态。';
      }
      return false;
    }
    return true;
  }

  private selectScope(scope: string): void {
    if (!this.active) {
      return;
    }
    this.synchronizeSession();
    if (scope === this.scope || !['latest', 'hot', 'following'].includes(scope) || this.favoriteBusyId !== 0 ||
      this.interaction.likeBusyId !== 0) {
      return;
    }
    this.requestVersion++;
    this.appClient.apiService.cancelMoments(this.listRequestKey);
    this.requestInFlight = false;
    this.scope = scope;
    this.selectedReportId = 0;
    this.items = this.cache.read(Date.now(), this.sessionVersion, scope) ?? [];
    this.errorMessage = '';
    this.load(true);
  }

  private async load(force: boolean): Promise<void> {
    this.synchronizeSession();
    if (!this.active || this.requestInFlight || this.favoriteBusyId !== 0 || this.interaction.likeBusyId !== 0) {
      return;
    }
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.showAuthenticationRequired();
      return;
    }
    if (this.currentUserId === 0 && !this.reportIdentityLoading) {
      this.loadReportIdentity();
    }
    if (!force) {
      const cached = this.cache.read(Date.now(), this.sessionVersion, this.scope);
      if (cached !== undefined) {
        this.items = cached;
        this.loading = false;
        this.errorMessage = '';
        return;
      }
    }

    const version = ++this.requestVersion;
    const viewVersion = this.viewVersion;
    const sessionVersion = this.sessionVersion;
    const scope = this.scope;
    this.selectedReportId = 0;
    this.requestInFlight = true;
    this.loading = this.items.length === 0;
    this.errorMessage = '';
    this.authenticationRequired = false;
    try {
      if (this.cache.hasPendingFavorite(sessionVersion)) {
        await this.cache.waitForFavorite(sessionVersion);
        if (!this.isCurrent(viewVersion, sessionVersion) || version !== this.requestVersion) {
          return;
        }
      }
      let revision = this.cache.getWriteRevision(sessionVersion);
      let result: MomentSummary[] | undefined = undefined;
      let failure: PortraError | undefined = undefined;
      try {
        result = await this.appClient.apiService.listMoments(scope, this.listRequestKey);
      } catch (error) {
        failure = error as PortraError;
      }
      if (!this.isCurrent(viewVersion, sessionVersion) || version !== this.requestVersion) {
        return;
      }
      if (revision !== this.cache.getWriteRevision(sessionVersion)) {
        await this.cache.waitForFavorite(sessionVersion);
        if (!this.isCurrent(viewVersion, sessionVersion) || version !== this.requestVersion) {
          return;
        }
        revision = this.cache.getWriteRevision(sessionVersion);
        failure = undefined;
        try {
          result = await this.appClient.apiService.listMoments(scope, this.listRequestKey);
        } catch (error) {
          failure = error as PortraError;
        }
        if (!this.isCurrent(viewVersion, sessionVersion) || version !== this.requestVersion) {
          return;
        }
        if (revision !== this.cache.getWriteRevision(sessionVersion)) {
          throw ErrorMapper.stale();
        }
      }
      if (failure !== undefined) {
        throw failure;
      }
      if (result === undefined || !Array.isArray(result) || result.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item))) {
        throw ErrorMapper.parse();
      }
      const nextItems = MomentFeedFormatter.deduplicate(result);
      nextItems.forEach((item: MomentSummary) => this.cache.clearUncertainFavorite(sessionVersion, item.momentId));
      this.items = nextItems;
      this.favoriteUncertain = false;
      this.cache.write(nextItems, Date.now(), sessionVersion, scope);
    } catch (error) {
      if (!this.isCurrent(viewVersion, sessionVersion) || version !== this.requestVersion ||
        ErrorMapper.isStale(error as PortraError)) {
        return;
      }
      const mapped = error as PortraError;
      this.authenticationRequired = ErrorMapper.isAuthenticationExpired(mapped);
      this.errorMessage = mapped.message?.length > 0 ? mapped.message : '动态加载失败，请稍后重试。';
      if (this.authenticationRequired) {
        this.showAuthenticationRequired();
      }
    } finally {
      if (this.isCurrent(viewVersion, sessionVersion) && version === this.requestVersion) {
        this.requestInFlight = false;
        this.loading = false;
      }
    }
  }

  private showAuthenticationRequired(): void {
    this.interactions?.suspend();
    this.loading = false;
    this.authenticationRequired = true;
    this.errorMessage = '登录后可查看真实动态 Feed。';
    this.items = [];
    this.currentUserId = 0;
    this.selectedReportId = 0;
    this.cache.clear();
  }

  private async loadReportIdentity(): Promise<void> {
    this.synchronizeSession();
    if (!this.active || this.reportIdentityLoading || !this.appClient.sessionManager.isAuthenticated()) {
      return;
    }
    const viewVersion = this.viewVersion;
    const sessionVersion = this.sessionVersion;
    this.reportIdentityLoading = true;
    this.reportIdentityError = '';
    try {
      const session = await this.appClient.apiService.currentSession(this.identityRequestKey);
      if (!this.isCurrent(viewVersion, sessionVersion)) {
        return;
      }
      if (session === null || !Number.isSafeInteger(session.userId) || session.userId <= 0) {
        throw ErrorMapper.parse();
      }
      this.currentUserId = session.userId;
    } catch (error) {
      if (!this.isCurrent(viewVersion, sessionVersion)) {
        return;
      }
      this.currentUserId = 0;
      this.reportIdentityError = '举报身份读取失败，请重试。';
    } finally {
      if (this.isCurrent(viewVersion, sessionVersion)) {
        this.reportIdentityLoading = false;
      }
    }
  }

  private openReport(item: MomentSummary): void {
    this.synchronizeSession();
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.onRequireLogin?.();
      return;
    }
    const current = this.items.find((value: MomentSummary) => value.momentId === item.momentId);
    if (!this.active || this.requestInFlight || this.favoriteBusyId !== 0 || this.interaction.likeBusyId !== 0 ||
      this.detailOpen || this.currentUserId <= 0 || current === undefined ||
      current.authorId === this.currentUserId) {
      return;
    }
    this.selectedReportId = current.momentId;
  }

  private handleErrorAction(): void {
    if (this.lifecycleUnavailable) {
      this.observeLifecycle();
    } else if (this.authenticationRequired) {
      this.onRequireLogin?.();
    } else {
      this.load(true);
    }
  }

  private async toggleFavorite(item: MomentSummary): Promise<void> {
    this.synchronizeSession();
    if (!this.active || this.selectedReportId === item.momentId || this.favoriteBusyId !== 0 ||
      this.requestInFlight || this.favoriteUncertain || this.interaction.likeBusyId !== 0 || this.detailOpen ||
      this.cache.hasPendingFavorite(this.sessionVersion)) {
      return;
    }
    const current = this.items.find((value: MomentSummary) => value.momentId === item.momentId);
    if (current === undefined) {
      return;
    }
    const viewVersion = this.viewVersion;
    const sessionVersion = this.sessionVersion;
    const scope = this.scope;
    const desired = !current.favoritedByCurrentUser;
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.showAuthenticationRequired();
      return;
    }
    this.favoriteBusyId = item.momentId;
    this.errorMessage = '';
    try {
      const result = await MomentFavoriteWrite.execute(new MomentApiBinding(this.appClient.apiService),
        this.cache, sessionVersion, current);
      if (!this.isCurrent(viewVersion, sessionVersion)) {
        return;
      }
      if (!MomentFeedFormatter.isValid(result) || result.momentId !== item.momentId ||
        result.favoritedByCurrentUser !== desired) {
        throw ErrorMapper.parse();
      }
      this.items = this.items.map((current: MomentSummary) =>
        current.momentId === result.momentId ? MomentDetailData.feedPreview(result) : current);
      this.cache.clear();
      this.cache.write(this.items, Date.now(), sessionVersion, scope);
    } catch (error) {
      if (!this.isCurrent(viewVersion, sessionVersion)) {
        return;
      }
      this.cache.clear();
      this.favoriteUncertain = true;
      const mapped = error as PortraError;
      this.authenticationRequired = ErrorMapper.isAuthenticationExpired(mapped);
      this.errorMessage = `${mapped.message?.length > 0 ? mapped.message : '收藏结果未确认。'} 请刷新确认后再操作。`;
      if (this.authenticationRequired) {
        this.showAuthenticationRequired();
      }
    } finally {
      if (this.isCurrent(viewVersion, sessionVersion)) {
        this.favoriteBusyId = 0;
      }
    }
  }

  private ensureInteractions(): MomentInteractions {
    if (this.interactions === undefined) {
      this.interactions = new MomentInteractions(new MomentApiBinding(this.appClient.apiService),
        new MomentSessionBinding(this.appClient.sessionManager), this.cache,
        (state: MomentInteractionSnapshot) => {
          this.interaction = state;
          this.detailOpen = state.loading && this.active;
          if (state.unavailableMomentId > 0) {
            this.items = this.items.filter((item: MomentSummary) => item.momentId !== state.unavailableMomentId);
          }
          if (state.authenticationRequired && this.active) {
            this.showAuthenticationRequired();
          }
        }, (result: MomentSummary) => {
          if (!this.active) {
            return;
          }
          this.items = this.items.map((item: MomentSummary) => item.momentId === result.momentId ? result : item);
          this.cache.clear();
          if (!this.cache.hasPendingFavorite(this.sessionVersion)) {
            this.cache.write(this.items, Date.now(), this.sessionVersion, this.scope);
          }
        });
    }
    return this.interactions;
  }

  private async openDetail(item: MomentSummary): Promise<void> {
    this.synchronizeSession();
    const current = this.items.find((row: MomentSummary) => row.momentId === item.momentId);
    if (!this.active || current === undefined || this.detailNavigationPending ||
      this.favoriteBusyId !== 0 || this.interaction.likeBusyId !== 0 || this.selectedReportId === item.momentId ||
      this.cache.hasPendingFavorite(this.sessionVersion) || !this.appClient.sessionManager.isAuthenticated()) { return; }
    const navigation = this.queryNavigationInfo();
    if (navigation === undefined) { this.errorMessage = '图片页面暂不可用，请重试。'; return; }
    this.detailNavigationPending = true;
    const param: NavigationRouteParam = { momentId: current.momentId };
    try { navigation.pathStack.pushPathByName(AppRoute.MOMENT_DETAIL, param); }
    catch { this.detailNavigationPending = false; this.errorMessage = '图片页面暂不可用，请重试。'; }
  }

  private async verifyLikeResult(): Promise<void> {
    if (this.interaction.loading) { return; }
    const view = this.viewVersion; const version = this.sessionVersion;
    const target = this.interaction.uncertainMomentId;
    await this.readDetail(target, false);
    if (this.isCurrent(view, version) && this.interaction.targetId === target) { this.interactions?.close(true); }
  }

  private async readDetail(momentId: number, requireListed: boolean): Promise<void> {
    this.synchronizeSession();
    if (!this.active || this.requestInFlight || this.favoriteBusyId !== 0 ||
      this.interaction.likeBusyId !== 0 || this.selectedReportId === momentId ||
      (requireListed && !this.items.some((current: MomentSummary) => current.momentId === momentId))) {
      return;
    }
    await this.ensureInteractions().open(momentId);
  }

  private closeDetail(): void {
    this.interactions?.close();
  }

  private openAuthor(item: MomentSummary): void {
    this.synchronizeSession();
    const current = this.detailOpen && this.interaction.item?.momentId === item.momentId ? this.interaction.item :
      this.items.find((record: MomentSummary) => record.momentId === item.momentId);
    if (!this.active || current === undefined || !this.appClient.sessionManager.isAuthenticated() ||
      this.favoriteBusyId !== 0 || this.interaction.likeBusyId !== 0 || this.requestInFlight ||
      this.selectedReportId === item.momentId || !['CUSTOMER', 'PROVIDER'].includes(current.authorRole)) {
      return;
    }
    this.closeDetail();
    this.onOpenAuthor?.(current.authorId, current.authorRole);
  }

  private async toggleLike(item: MomentSummary): Promise<void> {
    this.synchronizeSession();
    const current = this.detailOpen && this.interaction.item?.momentId === item.momentId ? this.interaction.item :
      this.items.find((record: MomentSummary) => record.momentId === item.momentId);
    if (!this.active || this.requestInFlight || this.favoriteBusyId !== 0 ||
      this.selectedReportId === item.momentId || current === undefined) {
      return;
    }
    await this.ensureInteractions().toggleLike(current);
  }

  build() {
    Column() {
      Row() {
        Column({ space: 7 }) {
          Row({ space: 8 }) {
            Divider().width(26).height(2).color(PortraTheme.primary)
            Text('MOMENTS').fontSize(10).letterSpacing(3).fontColor(PortraTheme.primary)
          }
          Text('动态').fontSize(28).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          Text('分享此刻，遇见同好。').fontSize(12).fontColor(PortraTheme.secondaryText)
        }
        .alignItems(HorizontalAlign.Start)
        Blank()
        Button(this.requestInFlight ? '刷新中' : '刷新')
          .height(36)
          .fontSize(PortraTheme.fontBodySmall)
          .fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft)
          .borderRadius(PortraTheme.radiusPill)
          .enabled(!this.requestInFlight && this.favoriteBusyId === 0 && this.interaction.likeBusyId === 0)
          .accessibilityText('刷新当前动态频道')
          .onClick(() => this.load(true))
      }
      .width('100%')
      .constraintSize({ minHeight: 120 })
      .padding({ left: PortraTheme.spacingXl, right: PortraTheme.spacingXl, top: 16, bottom: 18 })
      .backgroundColor(PortraTheme.pageBackground)
      .border({ width: { bottom: 1 }, color: PortraTheme.border })

      if (this.interaction.message.length > 0 && !this.detailOpen) {
        Row({ space: PortraTheme.spacingSm }) {
          Text(this.interaction.message)
            .layoutWeight(1)
            .fontSize(PortraTheme.fontBodySmall)
            .fontColor(PortraTheme.danger)
          Button('核实结果')
            .enabled(!this.interaction.loading && this.interaction.likeBusyId === 0 && this.selectedReportId !== this.interaction.uncertainMomentId)
            .onClick(() => this.verifyLikeResult())
        }
        .width('100%')
        .padding(PortraTheme.spacingMd)
      }

      Row({ space: PortraTheme.spacingSm }) {
        ForEach(['latest', 'hot', 'following'], (scope: string) => {
          Button(scope === 'latest' ? '最新' : scope === 'hot' ? '热门' : '关注')
            .layoutWeight(1)
            .constraintSize({ minHeight: 36 })
            .fontSize(PortraTheme.fontBodySmall)
            .fontColor(this.scope === scope ? PortraTheme.primary : PortraTheme.secondaryText)
            .backgroundColor(this.scope === scope ? PortraTheme.primarySoft : PortraTheme.surface)
            .borderRadius(PortraTheme.radiusPill)
            .enabled(this.favoriteBusyId === 0 && this.interaction.likeBusyId === 0)
            .accessibilityText(`${scope === 'latest' ? '最新' : scope === 'hot' ? '热门' : '关注'}动态${this.scope === scope ? '，已选择' : ''}`)
            .onClick(() => this.selectScope(scope))
        })
      }
      .width('100%')
      .padding({ left: PortraTheme.spacingLg, right: PortraTheme.spacingLg, top: 10, bottom: 10 })

      if (this.reportIdentityLoading) {
        Text('正在确认举报身份…')
          .fontSize(PortraTheme.fontCaption)
          .fontColor(PortraTheme.secondaryText)
      } else if (this.reportIdentityError.length > 0) {
        Button('举报身份读取失败，点击重试')
          .fontSize(PortraTheme.fontBodySmall)
          .fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft)
          .onClick(() => this.loadReportIdentity())
      }

      if (this.loading) {
        PortraLoading({ label: '正在读取动态…' })
          .layoutWeight(1)
      } else if (this.errorMessage.length > 0 && this.items.length === 0) {
        PortraErrorView({
          message: this.errorMessage,
          actionLabel: this.authenticationRequired ? '去登录' : '重试',
          onRetry: () => this.handleErrorAction()
        })
          .layoutWeight(1)
      } else if (this.items.length === 0) {
        PortraEmptyView({ message: this.scope === 'following' ? '暂无关注动态' : '暂时没有已发布的动态' })
          .layoutWeight(1)
      } else {
        Scroll() {
          Column({ space: PortraTheme.spacingLg }) {
            if (this.errorMessage.length > 0) {
              Row() {
                Text(this.errorMessage)
                  .layoutWeight(1)
                  .fontSize(PortraTheme.fontBodySmall)
                  .fontColor(PortraTheme.danger)
                Button(this.authenticationRequired ? '去登录' : '刷新确认')
                  .height(32)
                  .fontSize(PortraTheme.fontCaption)
                  .fontColor(PortraTheme.primary)
                  .backgroundColor(PortraTheme.primarySoft)
                  .enabled(!this.requestInFlight && this.favoriteBusyId === 0)
                  .onClick(() => this.handleErrorAction())
              }
              .width('100%')
              .padding(PortraTheme.spacingMd)
              .backgroundColor('#FFF0EC')
              .borderRadius(PortraTheme.radius)
            }
            // Same-ID server replacements must not retain a previous DTO/closure.
            ForEach(this.items, (item: MomentSummary) => {
              Column({ space: PortraTheme.spacingSm }) {
              MomentCard({
                item: item,
                detailDisabled: this.selectedReportId === item.momentId || this.favoriteBusyId !== 0 ||
                  this.interaction.likeBusyId !== 0,
                likeBusy: this.interaction.likeBusyId === item.momentId,
                likeUncertain: this.interactions?.isLikeUncertain(item.momentId) ?? false,
                favoriteBusy: this.favoriteBusyId === item.momentId,
                interactionsDisabled: this.selectedReportId === item.momentId || this.favoriteBusyId !== 0 ||
                  this.interaction.likeBusyId !== 0 ||
                  this.requestInFlight || this.favoriteUncertain,
                onToggleLike: (target: MomentSummary) => this.toggleLike(target),
                onOpenDetail: (target: MomentSummary) => this.openDetail(target),
                onOpenAuthor: this.onOpenAuthor === undefined ? undefined :
                  (target: MomentSummary) => this.openAuthor(target),
                onToggleFavorite: (target: MomentSummary) => this.toggleFavorite(target),
                reportAllowed: this.currentUserId > 0 && item.authorId !== this.currentUserId,
                onRequestReport: (target: MomentSummary) => this.openReport(target)
              })
              if (this.selectedReportId === item.momentId) {
                Column({ space: PortraTheme.spacingSm }) {
                  Text(`举报动态 #${item.momentId} · ${MomentFeedFormatter.title(item)}`)
                    .width('100%')
                    .fontSize(PortraTheme.fontBodySmall)
                    .fontColor(PortraTheme.primaryText)
                  ReportPanel({
                    targetType: 'MOMENT',
                    targetId: item.momentId,
                    ownerId: item.authorId,
                    currentUserId: this.currentUserId,
                    onRequireLogin: this.onRequireLogin
                  })
                  Button('关闭举报')
                    .fontSize(PortraTheme.fontBodySmall)
                    .fontColor(PortraTheme.secondaryText)
                    .backgroundColor(PortraTheme.surface)
                    .onClick(() => this.selectedReportId = 0)
                }
                .width('100%')
                .padding(PortraTheme.spacingMd)
                .backgroundColor(PortraTheme.surface)
                .borderRadius(PortraTheme.radius)
              }
              }
              .width('100%')
            }, (item: MomentSummary) => `${this.viewVersion}:${JSON.stringify(item)}`)
          }
          .width('100%')
          .padding({
            left: PortraTheme.spacingLg,
            right: PortraTheme.spacingLg,
            top: PortraTheme.spacingLg,
            bottom: PortraTheme.spacing2Xl
          })
        }
        .layoutWeight(1)
        .width('100%')
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
    .onAppear(() => this.observeLifecycle())
  }
}
