// Host-side tests for session state and AssetStore mapping; no real token is used.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const sourceRoot = path.resolve(__dirname, '../entry/src/main/ets');
const calls = [];
const http = {
  RequestMethod: { GET: 'GET' }, HttpDataType: { STRING: 1 },
  createHttp() {
    const call = { destroyed: 0 };
    calls.push(call);
    return {
      request(url, options) {
        Object.assign(call, { url, options });
        return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
      },
      destroy() { call.destroyed++; }
    };
  }
};
const Tag = {
  SECRET: 1, ALIAS: 2, ACCESSIBILITY: 3, AUTH_TYPE: 4, SYNC_TYPE: 5,
  REQUIRE_ATTR_ENCRYPTED: 6, CONFLICT_RESOLUTION: 7, RETURN_TYPE: 8,
  RETURN_LIMIT: 9, IS_PERSISTENT: 10
};
const assets = new Map();
const assetCalls = { add: [], query: [], remove: [] };
function aliasKey(bytes) { return Buffer.from(bytes).toString('hex'); }
const asset = {
  Tag,
  Accessibility: { DEVICE_FIRST_UNLOCKED: 1 }, AuthType: { NONE: 0 },
  SyncType: { NEVER: 0 }, ConflictResolution: { OVERWRITE: 0 }, ReturnType: { ALL: 0 },
  ErrorCode: { NOT_FOUND: 24000002 },
  async add(attributes) {
    assetCalls.add.push(attributes);
    assets.set(aliasKey(attributes.get(Tag.ALIAS)), new Map(attributes));
  },
  async query(query) {
    assetCalls.query.push(query);
    const record = assets.get(aliasKey(query.get(Tag.ALIAS)));
    if (!record) throw { code: 24000002 };
    return [new Map(record)];
  },
  async remove(query) {
    assetCalls.remove.push(query);
    const key = aliasKey(query.get(Tag.ALIAS));
    if (!assets.delete(key)) throw { code: 24000002 };
  }
};
class ArkTextEncoder { encodeInto(value = '') { return new TextEncoder().encode(value); } }
class ArkTextDecoder {
  static create() { return new ArkTextDecoder(); }
  decodeToString(value) { return new TextDecoder('utf-8', { fatal: true }).decode(value); }
}
const mocks = {
  '@kit.NetworkKit': { http }, '@kit.AssetStoreKit': { asset },
  '@kit.ArkTS': { util: { TextEncoder: ArkTextEncoder, TextDecoder: ArkTextDecoder } },
  '@kit.BasicServicesKit': { BusinessError: class BusinessError extends Error {} }
};
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot + path.sep));
  const originalRequire = module.require.bind(module);
  module.require = name => mocks[name] || originalRequire(name);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};

const { EnvironmentName } = require('../entry/src/main/ets/common/config/EnvironmentConfig.ets');
const { AuthStatus, AuthSessionManager } = require('../entry/src/main/ets/auth/AuthSessionManager.ets');
const { CredentialOperation, CredentialStoreError } =
  require('../entry/src/main/ets/storage/CredentialStore.ets');
const { AssetCredentialStore } = require('../entry/src/main/ets/storage/AssetCredentialStore.ets');
const { AuthInterceptor } = require('../entry/src/main/ets/network/AuthInterceptor.ets');
const { HttpClient } = require('../entry/src/main/ets/network/HttpClient.ets');

class MemoryCredentialStore {
  constructor(credential = null) {
    this.credential = credential;
    this.clearCalls = 0;
    this.loadError = null;
    this.saveError = null;
    this.clearError = null;
    this.clearBarrier = null;
  }
  async load() { if (this.loadError) throw this.loadError; return this.credential; }
  async save(credential) {
    if (this.saveError) throw this.saveError;
    this.credential = credential;
  }
  async clear() {
    this.clearCalls++;
    if (this.clearBarrier) await this.clearBarrier;
    if (this.clearError) throw this.clearError;
    this.credential = null;
  }
}
function tokenController() {
  return {
    token: '', clearCalls: 0,
    setAccessToken(value) { this.token = value.trim(); },
    clearAccessToken() { this.token = ''; this.clearCalls++; }
  };
}

test('Asset Store keeps an environment-scoped, local, encrypted token record', async () => {
  assets.clear();
  assetCalls.add.length = assetCalls.query.length = assetCalls.remove.length = 0;
  const dev = new AssetCredentialStore('dev', 'portra:dev');
  await dev.save({ accessToken: ' secret-token ', environment: 'dev' });
  const added = assetCalls.add[0];
  assert.equal(added.get(Tag.ACCESSIBILITY), asset.Accessibility.DEVICE_FIRST_UNLOCKED);
  assert.equal(added.get(Tag.SYNC_TYPE), asset.SyncType.NEVER);
  assert.equal(added.get(Tag.REQUIRE_ATTR_ENCRYPTED), true);
  assert.equal(added.has(Tag.IS_PERSISTENT), false);
  assert.deepEqual(await dev.load(), { accessToken: 'secret-token', environment: 'dev' });
  assert.equal(await new AssetCredentialStore('staging', 'portra:staging').load(), null);
  await dev.clear();
  await dev.clear();
  assert.equal(await dev.load(), null);
});

test('Asset Store rejects cross-environment and empty credentials', async () => {
  const store = new AssetCredentialStore('dev', 'portra:dev');
  for (const credential of [{ accessToken: 'token', environment: 'staging' },
    { accessToken: ' ', environment: 'dev' }]) {
    await assert.rejects(store.save(credential), error =>
      error instanceof CredentialStoreError && error.operation === CredentialOperation.SAVE);
  }
});

test('restore accepts only a valid credential from the current environment', async () => {
  const controller = tokenController();
  const store = new MemoryCredentialStore({ accessToken: 'token', environment: 'dev' });
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV);
  await manager.restore(manager.beginRestore());
  assert.equal(manager.getStatus(), AuthStatus.AUTHENTICATED);
  assert.equal(controller.token, 'token');
  store.credential = { accessToken: 'other-token', environment: 'staging' };
  await manager.restore(manager.beginRestore());
  assert.equal(manager.getStatus(), AuthStatus.GUEST);
  assert.equal(controller.token, '');
  assert.equal(manager.getCredentialError().operation, CredentialOperation.LOAD);
});

test('storage failures never create an in-memory authenticated session', async () => {
  const controller = tokenController();
  const store = new MemoryCredentialStore();
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV);
  store.loadError = new CredentialStoreError(CredentialOperation.LOAD, 24000001);
  await manager.restore(manager.beginRestore());
  assert.equal(manager.getStatus(), AuthStatus.GUEST);
  assert.equal(manager.getCredentialError().code, 24000001);
  store.loadError = null;
  store.saveError = new CredentialStoreError(CredentialOperation.SAVE, 24000008);
  assert.equal(await manager.signIn('token'), false);
  assert.equal(manager.isAuthenticated(), false);
  assert.equal(controller.token, '');
});

test('sign out clears local authentication even when secure deletion fails', async () => {
  const controller = tokenController();
  const store = new MemoryCredentialStore();
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV);
  assert.equal(await manager.signIn('token'), true);
  store.clearError = new CredentialStoreError(CredentialOperation.CLEAR, 24000008);
  assert.equal(await manager.signOut(), false);
  assert.equal(manager.getStatus(), AuthStatus.GUEST);
  assert.equal(manager.getSession(), null);
  assert.equal(controller.token, '');
  assert.equal(manager.getCredentialError().operation, CredentialOperation.CLEAR);
});

test('concurrent expiration clears the credential once', async () => {
  let releaseClear;
  const controller = tokenController();
  const store = new MemoryCredentialStore();
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV);
  await manager.signIn('token');
  store.clearBarrier = new Promise(resolve => { releaseClear = resolve; });
  const first = manager.markExpired();
  const second = manager.markExpired();
  assert.equal(first, second);
  assert.equal(store.clearCalls, 1);
  assert.equal(manager.getStatus(), AuthStatus.EXPIRED);
  assert.equal(controller.token, '');
  releaseClear();
  assert.equal(await first, true);
});

test('401 and 40101 expire a shared HTTP session; 403 does not', async () => {
  for (const response of [
    { responseCode: 401, result: '' },
    { responseCode: 200, result: JSON.stringify({ code: 40101, message: 'expired', data: null }) }
  ]) {
    const store = new MemoryCredentialStore();
    const interceptor = new AuthInterceptor();
    let manager;
    const handler = { async onExpired() { await manager.markExpired(); } };
    const client = new HttpClient(interceptor, handler);
    manager = new AuthSessionManager(client, store, EnvironmentName.DEV);
    await manager.signIn('token');
    const request = client.get('/private');
    calls.at(-1).resolve(response);
    await assert.rejects(request, error => error.httpStatus === 401 || error.businessCode === 40101);
    assert.equal(manager.getStatus(), AuthStatus.EXPIRED);
    assert.equal(store.clearCalls, 1);
  }
  const store = new MemoryCredentialStore();
  const interceptor = new AuthInterceptor();
  let manager;
  const handler = { async onExpired() { await manager.markExpired(); } };
  const client = new HttpClient(interceptor, handler);
  manager = new AuthSessionManager(client, store, EnvironmentName.DEV);
  await manager.signIn('token');
  const request = client.get('/private');
  calls.at(-1).resolve({ responseCode: 403, result: '' });
  await assert.rejects(request, error => error.httpStatus === 403);
  assert.equal(manager.getStatus(), AuthStatus.AUTHENTICATED);
  assert.equal(store.clearCalls, 0);
});

test('changing session invalidates the old account request', async () => {
  const store = new MemoryCredentialStore();
  const client = new HttpClient();
  const manager = new AuthSessionManager(client, store, EnvironmentName.DEV);
  await manager.signIn('old-token');
  const oldRequest = client.get('/private', 'account-data');
  const oldCall = calls.at(-1);
  await manager.signIn('new-token');
  oldCall.resolve({ responseCode: 200,
    result: JSON.stringify({ code: 200, message: 'success', data: 'old-account-data' }) });
  await assert.rejects(oldRequest, error => error.kind === 'stale');
  const currentRequest = client.get('/private', 'account-data');
  assert.equal(calls.at(-1).options.header.Authorization, 'Bearer new-token');
  calls.at(-1).resolve({ responseCode: 200,
    result: JSON.stringify({ code: 200, message: 'success', data: 'new-account-data' }) });
  assert.equal(await currentRequest, 'new-account-data');
});
