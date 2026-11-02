export const CONSENT_VERSION = '2026-10-29-v1'
export function hasCurrentConsent(value) {
  return value?.status === 'GRANTED'
    && value.privacyPolicyVersion === CONSENT_VERSION
    && value.crossBorderConsentVersion === CONSENT_VERSION
}
export function consentDecision(status, installationId, now = Date.now()) {
  return { status, privacyPolicyVersion: CONSENT_VERSION,
    crossBorderConsentVersion: CONSENT_VERSION, installationId, acceptedAtEpochMs: now }
}
