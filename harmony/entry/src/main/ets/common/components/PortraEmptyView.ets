import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraEmptyView {
  @Prop message: string = '暂无内容';

  build() {
    Column() {
      Text('暂无')
        .fontSize(20)
        .fontColor(PortraTheme.mutedText)
      Text(this.message)
        .fontSize(14)
        .fontColor(PortraTheme.secondaryText)
        .margin({ top: 8 })
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .padding(24)
    .alignItems(HorizontalAlign.Center)
  }
}
