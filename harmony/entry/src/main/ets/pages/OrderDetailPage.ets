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
  @State private errorMessage: string = '';
  @State private notice: string = '';
  @State private paymentUncertain: boolean = false;
  private readonly api = AppClient.shared.apiService;
  private requestVersion: number = 0;
  private paymentPromptConsumed: boolean = false;
  onBack?: () => void;
  onOpenConversation?: (conversationId: number) => void;

  aboutToAppear(): void { this.load(); }
  aboutToDisappear(): void {
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
    try {
      const result = await this.api.mockPay(this.orderId, amount);
      if (result.orderId !== this.orderId) throw new Error('支付结果待确认');
      this.showPay = false;
      await this.load();
      this.notice = this.order?.status === 'PAID_PENDING_SHOOT' ? '支付成功' : '正在核对支付结果';
      this.paymentUncertain = this.order?.status === 'PENDING_PAYMENT';
    } catch (error) {
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

  @Builder
  private Detail(label: string, value: string) {
    Row({ space: 12 }) {
      Text(label).fontSize(13).fontColor(PortraTheme.secondaryText).width(72)
      Text(value).fontSize(14).fontColor(PortraTheme.primaryText).layoutWeight(1)
    }.width('100%')
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
      PortraPageHeading({ title: '订单详情', eyebrow: '', onBack: this.onBack })
      if (this.loading) {
        PortraLoading({ label: '正在打开订单' })
      } else if (this.order === null) {
        PortraErrorView({ message: this.errorMessage || '订单暂时无法查看', onRetry: () => this.load() })
      } else {
        Scroll() {
          Column({ space: 18 }) {
            Column({ space: 6 }) {
              Text(OrderWorkflow.status(this.order!.status)).fontSize(24).fontWeight(FontWeight.Bold)
                .fontColor(PortraTheme.primaryText)
              Text(OrderWorkflow.task(this.order!, this.userId)).fontSize(14).fontColor(PortraTheme.secondaryText)
            }.width('100%').alignItems(HorizontalAlign.Start)
            Divider().color(PortraTheme.border)
            Text('约拍信息').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
            this.Detail('拍摄时间', QuoteWorkflow.dateInput(this.order!.shootStartTime ?? ''))
            this.Detail('拍摄地点', this.order!.shootLocation ?? '待更新')
            this.Detail('约拍费用', OrderWorkflow.money(this.order!.amountCent))
            Divider().color(PortraTheme.border)
            Text('订单进度').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
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
            if (this.order!.conversationId !== undefined && this.order!.conversationId! > 0) {
              Button('返回会话').height(44).backgroundColor(PortraTheme.surface)
                .fontColor(PortraTheme.primary).onClick(() =>
                  this.onOpenConversation?.(this.order!.conversationId!))
            }
          }.width('100%').alignItems(HorizontalAlign.Start)
            .padding({ left: 20, right: 20, top: 20, bottom: 30 })
        }.layoutWeight(1).scrollBar(BarState.Off)
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
      }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
      if (this.showPay && this.order !== null) {
        Column() {
          Blank().layoutWeight(1)
          MockPaymentConfirm({ amountCent: this.order!.amountCent ?? 0, busy: this.busy,
            onCancel: () => this.showPay = false, onConfirm: () => this.pay() })
        }.width('100%').height('100%').backgroundColor('#66000000')
      }
    }.width('100%').height('100%')
  }
}
