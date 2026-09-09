import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraBottomNav {
  @Prop selectedIndex: number = 0;
  onSelect?: (index: number) => void;

  @Builder
  private NavItem(index: number, label: string, icon: Resource) {
    Button({ type: ButtonType.Normal }) {
      Column({ space: 3 }) {
        if (this.selectedIndex === index) {
          Row()
            .width(5)
            .height(5)
            .borderRadius(PortraTheme.radiusPill)
            .backgroundColor(PortraTheme.accent)
        } else {
          Row().width(5).height(5)
        }
        Image(icon)
          .width(22)
          .height(22)
          .fillColor(this.selectedIndex === index ? PortraTheme.primary : PortraTheme.mutedText)
          .accessibilityText(label)
        Text(label)
          .fontSize(PortraTheme.fontCaption)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.selectedIndex === index ? PortraTheme.primary : PortraTheme.mutedText)
          .maxLines(1)
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
    }
    .layoutWeight(1)
    .height('100%')
    .padding(0)
    .backgroundColor(Color.Transparent)
    .onClick(() => this.onSelect?.(index))
  }

  build() {
    Row() {
      this.NavItem(0, '大厅', $r('app.media.ic_home'))
      this.NavItem(1, '动态', $r('app.media.ic_moments'))
      this.NavItem(2, '消息', $r('app.media.ic_message'))
      this.NavItem(3, '我的', $r('app.media.ic_profile'))
    }
    .width('100%')
    .height(68)
    .padding({ left: PortraTheme.spacingXl, right: PortraTheme.spacingXl })
    .backgroundColor(PortraTheme.surface)
    .border({ width: { top: 1 }, color: PortraTheme.border })
  }
}
