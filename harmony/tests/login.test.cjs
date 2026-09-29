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
let generated = 0;
let failFlush = false;
const uuid = '12345678-1234-4123-8123-123456789abc';
const store = {
  getSync(key, defaultValue) { return values.get(key) ?? defaultValue; },
  putSync(key, value) { values.set(key, value); },
  flushSync() { flushes++; if (failFlush) throw new Error('disk unavailable'); }
};
const mocks = {
  '@kit.ArkData': { preferences: { getPreferencesSync() { return store; } } },
  '@kit.ArkTS': { util: { generateRandomUUID() { generated++; return uuid; } } }
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
const { PhoneLoginPolicy } = require('../entry/src/main/ets/auth/PhoneLoginPolicy.ets');
const { DeviceIdentityStore } = require('../entry/src/main/ets/storage/DeviceIdentityStore.ets');

test('phone input is normalized to the backend E.164 contract', () => {
  for (const value of ['13800138000', '86 13800138000', '+86 138-0013-8000', '008613800138000']) {
    assert.equal(PhoneLoginPolicy.normalizePhone(value), '+8613800138000');
  }
  for (const value of ['', '123', '23800138000', '1380013800a']) {
    assert.equal(PhoneLoginPolicy.normalizePhone(value), undefined);
  }
  assert.equal(PhoneLoginPolicy.sanitizeCode('1a2-3 4 5 6 7'), '123456');
  assert.equal(PhoneLoginPolicy.validCode('123456'), true);
  assert.equal(PhoneLoginPolicy.validCode('12345'), false);
});

test('installation identity is random once and persisted for later launches', () => {
  values.clear();
  generated = 0;
  flushes = 0;
  assert.equal(DeviceIdentityStore.getOrCreate({}), uuid);
  assert.equal(DeviceIdentityStore.getOrCreate({}), uuid);
  assert.equal(generated, 1);
  assert.equal(flushes, 1);
});

test('failed identity persistence cannot silently invent a different device', () => {
  values.clear();
  failFlush = true;
  assert.throws(() => DeviceIdentityStore.getOrCreate({}), /Installation identity is unavailable/);
  failFlush = false;
});
