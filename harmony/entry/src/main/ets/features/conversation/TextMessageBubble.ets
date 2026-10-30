import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct TextMessageBubble {
  @Prop text: string = '';
  @Prop mine: boolean = false;

  build() {
    Text(this.text)
      .fontSize(14)
      .lineHeight(21)
      .fontColor(this.mine ? PortraTheme.white : PortraTheme.primaryText)
      .padding({ left: 12, right: 12, top: 9, bottom: 9 })
      .backgroundColor(this.mine ? PortraTheme.primary : PortraTheme.surface)
      .borderRadius(10)
      .constraintSize({ maxWidth: '100%' })
  }
}
