import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraEmptyView {
  @Prop message: string = '暂无内容';

  build() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Row()
          .width(52)
          .height(52)
          .borderRadius(PortraTheme.radiusPill)
          .backgroundColor(PortraTheme.primarySoft)
        Text('P')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primary)
      }
      Text(this.message)
        .fontSize(14)
        .fontColor(PortraTheme.secondaryText)
        .margin({ top: PortraTheme.spacingMd })
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .padding(24)
    .constraintSize({ minHeight: 180 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}
