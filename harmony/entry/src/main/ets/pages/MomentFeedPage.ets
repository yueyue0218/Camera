import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraLoading } from '../common/components/PortraLoading';
import { MomentCard } from '../features/moments/MomentCard';
import { createMomentFeedRequestKey, MomentFeedCache, MomentFeedFormatter } from '../features/moments/MomentFeedModels';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { ReportPanel } from '../features/user/ReportPanel';
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
  private readonly appClient: AppClient = AppClient.shared;
  private readonly cache: MomentFeedCache = MomentFeedCache.shared;
  private requestVersion: number = 0;
  private viewVersion: number = 0;
  private sessionVersion: number = -1;
  private active: boolean = false;
  private readonly listRequestKey: string = createMomentFeedRequestKey();
  private lifecycle?: MomentFeedLifecycle;
  onRequireLogin?: () => void;

  aboutToAppear(): void {
    this.active = true;
    this.synchronizeSession();
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
    this.appClient.apiService.cancelMoments(this.listRequestKey);
  }

  private synchronizeSession(): void {
    const current = this.appClient.sessionManager.getSessionVersion();
    if (current !== this.sessionVersion) {
      if (this.sessionVersion >= 0) {
        this.cache.clear();
      }
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
    if (scope === this.scope || !['latest', 'hot', 'following'].includes(scope) || this.favoriteBusyId !== 0) {
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
    if (!this.active || this.requestInFlight || this.favoriteBusyId !== 0) {
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
      const result = await this.appClient.apiService.listMoments(scope, this.listRequestKey);
      if (!this.isCurrent(viewVersion, sessionVersion) || version !== this.requestVersion) {
        return;
      }
      if (!Array.isArray(result) || result.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item))) {
        throw ErrorMapper.parse();
      }
      const nextItems = MomentFeedFormatter.deduplicate(result);
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
      const session = await this.appClient.apiService.currentSession();
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
    if (!this.active || this.requestInFlight || this.favoriteBusyId !== 0 || this.currentUserId <= 0 || current === undefined ||
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
      this.requestInFlight || this.favoriteUncertain ||
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
      const request = current.favoritedByCurrentUser ?
        this.appClient.apiService.unfavoriteMoment(item.momentId) :
        this.appClient.apiService.favoriteMoment(item.momentId);
      this.cache.trackFavorite(request, sessionVersion);
      const result = await request;
      if (!this.isCurrent(viewVersion, sessionVersion)) {
        return;
      }
      if (!MomentFeedFormatter.isValid(result) || result.momentId !== item.momentId ||
        result.favoritedByCurrentUser !== desired) {
        throw ErrorMapper.parse();
      }
      this.items = this.items.map((current: MomentSummary) =>
        current.momentId === result.momentId ? result : current);
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

  build() {
    Column() {
      Row() {
        Column({ space: 3 }) {
          Text('动态')
            .fontSize(PortraTheme.fontHero)
            .fontWeight(FontWeight.Bold)
            .fontColor(PortraTheme.primaryText)
          Text('MOMENTS')
            .fontSize(PortraTheme.fontCaption)
            .fontColor(PortraTheme.secondaryText)
        }
        .alignItems(HorizontalAlign.Start)
        Blank()
        Button(this.requestInFlight ? '刷新中' : '刷新')
          .height(36)
          .fontSize(PortraTheme.fontBodySmall)
          .fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft)
          .borderRadius(PortraTheme.radiusPill)
          .enabled(!this.requestInFlight && this.favoriteBusyId === 0)
          .accessibilityText('刷新当前动态频道')
          .onClick(() => this.load(true))
      }
      .width('100%')
      .constraintSize({ minHeight: 82 })
      .padding({ left: PortraTheme.spacingXl, right: PortraTheme.spacingXl })
      .backgroundColor(PortraTheme.pageBackground)
      .border({ width: { bottom: 1 }, color: PortraTheme.border })

      Row({ space: PortraTheme.spacingSm }) {
        ForEach(['latest', 'hot', 'following'], (scope: string) => {
          Button(scope === 'latest' ? '最新' : scope === 'hot' ? '热门' : '关注')
            .layoutWeight(1)
            .constraintSize({ minHeight: 36 })
            .fontSize(PortraTheme.fontBodySmall)
            .fontColor(this.scope === scope ? PortraTheme.primary : PortraTheme.secondaryText)
            .backgroundColor(this.scope === scope ? PortraTheme.primarySoft : PortraTheme.surface)
            .borderRadius(PortraTheme.radiusPill)
            .enabled(this.favoriteBusyId === 0)
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
                favoriteBusy: this.favoriteBusyId === item.momentId,
                interactionsDisabled: this.selectedReportId === item.momentId || this.favoriteBusyId !== 0 ||
                  this.requestInFlight || this.favoriteUncertain,
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
