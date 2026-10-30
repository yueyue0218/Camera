import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { EnvironmentConfig } from '../../common/config/EnvironmentConfig';

export class AftercareDraftStore {
  private static store?: preferences.Preferences;

  static configure(context: common.UIAbilityContext): void {
    try { AftercareDraftStore.store = preferences.getPreferencesSync(context, { name: 'portra_aftercare_drafts_v1' }); }
    catch { AftercareDraftStore.store = undefined; }
  }

  static key(actorId: number, orderId: number, kind: string, targetId: number = 0): string {
    if (!Number.isSafeInteger(actorId) || actorId <= 0 ||
      !Number.isSafeInteger(orderId) || orderId <= 0 ||
      !Number.isSafeInteger(targetId) || targetId < 0 || !/^[a-z]+$/.test(kind)) return '';
    return `${EnvironmentConfig.current().cacheNamespace}:${actorId}:${orderId}:${kind}:${targetId}`;
  }

  static read(actorId: number, orderId: number, kind: string, targetId: number = 0): string {
    const key = AftercareDraftStore.key(actorId, orderId, kind, targetId);
    if (!key || AftercareDraftStore.store === undefined) return '';
    try {
      const value = AftercareDraftStore.store.getSync(key, '');
      return typeof value === 'string' ? value : '';
    } catch { return ''; }
  }

  static write(actorId: number, orderId: number, kind: string, targetId: number, value: string): void {
    const key = AftercareDraftStore.key(actorId, orderId, kind, targetId);
    if (!key || AftercareDraftStore.store === undefined) return;
    try {
      AftercareDraftStore.store.putSync(key, value.slice(0, 2000));
      AftercareDraftStore.store.flushSync();
    } catch { /* Keep the live input if storage is unavailable. */ }
  }
}
