// Host-side logic tests. Only NetworkKit is replaced; no backend or device is used.
// Run with DEVECO_SDK_HOME set, using DevEco's bundled Node.
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
      // Deliberately allow late completion after destroy, to exercise race protection.
      destroy() { call.destroyed++; }
    };
  }
};
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot + path.sep));
  const originalRequire = module.require.bind(module);
  module.require = name => name === '@kit.NetworkKit' ? { http } : originalRequire(name);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};
const { HttpClient } = require('../entry/src/main/ets/network/HttpClient.ets');
const { ApiService } = require('../entry/src/main/ets/network/ApiService.ets');
const { EnvironmentConfig } = require('../entry/src/main/ets/common/config/EnvironmentConfig.ets');
function complete(call, data = null) {
  call.resolve({ responseCode: 200, result: JSON.stringify({ code: 200, message: 'success', data }) });
}
function hasKind(kind) { return error => error.kind === kind; }

test('valid payload and explicit null success are preserved', async () => {
  const client = new HttpClient();
  for (const data of [{ records: [], page: 1, size: 10, total: 0 }, null]) {
    const result = client.get('/test');
    complete(calls.at(-1), data);
    assert.deepEqual(await result, data);
  }
});

for (const result of ['null', '[]', '{}', 'true', '<html>failure</html>',
  '{"code":"200","message":"success","data":[]}', '{"code":200,"message":"success"}',
  '{"code":200,"data":[]}', new ArrayBuffer(4)]) {
  test(`malformed envelope is a parse error: ${String(result)}`, async () => {
    const promise = new HttpClient().get('/test');
    const call = calls.at(-1);
    call.resolve({ responseCode: 200, result });
    await assert.rejects(promise, hasKind('parse'));
    assert.equal(call.destroyed, 1);
  });
}

test('HTTP failures are checked before parsing the body', async () => {
  for (const status of [401, 403, 404, 503]) {
    const promise = new HttpClient().get('/test');
    calls.at(-1).resolve({ responseCode: status, result: '<html>error</html>' });
    await assert.rejects(promise, error => error.kind === 'http' && error.httpStatus === status);
  }
});

test('business failures retain codes and hide internal SQL details', async () => {
  for (const code of [40101, 40301, 40401, 50001]) {
    const promise = new HttpClient().get('/test');
    calls.at(-1).resolve({ responseCode: 200,
      result: JSON.stringify({ code, message: 'SQL internal database details', data: null }) });
    await assert.rejects(promise, error => error.kind === 'business' &&
      error.businessCode === code && !error.message.includes('SQL'));
  }
});

test('timeout and connection failure are distinct, cleaned up, and never retried', async () => {
  for (const [code, kind] of [[2300028, 'timeout'], [2300007, 'network']]) {
    const before = calls.length;
    const promise = new HttpClient().get('/test');
    const call = calls.at(-1);
    call.reject({ code });
    await assert.rejects(promise, hasKind(kind));
    assert.equal(call.destroyed, 1);
    assert.equal(calls.length, before + 1);
  }
});

test('same-key late success cannot overwrite a newer result', async () => {
  const client = new HttpClient();
  const old = client.get('/old', 'list');
  const oldCall = calls.at(-1);
  const current = client.get('/new', 'list');
  complete(calls.at(-1), 'new');
  complete(oldCall, 'old');
  assert.equal(await current, 'new');
  await assert.rejects(old, hasKind('stale'));
});

test('explicit cancel suppresses a late transport error and leaves other keys alone', async () => {
  const client = new HttpClient();
  const old = client.get('/old', 'first');
  const oldCall = calls.at(-1);
  const other = client.get('/other', 'second');
  const otherCall = calls.at(-1);
  client.cancelRequest('first');
  oldCall.reject({ code: 2300028 });
  complete(otherCall, 'other');
  await assert.rejects(old, hasKind('stale'));
  assert.equal(await other, 'other');
  assert.equal(oldCall.destroyed, 1);
});

test('token replacement and clearing invalidate in-flight results', async () => {
  const client = new HttpClient();
  for (const change of [() => client.setAccessToken('test-token'), () => client.clearAccessToken()]) {
    const result = client.get('/private');
    const call = calls.at(-1);
    change();
    complete(call);
    await assert.rejects(result, hasKind('stale'));
  }
});

test('public lists omit Bearer, use exact backend paths, and disable redirects/cache', async () => {
  const client = new HttpClient();
  client.setAccessToken('test-token');
  const api = new ApiService(client);
  for (const [invoke, suffix] of [[() => api.listDemands(2, 5), '/demands?page=2&size=5'],
    [() => api.listServicePackages(), '/service-packages?page=1&size=10']]) {
    const result = invoke();
    const call = calls.at(-1);
    assert.equal(call.url, EnvironmentConfig.DEV.baseUrl + suffix);
    assert.equal(call.options.header.Authorization, undefined);
    assert.equal(call.options.maxRedirects, 0);
    assert.equal(call.options.usingCache, false);
    assert.equal(call.options.connectTimeout, 10000);
    assert.equal(call.options.readTimeout, 15000);
    complete(call, { records: [], page: 1, size: 10, total: 0 });
    await result;
  }
  const result = client.get('/private');
  assert.equal(calls.at(-1).options.header.Authorization, 'Bearer test-token');
  complete(calls.at(-1));
  await result;
});

test('absolute URLs and ambiguous paths are rejected before network access', async () => {
  const before = calls.length;
  for (const url of ['https://example.com', '//example.com', '/bad\\path', '/bad path', '/bad#fragment']) {
    await assert.rejects(new HttpClient().get(url), hasKind('config'));
  }
  assert.equal(calls.length, before);
});

test('environment validation rejects unapproved protocols, credentials and non-dev HTTP', () => {
  assert.equal(EnvironmentConfig.isUsable(), true);
  assert.equal(EnvironmentConfig.isUsable(EnvironmentConfig.STAGING), false);
  assert.equal(EnvironmentConfig.isUsable(EnvironmentConfig.PRODUCTION), false);
  for (const baseUrl of ['ftp://host', 'host', 'HTTPS://host', 'https://user:password@host', 'https://host?x=1']) {
    assert.equal(EnvironmentConfig.isUsable({ ...EnvironmentConfig.DEV, baseUrl }), false);
  }
  assert.equal(EnvironmentConfig.isUsable({ ...EnvironmentConfig.STAGING,
    enabled: true, allowsPlainHttp: true, baseUrl: 'http://example.com' }), false);
  assert.equal(EnvironmentConfig.isUsable({ ...EnvironmentConfig.STAGING,
    enabled: true, baseUrl: 'https://example.com' }), true);
});
