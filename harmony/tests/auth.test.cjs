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
  RequestMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE', PATCH: 'PATCH' }, HttpDataType: { STRING: 1 },
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
let assetQueryError = null;
const preferenceValues = new Map();
const preferenceStore = {
  getSync(key, defaultValue) { return preferenceValues.get(key) ?? defaultValue; },
  putSync(key, value) { preferenceValues.set(key, value); },
  deleteSync(key) { preferenceValues.delete(key); },
  flushSync() {}
};
let assetAddError = null;
let assetRemoveError = null;
function aliasKey(bytes) { return Buffer.from(bytes).toString('hex'); }
const asset = {
  Tag,
  Accessibility: { DEVICE_FIRST_UNLOCKED: 1 }, AuthType: { NONE: 0 },
  SyncType: { NEVER: 0 }, ConflictResolution: { OVERWRITE: 0 }, ReturnType: { ALL: 0 },
  ErrorCode: { NOT_FOUND: 24000002 },
  async add(attributes) {
    assetCalls.add.push(attributes);
    if (assetAddError !== null) throw assetAddError;
    assets.set(aliasKey(attributes.get(Tag.ALIAS)), new Map(attributes));
  },
  async query(query) {
    assetCalls.query.push(query);
    if (assetQueryError !== null) throw assetQueryError;
    const record = assets.get(aliasKey(query.get(Tag.ALIAS)));
    if (!record) throw { code: 24000002 };
    return [new Map(record)];
  },
  async remove(query) {
    assetCalls.remove.push(query);
    if (assetRemoveError !== null) throw assetRemoveError;
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
  '@kit.ArkData': { preferences: { getPreferencesSync() { return preferenceStore; } } },
  '@kit.ArkTS': { util: {
    TextEncoder: ArkTextEncoder, TextDecoder: ArkTextDecoder,
    generateRandomUUID() { return '12345678-1234-4123-8123-123456789abc'; }
  } },
  '@kit.BasicServicesKit': { BusinessError: class BusinessError extends Error {} }
};
class TestBuildProfile {
  static PORTRA_ENVIRONMENT = 'dev';
  static PORTRA_BASE_URL = 'http://192.168.1.23:8080';
}
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot + path.sep));
  const originalRequire = module.require.bind(module);
  module.require = name => {
    if (mocks[name]) return mocks[name];
    if (name.endsWith('/BuildProfile')) return { default: TestBuildProfile };
    return originalRequire(name);
  };
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
const { AppClient } = require('../entry/src/main/ets/app/AppClient.ets');
const { ErrorKind, ErrorMapper, PortraError } = require('../entry/src/main/ets/network/ErrorMapper.ets');

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
    replaceAccessToken(value) { this.token = value.trim(); },
    clearAccessToken() { this.token = ''; this.clearCalls++; }
  };
}
function nativeSessionApi(accessToken = 'restored-access', nextRefreshToken = 'rotated-refresh') {
  return {
    refreshCalls: [], logoutCalls: 0,
    async refresh(refreshToken) {
      this.refreshCalls.push(refreshToken);
      return { accessToken, refreshToken: nextRefreshToken, userId: 1, nickname: '用户',
        role: 'CUSTOMER', adminCapable: false, newUser: false };
    },
    async logout() { this.logoutCalls++; return true; }
  };
}

test('role notification waits for in-flight renewal and preserves the rotated credential', async () => {
  let resolve;
  const controller = tokenController(), store = new MemoryCredentialStore();
  const api = nativeSessionApi();
  api.refresh = () => new Promise(done => { resolve = done; });
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV, api);
  await manager.signIn('test-access', 'test-refresh');
  const epoch = manager.getSessionVersion();
  const renewal = manager.refreshAccessToken();
  await new Promise(setImmediate);
  const changed = manager.notifyIdentityChanged();
  assert.equal(manager.getSessionVersion(), epoch);
  resolve({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  assert.equal(await renewal, true); assert.equal(await changed, true);
  assert.equal(manager.getSessionVersion(), epoch + 1);
  assert.equal(controller.token, 'new-access'); assert.equal(store.credential.refreshToken, 'new-refresh');
});

test('logout while role notification waits for renewal cannot resurrect a session', async () => {
  let resolve;
  const store = new MemoryCredentialStore(), api = nativeSessionApi();
  api.refresh = () => new Promise(done => { resolve = done; });
  const manager = new AuthSessionManager(tokenController(), store, EnvironmentName.DEV, api);
  await manager.signIn('test-access', 'test-refresh');
  const renewal = manager.refreshAccessToken();
  const rejected = assert.rejects(renewal);
  await new Promise(setImmediate);
  const changed = manager.notifyIdentityChanged();
  await manager.signOut();
  resolve({ accessToken: 'old-access', refreshToken: 'old-refresh' });
  await rejected; assert.equal(await changed, false);
  assert.equal(manager.isAuthenticated(), false); assert.equal(store.credential, null);
});

test('Asset Store keeps an environment-scoped, local, encrypted token record', async () => {
  assets.clear();
  assetCalls.add.length = assetCalls.query.length = assetCalls.remove.length = 0;
  const dev = new AssetCredentialStore('dev', 'portra:dev');
  await dev.save({ refreshToken: ' secret-token ', environment: 'dev' });
  const added = assetCalls.add[0];
  assert.equal(added.get(Tag.ACCESSIBILITY), asset.Accessibility.DEVICE_FIRST_UNLOCKED);
  assert.equal(added.get(Tag.SYNC_TYPE), asset.SyncType.NEVER);
  assert.equal(added.get(Tag.REQUIRE_ATTR_ENCRYPTED), true);
  assert.equal(added.has(Tag.IS_PERSISTENT), false);
  assert.deepEqual(await dev.load(), { refreshToken: 'secret-token', environment: 'dev' });
  assert.equal(await new AssetCredentialStore('staging', 'portra:staging').load(), null);
  await dev.clear();
  await dev.clear();
  assert.equal(await dev.load(), null);
});

test('Asset Store rejects cross-environment and empty credentials', async () => {
  const store = new AssetCredentialStore('dev', 'portra:dev');
  for (const credential of [{ refreshToken: 'token', environment: 'staging' },
    { refreshToken: ' ', environment: 'dev' }]) {
    await assert.rejects(store.save(credential), error =>
      error instanceof CredentialStoreError && error.operation === CredentialOperation.SAVE);
  }
});

test('restore accepts only a valid credential from the current environment', async () => {
  const controller = tokenController();
  const store = new MemoryCredentialStore({ refreshToken: 'token', environment: 'dev' });
  const api = nativeSessionApi();
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV, api);
  await manager.restore(manager.beginRestore());
  assert.equal(manager.getStatus(), AuthStatus.AUTHENTICATED);
  assert.equal(controller.token, 'restored-access');
  assert.deepEqual(api.refreshCalls, ['token']);
  assert.deepEqual(store.credential, { refreshToken: 'rotated-refresh', environment: 'dev' });
  store.credential = { refreshToken: 'other-token', environment: 'staging' };
  await manager.restore(manager.beginRestore());
  assert.equal(manager.getStatus(), AuthStatus.GUEST);
  assert.equal(controller.token, '');
  assert.equal(manager.getCredentialError().operation, CredentialOperation.LOAD);
});

test('temporary refresh failure keeps the stored credential for a later retry', async () => {
  const store = new MemoryCredentialStore({ refreshToken: 'stored-refresh', environment: 'dev' });
  const controller = tokenController();
  const api = nativeSessionApi();
  api.refresh = async () => { throw new PortraError(ErrorKind.NETWORK, 'offline'); };
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV, api);
  await manager.restore(manager.beginRestore());
  assert.equal(manager.getStatus(), AuthStatus.GUEST);
  assert.deepEqual(store.credential, { refreshToken: 'stored-refresh', environment: 'dev' });
  assert.equal(store.clearCalls, 0);

  api.refresh = nativeSessionApi().refresh;
  await manager.restore(manager.beginRestore());
  assert.equal(manager.getStatus(), AuthStatus.AUTHENTICATED);
  assert.equal(store.credential.refreshToken, 'rotated-refresh');
});

test('storage failures never create an in-memory authenticated session', async () => {
  const controller = tokenController();
  const store = new MemoryCredentialStore();
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV, nativeSessionApi());
  store.loadError = new CredentialStoreError(CredentialOperation.LOAD, 24000001);
  await manager.restore(manager.beginRestore());
  assert.equal(manager.getStatus(), AuthStatus.GUEST);
  assert.equal(manager.getCredentialError().code, 24000001);
  store.loadError = null;
  store.saveError = new CredentialStoreError(CredentialOperation.SAVE, 24000008);
  assert.equal(await manager.signIn('token', 'refresh'), false);
  assert.equal(manager.isAuthenticated(), false);
  assert.equal(controller.token, '');
});

test('application session restore deduplicates concurrency and retries after a transient failure', async () => {
  assets.clear();
  assetQueryError = { code: 24000001 };
  const first = AppClient.shared.restoreSession();
  const concurrent = AppClient.shared.restoreSession();
  assert.equal(first, concurrent);
  await first;
  assert.equal(AppClient.shared.sessionManager.getStatus(), AuthStatus.GUEST);
  assert.equal(AppClient.shared.sessionManager.getCredentialError().operation, CredentialOperation.LOAD);

  assetQueryError = null;
  const store = new AssetCredentialStore('dev', 'portra:dev');
  await store.save({ refreshToken: 'retry-token', environment: 'dev' });
  const retry = AppClient.shared.sessionManager.restore(AppClient.shared.sessionManager.beginRestore());
  assert.notEqual(retry, first);
  const previousCallCount = calls.length;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, previousCallCount + 1, 'explicit retry must reach the refresh endpoint');
  calls.at(-1).resolve({ responseCode: 200, result: JSON.stringify({ code: 200, message: 'success', data: {
    accessToken: 'retry-access', refreshToken: 'retry-refresh', userId: 1, nickname: '用户',
    role: 'CUSTOMER', adminCapable: false, newUser: false
  } }) });
  await retry;
  assert.equal(AppClient.shared.sessionManager.getStatus(), AuthStatus.AUTHENTICATED);
  assert.equal(AppClient.shared.sessionManager.getSession().accessToken, 'retry-access');
  const afterRestore = calls.length;
  await AppClient.shared.restoreSession();
  assert.equal(calls.length, afterRestore, 'an authenticated session must not rotate again');
  const signOut = AppClient.shared.sessionManager.signOut();
  calls.at(-1).resolve({ responseCode: 200,
    result: JSON.stringify({ code: 200, message: 'success', data: true }) });
  await signOut;
});

test('sign out clears local authentication even when secure deletion fails', async () => {
  const controller = tokenController();
  const store = new MemoryCredentialStore();
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV);
  assert.equal(await manager.signIn('token', 'refresh'), true);
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
  await manager.signIn('token', 'refresh');
  store.clearCalls = 0;
  store.clearBarrier = new Promise(resolve => { releaseClear = resolve; });
  const first = manager.markExpired();
  const second = manager.markExpired();
  assert.equal(first, second);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(store.clearCalls, 1);
  assert.equal(manager.getStatus(), AuthStatus.EXPIRED);
  assert.equal(controller.token, '');
  releaseClear();
  assert.equal(await first, true);
  assert.equal(await second, true);
});

test('401 and 40101 try refresh and expire a rejected session; 403 does not refresh', async () => {
  for (const response of [
    { responseCode: 401, result: '' },
    { responseCode: 200, result: JSON.stringify({ code: 40101, message: 'expired', data: null }) }
  ]) {
    const store = new MemoryCredentialStore();
    const interceptor = new AuthInterceptor();
    let manager;
    const handler = { refreshSession() { return manager.refreshAccessToken(); } };
    const client = new HttpClient(interceptor, handler);
    const api = nativeSessionApi();
    api.refresh = async function (token) {
      this.refreshCalls.push(token);
      throw ErrorMapper.fromHttpStatus(401);
    };
    manager = new AuthSessionManager(client, store, EnvironmentName.DEV, api);
    await manager.signIn('token', 'refresh');
    const request = client.get('/private');
    calls.at(-1).resolve(response);
    await assert.rejects(request, error => ErrorMapper.isStale(error));
    assert.equal(manager.getStatus(), AuthStatus.EXPIRED);
    assert.equal(store.clearCalls, 2, 'sign-in clears the previous credential, expiration clears the rejected one');
    assert.deepEqual(api.refreshCalls, ['refresh']);
    assert.equal(store.credential, null);
    assert.equal(interceptor.authorizationHeader(), '');
  }
  const store = new MemoryCredentialStore();
  const interceptor = new AuthInterceptor();
  let manager;
  const handler = { refreshSession() { return manager.refreshAccessToken(); } };
  const client = new HttpClient(interceptor, handler);
  const api = nativeSessionApi();
  manager = new AuthSessionManager(client, store, EnvironmentName.DEV, api);
  await manager.signIn('token', 'refresh');
  const request = client.get('/private');
  calls.at(-1).resolve({ responseCode: 403, result: '' });
  await assert.rejects(request, error => error.httpStatus === 403);
  assert.equal(manager.getStatus(), AuthStatus.AUTHENTICATED);
  assert.equal(store.clearCalls, 1);
  assert.deepEqual(api.refreshCalls, []);
});

test('concurrent expiration waits for the same failed deletion result', async () => {
  const store = new MemoryCredentialStore();
  const controller = tokenController();
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV);
  await manager.signIn('token', 'refresh');
  store.clearCalls = 0;
  let release;
  store.clearBarrier = new Promise(resolve => { release = resolve; });
  store.clearError = new CredentialStoreError(CredentialOperation.CLEAR, 24000008);
  const first = manager.markExpired();
  const second = manager.markExpired();
  let settled = false;
  second.then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'a concurrent caller must not report success while deletion is pending');
  assert.equal(controller.token, '');
  assert.equal(manager.getStatus(), AuthStatus.EXPIRED);
  assert.equal(store.clearCalls, 1);
  release();
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  assert.equal(await manager.markExpired(), false);
  assert.equal(manager.getCredentialError().code, 24000008);
});

test('an old expiration completion cannot expire a newer signed-in identity', async () => {
  const store = new MemoryCredentialStore();
  const controller = tokenController();
  const manager = new AuthSessionManager(controller, store, EnvironmentName.DEV);
  await manager.signIn('old', 'old-refresh');
  let release;
  store.clearBarrier = new Promise(resolve => { release = resolve; });
  const expired = manager.markExpired();
  await new Promise(resolve => setImmediate(resolve));
  const signIn = manager.signIn('new', 'new-refresh');
  release();
  assert.equal(await expired, false);
  assert.equal(await signIn, true);
  assert.equal(controller.token, 'new');
  assert.equal(store.credential.refreshToken, 'new-refresh');
  assert.equal(manager.getStatus(), AuthStatus.AUTHENTICATED);
  assert.equal(await manager.markExpired(), true);
  assert.equal(controller.token, '');
});

test('concurrent expired GETs share one rotation and retry with the new bearer', async () => {
  const store = new MemoryCredentialStore();
  const interceptor = new AuthInterceptor();
  let manager;
  const client = new HttpClient(interceptor, { refreshSession() { return manager.refreshAccessToken(); } });
  const api = nativeSessionApi();
  let finishRefresh;
  api.refresh = function (token) {
    this.refreshCalls.push(token);
    return new Promise(resolve => { finishRefresh = resolve; });
  };
  manager = new AuthSessionManager(client, store, EnvironmentName.DEV, api);
  await manager.signIn('old', 'refresh');
  const generation = manager.getSessionVersion();
  const start = calls.length;
  const a = client.get('/a');
  const b = client.get('/b');
  calls[start].resolve({ responseCode: 401, result: '' });
  calls[start + 1].resolve({ responseCode: 200,
    result: JSON.stringify({ code: 40101, message: 'expired', data: null }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(api.refreshCalls, ['refresh']);
  finishRefresh({ accessToken: 'rotated', refreshToken: 'rotated-refresh', userId: 1,
    nickname: '用户', role: 'CUSTOMER', adminCapable: false, newUser: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, start + 4);
  for (const call of calls.slice(start + 2)) {
    assert.equal(call.options.header.Authorization, 'Bearer rotated');
    call.resolve({ responseCode: 200,
      result: JSON.stringify({ code: 200, message: 'success', data: 'current' }) });
  }
  assert.deepEqual(await Promise.all([a, b]), ['current', 'current']);
  assert.equal(manager.getSessionVersion(), generation, 'rotation must not act as an identity switch');
  assert.equal(store.credential.refreshToken, 'rotated-refresh');
});

test('a recovered POST PUT DELETE or PATCH is never automatically replayed', async () => {
  for (const method of ['post', 'put', 'delete', 'patch']) {
    const store = new MemoryCredentialStore();
    let manager;
    const client = new HttpClient(new AuthInterceptor(), {
      refreshSession() { return manager.refreshAccessToken(); }
    });
    const api = nativeSessionApi();
    manager = new AuthSessionManager(client, store, EnvironmentName.DEV, api);
    await manager.signIn('old', 'refresh');
    const start = calls.length;
    const request = client[method]('/mutation');
    assert.equal(calls[start].options.method, method.toUpperCase());
    calls[start].resolve({ responseCode: 401, result: '' });
    await assert.rejects(request, error => error.kind === ErrorKind.BUSINESS && !ErrorMapper.isStale(error));
    assert.equal(calls.length, start + 1, method + ' must only send once');
    assert.deepEqual(api.refreshCalls, ['refresh']);
    assert.equal(manager.isAuthenticated(), true);
  }
});

test('changing session invalidates the old account request', async () => {
  const store = new MemoryCredentialStore();
  const client = new HttpClient();
  const manager = new AuthSessionManager(client, store, EnvironmentName.DEV);
  await manager.signIn('old-token', 'old-refresh');
  const oldRequest = client.get('/private', 'account-data');
  const oldCall = calls.at(-1);
  await manager.signIn('new-token', 'new-refresh');
  oldCall.resolve({ responseCode: 200,
    result: JSON.stringify({ code: 200, message: 'success', data: 'old-account-data' }) });
  await assert.rejects(oldRequest, error => error.kind === 'stale');
  const currentRequest = client.get('/private', 'account-data');
  assert.equal(calls.at(-1).options.header.Authorization, 'Bearer new-token');
  calls.at(-1).resolve({ responseCode: 200,
    result: JSON.stringify({ code: 200, message: 'success', data: 'new-account-data' }) });
  assert.equal(await currentRequest, 'new-account-data');
});

function freshAppClient() {
  const modulePath = require.resolve('../entry/src/main/ets/app/AppClient.ets');
  delete require.cache[modulePath];
  return require(modulePath).AppClient.shared;
}
function refreshedEnvelope(accessToken = 'rotated-access', refreshToken = 'rotated-refresh') {
  return { responseCode: 200, result: JSON.stringify({ code: 200, message: 'success', data: {
    accessToken, refreshToken, userId: 1, nickname: '用户', role: 'CUSTOMER', adminCapable: false, newUser: false
  } }) };
}

test('explicit restore retry persists an already rotated credential without sending the old refresh again', async () => {
  assets.clear();
  assetQueryError = assetAddError = assetRemoveError = null;
  const store = new AssetCredentialStore('dev', 'portra:dev');
  await store.save({ refreshToken: 'old-refresh', environment: 'dev' });
  const app = freshAppClient();
  const start = calls.length;
  const first = app.restoreSession();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, start + 1);
  assetAddError = { code: 24000008 };
  calls[start].resolve(refreshedEnvelope());
  await first;
  assert.equal(app.sessionManager.getStatus(), AuthStatus.GUEST);
  assert.equal(app.sessionManager.getCredentialError().operation, CredentialOperation.SAVE);
  assert.equal((await store.load()).refreshToken, 'old-refresh');
  assetAddError = null;
  const retry = app.restoreSession();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, start + 1, 'never rotate the already consumed refresh token again');
  await retry;
  assert.equal(app.sessionManager.getStatus(), AuthStatus.AUTHENTICATED);
  assert.equal(app.sessionManager.getSession().accessToken, 'rotated-access');
  assert.equal((await store.load()).refreshToken, 'rotated-refresh');
});

test('a lifecycle restore after failed logout deletion cannot restore the signed-out account', async () => {
  assets.clear();
  assetQueryError = assetAddError = assetRemoveError = null;
  const store = new AssetCredentialStore('dev', 'portra:dev');
  await store.save({ refreshToken: 'old-refresh', environment: 'dev' });
  const app = freshAppClient();
  const start = calls.length;
  const restore = app.restoreSession();
  await new Promise(resolve => setImmediate(resolve));
  calls[start].resolve(refreshedEnvelope());
  await restore;
  assetRemoveError = { code: 24000008 };
  try {
    assert.equal(await app.sessionManager.signOut(), false);
    assert.equal(app.sessionManager.getStatus(), AuthStatus.GUEST);
    calls.at(-1).resolve({ responseCode: 200,
      result: JSON.stringify({ code: 200, message: 'success', data: true }) });
    const beforeReappear = calls.length;
    const reappear = app.restoreSession();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, beforeReappear, 'returning to Index must not revive a signed-out account');
    await reappear;
    assert.equal(app.sessionManager.getSession(), null);
    assert.equal(app.sessionManager.getStatus(), AuthStatus.GUEST);
  } finally {
    assetRemoveError = null;
  }
});
test('a retried restore expires and deletes a credential rejected by the server', async () => {
  assets.clear();
  assetQueryError = assetAddError = assetRemoveError = null;
  const store = new AssetCredentialStore('dev', 'portra:dev');
  await store.save({ refreshToken: 'retry-refresh', environment: 'dev' });
  const app = freshAppClient();
  const start = calls.length;
  const first = app.restoreSession();
  await new Promise(resolve => setImmediate(resolve));
  calls[start].reject({ code: 2300007 });
  await first;
  assert.equal(app.sessionManager.getStatus(), AuthStatus.GUEST);
  const removals = assetCalls.remove.length;
  const retry = app.restoreSession();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, start + 2);
  calls[start + 1].resolve({ responseCode: 401, result: '' });
  await retry;
  assert.equal(app.sessionManager.getStatus(), AuthStatus.EXPIRED);
  assert.equal(app.sessionManager.getSession(), null);
  assert.equal(assetCalls.remove.length, removals + 1);
  assert.equal(await store.load(), null);
});

test('a retry that finds no credential clears the preceding storage error', async () => {
  assets.clear();
  assetQueryError = { code: 24000001 };
  assetAddError = assetRemoveError = null;
  const app = freshAppClient();
  await app.restoreSession();
  assert.equal(app.sessionManager.getCredentialError().operation, CredentialOperation.LOAD);
  assetQueryError = null;
  const before = calls.length;
  await app.restoreSession();
  assert.equal(app.sessionManager.getStatus(), AuthStatus.GUEST);
  assert.equal(app.sessionManager.getCredentialError(), null);
  assert.equal(calls.length, before);
});
