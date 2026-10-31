import { ConversationSummary, MessageSummary, UserBrief } from '../../model/ApiModels';

export interface ConversationListItem {
  readonly conversation: ConversationSummary;
  readonly peerName: string;
  readonly avatarFileId?: number;
  readonly preview: string;
  readonly previewTime: string;
}

const LEAKED_TEST_TEXT = /online[-_\s]*check\s+provider\s+reply\s+message|闯€/i;

export class ConversationListModel {
  static validSummary(item: ConversationSummary, userId: number): boolean {
    return item !== null && Number.isSafeInteger(item.conversationId) && item.conversationId > 0 &&
      Number.isSafeInteger(item.otherUserId) && item.otherUserId > 0 &&
      Number.isSafeInteger(item.participantAId) && Number.isSafeInteger(item.participantBId) &&
      (item.participantAId === userId || item.participantBId === userId) &&
      item.otherUserId !== userId &&
      (item.otherUserId === item.participantAId || item.otherUserId === item.participantBId);
  }

  static safeName(brief: UserBrief | null): string {
    const name = brief?.nickname?.trim() ?? '';
    return name.length > 0 && !LEAKED_TEST_TEXT.test(name) ? name : 'Portra 用户';
  }

  static preview(messages: MessageSummary[]): string | null {
    const latest = messages.length > 0 ? messages[messages.length - 1] : null;
    if (latest === null) return '开始对话';
    const text = latest.messageType === 'IMAGE' ? '[图片]' :
      latest.messageType === 'FILE' ? `[附件] ${latest.fileName ?? ''}`.trim() :
      (latest.content ?? '').trim();
    if (LEAKED_TEST_TEXT.test(text)) return null;
    return text || '开始对话';
  }

  static row(conversation: ConversationSummary, brief: UserBrief | null,
    messages: MessageSummary[]): ConversationListItem | null {
    const preview = ConversationListModel.preview(messages);
    if (preview === null) return null;
    const latest = messages.length > 0 ? messages[messages.length - 1] : null;
    return {
      conversation: conversation,
      peerName: ConversationListModel.safeName(brief),
      avatarFileId: brief?.avatarFileId,
      preview: preview,
      previewTime: latest?.createdAt ?? conversation.lastMessageTime ?? conversation.createdAt ?? ''
    };
  }

  static timeLabel(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysAgo = Math.round((today.getTime() - messageDay.getTime()) / 86400000);
    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    if (daysAgo === 0) return time;
    if (daysAgo === 1) return `昨天 ${time}`;
    if (daysAgo >= 2 && daysAgo < 7) {
      const weekDays: string[] = ['日', '一', '二', '三', '四', '五', '六'];
      return `周${weekDays[date.getDay()]}`;
    }
    const day = `${date.getMonth() + 1}月${date.getDate()}日`;
    return date.getFullYear() === now.getFullYear() ? day : `${date.getFullYear()}年${day}`;
  }
}
