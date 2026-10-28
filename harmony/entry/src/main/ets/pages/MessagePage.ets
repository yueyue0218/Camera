import { NotificationPage } from './NotificationPage';
import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { ConversationSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct MessagePage {
  @State private selectedTab: number = 0;
  @State private loading: boolean = true;
  @State private errorMessage: string = '';
  @State private conversations: ConversationSummary[] = [];
  @State private hidingConversationId: number = 0;
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  onBack?: () => void;
  onOpenMoment?: (id: number) => void;
  onOpenCredit?: () => void;
  onOpenOrders?: () => void;
  onRequireLogin?: () => void;
  onOpenConversation?: (conversationId: number) => void;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.requestVersion++;
    this.appClient.apiService.cancelConversations();
    if (this.hidingConversationId > 0) {
      this.appClient.apiService.cancelHideConversation(this.hidingConversationId);
    }
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.errorMessage = '';
    this.conversations = [];
    try {
      const result = await this.appClient.apiService.listConversations();
      if (version === this.requestVersion) {
        if (!Array.isArray(result)) {
          this.errorMessage = '会话数据格式异常';
        } else {
          this.conversations = this.normalizeConversations(result);
        }
      }
    } catch (error) {
      if (version === this.requestVersion) {
        this.errorMessage = (error as PortraError).message || '消息加载失败';
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  private normalizeConversations(source: ConversationSummary[]): ConversationSummary[] {
    const result: ConversationSummary[] = [];
    source.forEach((item: ConversationSummary) => {
      if (item !== null && Number.isSafeInteger(item.conversationId) && item.conversationId > 0 &&
        Number.isSafeInteger(item.otherUserId) && item.otherUserId > 0 &&
        !result.some((current: ConversationSummary) => current.conversationId === item.conversationId)) {
        result.push(item);
      }
    });
    return result.sort((left: ConversationSummary, right: ConversationSummary) =>
      this.conversationTime(right) - this.conversationTime(left));
  }

  private conversationTime(item: ConversationSummary): number {
    const text = item.lastMessageTime ?? item.createdAt ?? '';
    const value = Date.parse(text);
    return Number.isFinite(value) ? value : 0;
  }

  private conversationSubtitle(item: ConversationSummary): string {
    if (item.orderId !== undefined) {
      return `订单 #${item.orderId} · 对方 #${item.otherUserId}`;
    }
    if (item.sourceType?.trim()) {
      return `${item.sourceType} #${item.sourceId ?? '-'} · 对方 #${item.otherUserId}`;
    }
    return `对方用户 #${item.otherUserId}`;
  }

  private async hideConversation(conversationId: number): Promise<void> {
    if (this.hidingConversationId !== 0) {
      return;
    }
    this.hidingConversationId = conversationId;
    this.errorMessage = '';
    try {
      await this.appClient.apiService.hideConversation(conversationId);
      this.conversations = this.conversations.filter((item: ConversationSummary) =>
        item.conversationId !== conversationId);
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
    .onClick(() => this.selectedTab = index)
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

      if (this.selectedTab === 1) {
        NotificationPage({ onBack: () => this.selectedTab = 0, onOpenMoment: this.onOpenMoment,
          onOpenCredit: this.onOpenCredit, onOpenOrders: this.onOpenOrders, onRequireLogin: this.onRequireLogin })
          .layoutWeight(1)
      } else if (this.loading) {
        PortraLoading({ label: '正在读取会话' })
      } else if (this.errorMessage.length > 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() })
      } else if (this.conversations.length === 0) {
        PortraEmptyView({ message: '还没有会话' })
      } else {
        Scroll() {
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

            ForEach(this.conversations, (item: ConversationSummary) => {
              Row({ space: 12 }) {
                PortraAvatar({ displayName: '约', avatarSize: 48 })
                Column({ space: 5 }) {
                  Text('约拍会话')
                    .fontSize(15)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(PortraTheme.primaryText)
                  Text(this.conversationSubtitle(item))
                    .fontSize(12)
                    .fontColor(PortraTheme.secondaryText)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                }
                .layoutWeight(1)
                .alignItems(HorizontalAlign.Start)
                Column({ space: 4 }) {
                  Text(typeof item.lastMessageTime === 'string' ? item.lastMessageTime.slice(0, 10) : '')
                    .fontSize(11)
                    .fontColor(PortraTheme.mutedText)
                  Row({ space: 6 }) {
                    Button('进入')
                      .height(30)
                      .fontSize(11)
                      .backgroundColor(PortraTheme.primarySoft)
                      .fontColor(PortraTheme.primary)
                      .onClick(() => this.onOpenConversation?.(item.conversationId))
                    Button(this.hidingConversationId === item.conversationId ? '隐藏中' : '隐藏')
                      .height(30)
                      .fontSize(11)
                      .backgroundColor(PortraTheme.surface)
                      .fontColor(PortraTheme.secondaryText)
                      .enabled(this.hidingConversationId === 0)
                      .onClick(() => this.hideConversation(item.conversationId))
                  }
                }
              }
              .width('100%')
              .height(86)
              .padding({ left: 20, right: 20 })
              .backgroundColor(PortraTheme.surface)
              Divider().color(PortraTheme.border).padding({ left: 80 })
            }, (item: ConversationSummary) => item.conversationId.toString())

          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
