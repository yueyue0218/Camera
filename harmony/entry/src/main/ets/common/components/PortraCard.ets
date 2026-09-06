import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraCard {
  @Prop title: string = '';
  @Prop description: string = '';

  build() {
    Column() {
      Text(this.title)
        .width('100%')
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)

      if (this.description.length > 0) {
        Text(this.description)
          .width('100%')
          .fontSize(14)
          .fontColor(PortraTheme.secondaryText)
          .margin({ top: 8 })
      }
    }
    .width('100%')
    .padding(16)
    .backgroundColor(PortraTheme.surface)
    .borderRadius(PortraTheme.radius)
    .border({ width: 1, color: PortraTheme.border })
  }
}
