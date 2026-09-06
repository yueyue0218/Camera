import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraButton {
  @Prop label: string = '';
  @Prop disabled: boolean = false;
  @Prop loading: boolean = false;
  onAction?: () => void;

  build() {
    Button(this.loading ? '处理中…' : this.label)
      .width('100%')
      .height(48)
      .enabled(!this.disabled && !this.loading)
      .fontSize(16)
      .fontColor('#FFFFFF')
      .backgroundColor(this.disabled || this.loading ? PortraTheme.mutedText : PortraTheme.primary)
      .borderRadius(PortraTheme.radius)
      .onClick(() => {
        if (!this.disabled && !this.loading) {
          this.onAction?.();
        }
      })
  }
}
