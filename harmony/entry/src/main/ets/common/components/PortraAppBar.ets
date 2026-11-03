import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraAppBar {
  @Prop unreadCount: number = 0;
  @Prop @Watch('onNewNotice') noticeArrivalEpoch: number = 0;
  @State private bellAngle: number = 0;
  private mounted: boolean = false;
  private animationGeneration: number = 0;
  onSearch?: () => void;
  onNotice?: () => void;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; this.animationGeneration++; this.bellAngle = 0; }

  private onNewNotice(): void {
    if (!this.mounted || this.noticeArrivalEpoch <= 0) { return; }
    const generation = ++this.animationGeneration;
    this.getUIContext().keyframeAnimateTo({ iterations: 1, onFinish: () => {
      if (this.mounted && generation === this.animationGeneration) { this.bellAngle = 0; }
    } }, [
      { duration: 95, curve: Curve.EaseOut, event: () => { this.bellAngle = 12; } },
      { duration: 115, curve: Curve.EaseInOut, event: () => { this.bellAngle = -10; } },
      { duration: 105, curve: Curve.EaseInOut, event: () => { this.bellAngle = 7; } },
      { duration: 105, curve: Curve.EaseOut, event: () => { this.bellAngle = 0; } }
    ]);
  }

  private bellLabel(): string {
    return this.unreadCount > 0 ? `通知，${this.unreadCount} 条未读` : '通知，无未读';
  }

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
  private IconButton(icon: Resource, label: string, action?: () => void, rotation: number = 0) {
    Button({ type: ButtonType.Circle }) {
      Image(icon)
        .width(21)
        .height(21)
        .fillColor(PortraTheme.primaryText)
        .rotate({ angle: rotation })
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

      Stack({ alignContent: Alignment.TopStart }) {
        this.IconButton($r('app.media.ic_bell'), this.bellLabel(), this.onNotice, this.bellAngle)
        if (this.unreadCount > 0) {
          Row() {
            Text(this.unreadCount > 99 ? '99+' : this.unreadCount.toString())
              .fontSize(10)
              .fontWeight(FontWeight.Bold)
              .fontColor(Color.White)
          }
          .width(this.unreadCount > 99 ? 32 : this.unreadCount >= 10 ? 24 : 18)
          .height(18)
          .justifyContent(FlexAlign.Center)
          .backgroundColor('#CF5953')
          .borderRadius(9)
          .border({ width: 1.5, color: PortraTheme.pageBackground })
          .position({ x: this.unreadCount > 99 ? 20 : this.unreadCount >= 10 ? 24 : 26, y: 0 })
          .onClick(() => this.onNotice?.())
        }
      }
      .width(52)
      .height(42)
    }
    .width('100%')
    .height(58)
    .padding({ left: PortraTheme.spacingLg, right: PortraTheme.spacingLg })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(PortraTheme.pageBackground)
  }
}
