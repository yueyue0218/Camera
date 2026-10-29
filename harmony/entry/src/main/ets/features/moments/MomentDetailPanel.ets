import { InlineImagePolicy } from '../../common/components/ComponentPolicy';
import { PortraLoading } from '../../common/components/PortraLoading';
import { MomentSummary } from '../../model/ApiModels';
import { MomentAuthor } from './MomentAuthor';
import { MomentActionButton } from './MomentActionButton';
import { MomentFeedFormatter } from './MomentFeedModels';
import { MomentInteractionSnapshot } from './MomentInteractions';

class MomentImageFrame {
  readonly key: string; readonly source: string; readonly index: number; readonly version: number;
  constructor(key: string, source: string, index: number, version: number) {
    this.key = key; this.source = source; this.index = index; this.version = version;
  }
}

@Component
export struct MomentDetailPanel {
  @Prop @Watch('onStateChanged') state: MomentInteractionSnapshot = new MomentInteractionSnapshot();
  @State private imageIndex: number = 0;
  @State private imageFailed: boolean = false;
  @State private imageRatio: number = 1;
  @State private imageFrameVersion: number = 0;
  @State private albumSizing: boolean = false;
  private albumSources: string[] = [];
  private dimensions: Map<number, number> = new Map<number, number>();
  private completed: Set<number> = new Set<number>();
  private failedImages: Set<number> = new Set<number>();
  private lastTargetId: number = 0;
  onClose?: () => void;
  onRetry?: () => void;
  onRequireLogin?: () => void;
  onToggleFavorite?: (item: MomentSummary) => void;
  onToggleLike?: (item: MomentSummary) => void;
  onOpenAuthor?: (item: MomentSummary) => void;
  aboutToAppear(): void { this.onStateChanged(); }
  private onStateChanged(): void {
    const targetChanged = this.lastTargetId !== this.state.targetId;
    if (targetChanged) { this.imageIndex = 0; this.lastTargetId = this.state.targetId; }
    this.imageIndex = Math.max(0, Math.min(this.imageIndex, this.state.images.length - 1));
    if (targetChanged || this.state.images.length !== this.albumSources.length ||
      this.state.images.some((source: string, index: number) => source !== this.albumSources[index])) {
      this.albumSources = this.state.images.slice(); this.imageFrameVersion++;
      this.dimensions.clear(); this.completed.clear(); this.failedImages.clear();
      this.albumSizing = this.albumSources.length > 0; this.imageRatio = 1;
      this.albumSources.forEach((source: string, index: number) => {
        if (!InlineImagePolicy.accepts(source)) { this.completed.add(index); this.failedImages.add(index); }
      });
      this.finishAlbumSizing();
    }
    this.imageFailed = this.failedImages.has(this.imageIndex);
  }
  private moveImage(offset: number): void {
    this.imageIndex = Math.max(0, Math.min(this.imageIndex + offset, this.state.images.length - 1));
    this.onStateChanged();
  }
  private imageCompleted(frame: MomentImageFrame, width: number, height: number): void {
    if (frame.version !== this.imageFrameVersion || frame.source !== this.albumSources[frame.index] ||
      this.completed.has(frame.index) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) { return; }
    this.dimensions.set(frame.index, width / height); this.completed.add(frame.index); this.finishAlbumSizing();
  }
  private imageErrored(frame: MomentImageFrame): void {
    if (frame.version !== this.imageFrameVersion || frame.source !== this.albumSources[frame.index]) { return; }
    this.failedImages.add(frame.index); this.completed.add(frame.index);
    if (this.imageIndex === frame.index) { this.imageFailed = true; }
    this.finishAlbumSizing();
  }
  private finishAlbumSizing(): void {
    if (this.completed.size !== this.albumSources.length) { return; }
    let ratio = Number.POSITIVE_INFINITY;
    this.dimensions.forEach((value: number) => { ratio = Math.min(ratio, value); });
    this.imageRatio = Number.isFinite(ratio) ? ratio : 1; this.albumSizing = false;
  }
  private imageFrames(): MomentImageFrame[] {
    return this.albumSources.map((source: string, index: number) =>
      new MomentImageFrame(`${this.state.targetId}:${this.imageFrameVersion}:${index}`, source, index, this.imageFrameVersion))
      .filter((frame: MomentImageFrame) => InlineImagePolicy.accepts(frame.source));
  }

  @Builder
  private ImageBody() {
    Stack() {
      ForEach(this.imageFrames(), (frame: MomentImageFrame) => {
        Image(frame.source)
          .width(!this.albumSizing && !this.imageFailed && frame.index === this.imageIndex ? '100%' : 1)
          .height(!this.albumSizing && !this.imageFailed && frame.index === this.imageIndex ? '100%' : 1)
          .objectFit(ImageFit.Contain)
          .opacity(!this.albumSizing && !this.imageFailed && frame.index === this.imageIndex ? 1 : 0)
          .accessibilityLevel(!this.albumSizing && frame.index === this.imageIndex ? 'auto' : 'no')
          .accessibilityText(`动态完整图片，第 ${frame.index + 1} 张，共 ${this.state.images.length} 张`)
          .onComplete((event) => { if (event !== undefined) { this.imageCompleted(frame, event.width, event.height); } })
          .onError(() => this.imageErrored(frame))
      }, (frame: MomentImageFrame) => frame.key)
      if (this.albumSizing) {
        PortraLoading({ label: '正在读取相册尺寸' })
      } else if (this.imageFailed) {
        Text('该图片暂不可用').fontColor('#D8D4CC').padding(20)
      }
      if (!this.albumSizing && this.state.images.length > 1) {
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
    }.width('100%').aspectRatio(this.imageRatio).height(this.albumSizing ? 120 : undefined).backgroundColor('#FBF7EF')
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
          .accessibilityText('返回动态列表').onClick(() => this.onClose?.())
      }.width('100%').padding({ left: 16, right: 12, top: 8, bottom: 8 })

      Scroll() {
        Column() {
          if (this.state.loading) {
            PortraLoading({ label: '正在读取完整动态' }).padding(24)
          } else if (this.state.images.length > 0) {
            this.ImageBody()
          } else if (this.state.message.length === 0) {
            Text('该动态没有图片').fontColor('#77736F').padding(20)
          }
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
          Text(MomentFeedFormatter.content(this.state.item))
            .width('100%').fontSize(14).lineHeight(23).fontColor('#4D4943')
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
        .visibility(this.albumSizing ? Visibility.Hidden : Visibility.Visible)
        }.width('100%').alignItems(HorizontalAlign.Start)
      }.width('100%').layoutWeight(1).scrollBar(BarState.Off).align(Alignment.Top)
    }.width('100%').height('100%').backgroundColor('#FBF7EF')
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
  }
}
