import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraInput {
  @Prop value: string = '';
  @Prop placeholder: string = '';
  @Prop errorMessage: string = '';
  onChange?: (value: string) => void;

  build() {
    Column() {
      TextInput({ text: this.value, placeholder: this.placeholder })
        .width('100%')
        .height(48)
        .fontSize(16)
        .backgroundColor(PortraTheme.surface)
        .border({
          width: 1,
          color: this.errorMessage.length > 0 ? PortraTheme.danger : PortraTheme.border
        })
        .borderRadius(PortraTheme.radius)
        .padding({ left: 14, right: 14 })
        .onChange((value: string) => this.onChange?.(value))

      if (this.errorMessage.length > 0) {
        Text(this.errorMessage)
          .width('100%')
          .fontSize(12)
          .fontColor(PortraTheme.danger)
          .margin({ top: 6 })
      }
    }
    .width('100%')
  }
}
