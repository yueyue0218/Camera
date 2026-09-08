import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraAppBar {
  @Prop showNoticeDot: boolean = false;
  onSearch?: () => void;
  onNotice?: () => void;

  @Builder
  private BrandMark() {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width(30)
        .height(30)
        .border({ width: 2, color: PortraTheme.primary })
        .borderRadius(PortraTheme.radiusSm)
      Row()
        .width(12)
        .height(12)
        .border({ width: 2, color: PortraTheme.primary })
        .borderRadius(PortraTheme.radiusPill)
      Row()
        .width(6)
        .height(6)
        .backgroundColor(PortraTheme.accent)
        .borderRadius(PortraTheme.radiusPill)
        .position({ x: 20, y: 4 })
    }
    .width(30)
    .height(30)
    .rotate({ angle: -4 })
  }

  @Builder
  private IconButton(icon: Resource, label: string, action?: () => void) {
    Button({ type: ButtonType.Circle }) {
      Image(icon)
        .width(21)
        .height(21)
        .fillColor(PortraTheme.primaryText)
        .accessibilityText(label)
    }
    .width(40)
    .height(40)
    .backgroundColor(Color.Transparent)
    .stateStyles({
      pressed: { .backgroundColor('#10FFFFFF') },
      normal: { .backgroundColor(Color.Transparent) }
    })
    .onClick(() => action?.())
  }

  build() {
    Row() {
      this.BrandMark()
      Text('Portra')
        .fontSize(22)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
        .fontFamily('serif')
        .letterSpacing(-0.8)
        .margin({ left: PortraTheme.spacingSm })

      Blank()

      this.IconButton($r('app.media.ic_search'), '搜索', this.onSearch)

      Stack({ alignContent: Alignment.TopEnd }) {
        this.IconButton($r('app.media.ic_bell'), '通知', this.onNotice)
        if (this.showNoticeDot) {
          Row()
            .width(7)
            .height(7)
            .borderRadius(PortraTheme.radiusPill)
            .backgroundColor('#CF745F')
            .border({ width: 1.5, color: PortraTheme.pageBackground })
            .margin({ top: 6, right: 7 })
        }
      }
      .width(40)
      .height(40)
    }
    .width('100%')
    .height(58)
    .padding({ left: PortraTheme.spacingLg, right: PortraTheme.spacingLg })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(PortraTheme.pageBackground)
  }
}
