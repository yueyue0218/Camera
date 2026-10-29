import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { EnvironmentConfig } from '../../common/config/EnvironmentConfig';
import { QuoteDraft, QuoteWorkflow } from './QuoteWorkflow';

export class QuoteDraftStore {
  private static store?: preferences.Preferences;

  static configure(context: common.UIAbilityContext): void {
    try {
      QuoteDraftStore.store = preferences.getPreferencesSync(context, { name: 'portra_quote_drafts_v1' });
    } catch {
      QuoteDraftStore.store = undefined;
    }
  }

  private static key(userId: number, conversationId: number, quoteId: number): string {
    if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(conversationId) ||
      conversationId <= 0 || !Number.isSafeInteger(quoteId) || quoteId < 0) return '';
    return `${EnvironmentConfig.current().cacheNamespace}:${userId}:${conversationId}:${quoteId}`;
  }

  static read(userId: number, conversationId: number, quoteId: number): QuoteDraft | undefined {
    const key = QuoteDraftStore.key(userId, conversationId, quoteId);
    if (!key || QuoteDraftStore.store === undefined) return undefined;
    try {
      const raw = QuoteDraftStore.store.getSync(key, '');
      if (typeof raw !== 'string' || raw.length === 0) return undefined;
      const draft = JSON.parse(raw) as QuoteDraft;
      return QuoteWorkflow.isDraft(draft) ? draft : undefined;
    } catch {
      return undefined;
    }
  }

  static write(userId: number, conversationId: number, quoteId: number, draft: QuoteDraft): void {
    const key = QuoteDraftStore.key(userId, conversationId, quoteId);
    if (!key || QuoteDraftStore.store === undefined) return;
    try {
      QuoteDraftStore.store.putSync(key, JSON.stringify(draft));
      QuoteDraftStore.store.flushSync();
    } catch {
      // The current form remains intact when local storage is unavailable.
    }
  }

  static clear(userId: number, conversationId: number, quoteId: number): void {
    const key = QuoteDraftStore.key(userId, conversationId, quoteId);
    if (!key || QuoteDraftStore.store === undefined) return;
    try {
      QuoteDraftStore.store.deleteSync(key);
      QuoteDraftStore.store.flushSync();
    } catch {}
  }
}
