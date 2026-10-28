const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const sourceRoot = path.resolve(__dirname, '../entry/src/main/ets');
const calls = [];
const http = {
  RequestMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE' },
  HttpDataType: { STRING: 1 },
  createHttp() {
    const call = {};
    calls.push(call);
    return {
      request(url, options) {
        Object.assign(call, { url, options });
        return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
      },
      destroy() {}
    };
  }
};
class TestBuildProfile {
  static PORTRA_ENVIRONMENT = 'staging';
  static PORTRA_BASE_URL = 'https://reports.test.invalid';
}
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot + path.sep));
  const originalRequire = module.require.bind(module);
  module.require = name => {
    if (name === '@kit.NetworkKit') return { http };
    if (name.endsWith('/BuildProfile')) return { default: TestBuildProfile };
    return originalRequire(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(compiled.outputText, filename);
};
const { HttpClient } = require('../entry/src/main/ets/network/HttpClient.ets');
const { ApiService } = require('../entry/src/main/ets/network/ApiService.ets');
const { ErrorMapper } = require('../entry/src/main/ets/network/ErrorMapper.ets');

function report(overrides = {}) {
  return { reportId: 32, reporterId: 21, targetType: 'MOMENT', targetId: 7,
    reason: '测试原因', status: 'PENDING', createdAt: '2026-10-25T12:00:00', ...overrides };
}
function panelFixture(reset = true) {
  if (reset) require('../entry/src/main/ets/features/user/ReportSubmissionStore.ets').ReportSubmissionStore.shared.entries.clear();
  let version = 3;
  const requests = [], queries = [], cancellations = [];
  const api = {
    createReport(payload, key) {
      const call = { payload, key };
      requests.push(call);
      return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
    },
    cancelReports(create, mine) { cancellations.push({ create, mine }); },
    listMyReports(key) { const call = { key }; queries.push(call);
      return new Promise((resolve, reject) => Object.assign(call, { resolve, reject })); }
  };
  const app = { apiService: api,
    sessionManager: { isAuthenticated: () => true, getSessionVersion: () => version } };
  const filename = path.join(sourceRoot, 'features/user/ReportPanel.ets');
  const source = fs.readFileSync(filename, 'utf8');
  const plain = (source.slice(0, source.indexOf('  build() {')) + '\n}')
    .replace(/^@Component\s*$/m, '').replace('export struct ', 'export class ')
    .replace(/@Watch\('[^']+'\)\s*/g, '').replace(/@(State|Prop)\s+/g, '');
  const compiled = ts.transpileModule(plain, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => name === '../../app/AppClient' ? { AppClient: { shared: app } } : originalRequire(name);
  loaded._compile(compiled.outputText, filename);
  const panel = new loaded.exports.ReportPanel();
  Object.assign(panel, { targetType: 'MOMENT', targetId: 7, ownerId: 12, currentUserId: 21, reason: '测试原因' });
  return { panel, requests, queries, cancellations, changeSession() { version++; } };
}
function complete(call, data) {
  call.resolve({ responseCode: 200, result: JSON.stringify({ code: 200, message: 'success', data }) });
}
function apiFixture() {
  const client = new HttpClient();
  client.setAccessToken('test-session');
  return new ApiService(client);
}

test('report validates trimmed reason and description limits before sending', async () => {
  for (const input of [
    { reason: '  ', description: '', sent: false },
    { reason: '字'.repeat(500), description: '文'.repeat(1000), sent: true },
    { reason: '字'.repeat(501), description: '', sent: false },
    { reason: '字', description: '文'.repeat(1001), sent: false }
  ]) {
    const { panel, requests } = panelFixture();
    Object.assign(panel, { reason: input.reason, description: input.description });
    const operation = panel.submit();
    assert.equal(requests.length, input.sent ? 1 : 0);
    if (input.sent) requests[0].resolve(report());
    await operation;
    assert.equal(panel.submitted, input.sent);
  }
});

test('report refuses an invalid server ID and preserves the input', async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  requests[0].resolve(report({ reportId: 0 })); await operation;
  assert.equal(panel.submitted, false);
  assert.equal(panel.reason, '测试原因');
  assert.ok(panel.errorMessage.length > 0);
});

test('report response for a previous target cannot mark the new target submitted', async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  panel.targetId = 8;
  requests[0].resolve(report()); await operation;
  assert.equal(panel.submitted, false);
});

test('closed report ignores late errors', async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  panel.aboutToDisappear();
  requests[0].reject(ErrorMapper.stale()); await operation;
  assert.equal(panel.errorMessage, '');
});

test('old account report success cannot update a new session', async () => {
  const { panel, requests, changeSession } = panelFixture();
  const operation = panel.submit();
  changeSession();
  requests[0].resolve(report()); await operation;
  assert.equal(panel.submitted, false);
});

test('report success only accepts the real PENDING or RESOLVED state', async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  requests[0].resolve(report({ status: 'UNKNOWN' })); await operation;
  assert.equal(panel.submitted, false);
});

test('an ambiguous report timeout does not blindly submit again', async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  requests[0].reject(ErrorMapper.fromTransportCode(2300028)); await operation;
  const replay = panel.submit();
  // Settle any erroneous second request so the test does not leave pending work.
  if (requests.length > 1) requests[1].resolve(report({ reportId: 33 }));
  await replay;
  assert.equal(requests.length, 1);
});

test('two report instance request keys do not supersede one another', async () => {
  const api = apiFixture();
  const first = api.createReport({ targetType: 'MOMENT', targetId: 7, reason: '甲' }, 'reports.c.one');
  const a = calls.at(-1);
  const second = api.createReport({ targetType: 'MOMENT', targetId: 8, reason: '乙' }, 'reports.c.two');
  const b = calls.at(-1);
  const outcomes = Promise.allSettled([first, second]);
  complete(a, report()); complete(b, report({ targetId: 8, reportId: 33 }));
  assert.deepEqual((await outcomes).map(value => value.status), ['fulfilled', 'fulfilled']);
});

test('cancelling one report instance leaves the other instance live', async () => {
  const api = apiFixture();
  const first = api.createReport({ targetType: 'MOMENT', targetId: 7, reason: '甲' }, 'reports.c.one');
  const a = calls.at(-1);
  const second = api.createReport({ targetType: 'MOMENT', targetId: 8, reason: '乙' }, 'reports.c.two');
  const b = calls.at(-1);
  const outcomes = Promise.allSettled([first, second]);
  api.cancelReports('reports.c.one', 'reports.c.one.my');
  complete(a, report()); complete(b, report({ targetId: 8, reportId: 33 }));
  assert.deepEqual((await outcomes).map(value => value.status), ['rejected', 'fulfilled']);
});

test('target watch resets form and old finally cannot release the next submission', async () => {
  const f = panelFixture(); const first = f.panel.submit();
  f.panel.targetId = 8; f.panel.onTargetChanged();
  assert.equal(f.panel.reason, ''); assert.equal(f.panel.description, '');
  assert.equal(f.panel.submitted, false); assert.equal(f.panel.busy, false);
  f.panel.reason = '新对象原因'; const second = f.panel.submit();
  f.requests[0].resolve(report()); await first;
  assert.equal(f.panel.busy, true); assert.equal(f.panel.submitted, false);
  f.requests[1].resolve(report({ targetId: 8, reportId: 33 })); await second;
  assert.equal(f.panel.submitted, true); assert.equal(f.panel.busy, false);
});

test('a different reporter or malformed state cannot confirm submission', async () => {
  for (const data of [report({ reporterId: 99 }), report({ status: null }), report({ status: 'pending' })]) {
    const f = panelFixture(); const operation = f.panel.submit();
    f.requests[0].resolve(data); await operation;
    assert.equal(f.panel.submitted, false); assert.equal(f.panel.unconfirmed, true);
  }
});

test('closing during submission keeps ambiguity across a new component and never replays', async () => {
  const f = panelFixture(); const operation = f.panel.submit(); f.panel.aboutToDisappear();
  const reopened = panelFixture(false); await reopened.panel.submit();
  assert.equal(reopened.requests.length, 0); assert.equal(reopened.panel.unconfirmed, true);
  f.requests[0].reject(ErrorMapper.stale()); await operation;
  assert.equal(f.panel.errorMessage, '');
});

test('known late success is recorded only for its original object and account', async () => {
  const f = panelFixture(); const operation = f.panel.submit(); f.panel.aboutToDisappear();
  f.requests[0].resolve(report()); await operation;
  assert.equal(f.panel.submitted, false);
  const reopened = panelFixture(false); reopened.panel.aboutToAppear();
  assert.equal(reopened.panel.submitted, true);
  reopened.changeSession(); reopened.panel.onTargetChanged();
  assert.equal(reopened.panel.submitted, false); assert.equal(reopened.panel.unconfirmed, false);
});

test('verification shows candidate record IDs but does not infer a historical match is a new write', async () => {
  const f = panelFixture(); const operation = f.panel.submit();
  f.requests[0].reject(ErrorMapper.fromTransportCode(2300028)); await operation;
  const verify = f.panel.verifySubmission(); assert.equal(f.queries.length, 1);
  f.queries[0].resolve([report()]); await verify;
  assert.match(f.panel.verificationMessage, /#32/);
  assert.equal(f.panel.submitted, false); assert.equal(f.panel.unconfirmed, true);
  await f.panel.submit(); assert.equal(f.requests.length, 1);
});

test('no matching records never enables an automatic or manual blind replay', async () => {
  const f = panelFixture(); const operation = f.panel.submit();
  f.requests[0].reject(ErrorMapper.network()); await operation;
  const verify = f.panel.verifySubmission(); f.queries[0].resolve([]); await verify;
  assert.match(f.panel.verificationMessage, /不能据此判断未写入/);
  await f.panel.submit(); assert.equal(f.requests.length, 1);
});

test('cancellation uses instance-specific create and verification keys', async () => {
  const a = panelFixture(); const operationA = a.panel.submit();
  const b = panelFixture(false); b.panel.targetId = 8; const operationB = b.panel.submit();
  assert.notEqual(a.requests[0].key, b.requests[0].key);
  a.panel.aboutToDisappear(); assert.equal(a.cancellations[0].create, a.requests[0].key);
  assert.notEqual(a.cancellations[0].create, b.requests[0].key);
  a.requests[0].reject(ErrorMapper.stale()); b.requests[0].resolve(report({ targetId: 8, reportId: 33 }));
  await Promise.all([operationA, operationB]); assert.equal(b.panel.submitted, true);
});

test('unknown current identity and self-report cannot send a request', async () => {
  for (const currentUserId of [0, 12]) {
    const f = panelFixture(); f.panel.currentUserId = currentUserId;
    await f.panel.submit(); assert.equal(f.requests.length, 0);
  }
});

test('a changed session cannot submit the previous account draft before props catch up', async () => {
  const f = panelFixture(); f.panel.aboutToAppear(); f.panel.reason = '旧账号草稿';
  f.changeSession(); const unexpected = f.panel.submit();
  if (f.requests.length > 0) f.requests[0].resolve(report()); await unexpected;
  assert.equal(f.requests.length, 0); assert.equal(f.panel.reason, ''); assert.equal(f.panel.busy, false);
  f.panel.reason = '仍未核实身份'; const repeated = f.panel.submit();
  if (f.requests.length > 0) f.requests.at(-1).resolve(report()); await repeated; assert.equal(f.requests.length, 0);
});

test('an old account completion clears stale busy without unlocking another identity', async () => {
  const f = panelFixture(); f.panel.aboutToAppear(); f.panel.reason = '旧账号';
  const operation = f.panel.submit(); f.changeSession();
  f.requests[0].resolve(report()); await operation;
  assert.equal(f.panel.busy, false); assert.equal(f.panel.submitted, false); assert.equal(f.panel.reason, '');
  f.panel.reason = '尚未核实'; const repeated = f.panel.submit();
  if (f.requests.length > 1) f.requests.at(-1).resolve(report()); await repeated; assert.equal(f.requests.length, 1);
});

test('verification never sends an old pending record under a new session', async () => {
  const f = panelFixture(); f.panel.aboutToAppear(); f.panel.reason = '原账号原因';
  const operation = f.panel.submit(); f.requests[0].reject(ErrorMapper.network()); await operation;
  f.changeSession(); const verify = f.panel.verifySubmission();
  if (f.queries.length > 0) f.queries[0].resolve([]); await verify; assert.equal(f.queries.length, 0);
  assert.equal(f.panel.unconfirmed, false); assert.equal(f.panel.busy, false);
});

test('same account role-version changes keep unknown submissions blocked without restoring old input', async () => {
  const f = panelFixture(); const sent = f.panel.submit(); f.requests[0].reject(ErrorMapper.network()); await sent;
  const reentered = panelFixture(false); reentered.changeSession(); reentered.panel.reason = '';
  reentered.panel.aboutToAppear();
  assert.equal(reentered.panel.unconfirmed, true); assert.equal(reentered.panel.reason, '');
  reentered.panel.reason = '新角色仍不得盲重发'; const repeat = reentered.panel.submit();
  if (reentered.requests.length) reentered.requests[0].resolve(report()); await repeat;
  assert.equal(reentered.requests.length, 0);
});

test('another account never inherits an old actor unknown record', async () => {
  const f = panelFixture(); const sent = f.panel.submit(); f.requests[0].reject(ErrorMapper.network()); await sent;
  const other = panelFixture(false); other.changeSession(); other.panel.currentUserId = 99;
  other.panel.aboutToAppear(); assert.equal(other.panel.unconfirmed, false);
  other.panel.reason = '新账号自己的内容'; const sentOther = other.panel.submit();
  assert.equal(other.requests.length, 1); other.requests[0].resolve(report({ reporterId: 99 })); await sentOther;
  assert.equal(other.panel.submitted, true);
});

test('old logical-version ambiguity can be verified using the current version guard', async () => {
  const f = panelFixture(); const sent = f.panel.submit(); f.requests[0].reject(ErrorMapper.network()); await sent;
  const reentered = panelFixture(false); reentered.changeSession(); reentered.panel.aboutToAppear();
  const verify = reentered.panel.verifySubmission();
  assert.equal(reentered.queries.length, 1); reentered.queries[0].resolve([report()]); await verify;
  assert.match(reentered.panel.verificationMessage, /#32/); assert.equal(reentered.panel.unconfirmed, true);
});

test('a second version change while verifying ignores old records and clears busy', async () => {
  const f = panelFixture(); const sent = f.panel.submit(); f.requests[0].reject(ErrorMapper.network()); await sent;
  const reentered = panelFixture(false); reentered.changeSession(); reentered.panel.aboutToAppear();
  const verify = reentered.panel.verifySubmission();
  assert.equal(reentered.queries.length, 1); reentered.changeSession();
  reentered.queries[0].resolve([report()]); await verify;
  assert.equal(reentered.panel.verificationMessage, ''); assert.equal(reentered.panel.busy, false);
});
