const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const source = fs.readFileSync(path.join(__dirname, '../entry/src/main/ets/app/AppClient.ets'), 'utf8');
const method = source.slice(source.indexOf('  async synchronizePrivacyConsent()'), source.indexOf('  async withdrawRequiredPrivacyConsent()'));
function fixture() {
  let verified = 0, violations = 0, acknowledgements = 0, epoch = 1;
  const decisions = [], grants = [];
  const policyVersion = '2026-10-29-v1';
  const granted = { status: 'GRANTED', privacyPolicyVersion: policyVersion, crossBorderConsentVersion: policyVersion };
  const mod = { exports: {} };
  const code = ts.transpileModule(`class Client { ${method} }; module.exports = Client;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }
  }).outputText;
  new Function('module', 'PrivacyConsentStore', 'CROSS_BORDER_CONSENT_VERSION', 'PRIVACY_POLICY_VERSION', code)(mod, {
    recordStatus(_context, status) { decisions.push(status); }, acknowledgeServer() { acknowledgements++; }
  }, policyVersion, policyVersion);
  const client = new mod.exports();
  const evidence = { current: true, pendingServerGrant: false, acceptedAtEpochMs: 1234 };
  Object.assign(client, {
    explicitConsentAt: 0, requireContext: () => ({}), consentEvidence: () => evidence,
    consentUpdate: status => ({ status, acceptedAtEpochMs: evidence.acceptedAtEpochMs }),
    sessionManager: { isAuthenticated: () => true, getSessionVersion: () => epoch },
    privacyGuard: { verified() { verified++; }, violate() { violations++; } },
    privacyApi: { consent: async () => granted, updateConsent: async input => { grants.push(input); return granted; } }
  });
  return { client, evidence, decisions, grants, granted,
    get verified() { return verified; }, get violations() { return violations; },
    get acknowledgements() { return acknowledgements; }, switchAccount() { epoch++; } };
}
test('startup respects remote withdrawal and does not turn local cached consent into a new account grant', async () => {
  for (const pending of [false, true]) {
    const f = fixture(); f.evidence.pendingServerGrant = pending;
    f.client.privacyApi.consent = async () => ({ status: 'WITHDRAWN' });
    await assert.rejects(f.client.synchronizePrivacyConsent(), /重新确认/);
    assert.equal(f.grants.length, 0); assert.equal(f.verified, 0); assert.equal(f.violations, 1);
    assert.deepEqual(f.decisions, ['WITHDRAWN']);
  }
});
test('only a fresh explicit checkbox action may regrant a withdrawn account', async () => {
  const f = fixture(); f.evidence.pendingServerGrant = true; f.client.explicitConsentAt = 1234;
  f.client.privacyApi.consent = async () => ({ status: 'WITHDRAWN' });
  await f.client.synchronizePrivacyConsent();
  assert.equal(f.grants.length, 1); assert.equal(f.grants[0].status, 'GRANTED');
  assert.equal(f.verified, 1); assert.equal(f.acknowledgements, 1);
});
test('a failed consent registration never acknowledges local pending evidence or opens business requests', async () => {
  const f = fixture(); f.evidence.pendingServerGrant = true;
  f.client.privacyApi.consent = async () => ({ status: 'NOT_RECORDED' });
  f.client.privacyApi.updateConsent = async () => { throw new Error('database offline'); };
  await assert.rejects(f.client.synchronizePrivacyConsent(), /offline/);
  assert.equal(f.verified, 0); assert.equal(f.acknowledgements, 0);
});
test('existing current server grant is read on login without creating another agreement event', async () => {
  const f = fixture(); await f.client.synchronizePrivacyConsent();
  assert.equal(f.grants.length, 0); assert.equal(f.verified, 1); assert.equal(f.acknowledgements, 1);
});
test('old protocol versions cannot satisfy the account gate', async () => {
  const f = fixture(); f.client.privacyApi.consent = async () => ({ ...f.granted, crossBorderConsentVersion: 'old' });
  await assert.rejects(f.client.synchronizePrivacyConsent(), /重新确认/);
  assert.equal(f.verified, 0); assert.equal(f.violations, 1);
});
test('a prior accounts late consent response cannot grant, revoke or acknowledge the next account', async () => {
  const f = fixture(); let resolve;
  f.client.privacyApi.consent = () => new Promise(done => { resolve = done; });
  const pending = f.client.synchronizePrivacyConsent(); f.switchAccount(); resolve(f.granted);
  await assert.rejects(pending, /身份已变化/);
  assert.equal(f.verified, 0); assert.equal(f.grants.length, 0); assert.equal(f.decisions.length, 0);
});
