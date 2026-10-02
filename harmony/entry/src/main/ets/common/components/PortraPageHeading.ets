import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraPageHeading {
  @Prop title: string = '';
  @Prop eyebrow: string = '';
  onBack?: () => void;

  build() {
    Row({ space: 12 }) {
      Button('‹')
        .width(36)
        .height(36)
        .fontSize(27)
        .fontColor(PortraTheme.primaryText)
        .backgroundColor(Color.Transparent)
        .borderRadius(18)
        .accessibilityText('返回')
        .onClick(() => this.onBack?.())
      Column({ space: 2 }) {
        if (this.eyebrow.length > 0) {
          Text(this.eyebrow)
            .fontSize(10)
            .fontColor(PortraTheme.secondaryText)
        }
        Text(this.title)
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height(64)
    .padding({ left: 12, right: 20 })
    .backgroundColor(PortraTheme.pageBackground)
  }
}
