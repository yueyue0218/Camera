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
  RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }, HttpDataType: { STRING: 1, ARRAY_BUFFER: 2 },
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
class TestBuildProfile {
  static PORTRA_ENVIRONMENT = 'dev';
  static PORTRA_BASE_URL = 'http://192.168.1.23:8080';
}
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot + path.sep));
  const originalRequire = module.require.bind(module);
  module.require = name => {
    if (name === '@kit.NetworkKit') return { http };
    if (name.endsWith('/BuildProfile')) return { default: TestBuildProfile };
    return originalRequire(name);
  };
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

const { FileImageService } = require('../entry/src/main/ets/network/FileImageService.ets');
const { FileImagePolicy } = require('../entry/src/main/ets/common/components/ComponentPolicy.ets');
const tick = () => new Promise(resolve => setImmediate(resolve));
function binary(call, status = 200, type = 'image/jpeg', bytes = new ArrayBuffer(8)) {
  call.resolve({ responseCode: status, header: { 'Content-Type': type }, result: bytes });
}
function business(call, code) {
  binary(call, 200, 'application/json;charset=UTF-8',
    new TextEncoder().encode(JSON.stringify({code, message: '权限错误', data: null})).buffer);
}

test('file representations are binary, authenticated, relative and never cached or redirected', async () => {
  const client = new HttpClient(); client.setAccessToken('test-token');
  const service = new FileImageService(client);
  for (const variant of ['thumbnail', 'medium', 'original']) {
    const lease = service.acquire(27, variant); const call = calls.at(-1);
    assert.equal(call.url, `http://192.168.1.23:8080/files/27/${variant}`);
    assert.equal(call.options.expectDataType, http.HttpDataType.ARRAY_BUFFER);
    assert.equal(call.options.header.Authorization, 'Bearer test-token');
    assert.equal(call.options.usingCache, false); assert.equal(call.options.maxRedirects, 0);
    const bytes = new ArrayBuffer(12); binary(call, 200, 'image/png', bytes);
    assert.equal(await lease.promise, bytes); lease.release();
  }
});

test('shared in-flight bytes cancel only after the final consumer leaves; retry is fresh', async () => {
  const service = new FileImageService(new HttpClient()); const before = calls.length;
  const a = service.acquire(10, 'thumbnail'); const b = service.acquire(10, 'thumbnail');
  assert.equal(calls.length, before + 1); assert.equal(a.promise, b.promise);
  const call = calls.at(-1); a.release(); assert.equal(call.destroyed, 0);
  b.release(); assert.equal(call.destroyed, 1);
  const c = service.acquire(10, 'thumbnail'); binary(call);
  await assert.rejects(a.promise, hasKind('stale'));
  binary(calls.at(-1)); await c.promise; c.release();
});

test('identity changes invalidate bytes and notify mounted views; rotations do not', async () => {
  const client = new HttpClient(); client.setAccessToken('account-a');
  const service = new FileImageService(client); let changes = 0;
  const listener = () => changes++; service.observe(listener);
  const a = service.acquire(11, 'medium'); const old = calls.at(-1); const epoch = service.epoch();
  client.replaceAccessToken('rotated-a'); assert.equal(changes, 0); assert.equal(service.epoch(), epoch);
  client.setAccessToken('account-b'); assert.equal(changes, 1);
  const b = service.acquire(11, 'medium'); assert.notEqual(a.promise, b.promise);
  binary(old); await assert.rejects(a.promise, hasKind('stale'));
  assert.equal(calls.at(-1).options.header.Authorization, 'Bearer account-b');
  binary(calls.at(-1)); await b.promise;
  service.unobserve(listener); client.clearAccessToken(); assert.equal(changes, 1);
  a.release(); b.release();
});

test('HTTP and HTTP-200 business permission/missing errors remain distinct without retry', async () => {
  for (const code of [403, 404, 40301, 40401]) {
    const service = new FileImageService(new HttpClient()); const before = calls.length;
    const lease = service.acquire(8, 'medium');
    if (code > 1000) business(calls.at(-1), code); else binary(calls.at(-1), code);
    await assert.rejects(lease.promise, e => e.httpStatus === code || e.businessCode === code);
    assert.equal(calls.length, before + 1); lease.release();
  }
});

test('401 and 40101 share existing refresh and replay GET only once', async () => {
  for (const code of [401, 40101]) {
    let refreshes = 0; let client;
    client = new HttpClient(undefined, { async refreshSession() {
      refreshes++; client.replaceAccessToken('renewed'); return true;
    }});
    client.setAccessToken('expired'); const service = new FileImageService(client);
    const before = calls.length; const lease = service.acquire(9, 'thumbnail');
    if (code === 401) binary(calls.at(-1), code); else business(calls.at(-1), code);
    await tick(); assert.equal(refreshes, 1); assert.equal(calls.length, before + 2);
    assert.equal(calls.at(-1).options.header.Authorization, 'Bearer renewed');
    business(calls.at(-1), 40101);
    await assert.rejects(lease.promise, e => e.businessCode === 40101);
    assert.equal(refreshes, 1); lease.release();
  }
});

test('malformed, non-image, empty and oversized bodies never reach image decoding', async () => {
  for (const [mime, bytes] of [['text/html', new ArrayBuffer(8)], ['image/png', new ArrayBuffer(0)],
    ['image/png', new ArrayBuffer(32 * 1024 * 1024 + 1)], ['application/json', new ArrayBuffer(8)]]) {
    const lease = new FileImageService(new HttpClient()).acquire(4, 'thumbnail');
    binary(calls.at(-1), 200, mime, bytes); await assert.rejects(lease.promise, hasKind('parse')); lease.release();
  }
});

test('network error is released and explicit retry does not request business lists', async () => {
  const service = new FileImageService(new HttpClient()); const lease = service.acquire(4, 'medium');
  calls.at(-1).reject({ code: 2300028 }); await assert.rejects(lease.promise, hasKind('timeout'));
  lease.release(); const retry = service.acquire(4, 'medium');
  assert.ok(calls.at(-1).url.endsWith('/files/4/medium')); binary(calls.at(-1)); await retry.promise; retry.release();
});

test('legacy file references resolve to IDs; invalid IDs never reach transport', () => {
  for (const value of ['42', '/files/42/download', 'https://example.test/files/42/medium']) {
    assert.equal(FileImagePolicy.id(value), 42);
  }
  for (const value of ['', '0', '-1', 'https://example.test/photo.jpg', '9007199254740992']) {
    assert.equal(FileImagePolicy.id(value), 0);
  }
  const service = new FileImageService(new HttpClient()); const before = calls.length;
  for (const value of [0, -1, NaN, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => service.acquire(value, 'thumbnail'));
  }
  assert.equal(calls.length, before);
});

test('upload uses authenticated native multipart and exact backend fields; errors never replay POST', async () => {
  const client = new HttpClient(); client.setAccessToken('upload-token');
  const bytes = Uint8Array.from([255,216,255,1]).buffer;
  const success = client.uploadImage(bytes, 'DEMAND_REFERENCE', 'image/jpeg', 'photo.jpg');
  const call = calls.at(-1);
  assert.ok(call.url.endsWith('/files/upload')); assert.equal(call.options.method, 'POST');
  assert.equal(call.options.header.Authorization, 'Bearer upload-token');
  const parts = call.options.multiFormDataList;
  assert.deepEqual(parts.map(p => p.name), ['file','bizType','visibility']);
  assert.equal(parts[0].data, bytes); assert.equal(parts[0].remoteFileName, 'photo.jpg');
  assert.equal(parts[1].data, 'DEMAND_REFERENCE'); assert.equal(parts[2].data, 'PUBLIC');
  assert.equal(call.options.extraData, undefined);
  complete(call, {fileId: 456, originalName: 'photo.jpg'}); assert.equal((await success).fileId,456);
  for (const status of [401,403,413]) {
    const before=calls.length;
    const failure=client.uploadImage(bytes,'DEMAND_REFERENCE','image/jpeg','photo.jpg');
    calls.at(-1).resolve({responseCode:status,result:''});
    await assert.rejects(failure, e=>e.httpStatus===status); assert.equal(calls.length,before+1);
  }
});
