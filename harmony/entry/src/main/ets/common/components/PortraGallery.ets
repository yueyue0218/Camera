import { hilog } from '@kit.PerformanceAnalysisKit';
import { image } from '@kit.ImageKit';
import { AppClient } from '../../app/AppClient';
import { FileImagePolicy } from './ComponentPolicy';
import { PortraImage } from './PortraImage';
import { OriginalImageController, OriginalImageState } from './OriginalImageController';
import { PortraTheme } from '../../theme/PortraTheme';

/** Shared by demand references and service portfolios. Originals are explicitly requested in the cover only. */
@Component
export struct PortraGallery {
  @Prop @Watch('reset') fileIds: number[] = [];
  @Prop @Watch('reset') sources: string[] = [];
  @Prop moduleHeight: number = 332;
  @Prop journal: boolean = false;
  @Prop thumbnails: boolean = false;
  @State private index: number = 0;
  @State private previewOpen: boolean = false;
  @State private original: OriginalImageState = new OriginalImageState();
  @State private zoom: number = 1;
  @State private panX: number = 0;
  @State private panY: number = 0;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private closing: boolean = false;
  private closedAt: number = 0;
  private zoomStart: number = 1;
  private originals?: OriginalImageController;
  private retiring: OriginalImageController[] = [];
  private previewGeneration: number = 0;

  private currentFileId(): number {
    return this.fileIds[this.index] ?? FileImagePolicy.id(this.sources[this.index] ?? '');
  }
  private currentSource(): string { return this.fileIds.length > 0 ? '' : (this.sources[this.index] ?? ''); }
  private reset(): void { this.close(); this.index = 0; }
  private count(): number { return this.fileIds.length > 0 ? this.fileIds.length : this.sources.length; }
  private move(delta: number): void {
    const next = this.index + delta;
    if (next < 0 || next >= this.count()) { return; }
    this.index = next;
    this.zoom = 1;
    this.panX = 0; this.panY = 0;
    this.originals?.select(this.currentFileId());
  }
  private open(): void {
    if (this.count() === 0 || this.previewOpen || this.closing || Date.now() - this.closedAt < 250) { return; }
    const generation = ++this.previewGeneration;
    this.original = new OriginalImageState();
    this.previewOpen = true;
    this.originals = new OriginalImageController(AppClient.shared.fileImages,
      (bytes: ArrayBuffer) => this.decodeOriginal(bytes), (state: OriginalImageState) => {
        if (this.previewOpen && generation === this.previewGeneration) { this.original = state; }
      });
    this.originals.select(this.currentFileId());
    this.zoom = 1;
    this.panX = 0; this.panY = 0;
    hilog.info(0x0000, 'PortraGallery', 'UI04 open generation=%{public}d index=%{public}d', generation, this.index);
  }
  private close(reason: string = 'lifecycle'): void {
    if (!this.previewOpen && this.originals === undefined) { return; }
    hilog.info(0x0000, 'PortraGallery', 'UI04 close reason=%{public}s generation=%{public}d time=%{public}d', reason, this.previewGeneration, Date.now());
    this.closing = true;
    this.closedAt = Date.now();
    this.previewOpen = false;
    this.previewGeneration++;
    const controller = this.originals;
    this.originals = undefined;
    if (controller !== undefined) {
      const retiringController: OriginalImageController = controller;
      this.retiring.push(retiringController);
      // Hide the cover first; defer cancellation to avoid delaying the UI event.
      setTimeout(() => retiringController.stop(), 0);
    }
  }
  private releaseRetired(): void {
    hilog.info(0x0000, 'PortraGallery', 'UI04 disappeared elapsed=%{public}d', Date.now() - this.closedAt);
    this.closing = false;
    // onDisappear runs after the preview image nodes are removed. Never closes a newer cover.
    const retired = this.retiring;
    this.retiring = [];
    if (!this.previewOpen) { this.original = new OriginalImageState(); }
    setTimeout(() => retired.forEach((controller: OriginalImageController) => controller.dispose()), 0);
  }
  aboutToDisappear(): void { this.close(); this.releaseRetired(); }

  private async decodeOriginal(bytes: ArrayBuffer): Promise<image.PixelMap> {
    const decoder = image.createImageSource(bytes);
    try {
      const info = await decoder.getImageInfo();
      if (info.size.width <= 0 || info.size.height <= 0) { throw new Error('Invalid image'); }
      const scale = Math.min(1, 2560 / Math.max(info.size.width, info.size.height));
      return await decoder.createPixelMap({ desiredSize: {
        width: Math.max(1, Math.round(info.size.width * scale)),
        height: Math.max(1, Math.round(info.size.height * scale))
      } });
    } finally { await decoder.release().catch(() => {}); }
  }

  @Builder
  private Controls(dark: boolean) {
    Row({ space: 4 }) {
      Button('‹').width(44).height(44).fontSize(26).padding(0).borderRadius(8)
        .fontColor(dark ? Color.White : PortraTheme.secondaryText).backgroundColor(Color.Transparent)
        .accessibilityText('上一张图片').enabled(this.index > 0).onClick(() => this.move(-1))
      Text(`${this.index + 1} / ${this.count()}`).fontSize(12)
        .fontColor(dark ? '#CCCCCC' : PortraTheme.secondaryText)
      Button('›').width(44).height(44).fontSize(26).padding(0).borderRadius(8)
        .fontColor(dark ? Color.White : PortraTheme.secondaryText).backgroundColor(Color.Transparent)
        .accessibilityText('下一张图片').enabled(this.index + 1 < this.count()).onClick(() => this.move(1))
    }.width('100%').justifyContent(FlexAlign.Center)
  }

  @Builder
  private Preview() {
    Column() {
      Row() {
        Blank()
        Button('×').width(48).height(48).fontSize(28).padding(0)
          .fontColor(Color.White).backgroundColor(Color.Transparent).accessibilityText('关闭大图')
          // Handle touch-down as well as click: ArkUI click recognition may be
          // delayed/cancelled by competing image gestures or small pointer drift.
          .onTouch((event: TouchEvent) => {
            if (event.type === TouchType.Down) {
              hilog.info(0x0000, 'PortraGallery', 'UI04 close-button touch-down');
              this.close('button-touch');
            }
          })
          .onClick(() => this.close('button-click'))
      }.width('100%').height(48).flexShrink(0).zIndex(20).padding({ right: 12 })
      Stack({ alignContent: Alignment.BottomEnd }) {
        Stack() {
          PortraImage({ fileId: this.currentFileId(), source: this.currentSource(), variant: 'medium',
            contain: true, imageWidth: '100%', imageHeight: '100%', cornerRadius: 0,
            contentDescription: `第 ${this.index + 1} 张图片预览`, allowInlineData: true })
          if (this.original.fileId === this.currentFileId() && this.original.pixels !== undefined) {
            Image(this.original.pixels).width('100%').height('100%').objectFit(ImageFit.Contain)
              .accessibilityText(`第 ${this.index + 1} 张原图`)
          }
        }.width('100%').height('100%')
          .scale({ x: this.zoom, y: this.zoom }).translate({ x: this.panX, y: this.panY })
          .gesture(GestureGroup(GestureMode.Exclusive,
            PinchGesture().onActionStart(() => this.zoomStart = this.zoom)
              .onActionUpdate((event: GestureEvent) => this.zoom = Math.min(4, Math.max(1, this.zoomStart * event.scale))),
            PanGesture({ direction: PanDirection.All, distance: 8 })
              .onActionStart(() => { this.panStartX = this.panX; this.panStartY = this.panY; })
              .onActionUpdate((event: GestureEvent) => {
                if (this.zoom > 1) { this.panX = this.panStartX + event.offsetX; this.panY = this.panStartY + event.offsetY; }
              }),
            TapGesture({ count: 1 }).onAction(() => this.close('image-tap'))
          ))
          // Fallback for devices where a single tap is handled as a click
          // instead of resolving through the exclusive gesture group.
          .onClick(() => this.close('image-click'))
        Button(this.original.message).fontSize(12).fontColor(Color.White)
          .backgroundColor('#17191DD9').borderRadius(20).constraintSize({ minHeight: 40 })
          .padding({ left: 14, right: 14 }).margin({ right: 16, bottom: 16 })
          .enabled(this.original.status === 'idle' || this.original.status === 'error')
          .onClick(() => this.originals?.load())
      }.layoutWeight(1).width('100%').clip(true)
      this.Controls(true)
    }.width('100%').height('100%').padding({ top: 12, bottom: 24 }).backgroundColor('#101114')
  }

  build() {
    Column({ space: 0 }) {
      if (this.journal) {
        if (this.thumbnails) {
          Scroll() {
            Row({ space: 9 }) {
              ForEach(this.fileIds.length > 0 ? this.fileIds.map((id: number) => id.toString()) : this.sources,
                (_key: string, position: number) => {
                  PortraImage({ fileId: this.fileIds[position] ?? 0, source: this.fileIds.length > 0 ? '' : this.sources[position],
                    imageWidth: 140, imageHeight: 180, cornerRadius: 11, contentDescription: `第 ${position + 1} 张图片` })
                    .onClick(() => { this.index = position; this.open(); })
                }, (key: string) => key)
            }
          }.width('100%').scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off)
          if (this.count() === 0) { Text('尚未添加参考图片').fontSize(12).fontColor('#9A938C').padding(20) }
        } else {
          Stack({ alignContent: Alignment.BottomEnd }) {
            PortraImage({ fileId: this.fileIds[0] ?? 0, source: this.fileIds.length > 0 ? '' : (this.sources[0] ?? ''),
              variant: 'medium', imageWidth: '100%', imageHeight: this.moduleHeight, cornerRadius: 18,
              fallbackText: '尚未添加参考图片', contentDescription: '封面，点击查看全部图片' })
            if (this.count() > 0) {
              Text(`01 / ${this.count().toString().padStart(2, '0')} ↗`).fontSize(10).fontColor(Color.White)
                .padding({ left: 10, right: 10, top: 7, bottom: 7 }).backgroundColor('#55302E2D')
                .borderRadius(9).margin({ bottom: 13, right: 13 })
            }
          }.width('100%').height(this.moduleHeight).borderRadius(18).clip(true)
            .onClick(() => { this.index = 0; this.open(); })
        }
      } else {
      PortraImage({ fileId: this.currentFileId(), source: this.currentSource(), variant: 'medium',
        contain: true, imageWidth: '100%', imageHeight: Math.max(1, this.moduleHeight - (this.count() > 0 ? 44 : 0)), fallbackText: '暂无图片',
        contentDescription: `第 ${this.index + 1} 张图片，点击查看大图`, allowInlineData: true })
        .onClick(() => this.open())
      if (this.count() > 0) { this.Controls(false) }
      }
    }.width('100%')
    .bindContentCover($$this.previewOpen, this.Preview(), { modalTransition: ModalTransition.NONE,
      onWillDismiss: (action: DismissContentCoverAction) => {
        this.close('system-dismiss');
        action.dismiss();
      },
      onAppear: () => hilog.info(0x0000, 'PortraGallery', 'UI04 cover appeared'),
      // Do not close() here: an old cover's disappearance can arrive after
      // the user has opened a newer preview. Only release retired resources.
      onDisappear: () => this.releaseRetired() })
  }
}
