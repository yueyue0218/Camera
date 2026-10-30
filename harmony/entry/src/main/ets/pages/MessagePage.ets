import { NotificationTarget } from '../features/notifications/NotificationTargetResolver';
import { NotificationPage } from './NotificationPage';
import { image } from '@kit.ImageKit';
import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { ConversationListItem, ConversationListModel } from '../features/conversation/ConversationListModel';
import { ConversationMemory } from '../features/conversation/ConversationMemory';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { ConversationSummary, UserBrief } from '../model/ApiModels';
import { ErrorKind, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct MessagePage {
  @Prop @Watch('refreshTab') activeTab: boolean = true;
  @Prop @Watch('reloadWhenActive') sessionEpoch: number = 0;
  private loadedSessionVersion: number = -1;

  private reloadWhenActive(): void {
    if (this.visible) this.load();
    else this.loadedSessionVersion = -1;
  }

  private refreshTab(): void {
    this.syncVisibility();
    if (this.visible && this.loadedSessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
      this.load();
    }
  }

  @State private requiresLogin: boolean = false;
  @State private selectedTab: number = 0;
  @State private loading: boolean = true;
  @State private errorMessage: string = '';
  @State private conversations: ConversationListItem[] = [];
  @State private avatarImages: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  @State private hidingConversationId: number = 0;
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private remoteVersion: number = 0;
  private remoteInFlight: boolean = false;
  private readonly briefRefreshedIds: Set<number> = new Set<number>();
  private accountId: number = 0;
  private activeToken: string = '';
  private refreshTimer: number = -1;
  private readonly listScroller: Scroller = new Scroller();
  private visible: boolean = false;
  private rootVisible: boolean = false;
  private lifecycle?: MomentFeedLifecycle;
  private restoreTimer: number = -1;
  private avatarToken: string = '';
  private avatarAccountId: number = 0;
  private avatarRequests: Set<number> = new Set<number>();
  private failedAvatars: Set<number> = new Set<number>();
  private avatarQueue: number[] = [];
  private avatarWorkers: number = 0;
  private avatarGeneration: number = 0;
  onBack?: () => void;
  onOpenMoment?: (id: number) => void;
  onOpenCredit?: () => void;
  onOpenOrders?: () => void;
  onOpenTarget?: (target: NotificationTarget) => void;
  onRequireLogin?: () => void;
  onOpenConversation?: (conversationId: number) => void;

  aboutToAppear(): void {
    try {
      this.lifecycle = new MomentFeedLifecycle(this.getUIContext(),
        (update?: uiObserver.NavDestinationInfo) => this.routeVisible(update),
        (visible: boolean) => { this.rootVisible = visible; this.syncVisibility(); },
        () => {
          this.rootVisible = false;
          this.setVisible(false);
          this.loading = false;
          this.errorMessage = '消息暂时无法打开，请重试';
        });
      this.lifecycle.start();
    } catch {
      this.rootVisible = false;
      this.setVisible(false);
      this.loading = false;
      this.errorMessage = '消息暂时无法打开，请重试';
    }
  }

  aboutToDisappear(): void {
    this.lifecycle?.stop();
    this.lifecycle = undefined;
    this.rootVisible = false;
    this.setVisible(false);
    this.requestVersion++;
    this.remoteVersion++;
    if (this.restoreTimer >= 0) clearTimeout(this.restoreTimer);
    this.appClient.apiService.cancelConversations();
    this.appClient.apiService.cancelCurrentSession();
    this.resetAvatars('', 0);
    if (this.hidingConversationId > 0) {
      this.appClient.apiService.cancelHideConversation(this.hidingConversationId);
    }
  }

  private routeVisible(update?: uiObserver.NavDestinationInfo): boolean {
    const navigation = this.queryNavigationInfo();
    if (navigation === undefined) throw new Error('Navigation unavailable');
    let destination = this.queryNavDestinationInfo();
    if (destination === undefined) return navigation.pathStack.size() === 0;
    if (update?.navDestinationId === destination.navDestinationId) destination = update;
    return destination.index === navigation.pathStack.size() - 1 &&
      destination.state !== uiObserver.NavDestinationState.ON_HIDDEN &&
      destination.state !== uiObserver.NavDestinationState.ON_WILL_HIDE &&
      destination.state !== uiObserver.NavDestinationState.ON_DISAPPEAR &&
      destination.state !== uiObserver.NavDestinationState.ON_WILL_DISAPPEAR;
  }

  private syncVisibility(): void {
    this.setVisible(this.rootVisible && this.activeTab && this.selectedTab === 0);
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) {
      const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
      if (this.loadedSessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        this.load();
      } else if (this.accountId > 0 && token === this.activeToken) {
        this.conversations = ConversationMemory.read(token, this.accountId);
        this.resetAvatars(token, this.accountId);
        this.refresh();
      }
      else this.load();
      this.refreshTimer = setInterval(() => this.refresh(), 15000);
      this.restoreScroll();
      this.primeAvatars(this.conversations);
    } else {
      if (this.refreshTimer >= 0) clearInterval(this.refreshTimer);
      this.refreshTimer = -1;
      this.remoteVersion++;
      this.remoteInFlight = false;
      this.appClient.apiService.cancelConversations();
      this.avatarQueue = [];
      this.avatarRequests.forEach((fileId: number) => this.appClient.apiService.cancelAvatarThumbnail(fileId));
    }
  }

  private restoreScroll(): void {
    if (this.restoreTimer >= 0) clearTimeout(this.restoreTimer);
    this.restoreTimer = setTimeout(() => {
      const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
      const offset = ConversationMemory.readListOffset(token, this.accountId);
      if (this.visible && offset > 0) this.listScroller.scrollTo({ xOffset: 0, yOffset: offset });
      this.restoreTimer = -1;
    }, 100);
  }

  private async load(): Promise<void> {
    this.remoteVersion++;
    this.remoteInFlight = false;
    this.appClient.apiService.cancelConversations();
    this.loadedSessionVersion = this.appClient.sessionManager.getSessionVersion();
    const sessionVersion = this.loadedSessionVersion;
    const version = ++this.requestVersion;
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    if (token !== this.activeToken) {
      this.accountId = 0;
      this.conversations = [];
      this.resetAvatars('', 0);
    }
    this.activeToken = token;
    this.conversations = ConversationMemory.read(token, this.accountId);
    this.loading = this.conversations.length === 0;
    this.errorMessage = '';
    this.requiresLogin = !this.appClient.sessionManager.isAuthenticated();
    if (this.requiresLogin) { this.loading = false; return; }
    try {
      const session = await this.appClient.apiService.currentSession();
      if (!this.visible || version !== this.requestVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) return;
      this.accountId = session.userId;
      this.resetAvatars(token, session.userId);
      this.conversations = ConversationMemory.read(token, session.userId);
      this.loading = this.conversations.length === 0;
      this.restoreScroll();
      this.primeAvatars(this.conversations);
      await this.loadRemote(version, token);
    } catch (error) {
      if (version === this.requestVersion) {
        const failure = error as PortraError;
        this.requiresLogin = !this.appClient.sessionManager.isAuthenticated() ||
          failure.httpStatus === 401 || failure.businessCode === 40101;
        if (!this.appClient.sessionManager.isAuthenticated() || failure.httpStatus === 403 ||
          failure.businessCode === 40301) {
          this.conversations = [];
          this.accountId = 0;
          this.resetAvatars('', 0);
        }
        this.errorMessage = this.conversations.length ? '' : failure.message || '消息加载失败';
      }
    } finally {
      if (version === this.requestVersion && sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
        this.loading = false;
      }
    }
  }

  private async refresh(): Promise<void> {
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    if (!token || !this.appClient.sessionManager.isAuthenticated()) {
      this.accountId = 0;
      this.activeToken = '';
      this.conversations = [];
      this.resetAvatars('', 0);
      this.errorMessage = '登录状态已失效，请重新登录';
      return;
    }
    if (token !== this.activeToken || this.accountId <= 0) {
      this.load();
      return;
    }
    if (this.remoteInFlight) return;
    try {
      await this.loadRemote(this.requestVersion, token);
    } catch {
      if (!this.appClient.sessionManager.isAuthenticated()) {
        this.accountId = 0;
        this.activeToken = '';
        this.conversations = [];
        this.resetAvatars('', 0);
        this.errorMessage = '登录状态已失效，请重新登录';
      }
    }
  }

  private async loadRemote(version: number, token: string): Promise<void> {
    if (this.remoteInFlight) return;
    this.remoteInFlight = true;
    const remoteVersion = ++this.remoteVersion;
    try {
    const result = await this.appClient.apiService.listConversations();
    if (!Array.isArray(result)) throw new Error('会话数据格式异常');
    const current = ConversationMemory.read(token, this.accountId);
    const cached = new Map<number, ConversationListItem>();
    current.forEach((row: ConversationListItem) => cached.set(row.conversation.conversationId, row));
    const summaries = result.filter((item: ConversationSummary) =>
      ConversationListModel.validSummary(item, this.accountId));
    const rows: ConversationListItem[] = [];
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < summaries.length) {
        const item = summaries[cursor++];
        const old = cached.get(item.conversationId);
        const needsBrief = !this.briefRefreshedIds.has(item.otherUserId);
        let brief: UserBrief | null = null;
        if (needsBrief) {
          const peerRole = item.otherUserId === item.participantBId ? 'PROVIDER' : 'CUSTOMER';
          brief = await this.appClient.apiService.getUserBrief(item.otherUserId, peerRole,
            `conversations.list.brief.${item.conversationId}`).catch(() => null);
          if (brief !== null && token === this.appClient.sessionManager.getSession()?.accessToken &&
            this.accountId > 0) this.briefRefreshedIds.add(item.otherUserId);
        }
        if (old && old.conversation.lastMessageTime === item.lastMessageTime) {
          rows.push({ conversation: item,
            peerName: brief ? ConversationListModel.safeName(brief) : old.peerName,
            avatarFileId: brief ? brief.avatarFileId : old.avatarFileId,
            preview: old.preview, previewTime: old.previewTime });
          continue;
        }
        try {
          const messages = await this.appClient.apiService.listMessages(item.conversationId,
            `conversations.list.preview.${item.conversationId}`);
          const row = ConversationListModel.row(item, brief, messages);
          if (row !== null) rows.push(old ? {
            conversation: row.conversation, peerName: brief ? row.peerName : old.peerName,
            avatarFileId: brief ? brief.avatarFileId : old.avatarFileId,
            preview: row.preview, previewTime: row.previewTime
          } : row);
        } catch {
          if (old) rows.push({ conversation: item, peerName: old.peerName,
            avatarFileId: old.avatarFileId, preview: old.preview, previewTime: old.previewTime });
          else {
            const row = ConversationListModel.row(item, null, []);
            if (row !== null) rows.push(row);
          }
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (!this.visible || version !== this.requestVersion || remoteVersion !== this.remoteVersion ||
      token !== this.appClient.sessionManager.getSession()?.accessToken) return;
    const order = new Map<number, number>();
    summaries.forEach((item: ConversationSummary, index: number) => order.set(item.conversationId, index));
    rows.sort((left: ConversationListItem, right: ConversationListItem) =>
      (order.get(left.conversation.conversationId) ?? 0) - (order.get(right.conversation.conversationId) ?? 0));
    this.conversations = rows;
    ConversationMemory.write(token, this.accountId, rows);
    this.primeAvatars(rows);
    this.errorMessage = '';
    this.loading = false;
    this.restoreScroll();
    } finally {
      if (this.remoteVersion === remoteVersion) this.remoteInFlight = false;
    }
  }

  private resetAvatars(token: string, accountId: number): void {
    if (token === this.avatarToken && accountId === this.avatarAccountId) return;
    this.avatarRequests.forEach((fileId: number) => this.appClient.apiService.cancelAvatarThumbnail(fileId));
    this.avatarRequests.clear();
    this.avatarQueue = [];
    this.avatarGeneration++;
    this.avatarImages.forEach((avatar: image.PixelMap) => avatar.release().catch(() => {}));
    this.avatarImages = new Map<number, image.PixelMap>();
    this.failedAvatars.clear();
    this.briefRefreshedIds.clear();
    this.avatarToken = token;
    this.avatarAccountId = accountId;
  }

  private primeAvatars(rows: ConversationListItem[]): void {
    if (!this.visible || !this.avatarToken || this.avatarAccountId <= 0) return;
    rows.forEach((row: ConversationListItem) => {
      const id = row.avatarFileId ?? 0;
      if (id > 0 && !this.avatarImages.has(id) && !this.avatarRequests.has(id) &&
        !this.failedAvatars.has(id) && !this.avatarQueue.includes(id)) this.avatarQueue.push(id);
    });
    this.drainAvatars();
  }

  private drainAvatars(): void {
    while (this.visible && this.avatarWorkers < 3 && this.avatarQueue.length > 0) {
      const fileId = this.avatarQueue.shift()!;
      this.avatarWorkers++;
      this.loadAvatar(fileId).finally(() => {
        this.avatarWorkers--;
        this.drainAvatars();
      });
    }
  }

  private async loadAvatar(fileId: number): Promise<void> {
    if (this.avatarRequests.has(fileId)) return;
    const token = this.avatarToken;
    const accountId = this.avatarAccountId;
    const generation = this.avatarGeneration;
    this.avatarRequests.add(fileId);
    try {
      const bytes = await this.appClient.apiService.getAvatarThumbnail(fileId);
      const source = image.createImageSource(bytes);
      let pixelMap: image.PixelMap;
      try {
        pixelMap = await source.createPixelMap({ desiredSize: { width: 96, height: 96 } });
      } finally {
        await source.release();
      }
      if (this.visible && token === this.avatarToken && accountId === this.avatarAccountId &&
        token === this.appClient.sessionManager.getSession()?.accessToken) {
        const next = new Map<number, image.PixelMap>(this.avatarImages);
        next.set(fileId, pixelMap);
        this.avatarImages = next;
      } else {
        await pixelMap.release();
      }
    } catch (error) {
      if ((error as PortraError)?.kind !== ErrorKind.STALE && token === this.avatarToken &&
        accountId === this.avatarAccountId && this.visible) {
        this.failedAvatars.add(fileId);
      }
    } finally {
      if (generation === this.avatarGeneration) {
        this.avatarRequests.delete(fileId);
        if (this.visible) this.primeAvatars(this.conversations);
      }
    }
  }

  private async hideConversation(conversationId: number): Promise<void> {
    if (this.hidingConversationId !== 0) {
      return;
    }
    this.hidingConversationId = conversationId;
    this.errorMessage = '';
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    const accountId = this.accountId;
    try {
      await this.appClient.apiService.hideConversation(conversationId);
      if (token !== this.appClient.sessionManager.getSession()?.accessToken ||
        accountId !== this.accountId) return;
      this.remoteVersion++;
      this.appClient.apiService.cancelConversations();
      this.conversations = this.conversations.filter((item: ConversationListItem) =>
        item.conversation.conversationId !== conversationId);
      ConversationMemory.write(token, accountId, this.conversations);
    } catch (error) {
      this.errorMessage = (error as PortraError).message || '隐藏会话失败';
    } finally {
      this.hidingConversationId = 0;
    }
  }

  @Builder
  private Tab(label: string, index: number) {
    Column({ space: 9 }) {
      Text(label)
        .fontSize(15)
        .fontWeight(this.selectedTab === index ? FontWeight.Bold : FontWeight.Regular)
        .fontColor(this.selectedTab === index ? PortraTheme.primaryText : PortraTheme.secondaryText)
      Column()
        .width(28)
        .height(3)
        .backgroundColor(this.selectedTab === index ? PortraTheme.primary : Color.Transparent)
        .borderRadius(2)
    }
    .width(72)
    .onClick(() => { this.selectedTab = index; this.syncVisibility(); })
  }

  build() {
    Column() {
      if (this.selectedTab === 0) {
      PortraPageHeading({ title: '消息', eyebrow: 'CONVERSATIONS', onBack: this.onBack })
      Row({ space: 20 }) {
        this.Tab('聊天', 0)
        this.Tab('通知', 1)
      }
      .width('100%')
      .height(50)
      .padding({ left: 14 })
      .border({ width: { bottom: 1 }, color: PortraTheme.border })
      }

      if (this.selectedTab === 1 && this.activeTab) {
        NotificationPage({ onBack: () => { this.selectedTab = 0; this.syncVisibility(); },
          onOpenMoment: this.onOpenMoment,
          onOpenCredit: this.onOpenCredit, onOpenOrders: this.onOpenOrders, onOpenTarget: this.onOpenTarget, onRequireLogin: this.onRequireLogin })
          .layoutWeight(1)
      } else if (this.requiresLogin) {
        Button('登录后查看消息').margin(24).onClick(() => this.onRequireLogin?.())
      } else if (this.loading) {
        PortraLoading({ label: '正在读取会话' })
      } else if (this.errorMessage.length > 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() })
      } else if (this.conversations.length === 0) {
        PortraEmptyView({ message: '还没有会话' })
      } else {
        Scroll(this.listScroller) {
          Column({ space: 0 }) {
            Row() {
              Text('最近消息').fontSize(18).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              Blank()
              Text(`${this.conversations.length} 个会话`)
                .fontSize(12)
                .fontColor(PortraTheme.secondaryText)
            }
            .width('100%')
            .padding({ left: 20, right: 20, top: 20, bottom: 10 })

            ForEach(this.conversations, (item: ConversationListItem) => {
              Row({ space: 12 }) {
                if (this.avatarImages.has(item.avatarFileId ?? 0)) {
                  Image(this.avatarImages.get(item.avatarFileId ?? 0) as image.PixelMap)
                    .width(48).height(48).borderRadius(24).objectFit(ImageFit.Cover)
                } else {
                  PortraAvatar({ displayName: item.peerName, avatarSize: 48 })
                }
                Column({ space: 5 }) {
                  Text(item.peerName)
                    .fontSize(15)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(PortraTheme.primaryText)
                  Text(item.preview)
                    .fontSize(12)
                    .fontColor(PortraTheme.secondaryText)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                }
                .layoutWeight(1)
                .alignItems(HorizontalAlign.Start)
                .onClick(() => this.onOpenConversation?.(item.conversation.conversationId))
                Column({ space: 6 }) {
                  Text(ConversationListModel.timeLabel(item.previewTime))
                    .fontSize(11)
                    .fontColor(PortraTheme.mutedText)
                  Button('查看').height(28).fontSize(11).backgroundColor(PortraTheme.primarySoft)
                    .fontColor(PortraTheme.primary)
                    .onClick(() => this.onOpenConversation?.(item.conversation.conversationId))
                  Button(this.hidingConversationId === item.conversation.conversationId ? '隐藏中' : '隐藏')
                    .height(28).fontSize(11).backgroundColor(PortraTheme.surface)
                    .fontColor(PortraTheme.secondaryText).enabled(this.hidingConversationId === 0)
                    .onClick(() => this.hideConversation(item.conversation.conversationId))
                }
              }
              .width('100%')
              .height(94)
              .padding({ left: 20, right: 20 })
              .backgroundColor(PortraTheme.surface)
              Divider().color(PortraTheme.border).padding({ left: 80 })
            }, (item: ConversationListItem) => item.conversation.conversationId.toString())

          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .onDidScroll(() => {
          const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
          ConversationMemory.writeListOffset(token, this.accountId, this.listScroller.currentOffset().yOffset);
        })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
