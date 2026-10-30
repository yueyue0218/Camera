import { image } from '@kit.ImageKit';
import { common } from '@kit.AbilityKit';
import { AppClient } from '../app/AppClient';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { OrderWorkflow } from '../features/conversation/OrderWorkflow';
import { DeliveryTransfer } from '../features/delivery/DeliveryTransfer';
import { DeliveryFileSummary, DeliverySummary, OrderStatusLogSummary, OrderSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct DeliveryGalleryPage {
  @Prop orderId: number = 0;
  @State private order: OrderSummary | null = null;
  @State private deliveries: DeliverySummary[] = [];
  @State private thumbs: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private large: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private loading: boolean = true;
  @State private busy: boolean = false;
  @State private error: string = '';
  @State private notice: string = '';
  @State private reworkReason: string = '';
  @State private userId: number = 0;
  @State private viewerIndex: number = -1;
  @State private selecting: boolean = false;
  @State private selectedFileIds: number[] = [];
  @State private savingSelected: boolean = false;
  @State private reworkOpen: boolean = false;
  @State private reworkDiscard: boolean = false;
  @State private receiptOpen: boolean = false;
  @State private reworkText: string = '';
  @State private zoom: number = 1;
  @State private downloadingId: number = 0;
  @State private downloadProgress: number = 0;
  private readonly api = AppClient.shared.apiService;
  private readonly transfer = new DeliveryTransfer();
  private generation: number = 0;
  private readonly requested: Set<number> = new Set<number>();
  private longPressedAt: number = 0;
  onBack?: () => void;
  onOpenUpload?: () => void;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.generation++;
    this.api.cancelOrderDetail(this.orderId);
    this.transfer.cancel();
    this.releaseImages();
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading = this.order === null;
    this.error = '';
    try {
      const session = await this.api.currentSession();
      const results = await Promise.all([this.api.getOrder(this.orderId),
        this.api.listDeliveries(this.orderId)]);
      const order = results[0] as OrderSummary;
      const deliveries = results[1] as DeliverySummary[];
      if (generation !== this.generation) return;
      if (order.orderId !== this.orderId || !Array.isArray(deliveries)) throw new Error('作品暂时无法查看');
      this.userId = session.userId;
      this.order = order;
      this.deliveries = deliveries.filter((item: DeliverySummary) => item.orderId === this.orderId)
        .sort((a: DeliverySummary, b: DeliverySummary) => b.deliveryRound - a.deliveryRound);
      this.loadThumbs(generation);
      this.api.getOrderStatusLogs(this.orderId).then((logs: OrderStatusLogSummary[]) => {
        if (generation !== this.generation || !Array.isArray(logs)) return;
        const rework = logs.filter((log: OrderStatusLogSummary) => log.toStatus === 'REWORK_REQUIRED').pop();
        this.reworkReason = (rework?.reason ?? '').replace(/^需求方请求返修：?/, '').trim();
      }).catch(() => {});
    } catch (error) {
      if (generation === this.generation) this.error = (error as PortraError).message || '作品暂时无法查看';
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  private imageFiles(): DeliveryFileSummary[] {
    return this.deliveries.flatMap((batch: DeliverySummary) => (batch.files ?? [])
      .filter((file: DeliveryFileSummary) => this.isImage(file)));
  }

  private isImage(file: DeliveryFileSummary): boolean {
    return file.fileType === 'IMAGE' || (file.mimeType ?? '').startsWith('image/');
  }

  private async loadThumbs(generation: number): Promise<void> {
    const files = this.imageFiles();
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (generation === this.generation && cursor < files.length) {
        const file = files[cursor++];
        if (!this.thumbs.has(file.fileId) && !this.requested.has(file.fileId)) {
          this.requested.add(file.fileId);
          await this.loadImage(file.fileId, 'thumbnail', generation);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  private async loadImage(fileId: number, variant: 'thumbnail' | 'medium', generation: number): Promise<void> {
    if (variant === 'medium' && this.large.has(fileId)) return;
    try {
      const bytes = await this.api.getDeliveryImage(fileId, variant);
      const source = image.createImageSource(bytes);
      let bitmap: image.PixelMap;
      try {
        bitmap = await source.createPixelMap(variant === 'thumbnail' ?
          { desiredSize: { width: 360, height: 360 } } : {});
      } finally {
        await source.release();
      }
      if (generation !== this.generation) {
        await bitmap.release();
        return;
      }
      const next = new Map<number, image.PixelMap>(variant === 'thumbnail' ? this.thumbs : this.large);
      next.set(fileId, bitmap);
      if (variant === 'thumbnail') this.thumbs = next;
      else this.large = next;
    } catch {
      // A single unavailable photo must not hide the rest of the album.
    }
  }

  private releaseImages(): void {
    for (const fileId of this.imageFiles().map((file: DeliveryFileSummary) => file.fileId)) {
      this.api.cancelDeliveryImage(fileId, 'thumbnail');
      this.api.cancelDeliveryImage(fileId, 'medium');
    }
    this.thumbs.forEach((bitmap: image.PixelMap) => { bitmap.release(); });
    this.large.forEach((bitmap: image.PixelMap) => { bitmap.release(); });
    this.thumbs = new Map<number, image.PixelMap>();
    this.large = new Map<number, image.PixelMap>();
    this.requested.clear();
  }

  private openViewer(fileId: number): void {
    const index = this.imageFiles().findIndex((file: DeliveryFileSummary) => file.fileId === fileId);
    if (index < 0) return;
    this.viewerIndex = index;
    this.zoom = 1;
    this.loadImage(fileId, 'medium', this.generation);
  }

  private togglePhoto(fileId: number): void {
    this.selectedFileIds = this.selectedFileIds.includes(fileId) ?
      this.selectedFileIds.filter((id: number) => id !== fileId) : [...this.selectedFileIds, fileId];
  }

  private tapPhoto(fileId: number): void {
    if (Date.now() - this.longPressedAt < 500) return;
    if (this.selecting) this.togglePhoto(fileId);
    else this.openViewer(fileId);
  }

  private longPressPhoto(fileId: number): void {
    this.longPressedAt = Date.now();
    if (!this.selecting) this.selecting = true;
    if (!this.selectedFileIds.includes(fileId)) this.togglePhoto(fileId);
  }

  private async saveSelected(): Promise<void> {
    if (this.savingSelected || this.selectedFileIds.length === 0) return;
    this.savingSelected = true;
    const files = this.imageFiles().filter((file: DeliveryFileSummary) =>
      this.selectedFileIds.includes(file.fileId));
    let complete = true;
    for (const file of files) {
      if (!await this.download(file)) { complete = false; break; }
    }
    if (complete) { this.selecting = false; this.selectedFileIds = []; }
    this.savingSelected = false;
  }

  private viewerFile(): DeliveryFileSummary | undefined {
    return this.imageFiles()[this.viewerIndex];
  }

  private closeRework(): void {
    if (this.reworkText.trim().length > 0) this.reworkDiscard = true;
    else this.reworkOpen = false;
  }

  private async download(file: DeliveryFileSummary): Promise<boolean> {
    const token = AppClient.shared.sessionManager.getSession()?.accessToken ?? '';
    if (!token || this.downloadingId !== 0) return false;
    this.downloadingId = file.fileId;
    this.downloadProgress = 0;
    this.error = '';
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      const fallback = this.isImage(file) ? `作品-${file.fileId}.jpg` : `作品-${file.fileId}.zip`;
      const saved = await this.transfer.download(context, file.fileId, file.fileName ?? fallback, token,
        (percent: number) => this.downloadProgress = percent);
      if (saved) this.notice = '已保存作品';
      return saved;
    } catch (error) {
      this.error = (error as Error).message || '下载未完成，请重试';
      return false;
    } finally { this.downloadingId = 0; }
  }

  private async confirmReceipt(): Promise<void> {
    if (this.busy || this.order === null || !OrderWorkflow.canReviewDelivery(this.order, this.userId)) return;
    this.busy = true;
    this.error = '';
    try {
      await this.api.confirmReceipt(this.orderId);
      this.receiptOpen = false;
      await this.load();
      this.notice = '已确认收片';
    } catch (error) {
      const message = (error as PortraError).message || '操作未完成，请重试';
      await this.load();
      this.error = message;
    } finally { this.busy = false; }
  }

  private async submitRework(): Promise<void> {
    const reason = this.reworkText.trim();
    if (this.busy || this.order === null || !OrderWorkflow.canReviewDelivery(this.order, this.userId)) return;
    if (reason.length === 0 || reason.length > 200) {
      this.error = '请填写不超过 200 字的返修要求';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      await this.api.requestRework(this.orderId, reason);
      this.reworkOpen = false;
      this.reworkText = '';
      await this.load();
      this.notice = '返修要求已提交';
    } catch (error) {
      const message = (error as PortraError).message || '操作未完成，请重试';
      await this.load();
      this.error = message;
    } finally { this.busy = false; }
  }

  @Builder
  private FileTile(file: DeliveryFileSummary) {
    if (this.isImage(file)) {
      Stack({ alignContent: Alignment.TopEnd }) {
        if (this.thumbs.has(file.fileId)) {
          Image(this.thumbs.get(file.fileId)!).width('100%').height(145).objectFit(ImageFit.Cover)
        } else {
          Text('▧').fontSize(24).fontColor('#B6B4B1').width('100%').height(145)
            .textAlign(TextAlign.Center)
        }
        if (this.selecting) {
          Text(this.selectedFileIds.includes(file.fileId) ? '✓' : '○')
            .fontSize(19).fontColor(PortraTheme.white).textAlign(TextAlign.Center)
            .width(24).height(24).borderRadius(12)
            .border({ width: 1, color: PortraTheme.white })
            .backgroundColor(this.selectedFileIds.includes(file.fileId) ? '#147AF4' : '#66000000')
            .margin(7)
        }
      }
      .width('100%').height(145)
      .backgroundColor('#EEE9E3').borderRadius(6)
      .onClick(() => this.tapPhoto(file.fileId))
      .gesture(LongPressGesture().onAction(() => this.longPressPhoto(file.fileId)))
    } else {
      Row({ space: 10 }) {
        Text('ZIP').fontSize(12).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primary)
        Text(file.fileName ?? '作品文件').fontSize(13).fontColor(PortraTheme.primaryText)
          .layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        Button('下载').height(38).enabled(this.downloadingId === 0)
          .onClick(() => this.download(file))
      }.width('100%').padding(14).backgroundColor(PortraTheme.surface).borderRadius(6)
    }
  }

  @Builder
  private Batch(batch: DeliverySummary) {
    Column({ space: 12 }) {
      Row() {
        Text(batch === this.deliveries[0] ? '最新上传' : `第${batch.deliveryRound}次上传`)
          .fontSize(13).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
        Blank()
        Text(`${(batch.files ?? []).length} 个文件`).fontSize(12).fontColor(PortraTheme.secondaryText)
      }.width('100%')
      if ((batch.files ?? []).some((file: DeliveryFileSummary) => this.isImage(file))) {
        Grid() {
          ForEach((batch.files ?? []).filter((file: DeliveryFileSummary) => this.isImage(file)),
            (file: DeliveryFileSummary) => {
            GridItem() { this.FileTile(file) }
          }, (file: DeliveryFileSummary) => file.fileId.toString())
        }.columnsTemplate('1fr 1fr 1fr').columnsGap(5).rowsGap(5).width('100%')
          .height(Math.ceil((batch.files ?? []).filter((file: DeliveryFileSummary) => this.isImage(file)).length / 3) * 150)
      }
      ForEach((batch.files ?? []).filter((file: DeliveryFileSummary) => !this.isImage(file)),
        (file: DeliveryFileSummary) => { this.FileTile(file) },
        (file: DeliveryFileSummary) => file.fileId.toString())
      if (batch.remark) Text(batch.remark).fontSize(13).fontColor(PortraTheme.secondaryText)
    }.width('100%')
  }

  build() {
    Stack() {
      Column() {
        PortraPageHeading({ title: '作品相册', eyebrow: '', compact: true, onBack: this.onBack })
        if (this.loading) {
          PortraLoading({ label: '正在打开照片' })
        } else if (this.order === null) {
          PortraErrorView({ message: this.error || '作品暂时无法查看', onRetry: () => this.load() })
        } else {
          Scroll() {
            Column({ space: 16 }) {
              if (this.imageFiles().length > 0) {
                Row() {
                  Blank()
                  Button(this.selecting ? '取消选择' : '选择照片').height(36)
                    .backgroundColor(PortraTheme.surface).fontColor(PortraTheme.primary)
                    .onClick(() => { this.selecting = !this.selecting; this.selectedFileIds = []; })
                }.width('100%')
              }
              if (this.order!.status === 'REWORK_REQUIRED' && this.reworkReason) {
                Column({ space: 6 }) {
                  Text('返修要求').fontSize(16).fontWeight(FontWeight.Bold)
                    .fontColor(PortraTheme.primaryText)
                  Text(this.reworkReason).fontSize(13).fontColor(PortraTheme.secondaryText)
                }.width('100%').alignItems(HorizontalAlign.Start)
              }
              if (this.deliveries.length === 0) PortraEmptyView({ message: '还没有上传照片' })
              ForEach(this.deliveries, (batch: DeliverySummary) => {
                this.Batch(batch)
              }, (batch: DeliverySummary) => batch.deliveryId.toString())
            }.width('100%').justifyContent(FlexAlign.Start)
              .padding({ left: 14, right: 14, top: 16, bottom: 28 })
          }.layoutWeight(1).scrollBar(BarState.Off).align(Alignment.TopStart)
          if (this.notice) Text(this.notice).fontSize(12).fontColor(PortraTheme.success)
          if (this.error) Text(this.error).fontSize(12).fontColor(PortraTheme.danger)
          if (this.downloadingId > 0) Text(`正在下载 ${this.downloadProgress}%`)
            .fontSize(12).fontColor(PortraTheme.primary)
          if (this.selecting && this.selectedFileIds.length > 0) {
            Button(`保存所选 ${this.selectedFileIds.length} 张`).height(44)
              .enabled(!this.savingSelected && this.downloadingId === 0)
              .onClick(() => this.saveSelected())
          }
          if (OrderWorkflow.canReviewDelivery(this.order!, this.userId)) {
            Row({ space: 12 }) {
              Button('申请返修').layoutWeight(1).height(48).backgroundColor(PortraTheme.surface)
                .fontColor(PortraTheme.primary).onClick(() => this.reworkOpen = true)
              Button('确认收片').layoutWeight(1).height(48).onClick(() => this.receiptOpen = true)
            }.width('100%').padding({ left: 18, right: 18, bottom: 16 })
          } else if (OrderWorkflow.canUpload(this.order!, this.userId)) {
            Button('上传照片').height(48).width('100%').onClick(() => this.onOpenUpload?.())
              .padding({ left: 18, right: 18, bottom: 16 })
          }
        }
      }.width('100%').height('100%').backgroundColor('#F8F6F2')
      if (this.viewerIndex >= 0) {
        Column() {
          Row() {
            Button('返回').onClick(() => { this.viewerIndex = -1; this.zoom = 1; })
            Blank()
            Text(`${this.viewerIndex + 1} / ${this.imageFiles().length}`).fontColor(PortraTheme.white)
            Button('保存').enabled(this.downloadingId === 0 && this.viewerFile() !== undefined)
              .onClick(() => this.download(this.viewerFile()!))
          }.width('100%').padding(16)
          Swiper() {
            ForEach(this.imageFiles(), (file: DeliveryFileSummary) => {
              if (this.large.has(file.fileId) || this.thumbs.has(file.fileId)) {
                Image(this.large.get(file.fileId) ?? this.thumbs.get(file.fileId)!)
                  .width('100%').height('100%').objectFit(ImageFit.Contain)
                  .scale({ x: this.zoom, y: this.zoom })
                  .gesture(PinchGesture().onActionUpdate((event: GestureEvent) => {
                    this.zoom = Math.max(1, Math.min(4, event.scale));
                  }))
              } else {
                Text('正在打开照片').fontColor(PortraTheme.white)
              }
            }, (file: DeliveryFileSummary) => file.fileId.toString())
          }.index(this.viewerIndex).loop(false).indicator(false).layoutWeight(1)
            .onChange((index: number) => {
              this.viewerIndex = index;
              this.zoom = 1;
              this.loadImage(this.viewerFile()!.fileId, 'medium', this.generation);
            })
          Row() {
            Button('上一张').enabled(this.viewerIndex > 0).onClick(() => {
              this.viewerIndex--; this.zoom = 1;
              this.loadImage(this.viewerFile()!.fileId, 'medium', this.generation);
            })
            Blank()
            Button('下一张').enabled(this.viewerIndex < this.imageFiles().length - 1).onClick(() => {
              this.viewerIndex++; this.zoom = 1;
              this.loadImage(this.viewerFile()!.fileId, 'medium', this.generation);
            })
          }.width('100%').padding(18)
        }.width('100%').height('100%').backgroundColor('#151515')
      }
      if (this.reworkOpen || this.receiptOpen) {
        Column() {
          Blank().layoutWeight(1)
          Column({ space: 16 }) {
            Text(this.reworkOpen ? '申请返修' : '确认收片')
              .fontSize(18).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
            if (this.reworkOpen) {
              TextArea({ text: this.reworkText, placeholder: '请描述需要修改的地方' })
                .height(110).maxLength(200).onChange((value: string) => this.reworkText = value)
              Text(`${this.reworkText.length}/200`).fontSize(11).fontColor(PortraTheme.mutedText)
            } else {
              Text('确认后，本次约拍将完成。').fontSize(13).fontColor(PortraTheme.secondaryText)
            }
            Row({ space: 12 }) {
              Button('取消').layoutWeight(1).height(46).backgroundColor(PortraTheme.surface)
                .fontColor(PortraTheme.primary).onClick(() => {
                  if (this.reworkOpen) this.closeRework();
                  else this.receiptOpen = false;
                })
              Button(this.busy ? '提交中' : this.reworkOpen ? '提交返修' : '确认收片')
                .layoutWeight(1).height(46).enabled(!this.busy)
                .onClick(() => this.reworkOpen ? this.submitRework() : this.confirmReceipt())
            }.width('100%')
          }.width('100%').padding(20).backgroundColor(PortraTheme.surface)
        }.width('100%').height('100%').backgroundColor('#66000000')
      }
      if (this.reworkDiscard) {
        Column() {
          Blank().layoutWeight(1)
          Column({ space: 14 }) {
            Text('放弃返修要求？').fontSize(17).fontWeight(FontWeight.Bold)
            Row({ space: 12 }) {
              Button('继续编辑').layoutWeight(1).onClick(() => this.reworkDiscard = false)
              Button('放弃').layoutWeight(1).backgroundColor(PortraTheme.surface)
                .fontColor(PortraTheme.danger).onClick(() => {
                  this.reworkText = ''; this.reworkOpen = false; this.reworkDiscard = false;
                })
            }.width('100%')
          }.width('100%').padding(20).backgroundColor(PortraTheme.surface)
        }.width('100%').height('100%').backgroundColor('#66000000')
      }
    }.width('100%').height('100%')
  }
}
