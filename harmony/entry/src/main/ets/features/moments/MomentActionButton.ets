// C presentation shared by Feed and detail. No networking or local optimistic count.
@Component
export struct MomentActionButton {
  @Prop dark: boolean = false;
  @Prop action: string = 'like';
  @Prop selected: boolean = false;
  @Prop count: number = 0;
  @Prop busy: boolean = false;
  @Prop disabled: boolean = false;
  @Prop interactive: boolean = false;
  @Prop momentId: number = 0;
  onToggle?: () => void;

  private color(): string {
    return this.selected ? (this.action === 'like' ? '#E65450' : '#D99A0B') : (this.dark ? '#D8D4CC' : '#67615A');
  }

  private description(): string {
    const action = this.action === 'like' ? '点赞' : '收藏';
    return `${this.interactive && this.selected ? '取消' : ''}${action}动态 ${this.momentId}，${this.count} 次${action}${this.selected ? '，已选中' : ''}${this.busy ? '，处理中' : ''}${this.interactive ? '' : '，只读'}`;
  }

  build() {
    Button({ type: ButtonType.Normal }) {
      Row({ space: 8 }) {
          Image(this.action === 'like' ?
            (this.selected ? $r('app.media.c_moment_heart_selected') : (this.dark ? $r('app.media.c_moment_heart_dark') : $r('app.media.c_moment_heart'))) :
            (this.selected ? $r('app.media.c_moment_bookmark_selected') : (this.dark ? $r('app.media.c_moment_bookmark_dark') : $r('app.media.c_moment_bookmark'))))
            .width(24).height(24).accessibilityLevel('no')
        Text(this.count.toString())
          .fontSize(16).fontWeight(FontWeight.Medium).fontColor(this.color())
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityLevel('no')
      }
      .justifyContent(FlexAlign.Start)
    }
    .constraintSize({ minHeight: 48, minWidth: 64 })
    .padding({ left: 4, right: 8, top: 8, bottom: 8 })
    .borderRadius(8)
    .backgroundColor(Color.Transparent)
    .stateEffect(false)
    .enabled(this.interactive && !this.busy && !this.disabled)
    .accessibilityText(this.description())
    .onClick(() => this.onToggle?.())
  }
}
