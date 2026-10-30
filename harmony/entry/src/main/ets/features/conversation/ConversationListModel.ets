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
    const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    return sameDay ? value.slice(11, 16) : value.slice(5, 10);
  }
}
