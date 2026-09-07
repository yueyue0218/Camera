import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraErrorView {
  @Prop message: string = '加载失败，请稍后再试';
  onRetry?: () => void;

  build() {
    Column() {
      Text('出错了')
        .fontSize(20)
        .fontColor(PortraTheme.danger)
      Text(this.message)
        .fontSize(14)
        .fontColor(PortraTheme.secondaryText)
        .margin({ top: 8 })
        .textAlign(TextAlign.Center)

      Button('重试')
        .height(40)
        .margin({ top: 16 })
        .fontColor(PortraTheme.primary)
        .backgroundColor(PortraTheme.surface)
        .border({ width: 1, color: PortraTheme.primary })
        .borderRadius(PortraTheme.radius)
        .onClick(() => this.onRetry?.())
    }
    .width('100%')
    .padding(24)
    .alignItems(HorizontalAlign.Center)
  }
}
