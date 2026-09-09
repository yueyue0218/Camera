import { HallChannel } from '../HallUiModels';
import { PortraTheme } from '../../../theme/PortraTheme';

@Component
export struct HallSegmentedControl {
  @Prop channel: HallChannel = HallChannel.SHOWCASES;
  onChange?: (channel: HallChannel) => void;

  @Builder
  private Segment(label: string, channel: HallChannel) {
    Button(label)
      .layoutWeight(1)
      .height(32)
      .padding(0)
      .fontSize(16)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.channel === channel ? PortraTheme.primary : PortraTheme.secondaryText)
      .backgroundColor(Color.Transparent)
      .onClick(() => this.onChange?.(channel))
  }

  build() {
    Column() {
      Row() {
        this.Segment('镜头', HallChannel.SHOWCASES)
        this.Segment('约拍', HallChannel.DEMANDS)
      }
      .width('75%')

      Row() {
        Row()
          .width(34)
          .height(2)
          .borderRadius(PortraTheme.radiusPill)
          .backgroundColor(PortraTheme.primary)
      }
      .width('37.5%')
      .justifyContent(FlexAlign.Center)
      .alignSelf(this.channel === HallChannel.SHOWCASES ? ItemAlign.Start : ItemAlign.End)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
  }
}

@Component
export struct PortraFilterChip {
  @Prop label: string = '';
  @Prop active: boolean = false;
  onSelect?: () => void;

  build() {
    Button(this.label)
      .height(32)
      .padding({ left: 13, right: 13 })
      .fontSize(PortraTheme.fontBodySmall)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.active ? PortraTheme.primary : '#5C5956')
      .backgroundColor(this.active ? PortraTheme.primarySoft : PortraTheme.surface)
      .border({ width: 1, color: this.active ? '#CDD5FF' : PortraTheme.border })
      .borderRadius(PortraTheme.radiusPill)
      .onClick(() => this.onSelect?.())
  }
}

@Component
export struct HallFilters {
  build() {
    Scroll() {
      Row({ space: PortraTheme.spacingSm }) {
        PortraFilterChip({ label: '全部地区' })
        PortraFilterChip({ label: '时间' })
        PortraFilterChip({ label: '风格' })
        PortraFilterChip({ label: '预算' })
        PortraFilterChip({ label: '更多筛选' })
      }
      .padding({ right: PortraTheme.spacingLg })
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width('100%')
    .height(39)
  }
}
