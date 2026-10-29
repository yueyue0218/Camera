import { image } from '@kit.ImageKit';
import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { ConversationListItem, ConversationListModel } from '../features/conversation/ConversationListModel';
import { ConversationMemory } from '../features/conversation/ConversationMemory';
import { ConversationVisibility } from '../features/conversation/ConversationVisibility';
import { ConversationSummary } from '../model/ApiModels';
import { ErrorKind, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct MessagePage {
  @State private selectedTab: number = 0;
  @State private loading: boolean = true;
  @State private errorMessage: string = '';
  @State private conversations: ConversationListItem[] = [];
  @State private avatarImages: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private remoteVersion: number = 0;
  private accountId: number = 0;
  private activeToken: string = '';
  private refreshTimer: number = -1;
  private readonly listScroller: Scroller = new Scroller();
  private visible: boolean = false;
  private restoreTimer: number = -1;
  private avatarToken: string = '';
  private avatarAccountId: number = 0;
  private avatarRequests: Set<number> = new Set<number>();
  private failedAvatars: Set<number> = new Set<number>();
  private avatarQueue: number[] = [];
  private avatarWorkers: number = 0;
  private avatarGeneration: number = 0;
  onBack?: () => void;
  onOpenConversation?: (conversationId: number) => void;

  aboutToAppear(): void {
    ConversationVisibility.subscribe('list', (visible: boolean) => this.setVisible(visible));
  }

  aboutToDisappear(): void {
    ConversationVisibility.unsubscribe('list');
    this.setVisible(false);
    this.requestVersion++;
    this.remoteVersion++;
    if (this.restoreTimer >= 0) clearTimeout(this.restoreTimer);
    this.appClient.apiService.cancelConversations();
    this.appClient.apiService.cancelCurrentSession();
    this.resetAvatars('', 0);
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) {
      const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
      if (this.accountId > 0 && token === this.activeToken) {
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
    try {
      const session = await this.appClient.apiService.currentSession();
      if (!this.visible || version !== this.requestVersion) return;
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
        if (!this.appClient.sessionManager.isAuthenticated() || failure.httpStatus === 403 ||
          failure.businessCode === 40301) {
          this.conversations = [];
          this.accountId = 0;
          this.resetAvatars('', 0);
        }
        this.errorMessage = this.conversations.length ? '' : failure.message || '消息加载失败';
      }
    } finally {
      if (version === this.requestVersion) {
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
    const remoteVersion = ++this.remoteVersion;
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
        if (old && old.conversation.lastMessageTime === item.lastMessageTime) {
          rows.push({ conversation: item, peerName: old.peerName, avatarFileId: old.avatarFileId,
            preview: old.preview, previewTime: old.previewTime });
          continue;
        }
        try {
          const peerRole = item.otherUserId === item.participantBId ? 'PROVIDER' : 'CUSTOMER';
          const brief = old ? null : await this.appClient.apiService.getUserBrief(item.otherUserId, peerRole)
            .catch(() => null);
          const messages = await this.appClient.apiService.listMessages(item.conversationId,
            `conversations.list.preview.${item.conversationId}`);
          const row = ConversationListModel.row(item, brief, messages);
          if (row !== null) rows.push(old ? {
            conversation: row.conversation, peerName: old.peerName,
            avatarFileId: old.avatarFileId, preview: row.preview, previewTime: row.previewTime
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
    .onClick(() => this.selectedTab = index)
  }

  build() {
    Column() {
      PortraPageHeading({ title: '消息', eyebrow: 'CONVERSATIONS', onBack: this.onBack })
      Row({ space: 20 }) {
        this.Tab('聊天', 0)
        this.Tab('通知', 1)
      }
      .width('100%')
      .height(50)
      .padding({ left: 14 })
      .border({ width: { bottom: 1 }, color: PortraTheme.border })

      if (this.selectedTab === 1) {
        PortraEmptyView({ message: '通知列表尚未接入' })
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
                Text(ConversationListModel.timeLabel(item.previewTime))
                  .fontSize(11)
                  .fontColor(PortraTheme.mutedText)
              }
              .width('100%')
              .height(78)
              .padding({ left: 20, right: 20 })
              .backgroundColor(PortraTheme.surface)
              .onClick(() => this.onOpenConversation?.(item.conversation.conversationId))
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
