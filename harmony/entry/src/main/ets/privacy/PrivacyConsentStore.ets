import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';

export const PRIVACY_POLICY_VERSION: string = '2026-10-29-v1';
export const CROSS_BORDER_CONSENT_VERSION: string = '2026-10-29-v1';

const STORE_NAME: string = 'portra_privacy_consent';
const PRIVACY_VERSION_KEY: string = 'privacy_policy_version';
const CROSS_BORDER_VERSION_KEY: string = 'cross_border_consent_version';
const ACCEPTED_AT_KEY: string = 'accepted_at_epoch_ms';

export interface PrivacyConsentSnapshot {
  readonly privacyPolicyVersion: string;
  readonly crossBorderConsentVersion: string;
  readonly acceptedAtEpochMs: number;
  readonly current: boolean;
}

/** Local-only consent evidence. No network access occurs in this store. */
export class PrivacyConsentStore {
  static read(context: common.UIAbilityContext): PrivacyConsentSnapshot {
    try {
      const store = preferences.getPreferencesSync(context, { name: STORE_NAME });
      const privacyValue = store.getSync(PRIVACY_VERSION_KEY, '');
      const crossBorderValue = store.getSync(CROSS_BORDER_VERSION_KEY, '');
      const acceptedAtValue = store.getSync(ACCEPTED_AT_KEY, 0);
      const privacyVersion = typeof privacyValue === 'string' ? privacyValue : '';
      const crossBorderVersion = typeof crossBorderValue === 'string' ? crossBorderValue : '';
      const acceptedAt = typeof acceptedAtValue === 'number' ? acceptedAtValue : 0;
      return {
        privacyPolicyVersion: privacyVersion,
        crossBorderConsentVersion: crossBorderVersion,
        acceptedAtEpochMs: acceptedAt,
        current: privacyVersion === PRIVACY_POLICY_VERSION &&
          crossBorderVersion === CROSS_BORDER_CONSENT_VERSION && acceptedAt > 0
      };
    } catch {
      return PrivacyConsentStore.emptySnapshot();
    }
  }

  static hasCurrentConsent(context: common.UIAbilityContext): boolean {
    return PrivacyConsentStore.read(context).current;
  }

  static acceptCurrent(context: common.UIAbilityContext, acceptedAtEpochMs: number): void {
    if (!Number.isSafeInteger(acceptedAtEpochMs) || acceptedAtEpochMs <= 0) {
      throw new Error('Consent time is invalid');
    }
    try {
      const store = preferences.getPreferencesSync(context, { name: STORE_NAME });
      store.putSync(PRIVACY_VERSION_KEY, PRIVACY_POLICY_VERSION);
      store.putSync(CROSS_BORDER_VERSION_KEY, CROSS_BORDER_CONSENT_VERSION);
      store.putSync(ACCEPTED_AT_KEY, acceptedAtEpochMs);
      store.flushSync();
    } catch {
      PrivacyConsentStore.rollback(context);
      throw new Error('Privacy consent could not be saved');
    }
  }

  static clear(context: common.UIAbilityContext): void {
    try {
      const store = preferences.getPreferencesSync(context, { name: STORE_NAME });
      store.deleteSync(PRIVACY_VERSION_KEY);
      store.deleteSync(CROSS_BORDER_VERSION_KEY);
      store.deleteSync(ACCEPTED_AT_KEY);
      store.flushSync();
    } catch {
      throw new Error('Privacy consent could not be cleared');
    }
  }

  private static rollback(context: common.UIAbilityContext): void {
    try {
      const store = preferences.getPreferencesSync(context, { name: STORE_NAME });
      store.deleteSync(PRIVACY_VERSION_KEY);
      store.deleteSync(CROSS_BORDER_VERSION_KEY);
      store.deleteSync(ACCEPTED_AT_KEY);
      store.flushSync();
    } catch {
      // The caller still receives a persistence failure and keeps the gate closed.
    }
  }

  private static emptySnapshot(): PrivacyConsentSnapshot {
    return {
      privacyPolicyVersion: '',
      crossBorderConsentVersion: '',
      acceptedAtEpochMs: 0,
      current: false
    };
  }
}
