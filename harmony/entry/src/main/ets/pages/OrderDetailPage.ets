import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { MockPaymentConfirm } from '../features/conversation/MockPaymentConfirm';
import { OrderWorkflow } from '../features/conversation/OrderWorkflow';
import { QuoteWorkflow } from '../features/conversation/QuoteWorkflow';
import { OrderStatusLogSummary, OrderSummary } from '../model/ApiModels';
import { ErrorKind, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct OrderDetailPage {
  @Prop orderId: number = 0;
  @Prop openPayment: boolean = false;
  @State private order: OrderSummary | null = null;
  @State private logs: OrderStatusLogSummary[] = [];
  @State private userId: number = 0;
  @State private loading: boolean = true;
  @State private busy: boolean = false;
  @State private showPay: boolean = false;
  @State private showCancel: boolean = false;
  @State private errorMessage: string = '';
  @State private notice: string = '';
  @State private paymentUncertain: boolean = false;
  private readonly api = AppClient.shared.apiService;
  private requestVersion: number = 0;
  private paymentPromptConsumed: boolean = false;
  private active: boolean = false;
  onBack?: () => void;
  onOpenConversation?: (conversationId: number) => void;
  onOpenReviews?: () => void;
  onOpenGallery?: () => void;
  onOpenAuthorization?: () => void;
  onOpenUpload?: () => void;

  aboutToAppear(): void {
    this.active = true;
    this.load();
  }
  aboutToDisappear(): void {
    this.active = false;
    this.requestVersion++;
    this.api.cancelOrderDetail(this.orderId);
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = this.order === null;
    this.errorMessage = '';
    try {
      const session = await this.api.currentSession();
      const order = await this.api.getOrder(this.orderId);
      if (version !== this.requestVersion) return;
      if (order.orderId !== this.orderId) throw new Error('订单暂时无法查看');
      this.userId = session.userId;
      this.order = order;
      this.paymentUncertain = false;
      if (this.openPayment && !this.paymentPromptConsumed && OrderWorkflow.canPay(order, session.userId)) {
        this.paymentPromptConsumed = true;
        this.showPay = true;
      }
      try {
        const logs = await this.api.getOrderStatusLogs(this.orderId);
        if (version === this.requestVersion) this.logs = Array.isArray(logs) ? logs : [];
      } catch {
        // Order details remain usable while progress history is unavailable.
      }
    } catch (error) {
      if (version === this.requestVersion) this.errorMessage = (error as PortraError).message || '订单暂时无法查看';
    } finally {
      if (version === this.requestVersion) this.loading = false;
    }
  }

  private async pay(): Promise<void> {
    if (this.busy || this.order === null || !OrderWorkflow.canPay(this.order, this.userId) ||
      this.order.amountCent === undefined) return;
    this.busy = true;
    this.paymentUncertain = true;
    this.notice = '';
    this.errorMessage = '';
    const amount = this.order.amountCent;
    const version = this.requestVersion;
    try {
      const result = await this.api.mockPay(this.orderId, amount);
      if (!this.active || version !== this.requestVersion) return;
      if (result.orderId !== this.orderId) throw new Error('支付结果待确认');
      this.showPay = false;
      await this.load();
      this.notice = this.order?.status === 'PAID_PENDING_SHOOT' ? '支付成功' : '正在核对支付结果';
      this.paymentUncertain = this.order?.status === 'PENDING_PAYMENT';
    } catch (error) {
      if (!this.active || version !== this.requestVersion) return;
      this.showPay = false;
      await this.reconcilePayment(error as PortraError);
    } finally { this.busy = false; }
  }

  private async reconcilePayment(error: PortraError): Promise<void> {
    try {
      const order = await this.api.getOrder(this.orderId);
      this.order = order;
      if (order.status !== 'PENDING_PAYMENT') {
        const payment = await this.api.getPayment(this.orderId);
        this.notice = payment.paymentId > 0 && order.status === 'PAID_PENDING_SHOOT' ?
          '支付成功' : '订单状态已更新';
        await this.load();
        this.paymentUncertain = false;
        return;
      }
      this.paymentUncertain = true;
      this.errorMessage = error.kind === ErrorKind.TIMEOUT || error.kind === ErrorKind.NETWORK ?
        '暂未查到支付结果，请稍后刷新' : error.message;
    } catch {
      this.paymentUncertain = true;
      this.notice = '支付结果待确认，请稍后刷新订单';
    }
  }

  private async cancel(): Promise<void> {
    if (this.busy || this.order === null || this.paymentUncertain ||
      !OrderWorkflow.canCancel(this.order, this.userId)) return;
    this.busy = true;
    this.errorMessage = '';
    try {
      await this.api.cancelOrder(this.orderId);
      this.showCancel = false;
      await this.load();
      this.notice = '约拍已取消';
    } catch (error) {
      const message = (error as PortraError).message || '操作未完成，请重试';
      await this.load();
      this.errorMessage = message;
    } finally { this.busy = false; }
  }

  @Builder
  private Detail(label: string, value: string) {
    Row({ space: 12 }) {
      Text(label).fontSize(13).fontColor(PortraTheme.secondaryText).width(72)
      Text(value).fontSize(14).fontColor(PortraTheme.primaryText).layoutWeight(1)
    }.width('100%')
  }

  @Builder
  private Action(icon: string, label: string, onOpen: () => void) {
    Row({ space: 11 }) {
      Text(icon).width(34).height(34).fontSize(17).textAlign(TextAlign.Center)
        .fontColor(PortraTheme.primary).backgroundColor('#EDF2FF').borderRadius(10)
      Text(label).fontSize(13).fontWeight(FontWeight.Medium)
        .fontColor(PortraTheme.primaryText).layoutWeight(1)
      Text('›').fontSize(20).fontColor(PortraTheme.mutedText)
    }.width('100%').height(52).onClick(onOpen)
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
      PortraPageHeading({ title: '订单详情', eyebrow: '', compact: true, onBack: this.onBack })
      if (this.loading) {
        PortraLoading({ label: '正在打开订单' })
      } else if (this.order === null) {
        PortraErrorView({ message: this.errorMessage || '订单暂时无法查看', onRetry: () => this.load() })
      } else {
        Scroll() {
          Column({ space: 16 }) {
            Column({ space: 6 }) {
              Text(OrderWorkflow.status(this.order!.status)).fontSize(21).fontWeight(FontWeight.Bold)
                .fontColor(PortraTheme.primaryText)
              Text(OrderWorkflow.task(this.order!, this.userId)).fontSize(14).fontColor(PortraTheme.secondaryText)
            }.width('100%').alignItems(HorizontalAlign.Start)
            Row({ space: 12 }) {
              Text('▧').width(68).height(76).fontSize(28).textAlign(TextAlign.Center)
                .fontColor('#777F93').backgroundColor('#EDEAE5').borderRadius(10)
              Column({ space: 6 }) {
                Text('本次约拍').fontSize(16).fontWeight(FontWeight.Bold)
                  .fontColor(PortraTheme.primaryText)
                Text(this.order!.shootLocation ?? '约拍地点待确认').fontSize(11)
                  .fontColor(PortraTheme.secondaryText).maxLines(1)
                Text(OrderWorkflow.money(this.order!.amountCent)).fontSize(21)
                  .fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              }.layoutWeight(1).alignItems(HorizontalAlign.Start)
            }.width('100%').padding(14)
              .backgroundColor(PortraTheme.surface).borderRadius(14)
            Column({ space: 14 }) {
              this.Detail('拍摄时间', QuoteWorkflow.dateInput(this.order!.shootStartTime ?? ''))
              this.Detail('拍摄地点', this.order!.shootLocation ?? '待更新')
              this.Detail('对方', this.userId === this.order!.customerId ?
                this.order!.providerNickname ?? '摄影师' : this.order!.customerNickname ?? '客户')
            }.width('100%').alignItems(HorizontalAlign.Start).padding(14)
              .backgroundColor(PortraTheme.surface).borderRadius(14)
            Text('订单进度').fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              .width('100%')
            Column({ space: 4 }) {
            ForEach(this.logs, (log: OrderStatusLogSummary) => {
              Row({ space: 12 }) {
                Column({ space: 2 }) {
                  Text('●').fontSize(10).fontColor(PortraTheme.primary)
                  Divider().vertical(true).height(22).color(PortraTheme.border)
                }.width(14)
                Column({ space: 3 }) {
                  Text(OrderWorkflow.status(log.toStatus)).fontSize(13).fontColor(PortraTheme.primaryText)
                  Text(QuoteWorkflow.dateInput(log.createdAt ?? '')).fontSize(11)
                    .fontColor(PortraTheme.mutedText)
                }.alignItems(HorizontalAlign.Start)
              }.width('100%')
            })
            }.width('100%').alignItems(HorizontalAlign.Start).padding(14)
              .backgroundColor(PortraTheme.surface).borderRadius(14)
            if ((this.order!.conversationId ?? 0) > 0 || OrderWorkflow.hasGallery(this.order!) ||
              OrderWorkflow.canUpload(this.order!, this.userId) ||
              this.order!.status === 'COMPLETED' || this.order!.status === 'REFUNDED') {
              Text('相关内容').fontSize(14).fontWeight(FontWeight.Bold)
                .fontColor(PortraTheme.primaryText)
              Column() {
                if (this.order!.conversationId !== undefined && this.order!.conversationId! > 0) {
                  this.Action('☏', '返回聊天', () =>
                    this.onOpenConversation?.(this.order!.conversationId!))
                }
                if (OrderWorkflow.hasGallery(this.order!)) {
                  this.Action('▧', '查看照片', () => this.onOpenGallery?.())
                }
                if (OrderWorkflow.canUpload(this.order!, this.userId)) {
                  this.Action('↑', this.order!.status === 'REWORK_REQUIRED' ? '重新上传' : '上传照片',
                    () => this.onOpenUpload?.())
                }
                if (this.order!.status === 'COMPLETED') {
                  this.Action('▧', '展示授权', () => this.onOpenAuthorization?.())
                }
                if (this.order!.status === 'COMPLETED' || this.order!.status === 'REFUNDED') {
                  this.Action('☆', '评价', () => this.onOpenReviews?.())
                }
              }.width('100%').padding({ left: 14, right: 14 })
                .backgroundColor(PortraTheme.surface).borderRadius(14)
            }
            if (OrderWorkflow.canCancel(this.order!, this.userId) && !this.paymentUncertain) {
              Button('取消约拍').height(44).backgroundColor(PortraTheme.surface)
                .fontColor(PortraTheme.danger).enabled(!this.busy).onClick(() => this.showCancel = true)
            }
          }.width('100%').alignItems(HorizontalAlign.Start).justifyContent(FlexAlign.Start)
            .padding({ left: 14, right: 14, top: 16, bottom: 30 })
        }.layoutWeight(1).scrollBar(BarState.Off).align(Alignment.TopStart)
        if (this.notice) Text(this.notice).fontSize(12).fontColor(PortraTheme.primary)
          .padding({ left: 20, right: 20 })
        if (this.errorMessage) Text(this.errorMessage).fontSize(12).fontColor(PortraTheme.danger)
          .padding({ left: 20, right: 20 })
        if (this.paymentUncertain) {
          Row() {
            Button('刷新订单').height(44).width('100%').backgroundColor(PortraTheme.surface)
              .fontColor(PortraTheme.primary).onClick(() => this.load())
          }.width('100%').padding({ left: 20, right: 20, top: 10, bottom: 16 })
        } else if (OrderWorkflow.canPay(this.order!, this.userId)) {
          Row() {
            Button(this.busy ? '处理中' : '确认支付').height(48).width('100%').enabled(!this.busy)
              .onClick(() => this.showPay = true)
          }.width('100%').padding({ left: 20, right: 20, top: 10, bottom: 16 })
        }
      }
      }.width('100%').height('100%').backgroundColor('#F8F6F2')
      if (this.showPay && this.order !== null) {
        Column() {
          Blank().layoutWeight(1)
          MockPaymentConfirm({ amountCent: this.order!.amountCent ?? 0, busy: this.busy,
            onCancel: () => this.showPay = false, onConfirm: () => this.pay() })
        }.width('100%').height('100%').backgroundColor('#66000000')
      }
      if (this.showCancel && this.order !== null) {
        Column() {
          Blank().layoutWeight(1)
          Column({ space: 14 }) {
            Text('取消这次约拍？').fontSize(18).fontWeight(FontWeight.Bold)
              .fontColor(PortraTheme.primaryText)
            if (this.order!.status === 'PAID_PENDING_SHOOT') {
              Text('当前为模拟支付，不涉及真实退款。').fontSize(13)
                .fontColor(PortraTheme.secondaryText)
            }
            Row({ space: 12 }) {
              Button('再想想').layoutWeight(1).height(46).backgroundColor(PortraTheme.surface)
                .fontColor(PortraTheme.primary).onClick(() => this.showCancel = false)
              Button(this.busy ? '处理中' : '确认取消').layoutWeight(1).height(46)
                .enabled(!this.busy).onClick(() => this.cancel())
            }.width('100%')
          }.width('100%').padding(20).backgroundColor(PortraTheme.surface)
        }.width('100%').height('100%').backgroundColor('#66000000')
      }
    }.width('100%').height('100%')
  }
}
