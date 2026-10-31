// Node-only VM fixture adapter: ArkUI @Prop/@Watch are decorators without runtime
// semantics in this host-side simulation. No application source is changed.
const __portraUiPolish01VmDecoratorShim = require('node:vm');
const __portraOriginalUiPolishRun = __portraUiPolish01VmDecoratorShim.runInContext;
__portraUiPolish01VmDecoratorShim.runInContext = function (code, context, ...args) {
  if (__portraUiPolish01VmDecoratorShim.isContext(context)) {
    if (!Object.prototype.hasOwnProperty.call(context, 'Prop')) {
      context.Prop = function () {};
    }
    if (!Object.prototype.hasOwnProperty.call(context, 'Watch')) {
      context.Watch = function () { return function () {}; };
    }
  }
  return __portraOriginalUiPolishRun.call(__portraUiPolish01VmDecoratorShim, code, context, ...args);
};
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(path.join(process.env.DEVECO_SDK_HOME,
  'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
require.extensions['.ets'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
}).outputText, file);
const { HallFilterState } = require(path.join(root, 'features/hall/HallFilterState.ets'));
const { HallDataPolicy } = require(path.join(root, 'features/hall/HallDataPolicy.ets'));
const { HallContentState } = require(path.join(root, 'features/hall/HallUiModels.ets'));
const { HallUnreadCounter } = require(path.join(root, 'features/notifications/HallUnreadCounter.ets'));
const tick = () => new Promise(resolve => setImmediate(resolve));

test('filters use separate real API fields, cents, exact dates and stable paging', () => {
  const f = new HallFilterState();
  Object.assign(f, { city: '320100', style: '胶片', minYuan: '0', maxYuan: '299.99', date: '2028-02-29' });
  assert.equal(f.validate(), '');
  const service = f.serviceQuery(1, 20, 'seed');
  const demand = f.demandQuery(1, 20, 'seed');
  assert.equal(service.minPriceCent, 0);
  assert.equal(service.maxPriceCent, 29999);
  assert.equal(service.availableDate, f.date);
  assert.equal(service.style, f.style);
  assert.equal(demand.maxBudgetCent, 29999);
  assert.equal(demand.expectedDate, f.date);
  assert.equal(demand.styleTag, f.style);
  assert.equal(demand.status, 'OPEN');
  assert.deepEqual(f.serviceQuery(2, 20, 'seed'), { ...service, page: 2 });
  assert.deepEqual(f.demandQuery(2, 20, 'seed'), { ...demand, page: 2 });
  const draft = f.copy(); draft.city = '';
  assert.equal(f.city, '320100');
  assert.equal(new HallFilterState().serviceQuery(1, 20, 'seed').maxPriceCent, undefined);
});

test('invalid dates and budgets are rejected before request serialization', () => {
  const f = new HallFilterState();
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', 'tomorrow']) {
    f.date = date; assert.notEqual(f.validate(), '');
  }
  f.date = '';
  for (const amount of ['-1', '1.234', 'NaN', '21474836.48']) {
    f.minYuan = amount; assert.notEqual(f.validate(), '');
  }
  f.minYuan = '500'; f.maxYuan = '100'; assert.notEqual(f.validate(), '');
});

function fixture() {
  // Execute the production page's request/state methods without the native render builder.
  let source = fs.readFileSync(path.join(root, 'pages/HallPage.ets'), 'utf8');
  source = source.slice(0, source.indexOf('  build()')) + '\n}';
  source = source.replace(/import[\s\S]*?;\s*/g, '').replace(/@Component\s*/g, '')
    .replace(/@State\s*/g, '').replace('export struct HallPage', 'class HallPage');
  const requests = [];
  const api = {};
  for (const kind of ['ServicePackages', 'Demands']) {
    api[`list${kind}ByQuery`] = query => new Promise((resolve, reject) => requests.push({ kind, query, resolve, reject }));
    api[`cancel${kind}`] = () => {};
  }
  const context = { HallFilterState, HallDataPolicy, HallContentState, HallUnreadCounter,
    AppClient: { shared: { apiService: api, sessionManager: {
      getSessionVersion: () => 1, isAuthenticated: () => false
    } } }, ErrorMapper: { isStale: () => false } };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source + '\nglobalThis.Page = HallPage;', {
    compilerOptions: { target: ts.ScriptTarget.ES2021 }
  }).outputText, context);
  return { page: new context.Page(), requests };
}

test('late first page and load-more responses cannot replace new filters; retry keeps filters', async () => {
  const { page, requests } = fixture();
  page.reload();
  requests[0].resolve({ records: [{ serviceId: 1 }], page: 1, size: 20, total: 40 });
  requests[1].resolve({ records: [{ demandId: 1 }], page: 1, size: 20, total: 40 });
  await tick();
  page.loadServices(page.serviceVersion, 2, true);
  page.loadDemands(page.demandVersion, 2, true);
  page.serviceFilters.city = '310000'; page.demandFilters.style = '人像';
  page.reload();
  assert.equal(requests[4].query.page, 1);
  assert.equal(requests[4].query.cityCode, 'SH');
  assert.equal(requests[5].query.styleTag, '人像');
  requests[4].resolve({ records: [{ serviceId: 9 }], page: 1, size: 20, total: 1 });
  requests[5].resolve({ records: [], page: 1, size: 20, total: 0 });
  await tick();
  requests[2].resolve({ records: [{ serviceId: 2 }], page: 2, size: 20, total: 40 });
  requests[3].reject(new Error('stale failure'));
  await tick();
  assert.equal(page.serviceItems[0].serviceId, 9);
  assert.equal(page.serviceItems.length, 1);
  assert.equal(page.demandState, 'empty');
  assert.equal(page.demandError, '');
  page.reload();
  requests[6].reject(new Error('offline')); requests[7].reject(new Error('offline'));
  await tick(); assert.equal(page.serviceState, 'error');
  page.reload();
  assert.equal(requests[8].query.cityCode, 'SH');
  assert.equal(requests[9].query.styleTag, '人像');
  page.serviceFilters = new HallFilterState(); page.reload();
  requests[8].resolve({ records: [{ serviceId: 88 }], page: 1, size: 20, total: 1 });
  await tick(); assert.notEqual(page.serviceItems[0]?.serviceId, 88);
  assert.equal(requests[10].query.cityCode, undefined);
});
