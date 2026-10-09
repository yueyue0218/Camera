import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { ConversationSummary, CreateQuotePayload, MessageSummary, QuoteSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct ConversationDetailPage {
  @Prop conversationId: number = 0;
  @State private loading: boolean = true;
  @State private busy: boolean = false;
  @State private errorMessage: string = '';
  @State private actionError: string = '';
  @State private conversation: ConversationSummary | null = null;
  @State private userId: number = 0;
  @State private messages: MessageSummary[] = [];
  @State private quotes: QuoteSummary[] = [];
  @State private draft: string = '';
  @State private showQuoteForm: boolean = false;
  @State private quoteAmount: string = '';
  @State private quoteStart: string = '';
  @State private quoteEnd: string = '';
  @State private quoteDelivery: string = '';
  @State private quoteLocation: string = '';
  @State private quoteService: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private contentVersion: number = 0;
  private refreshTimer: number = -1;
  onBack?: () => void;

  aboutToAppear(): void {
    this.initialize();
    this.refreshTimer = setInterval(() => this.refreshContent(), 5000);
  }

  aboutToDisappear(): void {
    this.requestVersion++;
    if (this.refreshTimer >= 0) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = -1;
    }
    this.appClient.apiService.cancelConversationDetail(this.conversationId);
    this.appClient.apiService.cancelCurrentSession();
    this.appClient.apiService.cancelConversations('conversations.detail.list');
  }

  private async initialize(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.errorMessage = '';
    try {
      const session = await this.appClient.apiService.currentSession();
      const conversations = await this.appClient.apiService.listConversations('conversations.detail.list');
      const match = conversations.find((item: ConversationSummary) => item.conversationId === this.conversationId);
      if (match === undefined) {
        throw new Error('会话不存在或无权查看');
      }
      const messages = await this.appClient.apiService.listMessages(this.conversationId);
      const quotes = await this.appClient.apiService.listQuotes(this.conversationId);
      if (version === this.requestVersion) {
        this.userId = session.userId;
        this.conversation = match;
        this.messages = Array.isArray(messages) ? messages : [];
        this.quotes = Array.isArray(quotes) ? quotes : [];
      }
    } catch (error) {
      if (version === this.requestVersion) {
        this.errorMessage = (error as PortraError).message || '会话加载失败';
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  private async refreshContent(): Promise<void> {
    if (this.loading || this.busy || this.conversation === null) {
      return;
    }
    const version = this.requestVersion;
    const contentVersion = ++this.contentVersion;
    try {
      const messages = await this.appClient.apiService.listMessages(this.conversationId);
      const quotes = await this.appClient.apiService.listQuotes(this.conversationId);
      if (version === this.requestVersion && contentVersion === this.contentVersion && !this.busy) {
        this.messages = Array.isArray(messages) ? messages : this.messages;
        this.quotes = Array.isArray(quotes) ? quotes : this.quotes;
      }
    } catch {
      // Keep the last readable conversation during a temporary refresh failure.
    }
  }

  private async send(): Promise<void> {
    const content = this.draft.trim();
    if (this.busy || !content) {
      return;
    }
    this.busy = true;
    this.contentVersion++;
    this.actionError = '';
    try {
      const sent = await this.appClient.apiService.sendMessage(this.conversationId, content);
      this.messages = [...this.messages, sent];
      this.draft = '';
    } catch (error) {
      this.actionError = (error as PortraError).message || '发送失败，内容已保留';
    } finally {
      this.busy = false;
    }
  }

  private normalizedDateTime(value: string): string | undefined {
    const input = value.trim().replace(' ', 'T');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input) || Number.isNaN(Date.parse(input))) {
      return undefined;
    }
    return `${input}:00`;
  }

  private async createQuote(): Promise<void> {
    if (this.busy) {
      return;
    }
    const start = this.normalizedDateTime(this.quoteStart);
    const end = this.normalizedDateTime(this.quoteEnd);
    const delivery = this.normalizedDateTime(this.quoteDelivery);
    const amount = Number(this.quoteAmount.trim());
    const amountCent = Math.round(amount * 100);
    if (!start || !end || !delivery || Date.parse(start) >= Date.parse(end) ||
      Date.parse(end) >= Date.parse(delivery) || !this.quoteLocation.trim() || !this.quoteService.trim() ||
      !this.quoteAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountCent)) {
      this.actionError = '请检查金额、时间、地点和拍摄内容';
      return;
    }
    const payload: CreateQuotePayload = {
      conversationId: this.conversationId, amountCent: amountCent,
      shootStartTime: start, shootEndTime: end, deliveryDeadline: delivery,
      location: this.quoteLocation.trim(), serviceContent: this.quoteService.trim()
    };
    this.busy = true;
    this.contentVersion++;
    this.actionError = '';
    try {
      const quote = await this.appClient.apiService.createQuote(payload);
      this.quotes = [quote, ...this.quotes];
      this.showQuoteForm = false;
    } catch (error) {
      this.actionError = (error as PortraError).message || '提交约定失败';
    } finally {
      this.busy = false;
    }
  }

  private async confirmQuote(quoteId: number): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.contentVersion++;
    this.actionError = '';
    try {
      await this.appClient.apiService.confirmQuote(quoteId);
      await this.refreshAfterAction();
    } catch (error) {
      this.actionError = (error as PortraError).message || '确认失败';
    } finally {
      this.busy = false;
    }
  }

  private async refreshAfterAction(): Promise<void> {
    const result = await this.appClient.apiService.listQuotes(this.conversationId);
    this.quotes = Array.isArray(result) ? result : this.quotes;
  }

  @Builder
  private QuoteForm() {
    Column({ space: 10 }) {
      Text('拍摄约定').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      TextInput({ text: this.quoteAmount, placeholder: '报价金额（元）' })
        .type(InputType.Number).onChange((value: string) => this.quoteAmount = value)
      TextInput({ text: this.quoteStart, placeholder: '开始：2026-10-12 14:00' })
        .onChange((value: string) => this.quoteStart = value)
      TextInput({ text: this.quoteEnd, placeholder: '结束：2026-10-12 16:00' })
        .onChange((value: string) => this.quoteEnd = value)
      TextInput({ text: this.quoteDelivery, placeholder: '交付：2026-10-19 18:00' })
        .onChange((value: string) => this.quoteDelivery = value)
      TextInput({ text: this.quoteLocation, placeholder: '拍摄地点' })
        .onChange((value: string) => this.quoteLocation = value)
      TextArea({ text: this.quoteService, placeholder: '拍摄内容及交付约定' })
        .height(80).onChange((value: string) => this.quoteService = value)
      Button(this.busy ? '提交中' : '发送约定供客户确认')
        .enabled(!this.busy).onClick(() => this.createQuote())
    }
    .width('100%').padding(14).backgroundColor(PortraTheme.surface).borderRadius(8)
  }

  @Builder
  private QuoteItem(item: QuoteSummary) {
    Column({ space: 8 }) {
      Text(item.status === 'CONFIRMED' ? '双方约定已确认' :
        item.status === 'PENDING_CONFIRM' ? '等待客户确认' : '约定已结束')
        .fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primary)
      Text(`¥${(item.amountCent / 100).toFixed(2)} · ${item.location}`)
        .fontSize(14).fontColor(PortraTheme.primaryText)
      Text(`${item.shootStartTime.replace('T', ' ').slice(0, 16)} - ${item.shootEndTime.replace('T', ' ').slice(11, 16)}`)
        .fontSize(12).fontColor(PortraTheme.secondaryText)
      Text(item.serviceContent).fontSize(13).fontColor(PortraTheme.secondaryText)
      if (item.status === 'PENDING_CONFIRM' && this.userId === item.customerId) {
        Button(this.busy ? '确认中' : '确认约拍约定')
          .enabled(!this.busy).onClick(() => this.confirmQuote(item.quotationId))
      }
    }
    .width('100%').alignItems(HorizontalAlign.Start)
    .padding(14).backgroundColor(PortraTheme.surface).borderRadius(8)
  }

  build() {
    Column() {
      PortraPageHeading({ title: '约拍会话', eyebrow: 'CONVERSATION', onBack: this.onBack })
      if (this.loading) {
        PortraLoading({ label: '正在加载会话' })
      } else if (this.errorMessage.length > 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.initialize() })
      } else {
        Scroll() {
          Column({ space: 12 }) {
            Row() {
              Text('消息').fontSize(17).fontWeight(FontWeight.Bold)
              Blank()
              Button('刷新').onClick(() => this.refreshContent())
            }
            .width('100%')
            ForEach(this.messages, (item: MessageSummary) => {
              Row() {
                if (item.senderId === this.userId) { Blank() }
                Text(item.messageType === 'TEXT' ? (item.content ?? '') :
                  item.messageType === 'IMAGE' ? '[图片]' : `[附件] ${item.fileName ?? ''}`)
                  .fontSize(14).fontColor(PortraTheme.primaryText)
                  .padding(10).backgroundColor(item.senderId === this.userId ?
                    PortraTheme.primarySoft : PortraTheme.surface).borderRadius(8)
                if (item.senderId !== this.userId) { Blank() }
              }
              .width('100%')
            }, (item: MessageSummary) => item.messageId.toString())
            Divider().color(PortraTheme.border)
            Text('约拍约定').fontSize(17).fontWeight(FontWeight.Bold).width('100%')
            ForEach(this.quotes, (item: QuoteSummary) => {
              this.QuoteItem(item)
            }, (item: QuoteSummary) => item.quotationId.toString())
            if (this.conversation?.participantBId === this.userId) {
              if (this.showQuoteForm) {
                this.QuoteForm()
              } else {
                Button('提出拍摄约定').onClick(() => this.showQuoteForm = true)
              }
            }
          }
          .width('100%').padding({ left: 16, right: 16, top: 16, bottom: 20 })
        }
        .layoutWeight(1)
        if (this.actionError.length > 0) {
          Text(this.actionError).fontSize(12).fontColor(PortraTheme.danger)
            .width('100%').padding({ left: 16, right: 16, bottom: 6 })
        }
        Row({ space: 8 }) {
          TextInput({ text: this.draft, placeholder: '发送消息' })
            .layoutWeight(1).height(46).backgroundColor(PortraTheme.pageBackground)
            .onChange((value: string) => this.draft = value)
          Button(this.busy ? '发送中' : '发送')
            .enabled(!this.busy && this.draft.trim().length > 0)
            .onClick(() => this.send())
        }
        .width('100%').padding({ left: 16, right: 16, top: 10, bottom: 16 })
        .backgroundColor(PortraTheme.surface)
      }
    }
    .width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }
}
