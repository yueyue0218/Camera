import { KeyboardAvoidMode } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { ConversationMemory } from '../features/conversation/ConversationMemory';
import { ConversationDraftStore } from '../features/conversation/ConversationDraftStore';
import { ConversationListModel } from '../features/conversation/ConversationListModel';
import { ConversationVisibility } from '../features/conversation/ConversationVisibility';
import { ConversationMessageState, SendStatus } from '../features/conversation/ConversationMessageState';
import { ConversationTextSender } from '../features/conversation/ConversationTextSender';
import { ConversationTimeline, ConversationTimelineItem, TimelineKind } from '../features/conversation/ConversationTimeline';
import { QuoteEventCard } from '../features/conversation/QuoteEventCard';
import { OrderEventCard } from '../features/conversation/OrderEventCard';
import { OrderWorkflow } from '../features/conversation/OrderWorkflow';
import { QuoteWorkflow } from '../features/conversation/QuoteWorkflow';
import { TextMessageBubble } from '../features/conversation/TextMessageBubble';
import { ConversationSummary, MessageSummary, OrderSummary, QuoteSummary } from '../model/ApiModels';
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
  @State private peerName: string = '约拍会话';
  @State private messages: MessageSummary[] = [];
  @State private quotes: QuoteSummary[] = [];
  @State private orders: OrderSummary[] = [];
  @State private draft: string = '';
  @State private uncertainResendId: number = 0;
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private activeToken: string = '';
  private contentVersion: number = 0;
  private refreshTimer: number = -1;
  private draftTimer: number = -1;
  private scrollTimer: number = -1;
  private visible: boolean = false;
  private readonly threadScroller: Scroller = new Scroller();
  private previousKeyboardAvoidMode?: KeyboardAvoidMode;
  onBack?: () => void;
  onCreateQuote?: () => void;
  onOpenQuote?: (quoteId: number) => void;
  onOpenOrder?: (orderId: number) => void;
  onPayOrder?: (orderId: number) => void;

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
      this.previousKeyboardAvoidMode = this.getUIContext().getKeyboardAvoidMode();
      this.getUIContext().setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
      if (this.activeToken !== (this.appClient.sessionManager.getSession()?.accessToken ?? '')) {
        this.invalidateAccount();
      }
      if (this.conversation === null || this.userId <= 0) this.initialize();
      else this.refreshContent();
      this.refreshTimer = setInterval(() => this.refreshContent(), 5000);
    } else {
      if (this.previousKeyboardAvoidMode !== undefined) {
        this.getUIContext().setKeyboardAvoidMode(this.previousKeyboardAvoidMode);
        this.previousKeyboardAvoidMode = undefined;
      }
      if (this.refreshTimer >= 0) clearInterval(this.refreshTimer);
      this.refreshTimer = -1;
      this.contentVersion++;
      this.appClient.apiService.cancelConversationDetail(this.conversationId);
      this.loading = false;
    }
  }

  private invalidateAccount(): void {
    this.saveDraft();
    this.requestVersion++;
    this.contentVersion++;
    this.activeToken = '';
    this.userId = 0;
    this.conversation = null;
    this.messages = [];
    this.quotes = [];
    this.orders = [];
    this.draft = '';
    this.peerName = '约拍会话';
    this.busy = false;
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
      if (!this.visible || version !== this.requestVersion) return;
      const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
      if (!token) throw new Error('请重新登录');
      this.activeToken = token;
      this.userId = session.userId;
      this.draft = ConversationDraftStore.read(session.userId, this.conversationId);
      ConversationMemory.establishAccount(token, session.userId);
      const cached = ConversationMemory.read(token, session.userId).find(row =>
        row.conversation.conversationId === this.conversationId);
      if (cached !== undefined) {
        this.conversation = cached.conversation;
        this.peerName = cached.peerName;
        this.showMessages(ConversationMemory.readMessages(token, session.userId, this.conversationId), true);
        this.loading = false;
      }
      const conversations = await this.appClient.apiService.listConversations('conversations.detail.list');
      if (!this.visible || version !== this.requestVersion) return;
      const match = conversations.find((item: ConversationSummary) => item.conversationId === this.conversationId);
      if (match === undefined) {
        throw new Error('会话不存在或无权查看');
      }
      if (cached === undefined || cached.peerName === 'Portra 用户') {
        const peerRole = match.otherUserId === match.participantBId ? 'PROVIDER' : 'CUSTOMER';
        this.appClient.apiService.getUserBrief(match.otherUserId, peerRole).then((brief) => {
          if (version === this.requestVersion && this.visible) {
            this.peerName = ConversationListModel.safeName(brief);
          }
        }).catch(() => {});
      }
      const messages = await this.appClient.apiService.listMessages(this.conversationId);
      const quotes = await this.appClient.apiService.listQuotes(this.conversationId);
      if (this.visible && version === this.requestVersion) {
        this.conversation = match;
        this.showMessages(ConversationMessageState.merge(this.messages, Array.isArray(messages) ? messages : []),
          cached === undefined);
        ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
        this.quotes = Array.isArray(quotes) ? quotes : [];
        this.refreshOrders(version);
      }
    } catch (error) {
      if (this.visible && version === this.requestVersion) {
        if (this.conversation !== null) {
          this.actionError = (error as PortraError).message || '暂时无法更新会话';
        } else {
          this.errorMessage = (error as PortraError).message || '会话加载失败';
        }
      }
    } finally {
      if (this.visible && version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  private async refreshContent(): Promise<void> {
    if (!this.visible || this.loading || this.busy || this.conversation === null) {
      return;
    }
    if (this.activeToken !== (this.appClient.sessionManager.getSession()?.accessToken ?? '')) {
      this.invalidateAccount();
      if (this.appClient.sessionManager.isAuthenticated()) this.initialize();
      else this.errorMessage = '登录状态已失效，请重新登录';
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
        this.refreshOrders(version);
      }
    } catch {
      // Keep the last readable conversation during a temporary refresh failure.
    }
  }

  private async refreshOrders(version: number): Promise<void> {
    try {
      const orders = await this.appClient.apiService.listOrders();
      if (this.visible && version === this.requestVersion && Array.isArray(orders)) {
        this.orders = OrderWorkflow.inConversation(orders, this.conversationId);
      }
    } catch {
      // Messages and quotes remain usable while order updates are unavailable.
    }
  }

  private async send(): Promise<void> {
    const content = this.draft.trim();
    if (this.busy || !content || this.userId <= 0) {
      return;
    }
    const retry = ConversationMessageState.retryForContent(this.messages, this.userId, content);
    if (retry !== undefined) {
      await this.retryMessage(retry);
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
      this.busy = true;
      const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
      const version = this.requestVersion;
      try {
        const remote = await this.appClient.apiService.listMessages(this.conversationId);
        if (version !== this.requestVersion || token !==
          (this.appClient.sessionManager.getSession()?.accessToken ?? '')) return;
        this.showMessages(ConversationMessageState.merge(this.messages, remote));
        ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
        if (!this.messages.some(item => item.messageId === message.messageId)) return;
        this.uncertainResendId = message.messageId;
        this.actionError = '尚未查到发送结果。再次点击才会重发，可能产生重复消息。';
      } catch (error) {
        if (version === this.requestVersion && token ===
          (this.appClient.sessionManager.getSession()?.accessToken ?? '')) {
          this.actionError = (error as PortraError).message || '暂时无法核对发送结果';
        }
      } finally {
        this.busy = false;
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
      const outcome = await ConversationTextSender.send((id: number, content: string) =>
        this.appClient.apiService.sendMessage(id, content), token,
        this.userId, this.conversationId, pending);
      if (token !== (this.appClient.sessionManager.getSession()?.accessToken ?? '')) {
        this.invalidateAccount();
        if (this.appClient.sessionManager.isAuthenticated()) this.initialize();
        else this.errorMessage = '登录状态已失效，请重新登录';
        return;
      }
      if (outcome.sent !== undefined &&
        ConversationDraftStore.read(this.userId, this.conversationId).trim() === pending.content) {
          ConversationDraftStore.write(this.userId, this.conversationId, '');
      }
      if (version === this.requestVersion) {
        this.showMessages(outcome.messages, true);
        if (outcome.sent !== undefined && this.draft.trim() === pending.content) this.changeDraft('');
        if (outcome.errorText !== undefined) this.actionError = outcome.errorText;
      }
    } finally {
      if (version === this.requestVersion) this.busy = false;
    }
  }

  @Builder
  private TimelineRow(item: ConversationTimelineItem) {
    Row({ space: 8 }) {
      if (item.senderId !== this.userId) {
        PortraAvatar({ displayName: this.peerName, avatarSize: 34 })
      } else {
        Blank().layoutWeight(1)
      }
      Column({ space: 4 }) {
        if (item.kind === TimelineKind.QUOTE && item.quote !== undefined) {
          QuoteEventCard({ quote: item.quote, onOpen: () => this.onOpenQuote?.(item.quote!.quotationId) })
        } else if (item.kind === TimelineKind.ORDER && item.order !== undefined) {
          OrderEventCard({ order: item.order, userId: this.userId,
            onOpen: () => this.onOpenOrder?.(item.order!.orderId),
            onPay: () => this.onPayOrder?.(item.order!.orderId) })
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
      PortraPageHeading({ title: this.peerName, eyebrow: 'CONVERSATION', onBack: this.onBack })
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
            if (this.messages.length === 0 && this.quotes.length === 0 && this.orders.length === 0) {
              Text('从一句问候开始')
                .fontSize(13).fontColor(PortraTheme.secondaryText)
                .width('100%').textAlign(TextAlign.Center).padding(24)
            }
            ForEach(ConversationTimeline.build(this.messages, this.quotes, this.orders), (item: ConversationTimelineItem) => {
              this.TimelineRow(item)
            }, (item: ConversationTimelineItem) => item.key)
            if (this.conversation?.participantBId === this.userId) {
              if (QuoteWorkflow.active(this.quotes) === undefined) {
                Button('发送报价').onClick(() => this.onCreateQuote?.())
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
            .maxLength(4000).enterKeyType(EnterKeyType.Send)
            .onChange((value: string) => this.changeDraft(value))
            .onSubmit(() => this.send())
          Button(this.busy ? '发送中' : '发送')
            .width(76).height(46).borderRadius(8)
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
