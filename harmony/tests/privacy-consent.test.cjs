const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const sourceRoot = path.resolve(__dirname, '../entry/src/main/ets');

const values = new Map();
const identityValues = new Map();
let flushes = 0;
let failFlush = false;
let generatedIdentities = 0;
function createStore(storage, consentStore) { return {
  getSync(key, defaultValue) { return storage.get(key) ?? defaultValue; },
  putSync(key, value) { storage.set(key, value); },
  deleteSync(key) { storage.delete(key); },
  flushSync() {
    if (consentStore) flushes++;
    if (failFlush) throw new Error('disk unavailable');
  }
}; }
const store = createStore(values, true), identityStore = createStore(identityValues, false);
function reset() { values.clear(); identityValues.clear(); flushes = 0; failFlush = false; generatedIdentities = 0; }
const mocks = {
  '@kit.ArkData': { preferences: { getPreferencesSync(context, options) {
    return options.name === 'portra_device_identity' ? identityStore : store;
  } } },
  '@kit.ArkTS': { util: { generateRandomUUID() { generatedIdentities++; return '12345678-1234-4234-8234-123456789abc'; } } }
};

require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot + path.sep));
  const originalRequire = module.require.bind(module);
  module.require = name => mocks[name] ?? originalRequire(name);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};

const {
  CROSS_BORDER_CONSENT_VERSION,
  PRIVACY_POLICY_VERSION,
  PrivacyConsentStore
} = require('../entry/src/main/ets/privacy/PrivacyConsentStore.ets');

test('first launch has no current privacy consent', () => {
  reset();
  flushes = 0;
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
  const snapshot = PrivacyConsentStore.read({});
  assert.equal(snapshot.current, false);
  assert.equal(snapshot.acceptedAtEpochMs, 0);
  assert.equal(flushes, 0);
  assert.equal(snapshot.status, 'NOT_RECORDED');
  assert.equal(snapshot.installationId, '');
  assert.equal(snapshot.pendingServerGrant, false);
  assert.equal(generatedIdentities, 0);
});

test('acceptance persists both independent document versions and time', () => {
  reset();
  flushes = 0;
  PrivacyConsentStore.acceptCurrent({}, 1793228400000);
  const snapshot = PrivacyConsentStore.read({});
  assert.equal(snapshot.current, true);
  assert.equal(snapshot.privacyPolicyVersion, PRIVACY_POLICY_VERSION);
  assert.equal(snapshot.crossBorderConsentVersion, CROSS_BORDER_CONSENT_VERSION);
  assert.equal(snapshot.acceptedAtEpochMs, 1793228400000);
  assert.equal(snapshot.status, 'GRANTED');
  assert.equal(snapshot.pendingServerGrant, true);
  assert.match(snapshot.installationId, /^[0-9a-f-]{36}$/);
  assert.equal(generatedIdentities, 1);
  assert.equal(flushes, 1);
});

test('either document version change requires consent again', () => {
  reset();
  PrivacyConsentStore.acceptCurrent({}, 1793228400000);
  values.set('cross_border_consent_version', 'older-version');
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
  values.set('cross_border_consent_version', CROSS_BORDER_CONSENT_VERSION);
  values.set('privacy_policy_version', 'older-version');
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
});

test('failed persistence never reports consent as current', () => {
  reset();
  failFlush = true;
  assert.throws(() => PrivacyConsentStore.acceptCurrent({}, 1793228400000),
    /Privacy consent could not be saved/);
  failFlush = false;
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
});

test('legacy clear revokes the gate while retaining installation subject and explicit withdrawn status', () => {
  reset();
  PrivacyConsentStore.acceptCurrent({}, 1793228400000);
  const subject = PrivacyConsentStore.read({}).installationId;
  PrivacyConsentStore.clear({});
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
  const snapshot = PrivacyConsentStore.read({});
  assert.equal(snapshot.status, 'WITHDRAWN');
  assert.equal(snapshot.installationId, subject);
  assert.equal(snapshot.pendingServerGrant, false);
});

test('server acknowledgement clears pending grant without losing consent evidence or creating another subject', () => {
  reset(); PrivacyConsentStore.acceptCurrent({}, 1793228400000);
  const before = PrivacyConsentStore.read({}); PrivacyConsentStore.acknowledgeServer({});
  const after = PrivacyConsentStore.read({});
  assert.equal(after.pendingServerGrant, false); assert.equal(after.current, true);
  assert.equal(after.acceptedAtEpochMs, before.acceptedAtEpochMs);
  assert.equal(after.installationId, before.installationId); assert.equal(generatedIdentities, 1);
  assert.equal(after.crossBorderConsentVersion, CROSS_BORDER_CONSENT_VERSION);
});

test('withdrawal and refusal preserve prior accepted evidence but cannot authorize requests or pending automatic regrant', () => {
  for (const status of ['WITHDRAWN', 'DENIED']) {
    reset(); PrivacyConsentStore.acceptCurrent({}, 1793228400000);
    const before = PrivacyConsentStore.read({}); PrivacyConsentStore.recordStatus({}, status);
    const after = PrivacyConsentStore.read({});
    assert.equal(after.current, false); assert.equal(after.status, status); assert.equal(after.pendingServerGrant, false);
    assert.equal(after.installationId, before.installationId); assert.equal(after.acceptedAtEpochMs, before.acceptedAtEpochMs);
    assert.equal(after.privacyPolicyVersion, PRIVACY_POLICY_VERSION);
    assert.equal(after.crossBorderConsentVersion, CROSS_BORDER_CONSENT_VERSION);
    assert.ok(values.get('status_changed_at_epoch_ms') > 0);
  }
});

test('first-launch refusal records DENIED without creating an installation identifier before consent', () => {
  reset(); PrivacyConsentStore.recordStatus({}, 'DENIED');
  const snapshot = PrivacyConsentStore.read({});
  assert.equal(snapshot.status, 'DENIED'); assert.equal(snapshot.current, false);
  assert.equal(snapshot.pendingServerGrant, false); assert.equal(snapshot.installationId, '');
  assert.equal(snapshot.privacyPolicyVersion, PRIVACY_POLICY_VERSION);
  assert.equal(snapshot.crossBorderConsentVersion, CROSS_BORDER_CONSENT_VERSION);
  assert.equal(snapshot.consentType, 'CROSS_BORDER_HK');
  assert.ok(snapshot.statusChangedAtEpochMs > 0);
  assert.equal(generatedIdentities, 0); assert.ok(values.get('status_changed_at_epoch_ms') > 0);
});

test('only another explicit acceptance can set pending grant after withdrawal and reuses the installation subject', () => {
  reset(); PrivacyConsentStore.acceptCurrent({}, 1793228400000);
  const before = PrivacyConsentStore.read({}); PrivacyConsentStore.recordStatus({}, 'WITHDRAWN');
  assert.equal(PrivacyConsentStore.read({}).pendingServerGrant, false);
  PrivacyConsentStore.acceptCurrent({}, 1793228400001);
  const after = PrivacyConsentStore.read({});
  assert.equal(after.current, true); assert.equal(after.pendingServerGrant, true);
  assert.equal(after.acceptedAtEpochMs, 1793228400001); assert.equal(after.installationId, before.installationId);
  assert.equal(generatedIdentities, 1);
});

test('entry ability defers identity creation and index gates bootstrap', () => {
  const entry = fs.readFileSync(path.join(sourceRoot, 'entryability/EntryAbility.ets'), 'utf8');
  const index = fs.readFileSync(path.join(sourceRoot, 'pages/Index.ets'), 'utf8');
  assert.equal(entry.includes('DeviceIdentityStore.getOrCreate'), false);
  assert.equal(entry.includes('bindContext(this.context)'), true);
  assert.equal(index.includes('hasRequiredPrivacyConsent()'), true);
  assert.equal(index.includes('bootstrapAfterPrivacyConsent()'), true);
  assert.ok(index.indexOf('hasRequiredPrivacyConsent()') < index.indexOf('bootstrapAfterPrivacyConsent()'));
});
