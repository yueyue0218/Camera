import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { QuoteDetailContent } from '../features/conversation/QuoteDetailContent';
import { QuoteWorkflow } from '../features/conversation/QuoteWorkflow';
import { OrderSummary, QuoteSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct QuoteDetailPage {
  @Prop conversationId: number = 0;
  @Prop quoteId: number = 0;
  @State private quote: QuoteSummary | null = null;
  @State private orderId: number = 0;
  @State private userId: number = 0;
  @State private loading: boolean = true;
  @State private busy: boolean = false;
  @State private errorMessage: string = '';
  @State private rejectReason: string = '';
  @State private showReject: boolean = false;
  @State private showConfirm: boolean = false;
  private readonly api = AppClient.shared.apiService;
  private requestVersion: number = 0;
  onBack?: () => void;
  onEdit?: () => void;
  onConfirmed?: () => void;
  onOpenOrder?: (orderId: number) => void;

  aboutToAppear(): void { this.load(); }
  aboutToDisappear(): void { this.requestVersion++; }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.errorMessage = '';
    try {
      const session = await this.api.currentSession();
      const quotes = await this.api.listQuotes(this.conversationId);
      if (version !== this.requestVersion) return;
      const quote = quotes.find((item: QuoteSummary) => item.quotationId === this.quoteId);
      if (quote === undefined) throw new Error('报价不存在');
      this.userId = session.userId;
      this.quote = quote;
      if (quote.status === 'CONFIRMED') {
        const orders = await this.api.listOrders();
        if (version === this.requestVersion) {
          this.orderId = orders.find((order: OrderSummary) => order.quoteId === this.quoteId)?.orderId ?? 0;
        }
      }
    } catch (error) {
      if (version === this.requestVersion) this.errorMessage = (error as PortraError).message || '报价暂时无法查看';
    } finally {
      if (version === this.requestVersion) this.loading = false;
    }
  }

  private async confirm(): Promise<void> {
    if (this.busy || this.quote === null) return;
    this.busy = true;
    this.showConfirm = false;
    this.errorMessage = '';
    try {
      const result = await this.api.confirmQuote(this.quoteId);
      if (result.orderId > 0) {
        this.orderId = result.orderId;
        this.onConfirmed?.();
      } else {
        await this.load();
      }
    } catch (error) {
      await this.load();
      this.errorMessage = (error as PortraError).message || '暂时无法确认报价';
    } finally { this.busy = false; }
  }

  private async reject(): Promise<void> {
    if (this.busy || this.quote === null) return;
    this.busy = true;
    this.errorMessage = '';
    try {
      await this.api.rejectQuote(this.quoteId, this.rejectReason.trim());
      this.showReject = false;
      await this.load();
    } catch (error) {
      await this.load();
      this.errorMessage = (error as PortraError).message || '暂时无法拒绝报价';
    } finally { this.busy = false; }
  }

  build() {
    Column() {
      PortraPageHeading({ title: '报价详情', eyebrow: '', onBack: this.onBack })
      if (this.loading) {
        PortraLoading({ label: '正在打开报价' })
      } else if (this.quote === null) {
        PortraErrorView({ message: this.errorMessage || '报价暂时无法查看', onRetry: () => this.load() })
      } else {
        Scroll() {
          QuoteDetailContent({ quote: this.quote! })
            .padding({ left: 20, right: 20, top: 20, bottom: 30 })
        }.layoutWeight(1).scrollBar(BarState.Off)
        if (this.errorMessage) Text(this.errorMessage).fontColor(PortraTheme.danger).fontSize(12)
          .padding({ left: 20, right: 20 })
        if (this.showReject) {
          TextInput({ text: this.rejectReason, placeholder: '告诉摄影师你的想法（选填）' })
            .onChange((value: string) => this.rejectReason = value)
            .height(48).margin({ left: 20, right: 20 })
          Row({ space: 12 }) {
            Button('返回').onClick(() => this.showReject = false)
            Button(this.busy ? '提交中' : '确认拒绝').enabled(!this.busy).onClick(() => this.reject())
          }.padding(20)
        } else if (this.showConfirm) {
          Text('已查看拍摄与交付约定？').fontSize(14).fontColor(PortraTheme.primaryText)
            .padding({ left: 20, right: 20 })
          Row({ space: 12 }) {
            Button('再看看').onClick(() => this.showConfirm = false)
            Button(this.busy ? '确认中' : '确认报价').enabled(!this.busy).onClick(() => this.confirm())
          }.padding(20)
        } else if (QuoteWorkflow.canDecide(this.quote!, this.userId)) {
          Row({ space: 12 }) {
            Button('拒绝报价').backgroundColor(PortraTheme.pageBackgroundDeep)
              .fontColor(PortraTheme.primaryText).enabled(!this.busy).onClick(() => this.showReject = true)
            Button('确认报价').enabled(!this.busy).onClick(() => this.showConfirm = true)
          }.padding(20)
        } else if (QuoteWorkflow.canEdit(this.quote!, this.userId)) {
          Button('编辑报价').height(48).margin(20).onClick(() => this.onEdit?.())
        } else if (this.orderId > 0) {
          Button('查看订单').height(48).margin(20).onClick(() => this.onOpenOrder?.(this.orderId))
        }
      }
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }
}
