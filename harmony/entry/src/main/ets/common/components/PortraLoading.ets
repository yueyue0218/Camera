import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraLoading {
  @Prop label: string = '加载中…';

  build() {
    Row() {
      Text('…')
        .fontSize(20)
        .fontColor(PortraTheme.primary)
      Text(this.label)
        .fontSize(14)
        .fontColor(PortraTheme.secondaryText)
        .margin({ left: 8 })
    }
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .width('100%')
    .height(48)
  }
}
