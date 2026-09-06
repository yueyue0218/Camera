import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraInput {
  @Prop value: string = '';
  @Prop placeholder: string = '';
  @Prop errorMessage: string = '';
  @Prop enabled: boolean = true;
  @State private focused: boolean = false;
  onChange?: (value: string) => void;

  build() {
    Column() {
      TextInput({ text: this.value, placeholder: this.placeholder })
        .width('100%')
        .height(48)
        .enabled(this.enabled)
        .fontSize(16)
        .backgroundColor(PortraTheme.surface)
        .border({
          width: 1,
          color: this.errorMessage.length > 0 ? PortraTheme.danger :
            (this.focused ? PortraTheme.primary : PortraTheme.border)
        })
        .borderRadius(PortraTheme.radius)
        .padding({ left: 14, right: 14 })
        .onFocus(() => {
          this.focused = true;
        })
        .onBlur(() => {
          this.focused = false;
        })
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
