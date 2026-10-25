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

// Owner handoff requirements are executable TODOs while the shared files remain
// unchanged. Strict mode deliberately exits nonzero until the owner fixes them.
// This does not replace device checks of ArkUI @Watch or lifecycle delivery.
const strict = process.env.PORTRA_REQUIRE_SHARED_REPORTS === '1';
const pending = id => ({ todo: strict ? false : `${id}: owner implementation not provided` });
function report(overrides = {}) {
  return { reportId: 32, reporterId: 21, targetType: 'MOMENT', targetId: 7,
    reason: '测试原因', status: 'PENDING', createdAt: '2026-10-25T12:00:00', ...overrides };
}
function panelFixture() {
  let version = 3;
  const requests = [];
  const api = {
    createReport(payload, key) {
      const call = { payload, key };
      requests.push(call);
      return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
    },
    cancelReports() {},
    listMyReports() { return Promise.resolve([]); }
  };
  const app = { apiService: api,
    sessionManager: { isAuthenticated: () => true, getSessionVersion: () => version } };
  const filename = path.join(sourceRoot, 'features/user/ReportPanel.ets');
  const source = fs.readFileSync(filename, 'utf8');
  const plain = (source.slice(0, source.indexOf('  build() {')) + '\n}')
    .replace(/^@Component\s*$/m, '').replace('export struct ', 'export class ')
    .replace(/@(State|Prop)\s+/g, '');
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
  return { panel, requests, changeSession() { version++; } };
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

test('report response for a previous target cannot mark the new target submitted', pending('C-SHARED-03'), async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  panel.targetId = 8;
  requests[0].resolve(report()); await operation;
  assert.equal(panel.submitted, false);
});

test('closed report ignores late errors', pending('C-SHARED-03'), async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  panel.aboutToDisappear();
  requests[0].reject(ErrorMapper.stale()); await operation;
  assert.equal(panel.errorMessage, '');
});

test('old account report success cannot update a new session', pending('C-SHARED-03'), async () => {
  const { panel, requests, changeSession } = panelFixture();
  const operation = panel.submit();
  changeSession();
  requests[0].resolve(report()); await operation;
  assert.equal(panel.submitted, false);
});

test('report success only accepts the real PENDING or RESOLVED state', pending('C-SHARED-03'), async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  requests[0].resolve(report({ status: 'UNKNOWN' })); await operation;
  assert.equal(panel.submitted, false);
});

test('an ambiguous report timeout does not blindly submit again', pending('C-SHARED-03'), async () => {
  const { panel, requests } = panelFixture();
  const operation = panel.submit();
  requests[0].reject(ErrorMapper.fromTransportCode(2300028)); await operation;
  const replay = panel.submit();
  // Settle any erroneous second request so the test does not leave pending work.
  if (requests.length > 1) requests[1].resolve(report({ reportId: 33 }));
  await replay;
  assert.equal(requests.length, 1);
});

test('two report instance request keys do not supersede one another', pending('C-SHARED-04'), async () => {
  const api = apiFixture();
  const first = api.createReport({ targetType: 'MOMENT', targetId: 7, reason: '甲' }, 'reports.c.one');
  const a = calls.at(-1);
  const second = api.createReport({ targetType: 'MOMENT', targetId: 8, reason: '乙' }, 'reports.c.two');
  const b = calls.at(-1);
  const outcomes = Promise.allSettled([first, second]);
  complete(a, report()); complete(b, report({ targetId: 8, reportId: 33 }));
  assert.deepEqual((await outcomes).map(value => value.status), ['fulfilled', 'fulfilled']);
});

test('cancelling one report instance leaves the other instance live', pending('C-SHARED-04'), async () => {
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
