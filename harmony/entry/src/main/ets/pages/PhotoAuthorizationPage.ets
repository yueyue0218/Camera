import { KeyboardAvoidMode } from '@kit.ArkUI';
import { image } from '@kit.ImageKit';
import { AppClient } from '../app/AppClient';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { AftercareDraftStore } from '../features/aftercare/AftercareDraftStore';
import { AftercarePolicy } from '../features/aftercare/AftercarePolicy';
import { DeliveryFileSummary, DeliverySummary, OrderSummary, SessionSummary,
  PhotoAuthorizationSummary } from '../model/ApiModels';
import { ErrorKind, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

export interface PhotoAuthorizationPreviewState {
  readonly order: OrderSummary;
  readonly actorId: number;
  readonly deliveries: DeliverySummary[];
  readonly authorizations: PhotoAuthorizationSummary[];
  readonly detailId?: number;
  readonly selecting?: boolean;
  readonly selected?: number[];
}

@Component
export struct PhotoAuthorizationPage {
  @Prop orderId: number = 0;
  @Prop initialAuthorizationId: number = 0;
  @Prop previewState: PhotoAuthorizationPreviewState | null = null;
  @State private order: OrderSummary | null = null;
  @State private actorId: number = 0;
  @State private deliveries: DeliverySummary[] = [];
  @State private authorizations: PhotoAuthorizationSummary[] = [];
  @State private thumbnails: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private large: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private selected: number[] = [];
  @State private selecting: boolean = false;
  @State private confirming: boolean = false;
  @State private detailId: number = 0;
  @State private viewerId: number = 0;
  @State private remark: string = '';
  @State private decisionRemark: string = '';
  @State private rejecting: boolean = false;
  @State private approving: boolean = false;
  @State private busy: boolean = false;
  @State private uncertain: boolean = false;
  @State private loading: boolean = true;
  @State private error: string = '';
  @State private notice: string = '';
  private generation: number = 0;
  private mounted: boolean = false;
  private draftOwnerId: number = 0;
  private previousKeyboardAvoidMode?: KeyboardAvoidMode;
  private thumbnailQueue: number[] = [];
  private thumbnailCursor: number = 0;
  private readonly api = AppClient.shared.apiService;
  onBack?: () => void;
  onBackHandler?: (handler: (() => boolean) | undefined) => void;

  aboutToAppear(): void {
    this.mounted = true;
    this.onBackHandler?.(() => { this.back(); return true; });
    if (this.previewState !== null) {
      this.order = this.previewState.order;
      this.actorId = this.previewState.actorId;
      this.deliveries = this.previewState.deliveries;
      this.authorizations = this.previewState.authorizations;
      this.detailId = this.previewState.detailId ?? 0;
      this.selecting = this.previewState.selecting ?? false;
      this.selected = this.previewState.selected ?? [];
      this.loading = false;
      return;
    }
    this.previousKeyboardAvoidMode = this.getUIContext().getKeyboardAvoidMode();
    this.getUIContext().setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    this.load();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.onBackHandler?.(undefined);
    this.generation++;
    if (this.previousKeyboardAvoidMode !== undefined) {
      this.getUIContext().setKeyboardAvoidMode(this.previousKeyboardAvoidMode);
      this.previousKeyboardAvoidMode = undefined;
    }
    this.api.cancelPhotoAuthorizationReads(this.orderId);
    this.thumbnails.forEach((bitmap: image.PixelMap) => bitmap.release());
    this.large.forEach((bitmap: image.PixelMap) => bitmap.release());
    this.thumbnails = new Map<number, image.PixelMap>();
    this.large = new Map<number, image.PixelMap>();
  }

  private available(): DeliveryFileSummary[] {
    return AftercarePolicy.availablePhotos(this.deliveries, this.authorizations);
  }

  private allFiles(): DeliveryFileSummary[] {
    const files = new Map<number, DeliveryFileSummary>();
    this.deliveries.forEach((delivery: DeliverySummary) =>
      (delivery.files ?? []).forEach((file: DeliveryFileSummary) => {
        if (file.fileType === 'IMAGE') files.set(file.fileId, file);
      }));
    this.authorizations.forEach((authorization: PhotoAuthorizationSummary) =>
      authorization.files.forEach(file => {
        if (file.fileType === 'IMAGE' && !files.has(file.fileId)) {
          files.set(file.fileId, { fileId: file.fileId, fileName: file.fileName, fileType: file.fileType });
        }
      }));
    return Array.from(files.values());
  }

  private currentAuthorization(): PhotoAuthorizationSummary | undefined {
    return this.authorizations.find((item: PhotoAuthorizationSummary) => item.id === this.detailId);
  }

  private restoreDraft(actorId: number): void {
    if (this.draftOwnerId === actorId) return;
    this.draftOwnerId = actorId;
    const saved = AftercareDraftStore.read(actorId, this.orderId, 'authphotos');
    this.selected = saved.split(',').map((part: string) => Number(part))
      .filter((id: number) => Number.isSafeInteger(id) && id > 0);
    this.remark = AftercareDraftStore.read(actorId, this.orderId, 'authremark');
    this.selecting = this.selected.length > 0;
  }

  private saveSelection(): void {
    AftercareDraftStore.write(this.actorId, this.orderId, 'authphotos', 0, this.selected.join(','));
  }

  private openDetail(id: number): void {
    this.detailId = id;
    this.rejecting = false;
    this.approving = false;
    this.decisionRemark = AftercareDraftStore.read(this.actorId, this.orderId, 'authreject', id);
  }

  private back(): void {
    if (this.viewerId > 0) { this.viewerId = 0; return; }
    if (this.confirming) { this.confirming = false; return; }
    if (this.detailId > 0 && this.initialAuthorizationId === 0) { this.detailId = 0; return; }
    if (this.selecting) { this.selecting = false; return; }
    this.onBack?.();
  }

  private uncertainWrite(error: PortraError): boolean {
    return error.kind === ErrorKind.NETWORK || error.kind === ErrorKind.TIMEOUT ||
      error.kind === ErrorKind.PARSE || error.kind === ErrorKind.STALE ||
      (error.kind === ErrorKind.HTTP && error.httpStatus >= 500) ||
      (error.kind === ErrorKind.BUSINESS && error.businessCode >= 50000);
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading = this.order === null;
    this.error = '';
    try {
      const results = await Promise.all([
        this.api.currentSession(), this.api.getOrder(this.orderId), this.api.listDeliveries(this.orderId),
        this.api.listPhotoAuthorizations(this.orderId)
      ]);
      const session = results[0] as SessionSummary;
      const order = results[1] as OrderSummary;
      const deliveries = results[2] as DeliverySummary[];
      const authorizations = results[3] as PhotoAuthorizationSummary[];
      if (generation !== this.generation) return;
      if (order.orderId !== this.orderId || ![order.customerId, order.providerUserId].includes(session.userId) ||
        !Array.isArray(deliveries) || !Array.isArray(authorizations) ||
        authorizations.some((item: PhotoAuthorizationSummary) => item.orderId !== this.orderId)) {
        throw new Error('暂时无法查看展示授权');
      }
      this.order = order;
      this.actorId = session.userId;
      this.deliveries = deliveries.filter((item: DeliverySummary) => item.orderId === this.orderId);
      this.authorizations = authorizations;
      this.restoreDraft(session.userId);
      this.selected = this.selected.filter((id: number) =>
        this.available().some((file: DeliveryFileSummary) => file.fileId === id));
      this.saveSelection();
      if (this.initialAuthorizationId > 0 && this.detailId === 0) {
        this.openDetail(this.initialAuthorizationId);
      }
      if (this.detailId > 0 && !authorizations.some((item: PhotoAuthorizationSummary) => item.id === this.detailId)) {
        this.detailId = 0;
      }
      this.loadThumbnails(generation);
    } catch (error) {
      if (generation === this.generation) this.error = (error as PortraError).message || '暂时无法查看展示授权';
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  private loadThumbnails(generation: number): void {
    this.thumbnailQueue = this.allFiles().map((file: DeliveryFileSummary) => file.fileId)
      .filter((id: number) => !this.thumbnails.has(id));
    this.thumbnailCursor = 0;
    for (let worker = 0; worker < Math.min(4, this.thumbnailQueue.length); worker++) {
      this.loadThumbnailWorker(generation);
    }
  }

  private async loadThumbnailWorker(generation: number): Promise<void> {
    while (generation === this.generation && this.thumbnailCursor < this.thumbnailQueue.length) {
      const fileId = this.thumbnailQueue[this.thumbnailCursor++];
      await this.loadImage(fileId, 'thumbnail', generation);
    }
  }

  private async loadImage(fileId: number, variant: 'thumbnail' | 'medium', generation: number): Promise<void> {
    const sourceMap = variant === 'thumbnail' ? this.thumbnails : this.large;
    if (sourceMap.has(fileId)) return;
    const sessionVersion = AppClient.shared.sessionManager.getSessionVersion();
    try {
      const bytes = await this.api.getDeliveryImage(fileId, variant);
      const source = image.createImageSource(bytes);
      let bitmap: image.PixelMap;
      try {
        bitmap = await source.createPixelMap(variant === 'thumbnail' ?
          { desiredSize: { width: 320, height: 320 } } : {});
      } finally { await source.release(); }
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) {
        await bitmap.release(); return;
      }
      const next = new Map<number, image.PixelMap>(variant === 'thumbnail' ? this.thumbnails : this.large);
      next.set(fileId, bitmap);
      if (variant === 'thumbnail') this.thumbnails = next;
      else {
        if (next.size > 3) {
          const oldId = Array.from(next.keys())[0];
          const old = next.get(oldId);
          next.delete(oldId);
          old?.release();
        }
        this.large = next;
      }
    } catch { /* Keep the photo slot available for retry after refresh. */ }
  }

  private toggle(fileId: number): void {
    if (!this.available().some((file: DeliveryFileSummary) => file.fileId === fileId)) return;
    this.selected = this.selected.includes(fileId) ? this.selected.filter((id: number) => id !== fileId) :
      [...this.selected, fileId];
    this.saveSelection();
  }

  private async requestAuthorization(): Promise<void> {
    if (this.previewState !== null) return;
    if (this.busy || this.uncertain || this.order === null ||
      !AftercarePolicy.authorizable(this.order, this.actorId) || this.selected.length === 0 ||
      this.selected.some((id: number) => !this.available().some((file: DeliveryFileSummary) => file.fileId === id))) return;
    this.busy = true;
    this.error = '';
    const requested = this.selected.slice();
    const generation = this.generation;
    const sessionVersion = AppClient.shared.sessionManager.getSessionVersion();
    try {
      await this.api.requestPhotoAuthorization(this.orderId, { fileIds: requested, remark: this.remark.trim() });
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
      this.selected = [];
      this.remark = '';
      this.saveSelection();
      AftercareDraftStore.write(this.actorId, this.orderId, 'authremark', 0, '');
      this.selecting = false;
      this.confirming = false;
      this.notice = '申请已提交';
      await this.load();
      if (!this.error && this.authorizations.some((item: PhotoAuthorizationSummary) =>
        requested.every((id: number) => item.files.some(file => file.fileId === id)))) {
        this.onBack?.();
      }
    } catch (error) {
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
      const failure = error as PortraError;
      this.uncertain = this.uncertainWrite(failure);
      this.error = failure.message || '申请未提交';
      if (this.uncertain) await this.reconcileRequest(requested);
    } finally { if (this.mounted) this.busy = false; }
  }

  private async reconcileRequest(requested: number[]): Promise<void> {
    try {
      const authorizations = await this.api.listPhotoAuthorizations(this.orderId);
      if (authorizations.some((item: PhotoAuthorizationSummary) => requested.every((id: number) =>
        item.files.some(file => file.fileId === id)))) {
        this.authorizations = authorizations;
        this.selected = [];
        this.saveSelection();
        this.remark = '';
        AftercareDraftStore.write(this.actorId, this.orderId, 'authremark', 0, '');
        this.selecting = false;
        this.confirming = false;
        this.uncertain = false;
        this.notice = '申请已提交';
        this.error = '';
        this.onBack?.();
      } else {
        this.error = '暂未查到申请，请稍后核对，避免重复提交';
      }
    } catch { this.error = '暂时无法核对申请，请稍后重试'; }
  }

  private async decide(approve: boolean): Promise<void> {
    if (this.previewState !== null) return;
    const current = this.currentAuthorization();
    if (this.busy || this.uncertain || current === undefined ||
      !AftercarePolicy.canDecide(current, this.actorId)) return;
    if (!approve && !this.decisionRemark.trim()) { this.error = '请填写拒绝原因'; return; }
    this.busy = true;
    this.error = '';
    const generation = this.generation;
    const sessionVersion = AppClient.shared.sessionManager.getSessionVersion();
    try {
      await this.api.decidePhotoAuthorization(current.id, approve, this.decisionRemark.trim());
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
      this.rejecting = false;
      this.approving = false;
      this.decisionRemark = '';
      AftercareDraftStore.write(this.actorId, this.orderId, 'authreject', current.id, '');
      this.notice = approve ? '已同意展示' : '已拒绝展示';
      await this.load();
    } catch (error) {
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
      const failure = error as PortraError;
      this.uncertain = this.uncertainWrite(failure);
      this.error = failure.message || '操作未完成';
      if (this.uncertain) await this.reconcileDecision(current.id);
    } finally { if (this.mounted) this.busy = false; }
  }

  private async reconcileDecision(id: number): Promise<void> {
    try {
      const authorizations = await this.api.listPhotoAuthorizations(this.orderId);
      this.authorizations = authorizations;
      const current = authorizations.find((item: PhotoAuthorizationSummary) => item.id === id);
      if (current !== undefined && current.status !== 'PENDING') {
        this.uncertain = false;
        this.rejecting = false;
        this.approving = false;
        this.decisionRemark = '';
        AftercareDraftStore.write(this.actorId, this.orderId, 'authreject', id, '');
        this.notice = AftercarePolicy.authorizationStatus(current, this.actorId);
        this.error = '';
      } else this.error = '暂未查到处理结果，请稍后核对';
    } catch { this.error = '暂时无法核对处理结果，请稍后重试'; }
  }

  @Builder private Photo(fileId: number, selectable: boolean) {
    Stack({ alignContent: Alignment.Center }) {
      if (this.thumbnails.has(fileId)) {
        Image(this.thumbnails.get(fileId)!).width('100%').height(124).objectFit(ImageFit.Contain)
      } else {
        Text('照片').fontSize(12).fontColor(PortraTheme.mutedText)
      }
      if (selectable && this.selecting) {
        Text(this.available().some((file: DeliveryFileSummary) => file.fileId === fileId) ?
          this.selected.includes(fileId) ? '已选择' : '选择' : '已申请')
          .fontSize(12).fontColor(PortraTheme.white)
          .padding(6).backgroundColor(this.selected.includes(fileId) ? PortraTheme.primary : '#66000000')
          .align(Alignment.TopEnd)
      }
    }.width('48%').height(132).backgroundColor(PortraTheme.pageBackgroundDeep)
      .borderRadius(6).onClick(() => selectable && this.selecting ? this.toggle(fileId) : this.openViewer(fileId))
  }

  private openViewer(fileId: number): void {
    this.viewerId = fileId;
    this.loadImage(fileId, 'medium', this.generation);
  }

  @Builder private PhotoGrid(files: DeliveryFileSummary[], selectable: boolean) {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
      ForEach(files, (file: DeliveryFileSummary) => {
        this.Photo(file.fileId, selectable)
      }, (file: DeliveryFileSummary) => file.fileId.toString())
    }.width('100%')
  }

  @Builder private AuthorizationDetail(item: PhotoAuthorizationSummary) {
    Column({ space: 15 }) {
      Text(AftercarePolicy.authorizationStatus(item, this.actorId))
        .fontSize(18).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      Text(item.photoUsageScope === 'PORTFOLIO_DISPLAY' ?
        '用于摄影师作品集展示' : '使用用途暂时无法确认')
        .fontSize(14).fontColor(PortraTheme.secondaryText)
      if (item.remark) Text(item.remark).fontSize(13).fontColor(PortraTheme.secondaryText)
      this.PhotoGrid(item.files.map(file => ({ fileId: file.fileId, fileName: file.fileName,
        fileType: file.fileType } as DeliveryFileSummary)), false)
      if (AftercarePolicy.canDecide(item, this.actorId)) {
        if (this.rejecting) {
          TextArea({ text: this.decisionRemark, placeholder: '请写下拒绝原因' })
            .height(92).maxLength(500).enabled(!this.busy && !this.uncertain)
            .onChange((value: string) => {
              this.decisionRemark = value;
              AftercareDraftStore.write(this.actorId, this.orderId, 'authreject', item.id, value);
            })
        }
        if (this.approving) Text('确认同意展示这些照片？').fontSize(13)
          .fontColor(PortraTheme.primaryText)
        Row({ space: 12 }) {
          Button(this.rejecting || this.approving ? '返回' : '拒绝').layoutWeight(1).height(46)
            .backgroundColor(PortraTheme.surface).fontColor(PortraTheme.danger)
            .enabled(!this.busy && !this.uncertain)
            .onClick(() => {
              if (this.rejecting || this.approving) { this.rejecting = false; this.approving = false; }
              else this.rejecting = true;
            })
          Button(this.rejecting ? '确认拒绝' : this.approving ? '确认同意' : '同意展示')
            .layoutWeight(1).height(46)
            .enabled(!this.busy && !this.uncertain)
            .onClick(() => {
              if (this.rejecting) this.decide(false);
              else if (this.approving) this.decide(true);
              else this.approving = true;
            })
        }.width('100%')
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  build() {
    Stack() {
      Column() {
        PortraPageHeading({ title: this.detailId > 0 ? '展示申请' : '展示授权', eyebrow: '',
          onBack: () => this.back() })
        if (this.loading) {
          LoadingProgress().width(32).height(32).margin(24)
        } else if (this.order === null) {
          Text(this.error || '暂时无法查看展示授权').fontColor(PortraTheme.danger).padding(20)
          Button('重试').onClick(() => this.load())
        } else {
          Scroll() {
            Column({ space: 18 }) {
              if (this.detailId > 0 && this.currentAuthorization() !== undefined) {
                this.AuthorizationDetail(this.currentAuthorization()!)
              } else if (this.confirming) {
                Text('确认申请').fontSize(18).fontWeight(FontWeight.Bold)
                Text('用于摄影师作品集展示').fontSize(14).fontColor(PortraTheme.secondaryText)
                this.PhotoGrid(this.available().filter((file: DeliveryFileSummary) =>
                  this.selected.includes(file.fileId)), false)
                TextArea({ text: this.remark, placeholder: '备注（选填）' })
                  .height(90).maxLength(500).enabled(!this.busy && !this.uncertain)
                  .onChange((value: string) => {
                    this.remark = value;
                    AftercareDraftStore.write(this.actorId, this.orderId, 'authremark', 0, value);
                  })
                Button('提交申请').height(48).enabled(!this.busy && !this.uncertain)
                  .onClick(() => this.requestAuthorization())
                Button('返回选图').height(44).backgroundColor(PortraTheme.surface)
                  .fontColor(PortraTheme.primary).onClick(() => this.confirming = false)
              } else {
                if (this.order!.status === 'COMPLETED' && this.allFiles().length > 0) {
                  Text('本次作品').fontSize(17).fontWeight(FontWeight.Bold)
                  this.PhotoGrid(this.allFiles(), true)
                  if (AftercarePolicy.authorizable(this.order!, this.actorId) && this.available().length > 0) {
                    Button(this.selecting ? `已选 ${this.selected.length} 张 · 下一步` : '选择照片')
                      .height(48).enabled(!this.selecting || this.selected.length > 0)
                      .onClick(() => this.selecting ? this.confirming = true : this.selecting = true)
                  }
                }
                Text('申请记录').fontSize(17).fontWeight(FontWeight.Bold)
                if (this.authorizations.length === 0) Text('暂无申请').fontColor(PortraTheme.mutedText)
                ForEach(this.authorizations, (item: PhotoAuthorizationSummary) => {
                  Column({ space: 6 }) {
                    Text(AftercarePolicy.authorizationStatus(item, this.actorId))
                      .fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
                    Text(`${item.files.length} 张照片 · 查看申请 ›`)
                      .fontSize(13).fontColor(PortraTheme.secondaryText)
                  }.width('100%').padding(14).backgroundColor(PortraTheme.surface)
                    .border({ width: 1, color: PortraTheme.border }).borderRadius(6)
                    .onClick(() => this.openDetail(item.id))
                }, (item: PhotoAuthorizationSummary) => item.id.toString())
              }
              if (this.notice) Text(this.notice).fontColor(PortraTheme.success).fontSize(12)
              if (this.error) Text(this.error).fontColor(PortraTheme.danger).fontSize(12)
              if (this.uncertain) Button('核对结果').onClick(() => this.detailId > 0 ?
                this.reconcileDecision(this.detailId) : this.reconcileRequest(this.selected))
            }.width('100%').alignItems(HorizontalAlign.Start).padding(18)
          }.layoutWeight(1).scrollBar(BarState.Off)
        }
      }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
      if (this.viewerId > 0) {
        Column() {
          Button('返回').alignSelf(ItemAlign.Start).onClick(() => this.viewerId = 0)
          if (this.large.has(this.viewerId) || this.thumbnails.has(this.viewerId)) {
            Image(this.large.get(this.viewerId) ?? this.thumbnails.get(this.viewerId)!)
              .width('100%').layoutWeight(1).objectFit(ImageFit.Contain)
          } else Text('正在打开照片').fontColor(PortraTheme.white).layoutWeight(1)
        }.width('100%').height('100%').padding(16).backgroundColor('#151515')
      }
    }.width('100%').height('100%')
  }
}
