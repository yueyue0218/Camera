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
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct MessagePage {
  @State private selectedTab: number = 0;
  @State private loading: boolean = true;
  @State private errorMessage: string = '';
  @State private conversations: ConversationListItem[] = [];
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private remoteVersion: number = 0;
  private accountId: number = 0;
  private refreshTimer: number = -1;
  private readonly listScroller: Scroller = new Scroller();
  private visible: boolean = false;
  private restoreTimer: number = -1;
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
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) {
      if (this.accountId > 0) this.refresh();
      else this.load();
      this.refreshTimer = setInterval(() => this.refresh(), 15000);
      this.restoreScroll();
    } else {
      if (this.refreshTimer >= 0) clearInterval(this.refreshTimer);
      this.refreshTimer = -1;
      this.remoteVersion++;
      this.appClient.apiService.cancelConversations();
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
    this.conversations = ConversationMemory.read(token, this.accountId);
    this.loading = this.conversations.length === 0;
    this.errorMessage = '';
    try {
      const session = await this.appClient.apiService.currentSession();
      if (!this.visible || version !== this.requestVersion) return;
      this.accountId = session.userId;
      this.conversations = ConversationMemory.read(token, session.userId);
      this.loading = this.conversations.length === 0;
      this.restoreScroll();
      await this.loadRemote(version, token);
    } catch (error) {
      if (version === this.requestVersion) {
        this.errorMessage = this.conversations.length ? '' : (error as PortraError).message || '消息加载失败';
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  private async refresh(): Promise<void> {
    if (this.accountId <= 0 || !this.appClient.sessionManager.isAuthenticated()) return;
    const token = this.appClient.sessionManager.getSession()?.accessToken ?? '';
    try {
      await this.loadRemote(this.requestVersion, token);
    } catch {
      // Keep the last verified list during a transient refresh failure.
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
    this.errorMessage = '';
    this.loading = false;
    this.restoreScroll();
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
                PortraAvatar({ displayName: item.peerName, avatarSize: 48 })
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
