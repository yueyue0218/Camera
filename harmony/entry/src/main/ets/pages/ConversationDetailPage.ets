import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { ConversationMemory } from '../features/conversation/ConversationMemory';
import { ConversationDraftStore } from '../features/conversation/ConversationDraftStore';
import { ConversationVisibility } from '../features/conversation/ConversationVisibility';
import { ConversationMessageState, SendStatus } from '../features/conversation/ConversationMessageState';
import { ConversationTimeline, ConversationTimelineItem, TimelineKind } from '../features/conversation/ConversationTimeline';
import { TextMessageBubble } from '../features/conversation/TextMessageBubble';
import { ConversationSummary, CreateQuotePayload, MessageSummary, QuoteSummary } from '../model/ApiModels';
import { ErrorKind, PortraError } from '../network/ErrorMapper';
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
  @State private uncertainResendId: number = 0;
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private contentVersion: number = 0;
  private refreshTimer: number = -1;
  private draftTimer: number = -1;
  private scrollTimer: number = -1;
  private visible: boolean = false;
  private readonly threadScroller: Scroller = new Scroller();
  onBack?: () => void;

  aboutToAppear(): void {
    this.busy = false;
    ConversationVisibility.subscribe(`detail:${this.conversationId}`,
      (visible: boolean) => this.setVisible(visible));
  }

  aboutToDisappear(): void {
    ConversationVisibility.unsubscribe(`detail:${this.conversationId}`);
    this.setVisible(false);
    this.saveDraft();
    this.requestVersion++;
    if (this.scrollTimer >= 0) clearTimeout(this.scrollTimer);
    this.appClient.apiService.cancelConversationDetail(this.conversationId);
    this.appClient.apiService.cancelCurrentSession();
    this.appClient.apiService.cancelConversations('conversations.detail.list');
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) {
      if (this.conversation === null || this.userId <= 0) this.initialize();
      else this.refreshContent();
      this.refreshTimer = setInterval(() => this.refreshContent(), 5000);
    } else {
      if (this.refreshTimer >= 0) clearInterval(this.refreshTimer);
      this.refreshTimer = -1;
      this.contentVersion++;
      this.appClient.apiService.cancelConversationDetail(this.conversationId);
    }
  }

  private changeDraft(value: string): void {
    this.draft = value;
    if (this.draftTimer >= 0) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.saveDraft(), 300);
  }

  private saveDraft(): void {
    if (this.draftTimer >= 0) clearTimeout(this.draftTimer);
    this.draftTimer = -1;
    if (this.userId > 0) ConversationDraftStore.write(this.userId, this.conversationId, this.draft);
  }

  private showMessages(messages: MessageSummary[], follow: boolean = false): void {
    const atEnd = follow || this.threadScroller.isAtEnd();
    this.messages = messages;
    if (atEnd) this.scrollToBottom();
  }

  private scrollToBottom(): void {
    if (this.scrollTimer >= 0) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      if (this.visible) this.threadScroller.scrollEdge(Edge.Bottom);
      this.scrollTimer = -1;
    }, 30);
  }

  private async initialize(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.errorMessage = '';
    try {
      const session = await this.appClient.apiService.currentSession();
      if (version !== this.requestVersion) return;
      const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
      this.userId = session.userId;
      this.draft = ConversationDraftStore.read(session.userId, this.conversationId);
      ConversationMemory.establishAccount(token, session.userId);
      const cached = ConversationMemory.read(token, session.userId).find(row =>
        row.conversation.conversationId === this.conversationId);
      if (cached !== undefined) {
        this.conversation = cached.conversation;
        this.showMessages(ConversationMemory.readMessages(token, session.userId, this.conversationId), true);
        this.loading = false;
      }
      const conversations = await this.appClient.apiService.listConversations('conversations.detail.list');
      if (!this.visible || version !== this.requestVersion) return;
      const match = conversations.find((item: ConversationSummary) => item.conversationId === this.conversationId);
      if (match === undefined) {
        throw new Error('会话不存在或无权查看');
      }
      const messages = await this.appClient.apiService.listMessages(this.conversationId);
      const quotes = await this.appClient.apiService.listQuotes(this.conversationId);
      if (version === this.requestVersion) {
        this.conversation = match;
        this.showMessages(ConversationMessageState.merge(this.messages, Array.isArray(messages) ? messages : []),
          cached === undefined);
        ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
        this.quotes = Array.isArray(quotes) ? quotes : [];
      }
    } catch (error) {
      if (version === this.requestVersion) {
        if (this.conversation !== null) {
          this.actionError = (error as PortraError).message || '暂时无法更新会话';
        } else {
          this.errorMessage = (error as PortraError).message || '会话加载失败';
        }
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  private async refreshContent(): Promise<void> {
    if (!this.visible || this.loading || this.busy || this.conversation === null) {
      return;
    }
    const version = this.requestVersion;
    const contentVersion = ++this.contentVersion;
    try {
      const messages = await this.appClient.apiService.listMessages(this.conversationId);
      const quotes = await this.appClient.apiService.listQuotes(this.conversationId);
      if (version === this.requestVersion && contentVersion === this.contentVersion && !this.busy) {
        this.showMessages(ConversationMessageState.merge(this.messages, Array.isArray(messages) ? messages : []));
        const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
        ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
        this.quotes = Array.isArray(quotes) ? quotes : this.quotes;
      }
    } catch {
      // Keep the last readable conversation during a temporary refresh failure.
    }
  }

  private async send(): Promise<void> {
    const content = this.draft.trim();
    if (this.busy || !content || this.userId <= 0) {
      return;
    }
    const pending = ConversationMessageState.pending(this.conversationId, this.userId, content);
    this.saveDraft();
    this.showMessages([...this.messages, pending], true);
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
    await this.sendPending(pending);
  }

  private async retryMessage(message: MessageSummary): Promise<void> {
    if (this.busy || message.messageId >= 0) return;
    if (message.deliveryStatus === SendStatus.UNCERTAIN && this.uncertainResendId !== message.messageId) {
      try {
        const remote = await this.appClient.apiService.listMessages(this.conversationId);
        this.showMessages(ConversationMessageState.merge(this.messages, remote));
        const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
        ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
        if (!this.messages.some(item => item.messageId === message.messageId)) return;
        this.uncertainResendId = message.messageId;
        this.actionError = '尚未查到发送结果。再次点击才会重发，可能产生重复消息。';
      } catch (error) {
        this.actionError = (error as PortraError).message || '暂时无法核对发送结果';
      }
      return;
    }
    this.uncertainResendId = 0;
    await this.sendPending(message);
  }

  private async sendPending(pending: MessageSummary): Promise<void> {
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    const version = this.requestVersion;
    this.busy = true;
    this.contentVersion++;
    this.actionError = '';
    this.showMessages(ConversationMessageState.status(this.messages, pending.messageId, SendStatus.SENDING), true);
    ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
    try {
      const sent = await this.appClient.apiService.sendMessage(this.conversationId, pending.content ?? '');
      if (!sent || !Number.isSafeInteger(sent.messageId) || sent.messageId <= 0) throw new Error('发送结果无法确认');
      const current = ConversationMemory.readMessages(token, this.userId, this.conversationId);
      const merged = ConversationMessageState.confirm(current, pending.messageId, sent);
      ConversationMemory.writeMessages(token, this.userId, this.conversationId, merged);
      ConversationMemory.noteMessage(token, this.userId, this.conversationId, sent);
      if (ConversationDraftStore.read(this.userId, this.conversationId).trim() === pending.content) {
        ConversationDraftStore.write(this.userId, this.conversationId, '');
      }
      if (version === this.requestVersion) {
        this.showMessages(merged, true);
        if (this.draft.trim() === pending.content) this.changeDraft('');
      }
    } catch (error) {
      const mapped = error as PortraError;
      const definite = mapped.kind === ErrorKind.CONFIG ||
        (mapped.kind === ErrorKind.HTTP && mapped.httpStatus >= 400 && mapped.httpStatus < 500) ||
        (mapped.kind === ErrorKind.BUSINESS && mapped.businessCode < 50000);
      const status = definite ? SendStatus.FAILED : SendStatus.UNCERTAIN;
      const current = ConversationMemory.readMessages(token, this.userId, this.conversationId);
      const next = ConversationMessageState.status(current, pending.messageId, status);
      ConversationMemory.writeMessages(token, this.userId, this.conversationId, next);
      if (version === this.requestVersion) {
        this.showMessages(next, true);
        this.actionError = definite ? '发送失败，内容已保留，可重试。' :
          '发送结果未确认。请先查询结果，避免重复发送。';
      }
    } finally {
      if (version === this.requestVersion) this.busy = false;
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

  @Builder
  private TimelineRow(item: ConversationTimelineItem) {
    Row({ space: 8 }) {
      if (item.senderId !== this.userId) {
        PortraAvatar({ displayName: '对方', avatarSize: 34 })
      } else {
        Blank().layoutWeight(1)
      }
      Column({ space: 4 }) {
        if (item.kind === TimelineKind.QUOTE && item.quote !== undefined) {
          this.QuoteItem(item.quote)
        } else if (item.message !== undefined) {
          if (item.message.messageType === 'TEXT') {
            TextMessageBubble({ text: item.message.content ?? '', mine: item.senderId === this.userId })
            if (item.message.deliveryStatus === SendStatus.SENDING) {
              Text('发送中').fontSize(10).fontColor(PortraTheme.mutedText)
            } else if (item.message.deliveryStatus === SendStatus.FAILED ||
              item.message.deliveryStatus === SendStatus.UNCERTAIN) {
              Button(item.message.deliveryStatus === SendStatus.UNCERTAIN ?
                this.uncertainResendId === item.message.messageId ? '确认再次发送' : '查询结果' : '重试')
                .fontSize(11).height(32)
                .onClick(() => this.retryMessage(item.message!))
            }
          } else {
            Text(item.message.messageType === 'IMAGE' ? '[图片]' : `[附件] ${item.message.fileName ?? ''}`)
              .fontSize(13).fontColor(PortraTheme.secondaryText)
              .padding(10).backgroundColor(PortraTheme.surface).borderRadius(8)
          }
        }
        if (item.createdAt.length >= 16) {
          Text(item.createdAt.replace('T', ' ').slice(5, 16))
            .fontSize(10).fontColor(PortraTheme.mutedText)
        }
      }
      .constraintSize({ maxWidth: '76%' })
      .alignItems(item.senderId === this.userId ? HorizontalAlign.End : HorizontalAlign.Start)
      if (item.senderId !== this.userId) {
        Blank().layoutWeight(1)
      } else {
        PortraAvatar({ displayName: '我', avatarSize: 34 })
      }
    }
    .width('100%')
    .alignItems(VerticalAlign.Top)
  }

  build() {
    Column() {
      PortraPageHeading({ title: '约拍会话', eyebrow: 'CONVERSATION', onBack: this.onBack })
      if (this.loading) {
        PortraLoading({ label: '正在加载会话' })
      } else if (this.errorMessage.length > 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.initialize() })
      } else {
        Scroll(this.threadScroller) {
          Column({ space: 12 }) {
            Row() {
              Text('消息').fontSize(17).fontWeight(FontWeight.Bold)
              Blank()
              Button('刷新').onClick(() => this.refreshContent())
            }
            .width('100%')
            if (this.messages.length === 0 && this.quotes.length === 0) {
              Text('从一句问候开始')
                .fontSize(13).fontColor(PortraTheme.secondaryText)
                .width('100%').textAlign(TextAlign.Center).padding(24)
            }
            ForEach(ConversationTimeline.build(this.messages, this.quotes), (item: ConversationTimelineItem) => {
              this.TimelineRow(item)
            }, (item: ConversationTimelineItem) => item.key)
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
            .onChange((value: string) => this.changeDraft(value))
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
