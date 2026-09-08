import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraErrorView {
  @Prop message: string = '加载失败，请稍后再试';
  onRetry?: () => void;

  build() {
    Column() {
      Text('出错了')
        .fontSize(PortraTheme.fontTitle)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
      Text(this.message)
        .fontSize(14)
        .fontColor(PortraTheme.secondaryText)
        .margin({ top: 8 })
        .textAlign(TextAlign.Center)

      Button('重试')
        .height(40)
        .margin({ top: 16 })
        .fontColor(PortraTheme.primary)
        .backgroundColor(PortraTheme.primarySoft)
        .border({ width: 1, color: PortraTheme.primary })
        .borderRadius(PortraTheme.radiusPill)
        .onClick(() => this.onRetry?.())
    }
    .width('100%')
    .padding(24)
    .constraintSize({ minHeight: 180 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}
