import { HallChannel } from '../HallUiModels';
import { PortraTheme } from '../../../theme/PortraTheme';

@Component
export struct HallSegmentedControl {
  @Prop channel: HallChannel = HallChannel.SHOWCASES;
  onChange?: (channel: HallChannel) => void;

  @Builder
  private Segment(label: string, channel: HallChannel) {
    Column() {
      Button(label)
        .width('100%').height(32).padding(0).fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.channel === channel ? PortraTheme.primary : PortraTheme.secondaryText)
        .backgroundColor(Color.Transparent)
        .onClick(() => this.onChange?.(channel))
      Row().width(34).height(2).borderRadius(PortraTheme.radiusPill)
        .backgroundColor(this.channel === channel ? PortraTheme.primary : Color.Transparent)
    }.layoutWeight(1).alignItems(HorizontalAlign.Center)
  }

  build() {
    Row() {
      this.Segment('镜头', HallChannel.SHOWCASES)
      this.Segment('约拍', HallChannel.DEMANDS)
    }.width('75%')
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
