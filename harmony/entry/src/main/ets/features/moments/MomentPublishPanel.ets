import { window } from '@kit.ArkUI';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { fileIo } from '@kit.CoreFileKit';
import { image } from '@kit.ImageKit';
import { MomentPublishLimits } from './MomentPublishLimits';
import { util } from '@kit.ArkTS';
import { AppClient } from '../../app/AppClient';
import { MomentSummary } from '../../model/ApiModels';
import { MomentFeedCache } from './MomentFeedModels';
import { MomentSessionBinding } from './MomentInteractionBindings';
import { MomentPublishApiBinding } from './MomentPublishApiBinding';
import { MomentPublishController, MomentPublishSnapshot } from './MomentPublishController';
import { InlineImagePolicy, PublicImagePolicy } from '../../common/components/ComponentPolicy';

@Component
export struct MomentPublishPanel {
  @Prop @Watch('editingTargetChanged') editingId: number = 0;
  @State private state: MomentPublishSnapshot = new MomentPublishSnapshot();
  @State private picking: boolean = false;
  @State private selectingImages: boolean = false;
  @State private selectedImageIndexes: number[] = [];
  @State private topInset: number = 40;
  @State private networkAllowed: boolean = false;
  private controller?: MomentPublishController;
  private active: boolean = false;
  private lastLongPressAt: number = 0;
  onClose?: () => void;
  onRequireLogin?: () => void;
  onPublished?: (item: MomentSummary) => void;
  private readonly privacyChanged: () => void = () => {
    this.networkAllowed = AppClient.shared.canUseBusinessNetwork();
  };
  private canDisplayImage(source: string): boolean {
    return InlineImagePolicy.accepts(source) && (!PublicImagePolicy.accepts(source) || this.networkAllowed);
  }
  aboutToAppear(): void {
    this.active = true; this.readSafeArea();
    AppClient.shared.observePrivacyAccess(this.privacyChanged);
    this.privacyChanged();
    this.controller = new MomentPublishController(new MomentPublishApiBinding(AppClient.shared.apiService),
      new MomentSessionBinding(AppClient.shared.sessionManager), MomentFeedCache.shared,
      (value: MomentPublishSnapshot) => this.state = value, (item: MomentSummary) => this.onPublished?.(item));
    this.controller.open(this.editingId);
  }
  aboutToDisappear(): void {
    this.active = false;
    AppClient.shared.unobservePrivacyAccess(this.privacyChanged);
    this.controller?.close(); this.controller = undefined;
  }

  private editingTargetChanged(): void {
    this.picking = false; this.selectingImages = false; this.selectedImageIndexes = [];
    this.controller?.open(this.editingId);
  }

  private toggleImage(index: number): void {
    this.selectedImageIndexes = this.selectedImageIndexes.includes(index) ?
      this.selectedImageIndexes.filter((value: number) => value !== index) :
      [...this.selectedImageIndexes, index];
  }

  private longPressImage(index: number): void {
    if (this.state.submitting || this.state.uncertain) return;
    this.lastLongPressAt = Date.now();
    this.selectingImages = true;
    if (!this.selectedImageIndexes.includes(index)) this.toggleImage(index);
  }

  private removeSelectedImages(): void {
    this.selectedImageIndexes.slice().sort((a: number, b: number) => b - a)
      .forEach((index: number) => this.controller?.removeImage(index));
    this.selectedImageIndexes = []; this.selectingImages = false;
  }
  private async readSafeArea(): Promise<void> {
    const context = this.getUIContext().getHostContext();
    if (context === undefined) { return; }
    try {
      const currentWindow = await window.getLastWindow(context);
      const area = currentWindow.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
      if (this.active) { this.topInset = Math.max(24, this.getUIContext().px2vp(area.topRect.height)); }
    } catch { /* Keep a conservative native status-bar inset until the window is available. */ }
  }
  private async photoData(uri: string): Promise<string> {
    const file = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    try {
      const info = await fileIo.stat(file.fd);
      if (info.size <= 0 || info.size > 5 * 1024 * 1024) { throw new Error('单张照片请不超过5MB'); }
      const buffer = new ArrayBuffer(info.size);
      const count = await fileIo.read(file.fd, buffer);
      if (count !== info.size) { throw new Error('照片读取未完成，请重新选择'); }
      const bytes = new Uint8Array(buffer); let mime = '';
      if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { mime = 'jpeg'; }
      else if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) { mime = 'png'; }
      else if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 &&
        bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) { mime = 'webp'; }
      if (mime.length > 0 && bytes.length <= MomentPublishLimits.maxImageBytes) {
        return `data:image/${mime};base64,${new util.Base64Helper().encodeToStringSync(bytes)}`;
      }
      const source = image.createImageSource(buffer); const packer = image.createImagePacker();
      try {
        const info = await source.getImageInfo();
        for (const edge of [1280, 1024, 768, 512]) {
          const scale = Math.min(1, edge / Math.max(info.size.width, info.size.height));
          const pixels = await source.createPixelMap({ desiredSize: {
            width: Math.max(1, Math.round(info.size.width * scale)), height: Math.max(1, Math.round(info.size.height * scale)) } });
          try {
            for (const quality of [85, 70, 55]) {
              const packed = await packer.packing(pixels, { format: 'image/jpeg', quality: quality });
              if (packed.byteLength <= MomentPublishLimits.maxImageBytes) {
                return `data:image/jpeg;base64,${new util.Base64Helper().encodeToStringSync(new Uint8Array(packed))}`;
              }
            }
          } finally { await pixels.release(); }
        }
        throw new Error('照片数据偏大，请重新选择更小的照片');
      } finally { await packer.release(); await source.release(); }
    } finally { await fileIo.close(file.fd); }
  }
  private async chooseImages(): Promise<void> {
    if (this.picking || this.controller === undefined || this.state.images.length >= 9 || this.state.submitting || this.state.uncertain) { return; }
    const view = this.controller.getViewVersion(); this.picking = true;
    try {
      const options = new photoAccessHelper.PhotoSelectOptions();
      options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE; options.maxSelectNumber = 9 - this.state.images.length;
      const result = await new photoAccessHelper.PhotoViewPicker().select(options);
      const images: string[] = [];
      for (const uri of result.photoUris) { images.push(await this.photoData(uri)); }
      if (this.active) { this.controller?.addImages(images, view); }
    } catch (error) {
      if (this.active) { this.controller?.mediaError((error as Error).message || '照片暂时无法读取，请重新选择', view); }
    } finally { if (this.active && view === this.controller?.getViewVersion()) { this.picking = false; } }
  }
  build() {
    Column() {
      Row({ space: 12 }) {
        Column({ space: 4 }) {
          Text('PORTRA FILE').fontSize(10).letterSpacing(2).fontColor('#1746C5')
          Text(this.editingId > 0 ? '编辑动态' : '发布动态').fontSize(24).fontWeight(FontWeight.Bold).fontColor('#242529')
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        Button({ type: ButtonType.Circle }) {
          Image($r('app.media.c_moment_close_ink')).width(18).height(18)
        }.width(48).height(48).backgroundColor('#EEE8DF').accessibilityText(this.editingId > 0 ? '取消编辑动态' : '取消发布动态').onClick(() => this.onClose?.())
      }.width('100%').padding(20).border({ width: { bottom: 1 }, color: '#E8E2DB' })
      Scroll() {
        Column({ space: 14 }) {
          Text(this.editingId > 0 ? '更新这条动态的文字或照片。' : '分享今天想留下来的画面。').fontSize(14).fontColor('#77736F')
          if (this.state.loading) { Text(this.editingId > 0 ? '正在读取完整动态…' : '正在确认发布账号…').fontSize(12).fontColor('#77736F') }
          if (this.state.message.length > 0) {
            Text(this.state.message).width('100%').fontSize(13).fontColor('#B65745').padding(12).backgroundColor('#FFF0EC').borderRadius(10)
            if (this.state.uncertain) {
              Button(this.editingId > 0 ? '返回详情核实' : '返回动态查看').onClick(() => this.onClose?.())
              if (this.editingId === 0) { Button('已核实未发布，重新编辑').enabled(this.state.canConfirmAbsent).onClick(() => this.controller?.confirmVerifiedAbsent()) }
            } else if (this.state.actorId === 0 && !this.state.loading) {
              Button(this.editingId > 0 ? '返回详情' : '去登录').onClick(() => this.editingId > 0 ? this.onClose?.() : this.onRequireLogin?.())
            }
          }
          Text('标题').fontSize(14).fontWeight(FontWeight.Medium).fontColor('#242529')
          TextInput({ text: this.state.title, placeholder: '为今天的记录起个名字' })
            .maxLength(Math.max(50, this.state.title.length)).height(52).fontSize(16).backgroundColor('#FFFDF9').borderRadius(10)
            .border({ width: 1, color: '#E8E2DB' }).enabled(this.state.actorId > 0 && !this.state.submitting && !this.state.uncertain)
            .onChange((value: string) => this.controller?.updateTitle(value))
          Text(`${this.state.title.length}/50`).width('100%').textAlign(TextAlign.End).fontSize(11).fontColor('#77736F')
          Text('正文').fontSize(14).fontWeight(FontWeight.Medium).fontColor('#242529')
          TextArea({ text: this.state.content, placeholder: '写下这张照片背后的故事…' })
            .maxLength(Math.max(200, this.state.content.length)).height(148).fontSize(15).backgroundColor('#FFFDF9').borderRadius(10)
            .border({ width: 1, color: '#E8E2DB' }).enabled(this.state.actorId > 0 && !this.state.submitting && !this.state.uncertain)
            .onChange((value: string) => this.controller?.updateContent(value))
          Text(`${this.state.content.length}/200`).width('100%').textAlign(TextAlign.End).fontSize(11).fontColor('#77736F')
          Row() {
            Text(`照片 ${this.state.images.length}/9`).fontSize(14).fontWeight(FontWeight.Medium).fontColor('#242529')
            Blank()
            if (this.selectingImages) {
              Button(this.selectedImageIndexes.length > 0 ? `移除所选 ${this.selectedImageIndexes.length} 张` : '取消选择')
                .height(40).fontSize(12).fontColor('#B65745').backgroundColor('#FFF0EC')
                .onClick(() => this.selectedImageIndexes.length > 0 ? this.removeSelectedImages() :
                  (this.selectingImages = false))
            }
            Button(this.picking ? '读取中…' : '＋ 添加照片').height(40).fontSize(13).fontColor('#1746C5').backgroundColor('#E9EDFF')
              .enabled(this.state.actorId > 0 && !this.picking && !this.state.submitting && !this.state.uncertain && this.state.images.length < 9)
              .onClick(() => this.chooseImages())
          }.width('100%')
          Text('最多9张，照片会自动适配手机浏览；原图不超过5MB').fontSize(11).fontColor('#77736F')
          Flex({ wrap: FlexWrap.Wrap }) {
            ForEach(this.state.images, (source: string, index: number) => {
              Stack({ alignContent: Alignment.TopEnd }) {
                if (this.canDisplayImage(source)) {
                  Image(source).width('100%').height('100%').objectFit(ImageFit.Cover)
                } else { Text('授权后可查看图片').fontSize(11).fontColor('#77736F').padding(8) }
                if (this.selectingImages) {
                  Text(this.selectedImageIndexes.includes(index) ? '✓' : '○')
                    .fontSize(20).fontColor('#FFFFFF').textAlign(TextAlign.Center)
                    .width(34).height(34).borderRadius(17)
                    .backgroundColor(this.selectedImageIndexes.includes(index) ? '#1746C5' : '#88000000')
                    .margin(6)
                } else {
                  Button('×').width(40).height(40).fontColor('#FFFFFF').backgroundColor('#88000000')
                    .enabled(!this.state.submitting && !this.state.uncertain).accessibilityText(`移除第${index + 1}张照片`)
                    .onClick(() => this.controller?.removeImage(index))
                }
              }.width('30%').aspectRatio(1).borderRadius(10).clip(true).margin({ right: 8, bottom: 8 })
                .onClick(() => { if (this.selectingImages && Date.now() - this.lastLongPressAt >= 500) this.toggleImage(index); })
                .gesture(LongPressGesture().onAction(() => this.longPressImage(index)))
            }, (source: string, index: number) => `${index}:${source}`)
          }.width('100%')
        }.width('100%').alignItems(HorizontalAlign.Start).padding(20)
      }.width('100%').layoutWeight(1).scrollBar(BarState.Off).align(Alignment.Top)
      Row({ space: 12 }) {
        Button('取消').height(48).fontColor('#67615A').backgroundColor('#EEE8DF').layoutWeight(1).onClick(() => this.onClose?.())
        Button(this.state.submitting ? (this.editingId > 0 ? '保存中…' : '发布中…') : (this.editingId > 0 ? '保存修改' : '发布动态')).height(48).fontColor('#FFFFFF').backgroundColor('#1746C5')
          .layoutWeight(2).enabled(this.networkAllowed && this.state.canSubmit && !this.picking).onClick(() => this.controller?.submit())
      }.width('100%').padding(20).border({ width: { top: 1 }, color: '#E8E2DB' })
    }.width('100%').height('100%').padding({ top: this.topInset + 8 }).backgroundColor('#FBF7EF')
  }
}
