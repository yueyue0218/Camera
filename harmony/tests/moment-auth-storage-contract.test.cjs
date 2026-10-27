// C owner handoff: execute the real shared store against the documented native
// encrypted/non-encrypted query partitions. No real credential is used.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets/storage');

function setup() {
  const Tag = Object.fromEntries(['ALIAS', 'SECRET', 'RETURN_TYPE', 'RETURN_LIMIT', 'ACCESSIBILITY',
    'AUTH_TYPE', 'SYNC_TYPE', 'REQUIRE_ATTR_ENCRYPTED', 'CONFLICT_RESOLUTION'].map(key => [key, key]));
  const records = new Map();
  // The native default is false; an omitted flag cannot find encrypted records.
  const key = attributes => `${attributes.get(Tag.REQUIRE_ATTR_ENCRYPTED) === true}:${
    Buffer.from(attributes.get(Tag.ALIAS)).toString('hex')}`;
  const asset = { Tag, ReturnType: { ALL: 0 }, Accessibility: { DEVICE_FIRST_UNLOCKED: 1 },
    AuthType: { NONE: 0 }, SyncType: { NEVER: 0 }, ConflictResolution: { OVERWRITE: 0 },
    ErrorCode: { NOT_FOUND: 24000002 },
    async add(attributes) { records.set(key(attributes), new Map(attributes)); },
    async query(query) {
      const value = records.get(key(query));
      if (!value) throw { code: 24000002 };
      return [new Map(value)];
    },
    async remove(query) { if (!records.delete(key(query))) throw { code: 24000002 }; }
  };
  class Encoder { encodeInto(text) { return new TextEncoder().encode(text); } }
  const mocks = { '@kit.AssetStoreKit': { asset }, '@kit.ArkTS': { util: {
    TextEncoder: Encoder, TextDecoder: { create: () => ({
      decodeToString: bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    }) }
  } }, '@kit.BasicServicesKit': { BusinessError: class extends Error {} } };
  function compile(name) {
    const filename = path.join(root, name + '.ets');
    const source = fs.readFileSync(filename, 'utf8');
    const loaded = new Module(filename, module);
    loaded.filename = filename; loaded.paths = module.paths;
    loaded.require = name => {
      if (mocks[name]) return mocks[name];
      if (name === './CredentialStore') return compile('CredentialStore');
      throw new Error('Unexpected shared store dependency: ' + name);
    };
    loaded._compile(ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021
    } }).outputText, filename);
    return loaded.exports;
  }
  const { AssetCredentialStore } = compile('AssetCredentialStore');
  const hasEncrypted = namespace => records.has('true:' + Buffer.from(namespace + ':refresh-token').toString('hex'));
  return { AssetCredentialStore, hasEncrypted };
}

test('shared load can retrieve a credential written to the encrypted partition', async () => {
  const { AssetCredentialStore } = setup();
  const store = new AssetCredentialStore('dev', 'portra:dev');
  await store.save({ environment: 'dev', refreshToken: 'unit-fixture-only' });
  assert.deepEqual(await store.load(), { environment: 'dev', refreshToken: 'unit-fixture-only' });
});

test('shared clear removes its encrypted credential without removing another environment', async () => {
  const { AssetCredentialStore, hasEncrypted } = setup();
  const dev = new AssetCredentialStore('dev', 'portra:dev');
  await dev.save({ environment: 'dev', refreshToken: 'unit-dev-only' });
  await new AssetCredentialStore('staging', 'portra:staging').save({
    environment: 'staging', refreshToken: 'unit-staging-only'
  });
  await dev.clear();
  assert.equal(hasEncrypted('portra:dev'), false, 'sign-out must actually delete the encrypted credential');
  assert.equal(hasEncrypted('portra:staging'), true, 'do not remove another environment');
  await dev.clear();
});
