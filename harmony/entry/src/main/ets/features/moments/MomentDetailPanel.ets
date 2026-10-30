import { InlineImagePolicy } from '../../common/components/ComponentPolicy';
import { PortraLoading } from '../../common/components/PortraLoading';
import { MomentSummary } from '../../model/ApiModels';
import { MomentAuthor } from './MomentAuthor';
import { MomentActionButton } from './MomentActionButton';
import { MomentFeedFormatter } from './MomentFeedModels';
import { MomentInteractionSnapshot } from './MomentInteractions';

@Component
export struct MomentDetailPanel {
  @Prop @Watch('onStateChanged') state: MomentInteractionSnapshot = new MomentInteractionSnapshot();
  @State private imageIndex: number = 0;
  @State private imageFailed: boolean = false;
  private lastTargetId: number = 0;
  onClose?: () => void;
  onRetry?: () => void;
  onRequireLogin?: () => void;
  onToggleFavorite?: (item: MomentSummary) => void;
  onToggleLike?: (item: MomentSummary) => void;
  onOpenAuthor?: (item: MomentSummary) => void;
  aboutToAppear(): void { this.onStateChanged(); }
  private onStateChanged(): void {
    if (this.lastTargetId !== this.state.targetId) { this.imageIndex = 0; this.lastTargetId = this.state.targetId; }
    this.imageIndex = Math.max(0, Math.min(this.imageIndex, this.state.images.length - 1));
    this.imageFailed = false;
  }
  private moveImage(offset: number): void {
    this.imageIndex = Math.max(0, Math.min(this.imageIndex + offset, this.state.images.length - 1));
    this.imageFailed = false;
  }
  build() {
    Column() {
      Row({ space: 12 }) {
        if (this.state.item !== undefined) {
          MomentAuthor({ item: this.state.item, disabled: this.state.likeBusyId !== 0 || this.state.favoriteBusyId !== 0,
            onOpenAuthor: this.onOpenAuthor }).layoutWeight(1)
        } else { Blank() }
        Button({ type: ButtonType.Circle }) {
          Image($r('app.media.c_moment_close_ink')).width(18).height(18).accessibilityLevel('no')
        }.width(48).height(48).backgroundColor('#EEE8DF')
          .accessibilityText('关闭全屏图片').onClick(() => this.onClose?.())
      }.width('100%').padding({ left: 16, right: 12, top: 8, bottom: 8 })

      Stack() {
        if (this.state.loading) {
          PortraLoading({ label: '正在读取完整动态' })
        } else if (this.state.images.length > 0) {
          if (!this.imageFailed && InlineImagePolicy.accepts(this.state.images[this.imageIndex])) {
            Image(this.state.images[this.imageIndex])
              .width('100%').height('100%').objectFit(ImageFit.Contain)
              .accessibilityText(`动态完整图片，第 ${this.imageIndex + 1} 张，共 ${this.state.images.length} 张`)
              .onError(() => this.imageFailed = true)
          } else { Text('该图片暂不可用').fontColor('#D8D4CC') }
          if (this.state.images.length > 1) {
            Row() {
              Button({ type: ButtonType.Circle }) {
                Image($r('app.media.c_moment_previous')).width(16).height(16).accessibilityLevel('no')
              }.width(48).height(48).backgroundColor('#55000000')
                .opacity(this.imageIndex > 0 ? 1 : 0).enabled(this.imageIndex > 0)
                .accessibilityText('上一张图片').onClick(() => this.moveImage(-1))
              Blank()
              Button({ type: ButtonType.Circle }) {
                Image($r('app.media.c_moment_next')).width(16).height(16).accessibilityLevel('no')
              }.width(48).height(48).backgroundColor('#55000000')
                .opacity(this.imageIndex + 1 < this.state.images.length ? 1 : 0)
                .enabled(this.imageIndex + 1 < this.state.images.length)
                .accessibilityText('下一张图片').onClick(() => this.moveImage(1))
            }.width('100%').padding({ left: 8, right: 8 })
          }
        } else if (this.state.message.length === 0) {
          Text('该动态没有图片').fontColor('#D8D4CC')
        }
      }.width('100%').layoutWeight(1).backgroundColor('#000000')

      Column({ space: 8 }) {
        if (this.state.images.length > 0) {
          Text(`${this.imageIndex + 1} / ${this.state.images.length}`)
            .width('100%').textAlign(TextAlign.Center).fontSize(11).fontColor('#77736F')
        }
        if (this.state.message.length > 0) {
          Text(this.state.message).fontSize(12).fontColor('#B65745')
          Button(this.state.authenticationRequired ? '去登录' : '重新读取')
            .enabled(this.state.likeBusyId === 0 && this.state.favoriteBusyId === 0).backgroundColor('#E9EDFF').fontColor('#1735B9')
            .onClick(() => this.state.authenticationRequired ? this.onRequireLogin?.() : this.onRetry?.())
        }
        if (this.state.item !== undefined) {
          Text(MomentFeedFormatter.title(this.state.item))
            .width('100%').fontSize(18).fontWeight(FontWeight.Bold).fontColor('#242529')
            .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
          Scroll() {
            Text(MomentFeedFormatter.content(this.state.item))
              .width('100%').fontSize(13).lineHeight(22).fontColor('#4D4943')
          }.width('100%').constraintSize({ maxHeight: 88 }).scrollBar(BarState.Off)
          Row({ space: 16 }) {
            MomentActionButton({ action: 'like', selected: this.state.item.likedByCurrentUser,
              count: this.state.item.likeCount, momentId: this.state.item.momentId,
              busy: this.state.likeBusyId !== 0, interactive: this.onToggleLike !== undefined,
              disabled: this.state.favoriteBusyId !== 0 || this.state.uncertainMomentId === this.state.targetId,
              onToggle: () => { if (this.state.item !== undefined) { this.onToggleLike?.(this.state.item); } } })
            MomentActionButton({ action: 'favorite', selected: this.state.item.favoritedByCurrentUser,
              count: this.state.item.favoriteCount, momentId: this.state.item.momentId,
              busy: this.state.favoriteBusyId !== 0, interactive: this.onToggleFavorite !== undefined,
              disabled: this.state.likeBusyId !== 0 || this.state.favoriteUncertainMomentId === this.state.targetId,
              onToggle: () => { if (this.state.item !== undefined) { this.onToggleFavorite?.(this.state.item); } } })
          }.width('100%')
        }
      }.width('100%').padding({ left: 20, right: 20, top: 8, bottom: 12 })
        .alignItems(HorizontalAlign.Start).backgroundColor('#FBF7EF')
    }.width('100%').height('100%').backgroundColor('#FBF7EF')
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
  }
}
