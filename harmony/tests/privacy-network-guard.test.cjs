// Behavioral tests for the production privacy boundary. NetworkKit is mocked; no server/device is used.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the installed DevEco SDK.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');

function fixture() {
  const evidence = { current: false, acceptedAtEpochMs: 0, crossBorderConsentVersion: '2026-10-29-v1', installationId: '' };
  const calls = [], cache = new Map();
  let violations = 0, refreshes = 0, onRefresh = async () => false;
  const http = {
    RequestMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' },
    HttpDataType: { STRING: 1, ARRAY_BUFFER: 2 },
    createHttp() {
      const call = { destroyed: 0 }; calls.push(call);
      return {
        request(url, options) {
          Object.assign(call, { url, options });
          return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
        },
        // Permit late native completion after destroy to exercise result invalidation.
        destroy() { call.destroyed++; }
      };
    }
  };
  function load(relative) {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod);
    mod.require = name => {
      if (name === '@kit.NetworkKit') return { http };
      if (name.endsWith('/EnvironmentConfig')) return { EnvironmentConfig: {
        current: () => ({ baseUrl: 'https://portra.test.invalid', name: 'staging' }), isUsable: () => true
      }};
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ets')));
      return {};
    };
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
    });
    mod._compile(output.outputText, filename);
    return mod.exports;
  }
  const { PrivacyRequestGuard } = load('privacy/PrivacyRequestGuard.ets');
  const { HttpClient } = load('network/HttpClient.ets');
  const { AuthInterceptor } = load('network/AuthInterceptor.ets');
  const guard = new PrivacyRequestGuard(() => evidence, () => violations++);
  const client = new HttpClient(new AuthInterceptor(), { refreshSession: async () => { refreshes++; return onRefresh(); } }, guard);
  return {
    evidence, calls, client, guard, PrivacyRequestGuard,
    get violations() { return violations; }, get refreshes() { return refreshes; },
    set onRefresh(value) { onRefresh = value; },
    consent() { evidence.current = true; evidence.acceptedAtEpochMs = 1803850000000; evidence.installationId = 'random-installation'; },
    authenticate() { client.setAccessToken('unit-test-access'); guard.verified(); }
  };
}
function complete(call, data = null, code = 200) {
  call.resolve({ responseCode: 200, result: JSON.stringify({ code, message: 'result', data }) });
}
const isConfig = error => error.kind === 'config';
const isStale = error => error.kind === 'stale';

const options = { timeout: 5000 };
test('unconsented startup rejects public reads, login, files and uploads before creating a native request', options, async () => {
  const f = fixture();
  for (const invoke of [
    () => f.client.getPublic('/demands?page=1'),
    () => f.client.postPublic('/auth/sms/send', { phone: 'do-not-send' }),
    () => f.client.postPublic('/auth/native/sms/verify', { code: 'do-not-send' }),
    () => f.client.getImage('/files/8/thumbnail', 'image.8'),
    () => f.client.uploadImage(new ArrayBuffer(2), 'AVATAR', 'image/png', 'avatar.png')
  ]) { await assert.rejects(invoke(), isConfig); }
  assert.equal(f.calls.length, 0);
});

test('necessary rights/consent/closure and session revocation routes remain reachable under restriction', options, async () => {
  const f = fixture(); f.guard.suspend();
  const paths = ['/privacy/consent', '/privacy/rights?page=1&size=20', '/privacy/account-closure',
    '/privacy/account-closure/code', '/auth/native/refresh', '/auth/native/logout'];
  for (const route of paths) {
    assert.equal(f.PrivacyRequestGuard.necessary(route), true);
    const pending = f.client.post(route, {}, route);
    const call = f.calls.at(-1); assert.ok(call.url.endsWith(route));
    assert.equal(call.options.header['X-Portra-Consent-Accepted-At'], undefined);
    assert.equal(call.options.header['X-Portra-Installation-Id'], undefined);
    complete(call, { accepted: true }); assert.deepEqual(await pending, { accepted: true });
  }
  for (const route of ['/privacy/consent/extra', '/privacy/rights-admin', '/privacy/rights/../../orders',
    '/privacy/account-closure/code/anything', '/auth/native/refresh/other', '/auth/sms/send']) {
    assert.equal(f.PrivacyRequestGuard.necessary(route), false);
    const count = f.calls.length; await assert.rejects(f.client.get(route), isConfig); assert.equal(f.calls.length, count);
  }
});

test('explicit consent allows anonymous requests and includes version/time/installation evidence', options, async () => {
  const f = fixture(); f.consent();
  const pending = f.client.getPublic('/demands?page=1');
  const call = f.calls.at(-1);
  assert.equal(call.options.header.Authorization, undefined);
  assert.equal(call.options.header['X-Portra-Consent-Version'], f.evidence.crossBorderConsentVersion);
  assert.equal(call.options.header['X-Portra-Consent-Accepted-At'], String(f.evidence.acceptedAtEpochMs));
  assert.equal(call.options.header['X-Portra-Installation-Id'], f.evidence.installationId);
  complete(call, ['public']); assert.deepEqual(await pending, ['public']);
});

test('login or account switch requires remote account-consent verification before business requests', options, async () => {
  const f = fixture(); f.consent(); f.client.setAccessToken('first-account');
  await assert.rejects(f.client.get('/auth/session'), isConfig);
  await assert.rejects(f.client.getPublic('/demands'), isConfig);
  assert.equal(f.calls.length, 0);
  const checking = f.client.get('/privacy/consent'); complete(f.calls.at(-1), { status: 'GRANTED' }); await checking;
  f.guard.verified();
  const allowed = f.client.get('/orders'); complete(f.calls.at(-1), []); assert.deepEqual(await allowed, []);
  f.client.setAccessToken('second-account');
  const count = f.calls.length; await assert.rejects(f.client.get('/orders'), isConfig);
  assert.equal(f.calls.length, count);
});

test('suspension blocks all new nonessential requests and cancellation invalidates already-active native responses', options, async () => {
  const f = fixture(); f.consent(); f.authenticate();
  const orders = f.client.get('/orders', 'orders'), orderCall = f.calls.at(-1);
  const hall = f.client.getPublic('/demands', 'hall'), hallCall = f.calls.at(-1);
  // The production AppClient withdrawal path performs both operations before awaiting the server.
  f.guard.suspend(); f.client.cancelAllRequests();
  assert.equal(orderCall.destroyed, 1); assert.equal(hallCall.destroyed, 1);
  const count = f.calls.length; await assert.rejects(f.client.post('/conversations/1/messages', { text: 'blocked' }), isConfig);
  assert.equal(f.calls.length, count);
  complete(orderCall, ['late']); complete(hallCall, ['late']);
  await assert.rejects(orders, isStale); await assert.rejects(hall, isStale);
  const rights = f.client.get('/privacy/rights'); complete(f.calls.at(-1), []); assert.deepEqual(await rights, []);
});

test('server withdrawal code 40302 restricts the guard, notifies once, and cancels concurrent public/private requests', options, async () => {
  const f = fixture(); f.consent(); f.authenticate();
  const failing = f.client.get('/orders', 'orders'), failingCall = f.calls.at(-1);
  const pendingHall = f.client.getPublic('/demands', 'hall'), hallCall = f.calls.at(-1);
  complete(failingCall, null, 40302);
  await assert.rejects(failing, error => error.businessCode === 40302);
  assert.equal(f.violations, 1); assert.equal(f.guard.allowed(true), false); assert.equal(hallCall.destroyed, 1);
  complete(hallCall, ['must not render']); await assert.rejects(pendingHall, isStale);
  const count = f.calls.length; await assert.rejects(f.client.getPublic('/service-packages'), isConfig);
  assert.equal(f.calls.length, count); assert.equal(f.refreshes, 0);
});

test('a GET awaiting token refresh rechecks consent before any retry transport', options, async () => {
  const f = fixture(); f.consent(); f.authenticate();
  let resolveRefresh; f.onRefresh = () => new Promise(resolve => { resolveRefresh = resolve; });
  const pending = f.client.get('/orders', 'orders');
  f.calls.at(-1).resolve({ responseCode: 401, result: '' });
  while (!resolveRefresh) await new Promise(resolve => setImmediate(resolve));
  f.guard.suspend(); f.client.replaceAccessToken('rotated-unit-token'); resolveRefresh(true);
  await assert.rejects(pending, isConfig);
  assert.equal(f.calls.length, 1); assert.equal(f.refreshes, 1);
});

test('fresh consent cannot clear a withdrawal suspension until the account is verified again', options, async () => {
  const f = fixture(); f.consent(); f.authenticate(); f.guard.suspend();
  f.evidence.current = false; f.consent();
  await assert.rejects(f.client.getPublic('/demands'), isConfig);
  assert.equal(f.calls.length, 0);
  f.guard.verified(); const allowed = f.client.getPublic('/demands'); complete(f.calls.at(-1), []);
  assert.deepEqual(await allowed, []);
});
