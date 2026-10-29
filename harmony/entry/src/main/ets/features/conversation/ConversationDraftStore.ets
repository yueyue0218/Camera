import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { EnvironmentConfig } from '../../common/config/EnvironmentConfig';

const STORE_NAME = 'portra_conversation_drafts_v1';

export class ConversationDraftStore {
  private static store?: preferences.Preferences;

  static configure(context: common.UIAbilityContext): void {
    try {
      ConversationDraftStore.store = preferences.getPreferencesSync(context, { name: STORE_NAME });
    } catch {
      ConversationDraftStore.store = undefined;
    }
  }

  static key(accountId: number, conversationId: number): string {
    if (!Number.isSafeInteger(accountId) || accountId <= 0 ||
      !Number.isSafeInteger(conversationId) || conversationId <= 0) return '';
    return `${EnvironmentConfig.current().cacheNamespace}:draft:${accountId}:${conversationId}`;
  }

  static read(accountId: number, conversationId: number): string {
    const key = ConversationDraftStore.key(accountId, conversationId);
    if (!key || ConversationDraftStore.store === undefined) return '';
    try {
      const value = ConversationDraftStore.store.getSync(key, '');
      return typeof value === 'string' ? value : '';
    } catch {
      return '';
    }
  }

  static write(accountId: number, conversationId: number, value: string): void {
    const key = ConversationDraftStore.key(accountId, conversationId);
    if (!key || ConversationDraftStore.store === undefined) return;
    try {
      ConversationDraftStore.store.putSync(key, value.slice(0, 4000));
      ConversationDraftStore.store.flushSync();
    } catch {
      // A storage failure must not clear the in-memory composer.
    }
  }
}
