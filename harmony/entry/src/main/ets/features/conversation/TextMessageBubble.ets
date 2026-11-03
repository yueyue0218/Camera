import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct TextMessageBubble {
  @Prop text: string = '';
  @Prop mine: boolean = false;

  build() {
    Text(this.text)
      .fontSize(13)
      .lineHeight(20)
      .fontColor(this.mine ? PortraTheme.white : PortraTheme.primaryText)
      .padding({ left: 13, right: 13, top: 10, bottom: 10 })
      .backgroundColor(this.mine ? '#1A48CA' : '#FFFDF9')
      .borderRadius(15)
      .border({ width: this.mine ? 0 : 1, color: '#F0ECE6' })
      .constraintSize({ maxWidth: '100%' })
  }
}
