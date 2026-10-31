import { MessageSummary } from '../../model/ApiModels';

export enum SendStatus {
  SENDING = 'sending',
  FAILED = 'failed',
  UNCERTAIN = 'uncertain'
}

/** Pure operations so polling, POST completion and retries use the same merge rules. */
export class ConversationMessageState {
  private static nextTempId: number = -1;

  static pending(conversationId: number, senderId: number, content: string,
    now: string = ConversationMessageState.localTimestamp()): MessageSummary {
    return {
      messageId: ConversationMessageState.nextTempId--,
      conversationId: conversationId,
      senderId: senderId,
      messageType: 'TEXT',
      content: content,
      createdAt: now,
      deliveryStatus: SendStatus.SENDING
    };
  }

  static pendingAttachment(conversationId: number, senderId: number, type: string,
    fileName: string, mimeType: string, size: number, uri: string, content: string = '',
    now: string = ConversationMessageState.localTimestamp()): MessageSummary {
    return { messageId: ConversationMessageState.nextTempId--, conversationId: conversationId,
      senderId: senderId, messageType: type, content: content, fileName: fileName,
      mimeType: mimeType, size: size, localUri: uri, createdAt: now, deliveryStatus: SendStatus.SENDING };
  }

  private static localTimestamp(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 19);
  }

  static status(messages: MessageSummary[], tempId: number, status: SendStatus): MessageSummary[] {
    return messages.map((item: MessageSummary) => item.messageId === tempId ? {
      messageId: item.messageId, conversationId: item.conversationId,
      senderId: item.senderId, messageType: item.messageType, content: item.content,
      createdAt: item.createdAt, fileName: item.fileName, fileId: item.fileId,
      mimeType: item.mimeType, size: item.size, localUri: item.localUri, deliveryStatus: status
    } : item);
  }

  static uploaded(messages: MessageSummary[], tempId: number, fileId: number): MessageSummary[] {
    return messages.map((item: MessageSummary) => item.messageId === tempId ? {
      messageId: item.messageId, conversationId: item.conversationId, senderId: item.senderId,
      messageType: item.messageType, content: item.content, createdAt: item.createdAt,
      fileName: item.fileName, fileId: fileId, mimeType: item.mimeType, size: item.size,
      localUri: item.localUri, deliveryStatus: item.deliveryStatus
    } : item);
  }

  static retryForContent(messages: MessageSummary[], senderId: number, content: string): MessageSummary | undefined {
    return messages.find((item: MessageSummary) => item.messageId < 0 &&
      item.senderId === senderId && item.messageType === 'TEXT' && item.content === content);
  }

  static confirm(messages: MessageSummary[], tempId: number, confirmed: MessageSummary): MessageSummary[] {
    const pending = messages.find((item: MessageSummary) => item.messageId === tempId);
    const remaining = messages.filter((item: MessageSummary) => item.messageId !== tempId);
    const result: MessageSummary = ConversationMessageState.withLocalUri(confirmed, pending?.localUri);
    return ConversationMessageState.merge(remaining, [result]);
  }

  static merge(current: MessageSummary[], remote: MessageSummary[]): MessageSummary[] {
    const server = new Map<number, MessageSummary>();
    const previousById = new Map<number, MessageSummary>();
    current.forEach((item: MessageSummary) => previousById.set(item.messageId, item));
    remote.forEach((item: MessageSummary) => {
      if (item !== null && Number.isSafeInteger(item.messageId) && item.messageId > 0) {
        const previous = previousById.get(item.messageId);
        server.set(item.messageId, previous?.localUri ?
          ConversationMessageState.withLocalUri(item, previous.localUri) : item);
      }
    });
    current.forEach((item: MessageSummary) => {
      if (item.messageId > 0 && !server.has(item.messageId)) server.set(item.messageId, item);
    });
    const local = current.filter((item: MessageSummary) => item.messageId < 0);
    const remoteItems = Array.from(server.values());
    const consumed = new Set<number>();
    const unresolved = local.filter((item: MessageSummary) => {
      const candidates = remoteItems.filter((candidate: MessageSummary) =>
        !consumed.has(candidate.messageId) && ConversationMessageState.sameSend(item, candidate));
      if (candidates.length !== 1) return true;
      const matchingLocal = local.filter((other: MessageSummary) => ConversationMessageState.sameSend(other, candidates[0]));
      if (matchingLocal.length !== 1) return true;
      consumed.add(candidates[0].messageId);
      if (item.localUri) {
        const index = remoteItems.findIndex((candidate: MessageSummary) => candidate.messageId === candidates[0].messageId);
        remoteItems[index] = ConversationMessageState.withLocalUri(candidates[0], item.localUri);
      }
      return false;
    });
    return [...remoteItems, ...unresolved].sort((left: MessageSummary, right: MessageSummary) => {
      const a = Date.parse(left.createdAt ?? '');
      const b = Date.parse(right.createdAt ?? '');
      if (Number.isNaN(a) || Number.isNaN(b)) return left.messageId - right.messageId;
      if (a !== b) return a - b;
      if (left.messageId > 0 && right.messageId < 0) return -1;
      if (left.messageId < 0 && right.messageId > 0) return 1;
      return left.messageId > 0 ? left.messageId - right.messageId : right.messageId - left.messageId;
    });
  }

  private static withLocalUri(item: MessageSummary, uri: string | undefined): MessageSummary {
    return { messageId: item.messageId, conversationId: item.conversationId, senderId: item.senderId,
      messageType: item.messageType, content: item.content, fileId: item.fileId,
      fileName: item.fileName, mimeType: item.mimeType, size: item.size, localUri: uri,
      createdAt: item.createdAt, quotationId: item.quotationId, orderId: item.orderId,
      deliveryStatus: item.deliveryStatus };
  }

  private static sameSend(local: MessageSummary, remote: MessageSummary): boolean {
    if (local.senderId !== remote.senderId || local.conversationId !== remote.conversationId ||
      local.messageType !== remote.messageType) return false;
    if (local.messageType === 'TEXT' && local.content !== remote.content) return false;
    if (local.messageType !== 'TEXT' && (!local.fileId || local.fileId !== remote.fileId)) return false;
    const localTime = Date.parse(local.createdAt ?? '');
    const remoteTime = Date.parse(remote.createdAt ?? '');
    return !Number.isNaN(localTime) && !Number.isNaN(remoteTime) &&
      Math.abs(localTime - remoteTime) <= 120000;
  }
}
