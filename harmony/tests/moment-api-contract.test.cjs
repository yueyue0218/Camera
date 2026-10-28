// Real ApiService + HttpClient; only the OS transport is fake.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const calls = [];
const http = { RequestMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE' },
  HttpDataType: { STRING: 1 }, createHttp() {
    const call = {}; calls.push(call);
    return { request(url, options) {
      Object.assign(call, { url, options });
      return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
    }, destroy() { call.destroyed = true; } };
  } };
class Profile { static PORTRA_ENVIRONMENT = 'staging'; static PORTRA_BASE_URL = 'https://moments.test.invalid'; }
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(root + path.sep));
  const original = module.require.bind(module);
  module.require = name => name === '@kit.NetworkKit' ? { http } :
    name.endsWith('/BuildProfile') ? { default: Profile } : original(name);
  let source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021
  } }).outputText, filename);
};
const { HttpClient } = require(path.join(root, 'network/HttpClient.ets'));
const { ApiService } = require(path.join(root, 'network/ApiService.ets'));
function fixture() {
  const client = new HttpClient(); client.setAccessToken('unit-fixture-only');
  return new ApiService(client);
}
function moment(extra = {}) { return { momentId: 7, authorId: 12, authorRole: 'CUSTOMER',
  imageDataList: ['one', 'two', 'three', 'four', 'five'], likeCount: 6,
  favoriteCount: 2, likedByCurrentUser: false, favoritedByCurrentUser: false, ...extra }; }
function complete(call, data, code = 200) { call.resolve({ responseCode: code,
  result: JSON.stringify({ code: 200, message: 'success', data }) }); }

test('detail uses authenticated GET and preserves all five server images', async () => {
  const api = fixture(); const request = api.getMoment(7, 'c.one.detail');
  const call = calls.at(-1);
  assert.equal(call.url, 'https://moments.test.invalid/moments/7');
  assert.equal(call.options.method, 'GET');
  assert.equal(call.options.header.Authorization, 'Bearer unit-fixture-only');
  complete(call, moment()); assert.equal((await request).imageDataList.length, 5);
});
test('like/unlike use PUT/DELETE, server counts and legacy default keys', async () => {
  const api = fixture();
  const like = api.likeMoment(7); const call = calls.at(-1);
  assert.equal(call.options.method, 'PUT'); assert.ok(call.url.endsWith('/moments/7/like'));
  complete(call, moment({ likedByCurrentUser: true, likeCount: 33 }));
  assert.equal((await like).likeCount, 33);
  const unlike = api.unlikeMoment(7); assert.equal(calls.at(-1).options.method, 'DELETE');
  complete(calls.at(-1), moment({ likeCount: 27 })); assert.equal((await unlike).likeCount, 27);
});
test('unsafe IDs do not send any network request', async () => {
  const api = fixture(); const count = calls.length;
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const name of ['getMoment', 'likeMoment', 'unlikeMoment']) {
      assert.equal(typeof api[name], 'function');
      await assert.rejects(api[name](id), error => error.kind === 'parse');
    }
  }
  assert.equal(calls.length, count);
});
test('invalid object IDs, state and counts cannot become success', async () => {
  const api = fixture();
  for (const value of [null, moment({ momentId: 8 }), moment({ likeCount: -1 }),
    moment({ likedByCurrentUser: 'true' }), moment({ likedByCurrentUser: false })]) {
    const operation = api.likeMoment(7); complete(calls.at(-1), value);
    await assert.rejects(operation, error => error.kind === 'parse');
  }
});
test('two pages can read details independently, cancelling one preserves the other', async () => {
  const api = fixture(); const first = api.getMoment(7, 'page.a.detail');
  const a = calls.at(-1); const second = api.getMoment(7, 'page.b.detail'); const b = calls.at(-1);
  const outcomes = Promise.allSettled([first, second]); api.cancelMomentDetail('page.a.detail');
  complete(a, moment()); complete(b, moment()); const values = await outcomes;
  assert.equal(values[0].status, 'rejected'); assert.equal(values[0].reason.kind, 'stale');
  assert.equal(values[1].status, 'fulfilled');
});
test('two pages isolate like cancellation without changing existing HttpClient', async () => {
  const api = fixture(); const first = api.likeMoment(7, 'page.a.like'); const a = calls.at(-1);
  const second = api.likeMoment(7, 'page.b.like'); const b = calls.at(-1);
  const outcomes = Promise.allSettled([first, second]); api.cancelMomentLike(7, 'page.a.like');
  complete(a, moment({ likedByCurrentUser: true })); complete(b, moment({ likedByCurrentUser: true }));
  const values = await outcomes; assert.equal(values[0].status, 'rejected');
  assert.equal(values[0].reason.kind, 'stale'); assert.equal(values[1].status, 'fulfilled');
});
test('404 moderation visibility and 401 auth expiry keep shared error handling', async () => {
  const api = fixture();
  for (const code of [404, 401]) {
    const operation = api.getMoment(7); complete(calls.at(-1), null, code);
    await assert.rejects(operation, error => error.httpStatus === code);
  }
});
test('timeout is not retried or silently converted to success', async () => {
  const api = fixture(); const count = calls.length; const operation = api.likeMoment(7);
  calls.at(-1).reject({ code: 2300028 });
  await assert.rejects(operation, error => error.kind === 'timeout'); assert.equal(calls.length, count + 1);
});
