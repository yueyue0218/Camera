import { HallFilterState } from './HallFilterState';
import { HallFilters } from './components/HallFilters';
import { DemandSummary, ServicePackageSummary } from '../../model/ApiModels';
import { PortraAppBar } from '../../common/components/PortraAppBar';
import { PortraEmptyView } from '../../common/components/PortraEmptyView';
import { PortraErrorView } from '../../common/components/PortraErrorView';
import { PortraLoading } from '../../common/components/PortraLoading';
import { PortraTheme } from '../../theme/PortraTheme';
import { DemandCard, PortraPublishBanner, ShowcaseCard } from './components/HallCards';
import { HallSegmentedControl } from './components/HallControls';
import { HallChannel, HallContentState } from './HallUiModels';

@Component
export struct HallView {
  @Prop @Watch('onHallReselected') reselectEpoch: number = 0;
  @Prop serviceRefreshing: boolean = false;
  @Prop demandRefreshing: boolean = false;
  onRefresh?: (channel: HallChannel) => void;
  @Prop serviceState: HallContentState = HallContentState.LOADING;
  @Prop demandState: HallContentState = HallContentState.LOADING;
  @Prop serviceItems: ServicePackageSummary[] = [];
  @Prop demandItems: DemandSummary[] = [];
  @Prop serviceError: string = '';
  @Prop demandError: string = '';
  @Prop initialChannel: HallChannel = HallChannel.SHOWCASES;
  @Prop serviceCities: string[] = [];
  @Prop demandCities: string[] = [];
  @Prop serviceStyles: string[] = [];
  @Prop demandStyles: string[] = [];
  @Prop serviceFilters: HallFilterState = new HallFilterState();
  @Prop demandFilters: HallFilterState = new HallFilterState();
  @Prop serviceHasMore: boolean = false;
  @Prop demandHasMore: boolean = false;
  @Prop serviceLoadingMore: boolean = false;
  @Prop demandLoadingMore: boolean = false;
  @Prop @Watch('onRoleChanged') currentRole: string = '';
  @Prop roleLoading: boolean = false;
  @Prop roleError: string = '';
  @State private channel: HallChannel = HallChannel.SHOWCASES;
  private readonly contentScroller: Scroller = new Scroller();
  onSearch?: () => void;
  onNotice?: () => void;
  onPublish?: () => void;
  onRetryRole?: () => void;
  onRetry?: () => void;
  onOpenAuthor?: (userId: number, role: string) => void;
  onOpenService?: (serviceId: number) => void;
  onOpenDemand?: (demandId: number) => void;
  onServiceFiltersChange?: (value: HallFilterState) => void;
  onDemandFiltersChange?: (value: HallFilterState) => void;
  onLoadMoreServices?: () => void;
  onLoadMoreDemands?: () => void;

  aboutToAppear(): void {
    this.channel = this.initialChannel;
    this.onRoleChanged();
  }

  private onRoleChanged(): void {
    if (this.currentRole === 'PROVIDER') {
      this.selectChannel(HallChannel.DEMANDS);
    } else if (this.currentRole === 'CUSTOMER') {
      this.selectChannel(HallChannel.SHOWCASES);
    }
  }

  private onHallReselected(): void {
    this.contentScroller.scrollTo({ xOffset: 0, yOffset: 0, animation: { duration: 250, curve: Curve.EaseOut } });
    this.onRefresh?.(this.channel);
  }

  private selectChannel(channel: HallChannel): void {
    if (channel === this.channel) {
      return;
    }
    this.contentScroller.scrollTo({ xOffset: 0, yOffset: 0, animation: false });
    this.channel = channel;
  }

  @Builder
  private SectionHeading(title: string, caption: string) {
    Row() {
      Text(title)
        .fontSize(PortraTheme.fontTitle)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
        .letterSpacing(1)
      Blank()
      Text(caption)
        .fontSize(PortraTheme.fontBodySmall)
        .fontColor(PortraTheme.secondaryText)
        .maxLines(2)
        .textAlign(TextAlign.End)
    }
    .width('100%')
    .alignItems(VerticalAlign.Bottom)
  }

  @Builder
  private ShowcaseRows() {
    Column({ space: PortraTheme.spacingMd }) {
      ForEach(this.serviceItems, (item: ServicePackageSummary, index: number) => {
        if (index % 2 === 0) {
          Row({ space: PortraTheme.spacingMd }) {
            ShowcaseCard({ item: item, onOpen: this.onOpenService, onOpenAuthor: this.onOpenAuthor })
              .layoutWeight(1)
            if (index + 1 < this.serviceItems.length) {
              ShowcaseCard({ item: this.serviceItems[index + 1], onOpen: this.onOpenService, onOpenAuthor: this.onOpenAuthor })
                .layoutWeight(1)
            } else {
              Blank().layoutWeight(1)
            }
          }
          .width('100%')
          .alignItems(VerticalAlign.Top)
        }
      }, (item: ServicePackageSummary) => item.serviceId.toString())
    }
    .width('100%')
  }

  @Builder
  private ShowcaseState() {
    if (this.serviceState === HallContentState.LOADING) {
      PortraLoading({ label: '正在寻找附近的镜头…' })
    } else if (this.serviceState === HallContentState.ERROR) {
      PortraErrorView({ message: this.serviceError, onRetry: this.onRetry })
    } else if (this.serviceState === HallContentState.EMPTY || this.serviceItems.length === 0) {
      PortraEmptyView({ message: '暂时没有可展示的摄影橱窗' })
    } else {
      this.ShowcaseRows()
      if (this.serviceHasMore) {
        Button(this.serviceLoadingMore ? '加载中…' : '加载更多橱窗')
          .enabled(!this.serviceLoadingMore)
          .onClick(() => this.onLoadMoreServices?.())
      }
    }
  }

  @Builder
  private DemandState() {
    if (this.demandState === HallContentState.LOADING) {
      PortraLoading({ label: '正在读取最新约拍需求…' })
    } else if (this.demandState === HallContentState.ERROR) {
      PortraErrorView({ message: this.demandError, onRetry: this.onRetry })
    } else if (this.demandState === HallContentState.EMPTY || this.demandItems.length === 0) {
      PortraEmptyView({ message: '暂时没有公开约拍需求' })
    } else {
      Column({ space: PortraTheme.spacingMd }) {
        ForEach(this.demandItems, (item: DemandSummary) => {
          DemandCard({ item: item, onOpen: this.onOpenDemand, onOpenAuthor: this.onOpenAuthor })
        }, (item: DemandSummary) => item.demandId.toString())
        if (this.demandHasMore) {
          Button(this.demandLoadingMore ? '加载中…' : '加载更多需求')
            .enabled(!this.demandLoadingMore)
            .onClick(() => this.onLoadMoreDemands?.())
        }
      }
      .width('100%')
    }
  }

  build() {
    Column() {
      PortraAppBar({ onSearch: this.onSearch, onNotice: this.onNotice })

      Column({ space: 7 }) {
        HallSegmentedControl({
          channel: this.channel,
          onChange: (channel: HallChannel) => this.selectChannel(channel)
        })
        HallFilters({
          channel: this.channel,
          cities: this.channel === HallChannel.SHOWCASES ? this.serviceCities : this.demandCities,
          styles: this.channel === HallChannel.SHOWCASES ? this.serviceStyles : this.demandStyles,
          filters: this.channel === HallChannel.SHOWCASES ? this.serviceFilters : this.demandFilters,
          onChange: (value: HallFilterState) => {
            this.contentScroller.scrollTo({ xOffset: 0, yOffset: 0, animation: false });
            if (this.channel === HallChannel.SHOWCASES) { this.onServiceFiltersChange?.(value); }
            else { this.onDemandFiltersChange?.(value); }
          }
        })
      }
      .width('100%')
      .padding({ left: PortraTheme.spacingLg, right: PortraTheme.spacingLg, bottom: 6 })
      .flexShrink(0)
      .backgroundColor(PortraTheme.pageBackground)
      .border({ width: { bottom: 1 }, color: PortraTheme.border })

      Refresh({ refreshing: this.channel === HallChannel.SHOWCASES ? this.serviceRefreshing : this.demandRefreshing }) {
        Scroll(this.contentScroller) {
          Column({ space: PortraTheme.spacingLg }) {
            if (this.channel === HallChannel.SHOWCASES) {
              PortraPublishBanner({ role: this.currentRole, roleLoading: this.roleLoading,
                roleError: this.roleError, onRetryRole: this.onRetryRole, onPublish: this.onPublish })
              this.SectionHeading('精选镜头', '按风格与距离推荐')
              if (this.serviceError.length > 0 && this.serviceState === HallContentState.CONTENT) {
                Button(this.serviceError + ' 点击重试').onClick(() => this.onRefresh?.(HallChannel.SHOWCASES))
              }
              this.ShowcaseState()
            } else {
              PortraPublishBanner({ role: this.currentRole, roleLoading: this.roleLoading,
                roleError: this.roleError, onRetryRole: this.onRetryRole, onPublish: this.onPublish })
              this.SectionHeading('约拍需求', '查看最新公开需求')
              if (this.demandError.length > 0 && this.demandState === HallContentState.CONTENT) {
                Button(this.demandError + ' 点击重试').onClick(() => this.onRefresh?.(HallChannel.DEMANDS))
              }
              this.DemandState()
            }
          }
          .width('100%')
          .padding({
            left: PortraTheme.spacingLg,
            right: PortraTheme.spacingLg,
            top: this.channel === HallChannel.SHOWCASES ? 6 : 0,
            bottom: PortraTheme.spacing2Xl
          })
        }
        .height('100%')
        .width('100%')
        .align(Alignment.Top)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.Spring)
        .clip(true)
      }
      .layoutWeight(1)
      .width('100%')
      .onRefreshing(() => this.onRefresh?.(this.channel))
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
