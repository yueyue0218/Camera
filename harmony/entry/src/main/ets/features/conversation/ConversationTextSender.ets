import { MessageSummary } from '../../model/ApiModels';
import { ErrorKind, ErrorMapper, PortraError } from '../../network/ErrorMapper';
import { ConversationMemory } from './ConversationMemory';
import { ConversationMessageState, SendStatus } from './ConversationMessageState';

export interface TextSendResult {
  readonly messages: MessageSummary[];
  readonly sent?: MessageSummary;
  readonly errorText?: string;
}

/** POST result and cache reconciliation stay independent of page rendering. */
export class ConversationTextSender {
  static async send(post: (conversationId: number, content: string) => Promise<MessageSummary>,
    token: string, userId: number,
    conversationId: number, pending: MessageSummary): Promise<TextSendResult> {
    try {
      const sent = await post(conversationId, pending.content ?? '');
      if (!sent || !Number.isSafeInteger(sent.messageId) || sent.messageId <= 0 ||
        sent.conversationId !== conversationId || sent.senderId !== userId) throw ErrorMapper.parse();
      const current = ConversationMemory.readMessages(token, userId, conversationId);
      const merged = ConversationMessageState.confirm(current, pending.messageId, sent);
      ConversationMemory.writeMessages(token, userId, conversationId, merged);
      ConversationMemory.noteMessage(token, userId, conversationId, sent);
      return { messages: merged, sent: sent };
    } catch (error) {
      const mapped = error as PortraError;
      const definite = mapped.kind === ErrorKind.CONFIG ||
        (mapped.kind === ErrorKind.HTTP && mapped.httpStatus >= 400 && mapped.httpStatus < 500) ||
        (mapped.kind === ErrorKind.BUSINESS && mapped.businessCode < 50000);
      const status = definite ? SendStatus.FAILED : SendStatus.UNCERTAIN;
      const current = ConversationMemory.readMessages(token, userId, conversationId);
      const next = ConversationMessageState.status(current, pending.messageId, status);
      ConversationMemory.writeMessages(token, userId, conversationId, next);
      return { messages: next, errorText: definite ? '发送失败，内容已保留，可重试。' :
        '发送结果未确认。请先查询结果，避免重复发送。' };
    }
  }
}
