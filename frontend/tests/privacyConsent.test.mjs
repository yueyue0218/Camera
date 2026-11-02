import test from 'node:test'
import assert from 'node:assert/strict'
import { hasCurrentConsent, consentDecision, CONSENT_VERSION } from '../src/privacy/consentPolicy.js'
import { provinceCode, ProvinceCatalog } from '../src/common/region/ProvinceCatalog.js'
import { readFile } from 'node:fs/promises'

test('only current server account grant unlocks business, never local client labels', () => {
  for (const status of ['NOT_RECORDED', 'WITHDRAWN', null]) {
    assert.equal(hasCurrentConsent({ ...consentDecision(status, 'fixture'), clientType: 'web' }), false)
  }
  assert.equal(hasCurrentConsent(consentDecision('GRANTED', 'fixture')), true)
  assert.equal(hasCurrentConsent({ ...consentDecision('GRANTED', 'fixture'), privacyPolicyVersion: 'old' }), false)
  assert.equal(hasCurrentConsent(null), false)
})
test('explicit decision contains separate versioned evidence, never inferred grant', () => {
  assert.deepEqual(consentDecision('WITHDRAWN', 'test-device', 123), {
    status: 'WITHDRAWN', installationId: 'test-device', acceptedAtEpochMs: 123,
    privacyPolicyVersion: CONSENT_VERSION, crossBorderConsentVersion: CONSENT_VERSION
  })
})
test('34 regions retain names, aliases and six-digit history', () => {
  assert.equal(ProvinceCatalog.length, 34)
  for (const row of ProvinceCatalog) {
    for (const value of [row.code, row.name, `${row.prefix}0101`, ...row.aliases]) assert.equal(provinceCode(value), row.code)
  }
  assert.equal(provinceCode('320ABC'), '')
})
test('Web never infers IP or auto-grants and consent failures do not log out', async () => {
  const profile = await readFile(new URL('../src/pages/profile/ProfilePage.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(profile, /ip-api\.com|restapi\.amap\.com|detectIpLocation/)
  const gate = await readFile(new URL('../src/privacy/PrivacyGate.jsx', import.meta.url), 'utf8')
  assert.match(gate, /if \(status === 'GRANTED' && \(!policy \|\| !crossBorder\)\) return/)
  assert.match(gate, /\/privacy\/rights/)
  const client = await readFile(new URL('../src/api/client.js', import.meta.url), 'utf8')
  assert.match(client, /40302[\s\S]*portra:consent-required/)
})
