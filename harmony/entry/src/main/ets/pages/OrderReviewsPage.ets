import { KeyboardAvoidMode } from '@kit.ArkUI';
import { image } from '@kit.ImageKit';
import { AppClient } from '../app/AppClient';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { AftercareDraftStore } from '../features/aftercare/AftercareDraftStore';
import { AftercarePolicy } from '../features/aftercare/AftercarePolicy';
import { ImageUpload } from '../network/ImageUpload';
import { OrderEngagementSummary, ReviewComplaintSummary, ReviewSummary, SessionSummary } from '../model/ApiModels';
import { ErrorKind, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

export interface OrderReviewsPreviewState {
  readonly order: OrderEngagementSummary;
  readonly actorId: number;
  readonly reviews: ReviewSummary[];
  readonly complaints: ReviewComplaintSummary[];
  readonly mode?: string;
  readonly targetId?: number;
}

@Component
export struct OrderReviewsPage {
  @Prop orderId: number = 0;
  @Prop previewState: OrderReviewsPreviewState | null = null;
  @State private order: OrderEngagementSummary | null = null;
  @State private actorId: number = 0;
  @State private reviews: ReviewSummary[] = [];
  @State private complaints: ReviewComplaintSummary[] = [];
  @State private mode: string = '';
  @State private targetId: number = 0;
  @State private rating: number = 5;
  @State private content: string = '';
  @State private evidenceIds: number[] = [];
  @State private evidenceImages: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private evidenceLarge: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private evidenceViewerId: number = 0;
  @State private loading: boolean = true;
  @State private busy: boolean = false;
  @State private uncertain: boolean = false;
  @State private error: string = '';
  @State private notice: string = '';
  @State private discardPrompt: boolean = false;
  @State private cancelId: number = 0;
  private readonly api = AppClient.shared.apiService;
  private generation: number = 0;
  private mounted: boolean = false;
  private previousKeyboardAvoidMode?: KeyboardAvoidMode;
  onBack?: () => void;
  onBackHandler?: (handler: (() => boolean) | undefined) => void;

  aboutToAppear(): void {
    this.mounted = true;
    this.onBackHandler?.(() => { this.back(); return true; });
    if (this.previewState !== null) {
      this.order = this.previewState.order;
      this.actorId = this.previewState.actorId;
      this.reviews = this.previewState.reviews;
      this.complaints = this.previewState.complaints;
      this.mode = this.previewState.mode ?? '';
      this.targetId = this.previewState.targetId ?? 0;
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
    this.evidenceImages.forEach((bitmap: image.PixelMap) => bitmap.release());
    this.evidenceLarge.forEach((bitmap: image.PixelMap) => bitmap.release());
    this.evidenceImages = new Map<number, image.PixelMap>();
    this.evidenceLarge = new Map<number, image.PixelMap>();
  }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const sessionVersion = AppClient.shared.sessionManager.getSessionVersion();
    this.loading = this.order === null;
    this.error = '';
    try {
      const results = await Promise.all([this.api.currentSession(), this.api.getOrder(this.orderId),
        this.api.listOrderReviews(this.orderId, `reviews.${this.orderId}.list`)]);
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
      const session = results[0] as SessionSummary;
      const order = results[1] as OrderEngagementSummary;
      const reviews = results[2] as ReviewSummary[];
      if (order.orderId !== this.orderId || ![order.customerId, order.providerUserId].includes(session.userId) ||
        !Array.isArray(reviews) || reviews.some((item: ReviewSummary) => item.orderId !== this.orderId)) {
        throw new Error('暂时无法查看评价');
      }
      this.actorId = session.userId;
      this.order = order;
      this.reviews = reviews;
      const complaintLists = await Promise.all(reviews.map((item: ReviewSummary) =>
        this.api.listReviewComplaints(item.reviewId, `reviews.${this.orderId}.complaints.${item.reviewId}`)));
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
      this.complaints = complaintLists.flat().filter((item: ReviewComplaintSummary) => item.orderId === this.orderId);
      this.complaints.filter((item: ReviewComplaintSummary) => item.complainantId === this.actorId)
        .forEach((item: ReviewComplaintSummary) => this.readEvidenceIds(item.evidenceFileIds).forEach((id: number) =>
          this.loadEvidenceImage(id, generation)));
    } catch (error) {
      if (generation === this.generation) this.error = (error as PortraError).message || '评价暂时无法查看';
    } finally { if (generation === this.generation) this.loading = false; }
  }

  private start(mode: string, targetId: number): void {
    if (this.busy || this.uncertain) return;
    this.mode = mode;
    this.targetId = targetId;
    this.content = AftercareDraftStore.read(this.actorId, this.orderId, mode, targetId) ||
      (mode === 'followup' ? this.reviewFor(targetId)?.replyContent ?? '' : '');
    const rating = Number(AftercareDraftStore.read(this.actorId, this.orderId, 'rating', targetId));
    this.rating = Number.isSafeInteger(rating) && rating >= 1 && rating <= 5 ? rating : 5;
    this.evidenceIds = mode === 'complaint' ? this.readEvidenceIds(
      AftercareDraftStore.read(this.actorId, this.orderId, 'evidence', targetId)) : [];
    this.evidenceIds.forEach((id: number) => this.loadEvidenceImage(id, this.generation));
    this.error = '';
    this.notice = '';
  }

  private readEvidenceIds(value?: string): number[] {
    if (!value) return [];
    return value.split(',').map((part: string) => Number(part))
      .filter((id: number) => Number.isSafeInteger(id) && id > 0).slice(0, 5);
  }

  private saveEvidenceIds(): void {
    AftercareDraftStore.write(this.actorId, this.orderId, 'evidence', this.targetId,
      this.evidenceIds.join(','));
  }

  private uncertainWrite(error: PortraError): boolean {
    return error.kind === ErrorKind.NETWORK || error.kind === ErrorKind.TIMEOUT ||
      error.kind === ErrorKind.PARSE || error.kind === ErrorKind.STALE ||
      (error.kind === ErrorKind.HTTP && error.httpStatus >= 500) ||
      (error.kind === ErrorKind.BUSINESS && error.businessCode >= 50000);
  }

  private async loadEvidenceImage(fileId: number, generation: number): Promise<void> {
    if (this.evidenceImages.has(fileId)) return;
    const sessionVersion = AppClient.shared.sessionManager.getSessionVersion();
    try {
      const bytes = await this.api.getDeliveryImage(fileId, 'thumbnail');
      const source = image.createImageSource(bytes);
      let bitmap: image.PixelMap;
      try { bitmap = await source.createPixelMap({ desiredSize: { width: 128, height: 128 } }); }
      finally { await source.release(); }
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) {
        await bitmap.release(); return;
      }
      const next = new Map<number, image.PixelMap>(this.evidenceImages);
      next.set(fileId, bitmap);
      this.evidenceImages = next;
    } catch { /* Private evidence stays listed even if its thumbnail cannot be loaded. */ }
  }

  private async openEvidence(fileId: number): Promise<void> {
    this.evidenceViewerId = fileId;
    if (this.evidenceLarge.has(fileId)) return;
    const generation = this.generation;
    const sessionVersion = AppClient.shared.sessionManager.getSessionVersion();
    try {
      const bytes = await this.api.getDeliveryImage(fileId, 'medium',
        `reviews.${this.orderId}.evidence.${fileId}.medium`);
      const source = image.createImageSource(bytes);
      let bitmap: image.PixelMap;
      try { bitmap = await source.createPixelMap(); }
      finally { await source.release(); }
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) {
        await bitmap.release(); return;
      }
      const next = new Map<number, image.PixelMap>(this.evidenceLarge);
      next.set(fileId, bitmap);
      this.evidenceLarge = next;
    } catch { /* The thumbnail remains available if the full photo cannot be read. */ }
  }

  private changeContent(value: string): void {
    this.content = value;
    AftercareDraftStore.write(this.actorId, this.orderId, this.mode, this.targetId, value);
  }

  private back(): void {
    if (this.busy) return;
    if (this.evidenceViewerId > 0) { this.evidenceViewerId = 0; return; }
    if (this.mode) {
      if (this.content.trim() || this.evidenceIds.length > 0) this.discardPrompt = true;
      else this.mode = '';
    } else this.onBack?.();
  }

  private reviewFor(targetId: number): ReviewSummary | undefined {
    return this.reviews.find((item: ReviewSummary) => item.reviewId === targetId);
  }

  private canComplain(review: ReviewSummary): boolean {
    return AftercarePolicy.canComplain(review, this.actorId, this.complaints);
  }

  private async addEvidence(): Promise<void> {
    if (this.previewState !== null) return;
    if (this.busy || this.evidenceIds.length >= 5) return;
    this.busy = true;
    const generation = this.generation;
    try {
      const epoch = AppClient.shared.sessionManager.getSessionVersion();
      const uris = await ImageUpload.select(5 - this.evidenceIds.length);
      for (const uri of uris) {
        const fileId = await ImageUpload.upload(uri, 'REVIEW_EVIDENCE', epoch);
        if (generation !== this.generation ||
          epoch !== AppClient.shared.sessionManager.getSessionVersion()) return;
        this.evidenceIds = [...this.evidenceIds, fileId];
        this.saveEvidenceIds();
        this.loadEvidenceImage(fileId, this.generation);
      }
    } catch (error) {
      if (generation === this.generation) this.error = (error as Error).message || '证据添加失败';
    }
    finally { if (this.mounted) this.busy = false; }
  }

  private async submit(): Promise<void> {
    if (this.previewState !== null) return;
    if (this.busy || this.uncertain || this.order === null || !this.mode) return;
    const text = this.content.trim();
    if (text.length > 1000 || (this.mode !== 'review' && text.length === 0)) {
      this.error = '请填写不超过 1000 字的内容'; return;
    }
    const review = this.reviewFor(this.targetId);
    if (this.mode === 'review' && !AftercarePolicy.canReview(this.order, this.actorId, this.reviews)) return;
    if (this.mode === 'followup' && (review === undefined ||
      !AftercarePolicy.canFollowUp(review, this.actorId))) return;
    if (this.mode === 'complaint' && (review === undefined || !this.canComplain(review) ||
      this.evidenceIds.length > 5)) return;
    this.busy = true;
    this.error = '';
    const mode = this.mode;
    const target = this.targetId;
    const submittedRating = this.rating;
    const generation = this.generation;
    const sessionVersion = AppClient.shared.sessionManager.getSessionVersion();
    try {
      if (mode === 'review') {
        await this.api.createReview(this.orderId, { rating: submittedRating, content: text },
          `reviews.${this.orderId}.create`);
      } else if (mode === 'followup') {
        await this.api.followUpReview(target, { content: text }, `reviews.${target}.followup`);
      } else {
        await this.api.createReviewComplaint(target,
          { reason: text, evidenceFileIds: this.evidenceIds.join(',') }, `reviews.${target}.complaint`);
      }
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
      AftercareDraftStore.write(this.actorId, this.orderId, mode, target, '');
      if (mode === 'review') AftercareDraftStore.write(this.actorId, this.orderId, 'rating', target, '');
      if (mode === 'complaint') AftercareDraftStore.write(this.actorId, this.orderId, 'evidence', target, '');
      this.mode = '';
      this.content = '';
      this.evidenceIds = [];
      this.notice = mode === 'review' ? '评价已提交' : mode === 'followup' ? '追评已提交' : '投诉已提交';
      await this.load();
      if (mode === 'review' && !this.error && this.reviews.some((item: ReviewSummary) =>
        item.reviewerId === this.actorId && item.content === text && item.rating === submittedRating)) {
        this.onBack?.();
      }
    } catch (error) {
      if (generation !== this.generation ||
        sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
      const failure = error as PortraError;
      this.uncertain = this.uncertainWrite(failure);
      this.error = failure.message || '暂时无法提交';
      if (this.uncertain) await this.verify(mode, target, text, submittedRating);
    } finally { if (this.mounted) this.busy = false; }
  }

  private async verify(mode: string, target: number, text: string, rating: number): Promise<void> {
    const expectedGeneration = this.generation + 1;
    const sessionVersion = AppClient.shared.sessionManager.getSessionVersion();
    await this.load();
    if (!this.mounted || expectedGeneration !== this.generation ||
      sessionVersion !== AppClient.shared.sessionManager.getSessionVersion()) return;
    if (this.error) { this.uncertain = true; return; }
    const found = mode === 'review' ? this.reviews.some((item: ReviewSummary) =>
      item.reviewerId === this.actorId && item.content === text && item.rating === rating) :
      mode === 'followup' ? this.reviews.some((item: ReviewSummary) =>
        item.reviewId === target && item.replyContent === text) :
        this.complaints.some((item: ReviewComplaintSummary) => item.reviewId === target &&
          item.complainantId === this.actorId && item.reason === text);
    if (found) {
      AftercareDraftStore.write(this.actorId, this.orderId, mode, target, '');
      if (mode === 'review') AftercareDraftStore.write(this.actorId, this.orderId, 'rating', target, '');
      if (mode === 'complaint') AftercareDraftStore.write(this.actorId, this.orderId, 'evidence', target, '');
      this.uncertain = false;
      this.mode = '';
      this.content = '';
      this.evidenceIds = [];
      this.notice = '已核对提交结果';
      if (mode === 'review') this.onBack?.();
    } else {
      this.uncertain = true;
      this.error = '暂未查到记录，请稍后核对，避免重复提交';
    }
  }

  private async cancelComplaint(id: number): Promise<void> {
    if (this.previewState !== null) return;
    const complaint = this.complaints.find((item: ReviewComplaintSummary) => item.complaintId === id);
    if (this.busy || complaint === undefined ||
      !AftercarePolicy.canCancelComplaint(complaint, this.actorId)) return;
    this.busy = true;
    this.cancelId = 0;
    try {
      await this.api.cancelReviewComplaint(id);
      this.notice = '投诉已撤回';
      await this.load();
    } catch (error) {
      await this.load();
      this.error = (error as PortraError).message || '暂时无法撤回，请核对状态';
    } finally { this.busy = false; }
  }

  private complaintStatus(status: string): string {
    if (status === 'PENDING') return '待处理';
    if (status === 'CANCELED' || status === 'CANCELLED') return '已撤回';
    if (status === 'RESOLVED') return '已处理';
    return '状态待更新';
  }

  @Builder private EvidenceStrip(ids: number[], removable: boolean) {
    Row({ space: 8 }) {
      ForEach(ids, (id: number) => {
        Column({ space: 3 }) {
          if (this.evidenceImages.has(id)) {
            Image(this.evidenceImages.get(id)!).width(60).height(60).objectFit(ImageFit.Cover)
              .borderRadius(4).onClick(() => this.openEvidence(id))
          } else Text('照片').width(60).height(60).textAlign(TextAlign.Center)
            .fontSize(11).fontColor(PortraTheme.mutedText)
            .backgroundColor(PortraTheme.pageBackgroundDeep)
          if (removable) Text('移除').fontSize(11).fontColor(PortraTheme.danger)
            .onClick(() => {
              this.evidenceIds = this.evidenceIds.filter((fileId: number) => fileId !== id);
              this.saveEvidenceIds();
            })
        }
      }, (id: number) => id.toString())
    }.width('100%')
  }

  @Builder private ReviewCard(review: ReviewSummary) {
    Column({ space: 10 }) {
      Row() {
        Text(review.reviewerId === this.actorId ? '我写的评价' : '收到的评价')
          .fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText).layoutWeight(1)
        Text(`${review.rating} ★`).fontSize(16).fontColor(PortraTheme.primary)
      }.width('100%')
      Text(review.targetUserNickname ?? '约拍伙伴').fontSize(12).fontColor(PortraTheme.secondaryText)
      if (review.isVisible === false) Text('这条评价已隐藏').fontSize(12)
        .fontColor(PortraTheme.mutedText)
      if (review.content) Text(review.content).fontSize(14).fontColor(PortraTheme.primaryText)
      if (review.createdAt) Text(review.createdAt.replace('T', ' ').slice(0, 16))
        .fontSize(11).fontColor(PortraTheme.mutedText)
      if (review.replyContent) {
        Text(`追评：${review.replyContent}`).fontSize(13).fontColor(PortraTheme.secondaryText)
      }
      if (AftercarePolicy.canFollowUp(review, this.actorId)) {
        Button(review.replyContent ? '修改追评' : '写追评').height(42)
          .backgroundColor(PortraTheme.surface).fontColor(PortraTheme.primary)
          .onClick(() => this.start('followup', review.reviewId))
      }
      if (this.canComplain(review)) {
        Button('投诉这条评价').height(42).backgroundColor(PortraTheme.surface)
          .fontColor(PortraTheme.danger).onClick(() => this.start('complaint', review.reviewId))
      }
      ForEach(this.complaints.filter((item: ReviewComplaintSummary) => item.reviewId === review.reviewId),
        (item: ReviewComplaintSummary) => {
          Divider().color(PortraTheme.border)
          Text(`评价投诉 · ${this.complaintStatus(item.status)}`)
            .fontSize(13).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          Text(item.reason).fontSize(13).fontColor(PortraTheme.secondaryText)
          if (item.evidenceFileIds) {
            Text(`已提交 ${this.readEvidenceIds(item.evidenceFileIds).length} 份证据`)
              .fontSize(12).fontColor(PortraTheme.mutedText)
            if (item.complainantId === this.actorId) this.EvidenceStrip(
              this.readEvidenceIds(item.evidenceFileIds), false)
          }
          if (item.arbitrationResult === 'REVIEW_HIDDEN') Text('投诉成立，评价已隐藏')
            .fontSize(13).fontColor(PortraTheme.primaryText)
          else if (item.arbitrationResult === 'REJECTED') Text('投诉未成立')
            .fontSize(13).fontColor(PortraTheme.primaryText)
          if (item.arbitrationComment) Text(item.arbitrationComment)
            .fontSize(13).fontColor(PortraTheme.secondaryText)
          if (AftercarePolicy.canCancelComplaint(item, this.actorId)) {
            Button('撤回投诉').height(40).backgroundColor(PortraTheme.surface)
              .fontColor(PortraTheme.secondaryText).onClick(() => this.cancelId = item.complaintId)
          }
        }, (item: ReviewComplaintSummary) => item.complaintId.toString())
    }.width('100%').alignItems(HorizontalAlign.Start).padding(16)
      .backgroundColor(PortraTheme.surface).borderRadius(6)
      .border({ width: 1, color: PortraTheme.border })
  }

  @Builder private Form() {
    Column({ space: 16 }) {
      Text(this.mode === 'review' ? '评价这次约拍' : this.mode === 'followup' ? '写追评' : '投诉这条评价')
        .fontSize(19).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      if (this.mode === 'review') {
        Text(this.actorId === this.order?.customerId ?
          this.order?.providerNickname ?? '摄影师' : this.order?.customerNickname ?? '客户')
          .fontSize(14).fontColor(PortraTheme.secondaryText)
        Row({ space: 8 }) {
          ForEach([1, 2, 3, 4, 5], (value: number) => {
            Text('★').fontSize(30).fontColor(value <= this.rating ? PortraTheme.primary : PortraTheme.mutedText)
              .width(46).height(46).textAlign(TextAlign.Center).onClick(() => {
                if (this.busy || this.uncertain) return;
                this.rating = value;
                AftercareDraftStore.write(this.actorId, this.orderId, 'rating', this.targetId, value.toString());
              })
          }, (value: number) => value.toString())
        }
      }
      TextArea({ text: this.content, placeholder: this.mode === 'complaint' ?
        '请说明投诉原因' : this.mode === 'review' ? '写下你的感受（选填）' : '写下你的补充评价' })
        .height(140).maxLength(1000).enabled(!this.busy && !this.uncertain)
        .onChange((value: string) => this.changeContent(value))
      Text(`${this.content.length}/1000`).fontSize(11).fontColor(PortraTheme.mutedText)
      if (this.mode === 'complaint') {
        Button(`添加证据照片 ${this.evidenceIds.length}/5`).height(44)
          .enabled(!this.busy && this.evidenceIds.length < 5).onClick(() => this.addEvidence())
        if (this.evidenceIds.length > 0) this.EvidenceStrip(this.evidenceIds, true)
      }
      Button(this.busy ? '提交中' : '提交').height(48).enabled(!this.busy && !this.uncertain)
        .onClick(() => this.submit())
      if (this.uncertain) Button('核对结果').height(44)
        .onClick(() => this.verify(this.mode, this.targetId, this.content.trim(), this.rating))
      if (this.error) Text(this.error).fontSize(12).fontColor(PortraTheme.danger)
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  build() {
    Stack() {
      Column() {
        PortraPageHeading({ title: this.mode ? '评价' : '本次评价', eyebrow: '', onBack: () => this.back() })
        if (this.loading) LoadingProgress().width(32).height(32).margin(24)
        else if (this.order === null) {
          Text(this.error || '暂时无法查看评价').fontColor(PortraTheme.danger).padding(20)
          Button('重试').onClick(() => this.load())
        } else {
          Scroll() {
            Column({ space: 16 }) {
              if (this.mode) this.Form()
              else {
                if (AftercarePolicy.canReview(this.order!, this.actorId, this.reviews)) {
                  Button('评价这次约拍').height(48).width('100%')
                    .onClick(() => this.start('review', this.orderId))
                }
                if (this.reviews.length === 0) Text('暂无评价').fontColor(PortraTheme.mutedText)
                ForEach(this.reviews, (item: ReviewSummary) => {
                  this.ReviewCard(item)
                }, (item: ReviewSummary) => item.reviewId.toString())
                if (this.notice) Text(this.notice).fontColor(PortraTheme.success).fontSize(12)
                if (this.error) Text(this.error).fontColor(PortraTheme.danger).fontSize(12)
              }
            }.width('100%').alignItems(HorizontalAlign.Start).padding(18)
          }.layoutWeight(1).scrollBar(BarState.Off)
        }
      }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
      if (this.discardPrompt || this.cancelId > 0) {
        Column() {
          Blank().layoutWeight(1)
          Column({ space: 14 }) {
            Text(this.cancelId > 0 ? '撤回这条投诉？' : '保留尚未提交的内容？')
              .fontSize(17).fontWeight(FontWeight.Bold)
            Row({ space: 12 }) {
              Button('继续编辑').layoutWeight(1).onClick(() => {
                this.discardPrompt = false; this.cancelId = 0;
              })
              Button(this.cancelId > 0 ? '确认撤回' : '返回').layoutWeight(1)
                .backgroundColor(PortraTheme.surface).fontColor(PortraTheme.danger)
                .onClick(() => {
                  if (this.cancelId > 0) this.cancelComplaint(this.cancelId);
                  else { this.discardPrompt = false; this.mode = ''; }
                })
            }.width('100%')
          }.width('100%').padding(20).backgroundColor(PortraTheme.surface)
        }.width('100%').height('100%').backgroundColor('#66000000')
      }
      if (this.evidenceViewerId > 0) {
        Column() {
          Button('返回').alignSelf(ItemAlign.Start).onClick(() => this.evidenceViewerId = 0)
          if (this.evidenceLarge.has(this.evidenceViewerId) || this.evidenceImages.has(this.evidenceViewerId)) Image(
            this.evidenceLarge.get(this.evidenceViewerId) ?? this.evidenceImages.get(this.evidenceViewerId)!)
            .width('100%').layoutWeight(1).objectFit(ImageFit.Contain)
        }.width('100%').height('100%').padding(16).backgroundColor('#151515')
      }
    }.width('100%').height('100%')
  }
}
