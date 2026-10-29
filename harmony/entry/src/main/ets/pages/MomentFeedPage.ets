import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraLoading } from '../common/components/PortraLoading';
import { MomentCard } from '../features/moments/MomentCard';
import { MomentFeedCache, MomentFeedFormatter } from '../features/moments/MomentFeedModels';
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
  private readonly appClient: AppClient = AppClient.shared;
  private readonly cache: MomentFeedCache = MomentFeedCache.shared;
  private requestVersion: number = 0;
  private requestInFlight: boolean = false;
  onRequireLogin?: () => void;

  aboutToAppear(): void {
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.showAuthenticationRequired();
      return;
    }
    const cached = this.cache.read(Date.now(), this.appClient.sessionManager.getSessionVersion());
    if (cached !== undefined) {
      this.items = cached;
      this.loading = false;
      this.errorMessage = '';
      this.authenticationRequired = false;
      return;
    }
    this.load(false);
  }

  aboutToDisappear(): void {
    this.requestVersion++;
    this.requestInFlight = false;
    this.appClient.apiService.cancelMoments();
  }

  private async load(force: boolean): Promise<void> {
    if (this.requestInFlight) {
      return;
    }
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.showAuthenticationRequired();
      return;
    }
    if (!force) {
      const cached = this.cache.read(Date.now(), this.appClient.sessionManager.getSessionVersion());
      if (cached !== undefined) {
        this.items = cached;
        this.loading = false;
        this.errorMessage = '';
        return;
      }
    }

    const version = ++this.requestVersion;
    this.requestInFlight = true;
    this.loading = this.items.length === 0;
    this.errorMessage = '';
    this.authenticationRequired = false;
    try {
      const result = await this.appClient.apiService.listMoments('latest');
      if (version !== this.requestVersion) {
        return;
      }
      if (!Array.isArray(result) || result.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item))) {
        throw ErrorMapper.parse();
      }
      const nextItems = MomentFeedFormatter.deduplicate(result);
      this.items = nextItems;
      this.cache.write(nextItems, Date.now(), this.appClient.sessionManager.getSessionVersion());
    } catch (error) {
      if (version !== this.requestVersion || ErrorMapper.isStale(error as PortraError)) {
        return;
      }
      const mapped = error as PortraError;
      this.authenticationRequired = ErrorMapper.isAuthenticationExpired(mapped);
      this.errorMessage = mapped.message?.length > 0 ? mapped.message : '动态加载失败，请稍后重试。';
    } finally {
      if (version === this.requestVersion) {
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
  }

  private handleErrorAction(): void {
    if (this.authenticationRequired) {
      this.onRequireLogin?.();
    } else {
      this.load(true);
    }
  }

  private async toggleFavorite(item: MomentSummary): Promise<void> {
    if (this.favoriteBusyId !== 0) {
      return;
    }
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.showAuthenticationRequired();
      return;
    }
    this.favoriteBusyId = item.momentId;
    this.errorMessage = '';
    try {
      const result = item.favoritedByCurrentUser ?
        await this.appClient.apiService.unfavoriteMoment(item.momentId) :
        await this.appClient.apiService.favoriteMoment(item.momentId);
      if (!MomentFeedFormatter.isValid(result) || result.momentId !== item.momentId ||
        result.favoritedByCurrentUser === item.favoritedByCurrentUser) {
        throw ErrorMapper.parse();
      }
      this.items = this.items.map((current: MomentSummary) =>
        current.momentId === result.momentId ? result : current);
      this.cache.write(this.items, Date.now(), this.appClient.sessionManager.getSessionVersion());
    } catch (error) {
      const mapped = error as PortraError;
      this.authenticationRequired = ErrorMapper.isAuthenticationExpired(mapped);
      this.errorMessage = mapped.message?.length > 0 ? mapped.message : '收藏操作失败，请稍后重试。';
    } finally {
      this.favoriteBusyId = 0;
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
          Text('MOMENTS · 最新发布')
            .fontSize(PortraTheme.fontCaption)
            .fontColor(PortraTheme.secondaryText)
        }
        .alignItems(HorizontalAlign.Start)
        Blank()
        Button('刷新')
          .height(36)
          .fontSize(PortraTheme.fontBodySmall)
          .fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft)
          .borderRadius(PortraTheme.radiusPill)
          .enabled(!this.requestInFlight)
          .onClick(() => this.load(true))
      }
      .width('100%')
      .height(82)
      .padding({ left: PortraTheme.spacingXl, right: PortraTheme.spacingXl })
      .backgroundColor(PortraTheme.pageBackground)
      .border({ width: { bottom: 1 }, color: PortraTheme.border })

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
        PortraEmptyView({ message: '暂时没有已发布的动态' })
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
                Button('重试')
                  .height(32)
                  .fontSize(PortraTheme.fontCaption)
                  .fontColor(PortraTheme.primary)
                  .backgroundColor(PortraTheme.primarySoft)
                  .onClick(() => this.load(true))
              }
              .width('100%')
              .padding(PortraTheme.spacingMd)
              .backgroundColor('#FFF0EC')
              .borderRadius(PortraTheme.radius)
            }
            ForEach(this.items, (item: MomentSummary) => {
              MomentCard({
                item: item,
                favoriteBusy: this.favoriteBusyId === item.momentId,
                onToggleFavorite: (target: MomentSummary) => this.toggleFavorite(target)
              })
            }, (item: MomentSummary) => item.momentId.toString())
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
  }
}
