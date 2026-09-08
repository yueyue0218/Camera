import { DemandSummary, ServicePackageSummary } from '../../model/ApiModels';
import { PortraAppBar } from '../../common/components/PortraAppBar';
import { PortraEmptyView } from '../../common/components/PortraEmptyView';
import { PortraErrorView } from '../../common/components/PortraErrorView';
import { PortraLoading } from '../../common/components/PortraLoading';
import { PortraTheme } from '../../theme/PortraTheme';
import { DemandCard, PortraPublishBanner, ShowcaseCard } from './components/HallCards';
import { HallFilters, HallSegmentedControl } from './components/HallControls';
import { HallChannel, HallContentState } from './HallUiModels';

@Component
export struct HallView {
  @Prop serviceState: HallContentState = HallContentState.LOADING;
  @Prop demandState: HallContentState = HallContentState.LOADING;
  @Prop serviceItems: ServicePackageSummary[] = [];
  @Prop demandItems: DemandSummary[] = [];
  @Prop serviceError: string = '';
  @Prop demandError: string = '';
  @Prop initialChannel: HallChannel = HallChannel.SHOWCASES;
  @State private channel: HallChannel = HallChannel.SHOWCASES;
  private readonly contentScroller: Scroller = new Scroller();
  onSearch?: () => void;
  onNotice?: () => void;
  onPublish?: () => void;
  onRetry?: () => void;
  onOpenService?: (serviceId: number) => void;
  onOpenDemand?: (demandId: number) => void;

  aboutToAppear(): void {
    this.channel = this.initialChannel;
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
            ShowcaseCard({ item: item, onOpen: this.onOpenService })
              .layoutWeight(1)
            if (index + 1 < this.serviceItems.length) {
              ShowcaseCard({ item: this.serviceItems[index + 1], onOpen: this.onOpenService })
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
          DemandCard({ item: item, onOpen: this.onOpenDemand })
        }, (item: DemandSummary) => item.demandId.toString())
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
        HallFilters()
      }
      .width('100%')
      .padding({ left: PortraTheme.spacingLg, right: PortraTheme.spacingLg, bottom: 5 })
      .backgroundColor(PortraTheme.pageBackground)
      .border({ width: { bottom: 1 }, color: PortraTheme.border })

      Scroll(this.contentScroller) {
        Column({ space: PortraTheme.spacingLg }) {
          if (this.channel === HallChannel.SHOWCASES) {
            PortraPublishBanner({ onPublish: this.onPublish })
            this.SectionHeading('精选镜头', '按风格与距离推荐')
            this.ShowcaseState()
          } else {
            this.SectionHeading('约拍需求', '查看最新公开需求')
            this.DemandState()
          }
        }
        .width('100%')
        .padding({
          left: PortraTheme.spacingLg,
          right: PortraTheme.spacingLg,
          top: PortraTheme.spacingSm,
          bottom: PortraTheme.spacing2Xl
        })
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.Spring)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
