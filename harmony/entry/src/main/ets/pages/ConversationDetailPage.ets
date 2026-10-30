import { KeyboardAvoidMode } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { image } from '@kit.ImageKit';
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
import { ConversationTask, ConversationTaskModel } from '../features/conversation/ConversationTaskModel';
import { QuoteEventCard } from '../features/conversation/QuoteEventCard';
import { OrderEventCard } from '../features/conversation/OrderEventCard';
import { FulfillmentEventCard } from '../features/conversation/FulfillmentEventCard';
import { OrderWorkflow } from '../features/conversation/OrderWorkflow';
import { TextMessageBubble } from '../features/conversation/TextMessageBubble';
import { MessageMediaBubble } from '../features/conversation/MessageMediaBubble';
import { ConversationMedia, SelectedMessageFile } from '../features/conversation/ConversationMedia';
import { DeliveryTransfer } from '../features/delivery/DeliveryTransfer';
import { PhotoAuthorizationEventCard } from '../features/aftercare/PhotoAuthorizationEventCard';
import { AftercarePolicy } from '../features/aftercare/AftercarePolicy';
import { ConversationSummary, DeliverySummary, MessageSummary, OrderStatusLogSummary, OrderSummary,
  PhotoAuthorizationSummary, QuoteSummary } from '../model/ApiModels';
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
  @State private peerName: string = '聊天';
  @State private messages: MessageSummary[] = [];
  @State private quotes: QuoteSummary[] = [];
  @State private orders: OrderSummary[] = [];
  @State private orderLogs: OrderStatusLogSummary[] = [];
  @State private deliveries: DeliverySummary[] = [];
  @State private authorizations: PhotoAuthorizationSummary[] = [];
  @State private authorizationThumbnails: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private draft: string = '';
  @State private uncertainResendId: number = 0;
  @State private mediaMenuOpen: boolean = false;
  @State private attachmentDraft: SelectedMessageFile[] = [];
  @State private selectingAttachments: boolean = false;
  @State private selectedAttachmentUris: string[] = [];
  @State private mediaPicking: boolean = false;
  @State private mediaThumbs: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private mediaLarge: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private failedImageIds: number[] = [];
  @State private viewerFileId: number = 0;
  @State private viewerUri: string = '';
  @State private viewerZoom: number = 1;
  @State private downloadId: number = 0;
  @State private downloadProgress: number = 0;
  @State private mediaNotice: string = '';
  @State private unreadBelow: number = 0;
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private activeToken: string = '';
  private contentVersion: number = 0;
  private refreshTimer: number = -1;
  private draftTimer: number = -1;
  private scrollTimer: number = -1;
  private visible: boolean = false;
  private orderSignature: string = '';
  private lastAuthorizationRefresh: number = 0;
  private lastBusinessRefresh: number = 0;
  private refreshInFlight: boolean = false;
  private businessInFlight: boolean = false;
  private readonly threadScroller: Scroller = new Scroller();
  private readonly transfer = new DeliveryTransfer();
  private readonly mediaRequests: Set<string> = new Set<string>();
  private readonly mediaPhases: Map<number, string> = new Map<number, string>();
  private readonly requestedMedia: Set<number> = new Set<number>();
  private attachmentLongPressedAt: number = 0;
  private readonly identityChanged: () => void = () => {
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    if (this.visible && this.activeToken && token !== this.activeToken) {
      this.invalidateAccount();
      if (token) this.initialize();
      else this.errorMessage = '登录状态已失效，请重新登录';
    }
  };
  private previousKeyboardAvoidMode?: KeyboardAvoidMode;
  onBack?: () => void;
  onCreateQuote?: () => void;
  onOpenQuote?: (quoteId: number) => void;
  onOpenOrder?: (orderId: number) => void;
  onPayOrder?: (orderId: number) => void;
  onOpenGallery?: (orderId: number) => void;
  onOpenUpload?: (orderId: number) => void;
  onOpenAuthorization?: (orderId: number, authorizationId: number) => void;
  onOpenReviews?: (orderId: number) => void;
  onBackHandler?: (handler: (() => boolean) | undefined) => void;

  aboutToAppear(): void {
    this.busy = false;
    this.onBackHandler?.(() => this.handleBack());
    this.appClient.fileImages.observe(this.identityChanged);
    ConversationVisibility.subscribe(`detail:${this.conversationId}`,
      (visible: boolean) => this.setVisible(visible));
  }

  aboutToDisappear(): void {
    this.onBackHandler?.(undefined);
    this.appClient.fileImages.unobserve(this.identityChanged);
    ConversationVisibility.unsubscribe(`detail:${this.conversationId}`);
    this.setVisible(false);
    this.saveDraft();
    this.requestVersion++;
    if (this.scrollTimer >= 0) clearTimeout(this.scrollTimer);
    this.appClient.apiService.cancelConversationDetail(this.conversationId);
    this.appClient.apiService.cancelCurrentSession();
    this.appClient.apiService.cancelConversations('conversations.detail.list');
    this.mediaRequests.forEach((key: string) => this.appClient.apiService.cancelMessageMedia(key));
    this.mediaRequests.clear();
    let retained = this.messages;
    this.messages.forEach((item: MessageSummary) => {
      if (item.messageId < 0 && item.messageType !== 'TEXT' && item.deliveryStatus === SendStatus.SENDING) {
        retained = ConversationMessageState.status(retained, item.messageId,
          this.mediaPhases.get(item.messageId) === 'post' ? SendStatus.UNCERTAIN : SendStatus.FAILED);
      }
    });
    this.messages = retained;
    ConversationMemory.writeMessages(this.activeToken, this.userId, this.conversationId, this.messages);
    this.transfer.cancel();
    this.releaseMedia();
    this.authorizations.forEach((authorization: PhotoAuthorizationSummary) =>
      authorization.files.slice(0, 3).forEach(file =>
        this.appClient.apiService.cancelDeliveryImage(file.fileId, 'thumbnail',
          `conversations.${this.conversationId}.authorization.${file.fileId}`)));
    this.orders.forEach((order: OrderSummary) => this.appClient.apiService.cancelEngagementRequests(
      [`conversations.${this.conversationId}.authorizations.${order.orderId}`]));
    this.authorizationThumbnails.forEach((bitmap: image.PixelMap) => bitmap.release());
    this.authorizationThumbnails = new Map<number, image.PixelMap>();
  }

  private handleBack(): boolean {
    if (this.viewerFileId > 0 || this.viewerUri) {
      this.viewerFileId = 0; this.viewerUri = ''; return true;
    }
    if (this.mediaMenuOpen) { this.mediaMenuOpen = false; return true; }
    if (this.attachmentDraft.length > 0) {
      this.attachmentDraft = []; this.selectingAttachments = false; this.selectedAttachmentUris = [];
      return true;
    }
    return false;
  }

  private releaseMedia(): void {
    this.requestedMedia.forEach((fileId: number) => {
      this.appClient.apiService.cancelMessageMedia(`conversations.${this.conversationId}.image.${fileId}.thumbnail`);
      this.appClient.apiService.cancelMessageMedia(`conversations.${this.conversationId}.image.${fileId}.medium`);
    });
    this.requestedMedia.clear();
    this.mediaThumbs.forEach((bitmap: image.PixelMap) => bitmap.release());
    this.mediaLarge.forEach((bitmap: image.PixelMap) => bitmap.release());
    this.mediaThumbs = new Map<number, image.PixelMap>();
    this.mediaLarge = new Map<number, image.PixelMap>();
    this.failedImageIds = [];
    this.viewerFileId = 0;
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) {
      this.lastAuthorizationRefresh = 0;
      this.previousKeyboardAvoidMode = this.getUIContext().getKeyboardAvoidMode();
      this.getUIContext().setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
      if (this.activeToken !== (this.appClient.sessionManager.getSession()?.accessToken ?? '')) {
        this.invalidateAccount();
      }
      if (this.conversation === null || this.userId <= 0) this.initialize();
      else this.refreshContent();
      this.refreshTimer = setInterval(() => this.refreshContent(), 3000);
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
    this.orderLogs = [];
    this.deliveries = [];
    this.authorizations = [];
    this.attachmentDraft = [];
    this.selectingAttachments = false;
    this.selectedAttachmentUris = [];
    this.mediaMenuOpen = false;
    this.releaseMedia();
    this.authorizationThumbnails.forEach((bitmap: image.PixelMap) => bitmap.release());
    this.authorizationThumbnails = new Map<number, image.PixelMap>();
    this.orderSignature = '';
    this.lastAuthorizationRefresh = 0;
    this.lastBusinessRefresh = 0;
    this.draft = '';
    this.peerName = '聊天';
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
    if (messages.length === this.messages.length && messages.every((item: MessageSummary, index: number) => {
      const previous = this.messages[index];
      return item.messageId === previous.messageId && item.deliveryStatus === previous.deliveryStatus &&
        item.fileId === previous.fileId && item.content === previous.content &&
        item.createdAt === previous.createdAt && item.localUri === previous.localUri &&
        item.fileName === previous.fileName && item.size === previous.size;
    })) return;
    if (!atEnd && messages.length > this.messages.length) this.unreadBelow += messages.length - this.messages.length;
    this.messages = messages;
    if (atEnd) { this.unreadBelow = 0; this.scrollToBottom(); }
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
        this.lastBusinessRefresh = Date.now();
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
    if (!this.visible || this.loading || this.busy || this.refreshInFlight || this.conversation === null) {
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
    this.refreshInFlight = true;
    try {
      const messages = await this.appClient.apiService.listMessages(this.conversationId);
      if (version === this.requestVersion && contentVersion === this.contentVersion && !this.busy) {
        this.showMessages(ConversationMessageState.merge(this.messages, Array.isArray(messages) ? messages : []));
        const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
        ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
        if (!this.businessInFlight && Date.now() - this.lastBusinessRefresh >= 9000) {
          this.lastBusinessRefresh = Date.now();
          this.refreshBusiness(version);
        }
      }
    } catch {
      // Keep the last readable conversation during a temporary refresh failure.
    } finally {
      this.refreshInFlight = false;
    }
  }

  private async refreshBusiness(version: number): Promise<void> {
    this.businessInFlight = true;
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    try {
      const quotes = await this.appClient.apiService.listQuotes(this.conversationId);
      if (this.visible && version === this.requestVersion &&
        token === (this.appClient.sessionManager.getSession()?.accessToken ?? '') && Array.isArray(quotes)) {
        this.quotes = quotes;
        this.refreshOrders(version);
      }
    } catch { /* Keep the last confirmed business cards. */ }
    finally { this.businessInFlight = false; }
  }

  private async refreshOrders(version: number): Promise<void> {
    try {
      const orders = await this.appClient.apiService.listOrders();
      if (this.visible && version === this.requestVersion && Array.isArray(orders)) {
        const current = OrderWorkflow.inConversation(orders, this.conversationId);
        const signature = current.map((order: OrderSummary) => `${order.orderId}:${order.status}`).join('|');
        this.orders = current;
        this.refreshAuthorizations(current, version);
        if (signature === this.orderSignature) return;
        const logs: OrderStatusLogSummary[] = [];
        const deliveries: DeliverySummary[] = [];
        let complete = true;
        for (const order of current) {
          try {
            const result = await Promise.all([this.appClient.apiService.getOrderStatusLogs(order.orderId),
              this.appClient.apiService.listDeliveries(order.orderId)]);
            if (Array.isArray(result[0])) logs.push(...result[0] as OrderStatusLogSummary[]);
            if (Array.isArray(result[1])) deliveries.push(...result[1] as DeliverySummary[]);
          } catch { complete = false; }
        }
        if (this.visible && version === this.requestVersion) {
          this.orderLogs = logs;
          this.deliveries = deliveries;
          if (complete) this.orderSignature = signature;
        }
      }
    } catch {
      // Messages and quotes remain usable while order updates are unavailable.
    }
  }

  private async refreshAuthorizations(orders: OrderSummary[], version: number): Promise<void> {
    const now = Date.now();
    if (now - this.lastAuthorizationRefresh < 12000) return;
    this.lastAuthorizationRefresh = now;
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    const completed = orders.filter((order: OrderSummary) => order.status === 'COMPLETED');
    if (completed.length === 0) {
      this.authorizations = [];
      return;
    }
    try {
      const lists = await Promise.all(completed.map((order: OrderSummary) =>
        this.appClient.apiService.listPhotoAuthorizations(order.orderId,
          `conversations.${this.conversationId}.authorizations.${order.orderId}`)));
      if (!this.visible || version !== this.requestVersion ||
        token !== (this.appClient.sessionManager.getSession()?.accessToken ?? '')) return;
      this.authorizations = lists.flat().filter((item: PhotoAuthorizationSummary) =>
        completed.some((order: OrderSummary) => order.orderId === item.orderId));
      AftercarePolicy.conversationAuthorizations(this.authorizations).forEach((item: PhotoAuthorizationSummary) =>
        item.files.slice(0, 3).forEach(file => this.loadAuthorizationThumbnail(file.fileId, version)));
    } catch {
      // An unavailable aftercare endpoint must not hide the existing message stream.
    }
  }

  private async loadAuthorizationThumbnail(fileId: number, version: number): Promise<void> {
    if (this.authorizationThumbnails.has(fileId)) return;
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    try {
      const bytes = await this.appClient.apiService.getDeliveryImage(fileId, 'thumbnail',
        `conversations.${this.conversationId}.authorization.${fileId}`);
      const source = image.createImageSource(bytes);
      let bitmap: image.PixelMap;
      try { bitmap = await source.createPixelMap({ desiredSize: { width: 96, height: 96 } }); }
      finally { await source.release(); }
      if (!this.visible || version !== this.requestVersion ||
        token !== (this.appClient.sessionManager.getSession()?.accessToken ?? '')) {
        await bitmap.release(); return;
      }
      const next = new Map<number, image.PixelMap>(this.authorizationThumbnails);
      next.set(fileId, bitmap);
      this.authorizationThumbnails = next;
    } catch { /* The request remains open even when a thumbnail is temporarily unavailable. */ }
  }

  private async pickMedia(kind: string): Promise<void> {
    if (this.mediaPicking || this.userId <= 0) return;
    this.mediaPicking = true;
    this.actionError = '';
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      const files = kind === 'photo' ? await ConversationMedia.photos() :
        kind === 'camera' ? await ConversationMedia.camera(context) : await ConversationMedia.document(context);
      if (!this.visible || files.length === 0) return;
      this.attachmentDraft = files;
      this.selectingAttachments = false;
      this.selectedAttachmentUris = [];
      this.mediaMenuOpen = false;
    } catch (error) {
      if (this.visible) this.actionError = kind === 'camera' ? '暂时无法拍照，请从相册选择照片' :
        (error as Error).message || '暂时无法选择文件';
    } finally { this.mediaPicking = false; }
  }

  private toggleAttachment(uri: string): void {
    this.selectedAttachmentUris = this.selectedAttachmentUris.includes(uri) ?
      this.selectedAttachmentUris.filter((item: string) => item !== uri) :
      [...this.selectedAttachmentUris, uri];
  }

  private longPressAttachment(uri: string): void {
    this.attachmentLongPressedAt = Date.now();
    this.selectingAttachments = true;
    if (!this.selectedAttachmentUris.includes(uri)) this.toggleAttachment(uri);
  }

  private async sendSelectedMedia(): Promise<void> {
    if (!this.visible || this.userId <= 0 || this.attachmentDraft.length === 0) return;
    const files = this.attachmentDraft.slice();
    const caption = this.draft.trim();
    const pending = files.map((file: SelectedMessageFile, index: number) =>
      ConversationMessageState.pendingAttachment(this.conversationId, this.userId,
        file.messageType, file.fileName, file.mimeType, file.size, file.uri, index === 0 ? caption : ''));
    this.attachmentDraft = [];
    this.selectingAttachments = false;
    this.selectedAttachmentUris = [];
    this.changeDraft('');
    this.showMessages([...this.messages, ...pending], true);
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < pending.length) {
        const index = cursor++;
        await this.sendPendingAttachment(pending[index]);
      }
    };
    await Promise.all([worker(), worker()]);
  }

  private mediaKey(tempId: number, phase: string): string {
    return `conversations.${this.conversationId}.media.${tempId}.${phase}`;
  }

  private mediaCurrent(token: string, version: number): boolean {
    return this.visible && version === this.requestVersion &&
      token === (this.appClient.sessionManager.getSession()?.accessToken ?? '');
  }

  private async sendPendingAttachment(pending: MessageSummary): Promise<void> {
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    const version = this.requestVersion;
    let fileId = pending.fileId ?? 0;
    let phase = 'upload';
    this.mediaPhases.set(pending.messageId, phase);
    this.showMessages(ConversationMessageState.status(this.messages, pending.messageId, SendStatus.SENDING));
    ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
    try {
      if (fileId === 0) {
        const file: SelectedMessageFile = { uri: pending.localUri ?? '', fileName: pending.fileName ?? '文件',
          mimeType: pending.mimeType ?? (pending.messageType === 'IMAGE' ? 'image/jpeg' : 'application/octet-stream'),
          size: pending.size ?? 0, messageType: pending.messageType };
        const data = await ConversationMedia.read(file);
        if (!this.mediaCurrent(token, version)) return;
        const uploadKey = this.mediaKey(pending.messageId, 'upload');
        this.mediaRequests.add(uploadKey);
        try { fileId = await this.appClient.apiService.uploadMessageAttachment(data, file.mimeType, file.fileName,
          uploadKey); }
        finally { this.mediaRequests.delete(uploadKey); }
        if (!this.mediaCurrent(token, version)) return;
        this.showMessages(ConversationMessageState.uploaded(this.messages, pending.messageId, fileId));
        ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
      }
      phase = 'post';
      this.mediaPhases.set(pending.messageId, phase);
      const postKey = this.mediaKey(pending.messageId, 'post');
      this.mediaRequests.add(postKey);
      let sent: MessageSummary;
      try { sent = await this.appClient.apiService.sendAttachment(this.conversationId, fileId,
        pending.content ?? '', postKey); }
      finally { this.mediaRequests.delete(postKey); }
      if (!this.mediaCurrent(token, version)) return;
      if (!sent || sent.conversationId !== this.conversationId || sent.senderId !== this.userId ||
        sent.fileId !== fileId || sent.messageId <= 0) throw new Error('发送结果暂时无法确认');
      this.showMessages(ConversationMessageState.confirm(this.messages, pending.messageId, sent));
      ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
      ConversationMemory.noteMessage(token, this.userId, this.conversationId, sent);
    } catch (error) {
      if (!this.mediaCurrent(token, version)) return;
      const failure = error as PortraError;
      const definite = failure.kind === ErrorKind.CONFIG ||
        (failure.kind === ErrorKind.HTTP && failure.httpStatus >= 400 && failure.httpStatus < 500) ||
        (failure.kind === ErrorKind.BUSINESS && failure.businessCode < 50000);
      const status = phase === 'upload' || definite ? SendStatus.FAILED : SendStatus.UNCERTAIN;
      this.showMessages(ConversationMessageState.status(this.messages, pending.messageId, status));
      ConversationMemory.writeMessages(token, this.userId, this.conversationId, this.messages);
      this.actionError = status === SendStatus.UNCERTAIN ? '发送结果待确认，请先查询后重试' :
        '发送失败，照片或文件已保留，可重试';
    } finally { this.mediaPhases.delete(pending.messageId); }
  }

  private async loadMessageImage(fileId: number, variant: 'thumbnail' | 'medium'): Promise<void> {
    if (fileId <= 0 || (variant === 'thumbnail' ? this.mediaThumbs : this.mediaLarge).has(fileId)) return;
    if (variant === 'thumbnail' && this.failedImageIds.includes(fileId)) return;
    if (variant === 'thumbnail' && this.requestedMedia.has(fileId)) return;
    this.requestedMedia.add(fileId);
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    const version = this.requestVersion;
    try {
      const bytes = await this.appClient.apiService.getMessageImage(fileId, variant,
        `conversations.${this.conversationId}.image.${fileId}.${variant}`);
      const source = image.createImageSource(bytes);
      let bitmap: image.PixelMap;
      try { bitmap = await source.createPixelMap(variant === 'thumbnail' ?
        { desiredSize: { width: 400, height: 400 } } : {}); }
      finally { await source.release(); }
      if (!this.mediaCurrent(token, version)) { await bitmap.release(); return; }
      const next = new Map<number, image.PixelMap>(variant === 'thumbnail' ? this.mediaThumbs : this.mediaLarge);
      next.set(fileId, bitmap);
      if (variant === 'thumbnail') this.mediaThumbs = next;
      else this.mediaLarge = next;
      if (this.failedImageIds.includes(fileId)) {
        this.failedImageIds = this.failedImageIds.filter((id: number) => id !== fileId);
      }
    } catch {
      if (this.mediaCurrent(token, version) && !this.failedImageIds.includes(fileId)) {
        this.failedImageIds = [...this.failedImageIds, fileId];
      }
    }
    finally { if (variant === 'thumbnail') this.requestedMedia.delete(fileId); }
  }

  private openMessageImage(message: MessageSummary): void {
    this.viewerFileId = message.fileId ?? 0;
    this.viewerUri = message.localUri ?? '';
    this.viewerZoom = 1;
    if (this.viewerFileId > 0) this.loadMessageImage(this.viewerFileId, 'medium');
  }

  private async saveMessageFile(message: MessageSummary): Promise<void> {
    if (!message.fileId || message.messageId < 0 || this.downloadId > 0) return;
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    this.downloadId = message.fileId;
    this.downloadProgress = 0;
    this.mediaNotice = '';
    try {
      const saved = await this.transfer.download(this.getUIContext().getHostContext() as common.UIAbilityContext,
        message.fileId, message.fileName || '文件', token,
        (percent: number) => this.downloadProgress = percent);
      this.actionError = '';
      if (saved) this.mediaNotice = '已保存文件';
    } catch (error) { this.actionError = (error as Error).message || '保存失败，请重试'; }
    finally { this.downloadId = 0; }
  }

  private currentTask(): ConversationTask | null {
    return ConversationTaskModel.current(this.orders, this.quotes, this.authorizations,
      this.deliveries, this.userId, this.conversation?.participantBId ?? 0);
  }

  private openTask(task: ConversationTask): void {
    switch (task.action) {
      case 'pay': this.onPayOrder?.(task.targetId); break;
      case 'upload': this.onOpenUpload?.(task.targetId); break;
      case 'gallery': this.onOpenGallery?.(task.targetId); break;
      case 'authorization': this.onOpenAuthorization?.(task.targetId, task.authorizationId ?? 0); break;
      case 'reviews': this.onOpenReviews?.(task.targetId); break;
      case 'quote': this.onOpenQuote?.(task.targetId); break;
      case 'createQuote': this.onCreateQuote?.(); break;
      default: this.onOpenOrder?.(task.targetId);
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
    if (message.messageType === 'TEXT') await this.sendPending(message);
    else await this.sendPendingAttachment(message);
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
    Column({ space: 6 }) {
      if (item.timeLabel) {
        Text(item.timeLabel).fontSize(11).fontColor(PortraTheme.mutedText)
          .width('100%').textAlign(TextAlign.Center).padding({ top: 8, bottom: 5 })
      }
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
            onPay: () => this.onPayOrder?.(item.order!.orderId),
            onOpenGallery: () => this.onOpenGallery?.(item.order!.orderId),
            onOpenUpload: () => this.onOpenUpload?.(item.order!.orderId) })
        } else if (item.kind === TimelineKind.FULFILLMENT && item.event !== undefined) {
          FulfillmentEventCard({ event: item.event,
            onOpen: () => item.event!.openGallery ? this.onOpenGallery?.(item.event!.orderId) :
              this.onOpenOrder?.(item.event!.orderId) })
        } else if (item.message !== undefined) {
          if (item.message.messageType === 'TEXT') {
            TextMessageBubble({ text: item.message.content ?? '', mine: item.senderId === this.userId })
          } else {
            MessageMediaBubble({ message: item.message,
              bitmap: this.mediaThumbs.get(item.message.fileId ?? 0) ?? null,
              imageFailed: this.failedImageIds.includes(item.message.fileId ?? 0),
              onOpen: () => this.openMessageImage(item.message!),
              onSave: () => this.saveMessageFile(item.message!) })
            if (item.message.content) {
              Text(item.message.content).fontSize(13).fontColor(PortraTheme.primaryText)
            }
          }
          if (item.message.deliveryStatus === SendStatus.SENDING) {
            Text('发送中').fontSize(10).fontColor(PortraTheme.mutedText)
          } else if (item.message.deliveryStatus === SendStatus.FAILED ||
            item.message.deliveryStatus === SendStatus.UNCERTAIN) {
            Button(item.message.deliveryStatus === SendStatus.UNCERTAIN ?
              this.uncertainResendId === item.message.messageId ? '确认再次发送' : '查询结果' : '重试')
              .fontSize(11).height(32)
              .onClick(() => this.retryMessage(item.message!))
          }
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
      .width('100%').alignItems(VerticalAlign.Top)
      .onAppear(() => {
        const message = item.message;
        if (message?.messageType === 'IMAGE' && message.fileId && message.messageId > 0 &&
          !this.failedImageIds.includes(message.fileId)) {
          this.loadMessageImage(message.fileId, 'thumbnail');
        }
      })
    }.width('100%')
  }

  build() {
    Stack() {
    Column() {
      PortraPageHeading({ title: this.peerName, eyebrow: '', onBack: () => {
        if (!this.handleBack()) this.onBack?.();
      } })
      if (this.loading) {
        PortraLoading({ label: '正在打开聊天' })
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
            ForEach(ConversationTimeline.build(this.messages, this.quotes, this.orders,
              this.orderLogs, this.deliveries), (item: ConversationTimelineItem) => {
              this.TimelineRow(item)
            }, (item: ConversationTimelineItem) => item.key)
            if (AftercarePolicy.conversationAuthorizations(this.authorizations).length > 0) {
              Text('约拍事项').fontSize(13).fontColor(PortraTheme.secondaryText).width('100%')
              ForEach(AftercarePolicy.conversationAuthorizations(this.authorizations),
                (item: PhotoAuthorizationSummary) => {
                PhotoAuthorizationEventCard({ authorization: item, actorId: this.userId,
                  thumbnails: this.authorizationThumbnails,
                  onOpen: () => this.onOpenAuthorization?.(item.orderId, item.id) })
              }, (item: PhotoAuthorizationSummary) => `authorization:${item.id}`)
            }
            ForEach(this.orders.filter((order: OrderSummary) => order.status === 'COMPLETED'),
              (order: OrderSummary) => {
                Button('查看本次评价').height(40).backgroundColor(PortraTheme.surface)
                  .fontColor(PortraTheme.primary).onClick(() => this.onOpenReviews?.(order.orderId))
              }, (order: OrderSummary) => `reviews:${order.orderId}`)
          }
          .width('100%').padding({ left: 16, right: 16, top: 16, bottom: 20 })
        }
        .layoutWeight(1)
        if (this.currentTask() !== null) {
          Row({ space: 10 }) {
            Text(this.currentTask()!.label).fontSize(12).fontColor(PortraTheme.primaryText)
              .layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            Button(this.currentTask()!.button).height(36).fontSize(12)
              .onClick(() => this.openTask(this.currentTask()!))
          }.width('100%').padding({ left: 16, right: 16, top: 8, bottom: 8 })
            .backgroundColor(PortraTheme.surface)
        }
        if (this.unreadBelow > 0) {
          Button(`${this.unreadBelow} 条新消息 ↓`).height(34)
            .backgroundColor(PortraTheme.primarySoft).fontColor(PortraTheme.primary)
            .onClick(() => { this.unreadBelow = 0; this.scrollToBottom(); })
        }
        if (this.actionError.length > 0) {
          Text(this.actionError).fontSize(12).fontColor(PortraTheme.danger)
            .width('100%').padding({ left: 16, right: 16, bottom: 6 })
        }
        if (this.downloadId > 0) {
          Text(`正在保存 ${this.downloadProgress}%`).fontSize(12).fontColor(PortraTheme.primary)
            .width('100%').padding({ left: 16, bottom: 6 })
        } else if (this.mediaNotice) {
          Text(this.mediaNotice).fontSize(12).fontColor(PortraTheme.success)
            .width('100%').padding({ left: 16, bottom: 6 })
        }
        if (this.attachmentDraft.length > 0) {
          Column({ space: 8 }) {
            Row() {
              Text(`准备发送 ${this.attachmentDraft.length} 个文件`)
                .fontSize(13).fontColor(PortraTheme.primaryText)
              Blank()
              if (this.selectingAttachments) {
                Button('取消选择').fontSize(11).height(30).onClick(() => {
                  this.selectingAttachments = false; this.selectedAttachmentUris = [];
                })
                Button(`移除 ${this.selectedAttachmentUris.length} 张`).fontSize(11).height(30)
                  .enabled(this.selectedAttachmentUris.length > 0).onClick(() => {
                    this.attachmentDraft = this.attachmentDraft.filter((file: SelectedMessageFile) =>
                      !this.selectedAttachmentUris.includes(file.uri));
                    this.selectedAttachmentUris = []; this.selectingAttachments = false;
                  })
              }
            }.width('100%')
            Scroll() {
              Row({ space: 10 }) {
                ForEach(this.attachmentDraft, (file: SelectedMessageFile) => {
                  Column({ space: 5 }) {
                    if (file.messageType === 'IMAGE') {
                      Stack({ alignContent: Alignment.TopEnd }) {
                        Image(file.uri).width(72).height(72).objectFit(ImageFit.Cover).borderRadius(5)
                        if (this.selectingAttachments) {
                          Text(this.selectedAttachmentUris.includes(file.uri) ? '✓' : '○')
                            .fontSize(17).fontColor(PortraTheme.white)
                            .backgroundColor('#66000000').margin(4)
                        }
                      }.width(72).height(72)
                    } else {
                      Text('文件').width(72).height(72).textAlign(TextAlign.Center)
                        .backgroundColor(PortraTheme.pageBackgroundDeep)
                    }
                    if (!this.selectingAttachments || file.messageType !== 'IMAGE') {
                      Button('移除').fontSize(11).height(28).onClick(() => this.attachmentDraft =
                        this.attachmentDraft.filter((item: SelectedMessageFile) => item.uri !== file.uri))
                    }
                  }.onClick(() => {
                    if (this.selectingAttachments && file.messageType === 'IMAGE' &&
                      Date.now() - this.attachmentLongPressedAt >= 500) this.toggleAttachment(file.uri);
                  }).gesture(LongPressGesture().onAction(() => {
                    if (file.messageType === 'IMAGE') this.longPressAttachment(file.uri);
                  }))
                }, (file: SelectedMessageFile) => file.uri)
              }
            }.scrollable(ScrollDirection.Horizontal).height(112)
            Row() {
              Button('取消').layoutWeight(1).height(40).backgroundColor(PortraTheme.pageBackgroundDeep)
                .fontColor(PortraTheme.primaryText).onClick(() => this.attachmentDraft = [])
              Button('发送').layoutWeight(1).height(40).onClick(() => this.sendSelectedMedia())
            }.width('100%')
          }.width('100%').padding(12).backgroundColor(PortraTheme.surface)
        }
        if (this.mediaMenuOpen) {
          Column({ space: 12 }) {
            Text('发送内容').fontSize(12).fontColor(PortraTheme.secondaryText).width('100%')
            Row({ space: 10 }) {
              Button('照片').layoutWeight(1).height(48).onClick(() => this.pickMedia('photo'))
              Button('拍照').layoutWeight(1).height(48).onClick(() => this.pickMedia('camera'))
              Button('文件').layoutWeight(1).height(48).onClick(() => this.pickMedia('file'))
            }.width('100%')
            if (this.orders.length > 0) {
              Divider().color(PortraTheme.border)
              Button('订单详情  ›').width('100%').height(42)
                .backgroundColor(PortraTheme.pageBackgroundDeep).fontColor(PortraTheme.primaryText)
                .onClick(() => { this.mediaMenuOpen = false;
                  this.onOpenOrder?.(this.orders.slice().sort((a: OrderSummary, b: OrderSummary) =>
                    b.orderId - a.orderId)[0].orderId); })
            }
            Button('取消').height(38).backgroundColor(PortraTheme.surface)
              .fontColor(PortraTheme.secondaryText).onClick(() => this.mediaMenuOpen = false)
          }.width('100%').padding(16).backgroundColor(PortraTheme.surface)
        }
        Row({ space: 8 }) {
          Button('+').width(42).height(42).fontSize(26).fontColor(PortraTheme.primary)
            .backgroundColor(PortraTheme.surface).border({ width: 1, color: PortraTheme.border })
            .borderRadius(21).onClick(() => this.mediaMenuOpen = !this.mediaMenuOpen)
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
    if (this.viewerFileId > 0 || this.viewerUri.length > 0) {
      Column() {
        Row() {
          Button('返回').onClick(() => { this.viewerFileId = 0; this.viewerUri = ''; })
          Blank()
        }.width('100%').padding(16)
        if (this.mediaLarge.has(this.viewerFileId) || this.mediaThumbs.has(this.viewerFileId)) {
          Image(this.mediaLarge.get(this.viewerFileId) ?? this.mediaThumbs.get(this.viewerFileId)!)
            .width('100%').layoutWeight(1).objectFit(ImageFit.Contain)
            .scale({ x: this.viewerZoom, y: this.viewerZoom })
            .gesture(PinchGesture().onActionUpdate((event: GestureEvent) => {
              this.viewerZoom = Math.max(1, Math.min(4, event.scale));
            }))
        } else if (this.viewerUri) {
          Image(this.viewerUri).width('100%').layoutWeight(1).objectFit(ImageFit.Contain)
            .scale({ x: this.viewerZoom, y: this.viewerZoom })
            .gesture(PinchGesture().onActionUpdate((event: GestureEvent) => {
              this.viewerZoom = Math.max(1, Math.min(4, event.scale));
            }))
        } else if (this.failedImageIds.includes(this.viewerFileId)) {
          Column({ space: 12 }) {
            Text('照片暂时无法显示').fontColor(PortraTheme.white)
            Button('重试').onClick(() => {
              const id = this.viewerFileId;
              this.failedImageIds = this.failedImageIds.filter((value: number) => value !== id);
              this.loadMessageImage(id, 'medium');
            })
          }.layoutWeight(1).justifyContent(FlexAlign.Center)
        } else {
          Text('正在打开照片').fontColor(PortraTheme.white).layoutWeight(1)
        }
      }.width('100%').height('100%').backgroundColor('#151515')
    }
    }.width('100%').height('100%')
  }
}
