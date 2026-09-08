import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraLoading {
  @Prop label: string = '加载中…';

  build() {
    Column({ space: PortraTheme.spacingMd }) {
      LoadingProgress()
        .width(28)
        .height(28)
        .color(PortraTheme.primary)
      Text(this.label)
        .fontSize(14)
        .fontColor(PortraTheme.secondaryText)
        .textAlign(TextAlign.Center)
    }
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .width('100%')
    .constraintSize({ minHeight: 180 })
  }
}
