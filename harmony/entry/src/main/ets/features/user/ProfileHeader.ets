@Component
export struct ProfileHeader {
  @Prop title: string = '';
  onBack?: () => void;
  build() {
    Row({ space: 10 }) {
      Button('‹').width(48).height(48).padding(0).fontSize(29)
        .fontColor('#625D58').backgroundColor(Color.Transparent)
        .accessibilityText('返回').onClick(() => this.onBack?.())
      Text(this.title).fontSize(24).fontWeight(FontWeight.Bold)
        .fontColor('#292A2E').layoutWeight(1)
    }.width('100%').height(58).padding({ left: 16, right: 16 })
      .backgroundColor('#F6F3EE')
  }
}
