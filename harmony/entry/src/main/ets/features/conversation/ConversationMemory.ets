import { MessageSummary } from '../../model/ApiModels';
import { ConversationListItem, ConversationListModel } from './ConversationListModel';

/** In-memory only. Access requires the exact current access token and account ID. */
export class ConversationMemory {
  private static token: string = '';
  private static userId: number = 0;
  private static rows: ConversationListItem[] = [];

  static read(token: string, userId: number): ConversationListItem[] {
    return token && token === ConversationMemory.token && userId === ConversationMemory.userId
      ? ConversationMemory.rows : [];
  }

  static write(token: string, userId: number, rows: ConversationListItem[]): void {
    if (!token || !Number.isSafeInteger(userId) || userId <= 0) return;
    ConversationMemory.token = token;
    ConversationMemory.userId = userId;
    ConversationMemory.rows = rows;
  }

  static noteMessage(token: string, userId: number, conversationId: number, message: MessageSummary): void {
    if (token !== ConversationMemory.token || userId !== ConversationMemory.userId) return;
    ConversationMemory.rows = ConversationMemory.rows.map((row: ConversationListItem) => {
      if (row.conversation.conversationId !== conversationId) return row;
      const preview = ConversationListModel.preview([message]);
      return preview === null ? row : {
        conversation: row.conversation,
        peerName: row.peerName,
        avatarFileId: row.avatarFileId,
        preview: preview,
        previewTime: message.createdAt ?? row.previewTime
      };
    });
  }

  static clear(): void {
    ConversationMemory.token = '';
    ConversationMemory.userId = 0;
    ConversationMemory.rows = [];
  }
}
