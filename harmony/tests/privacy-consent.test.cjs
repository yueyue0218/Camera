const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const sourceRoot = path.resolve(__dirname, '../entry/src/main/ets');

const values = new Map();
let flushes = 0;
let failFlush = false;
const store = {
  getSync(key, defaultValue) { return values.get(key) ?? defaultValue; },
  putSync(key, value) { values.set(key, value); },
  deleteSync(key) { values.delete(key); },
  flushSync() {
    flushes++;
    if (failFlush) throw new Error('disk unavailable');
  }
};
const mocks = {
  '@kit.ArkData': { preferences: { getPreferencesSync() { return store; } } }
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
  values.clear();
  flushes = 0;
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
  const snapshot = PrivacyConsentStore.read({});
  assert.equal(snapshot.current, false);
  assert.equal(snapshot.acceptedAtEpochMs, 0);
  assert.equal(flushes, 0);
});

test('acceptance persists both independent document versions and time', () => {
  values.clear();
  flushes = 0;
  PrivacyConsentStore.acceptCurrent({}, 1793228400000);
  const snapshot = PrivacyConsentStore.read({});
  assert.equal(snapshot.current, true);
  assert.equal(snapshot.privacyPolicyVersion, PRIVACY_POLICY_VERSION);
  assert.equal(snapshot.crossBorderConsentVersion, CROSS_BORDER_CONSENT_VERSION);
  assert.equal(snapshot.acceptedAtEpochMs, 1793228400000);
  assert.equal(flushes, 1);
});

test('either document version change requires consent again', () => {
  values.clear();
  PrivacyConsentStore.acceptCurrent({}, 1793228400000);
  values.set('cross_border_consent_version', 'older-version');
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
  values.set('cross_border_consent_version', CROSS_BORDER_CONSENT_VERSION);
  values.set('privacy_policy_version', 'older-version');
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
});

test('failed persistence never reports consent as current', () => {
  values.clear();
  failFlush = true;
  assert.throws(() => PrivacyConsentStore.acceptCurrent({}, 1793228400000),
    /Privacy consent could not be saved/);
  failFlush = false;
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
});

test('clear removes all recorded consent evidence', () => {
  values.clear();
  PrivacyConsentStore.acceptCurrent({}, 1793228400000);
  PrivacyConsentStore.clear({});
  assert.equal(PrivacyConsentStore.hasCurrentConsent({}), false);
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
