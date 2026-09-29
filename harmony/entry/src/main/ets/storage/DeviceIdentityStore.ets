import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { util } from '@kit.ArkTS';

const STORE_NAME = 'portra_device_identity';
const INSTALLATION_ID_KEY = 'installation_id';

export class DeviceIdentityStore {
  static getOrCreate(context: common.UIAbilityContext): string {
    try {
      const store = preferences.getPreferencesSync(context, { name: STORE_NAME });
      const existing = store.getSync(INSTALLATION_ID_KEY, '');
      if (typeof existing === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
        return existing;
      }
      const installationId = util.generateRandomUUID();
      store.putSync(INSTALLATION_ID_KEY, installationId);
      store.flushSync();
      return installationId;
    } catch {
      throw new Error('Installation identity is unavailable');
    }
  }
}
