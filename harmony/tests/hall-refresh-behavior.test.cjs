const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
require.extensions['.ets'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }
}).outputText, filename);
const { HallDataPolicy } = require('../entry/src/main/ets/features/hall/HallDataPolicy.ets');
const { HallChannel, HallContentState } = require('../entry/src/main/ets/features/hall/HallUiModels.ets');
const { HallFilterState } = require('../entry/src/main/ets/features/hall/HallFilterState.ets');
const source = fs.readFileSync(path.join(__dirname, '../entry/src/main/ets/pages/HallPage.ets'), 'utf8');
const methods = source.slice(source.indexOf('  private reload()'), source.indexOf('  build()'));
const compiled = ts.transpileModule(`class Page { ${methods} }; module.exports = Page`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }
}).outputText;
const mod = { exports: {} };
new Function('module', 'HallChannel', 'HallContentState', 'HallDataPolicy', 'ErrorMapper', compiled)(
  mod, HallChannel, HallContentState, HallDataPolicy, { isStale: () => false });
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const page = new mod.exports(), calls = { service: [], demand: [] };
  page.pageSize = 20; page.feedSeed = 'stable';
  page.apiService = { cancelServicePackages() {}, cancelDemands() {} };
  for (const kind of ['service', 'demand']) {
    Object.assign(page, { [kind + 'Version']: 1, [kind + 'Page']: 2, [kind + 'HasMore']: true,
      [kind + 'LoadingMore']: false, [kind + 'Refreshing']: false, [kind + 'Items']: [{ [kind + 'Id']: 1 }],
      [kind + 'Cities']: [], [kind + 'Styles']: [], [kind + 'Error']: '',
      [kind + 'State']: HallContentState.CONTENT, [kind + 'Filters']: new HallFilterState() });
    page.apiService[kind === 'service' ? 'listServicePackagesByQuery' : 'listDemandsByQuery'] = query =>
      new Promise((resolve, reject) => calls[kind].push({ query, resolve, reject }));
  }
  return { page, calls };
}
const result = (kind, ids, page = 1, total = 40) => ({ records: ids.map(id => ({ [kind + 'Id']: id })), page, size: 20, total });
for (const kind of ['service', 'demand']) {
  const channel = kind === 'service' ? HallChannel.SHOWCASES : HallChannel.DEMANDS;
  const load = kind === 'service' ? 'loadServices' : 'loadDemands';
  test(`${kind}: repeated refresh is coalesced, preserves filters/cards, replaces first page and resumes pagination`, async () => {
    const { page: p, calls } = fixture(); const filters = p[kind + 'Filters'];
    filters.city = '320100';
    p.refreshChannel(channel); p.refreshChannel(channel);
    assert.equal(calls[kind].length, 1); assert.equal(calls[kind][0].query.page, 1);
    assert.equal(calls[kind][0].query.cityCode, '320100'); assert.equal(p[kind + 'Filters'], filters);
    assert.equal(p[kind + 'Items'][0][kind + 'Id'], 1); assert.equal(p[kind + 'Page'], 0);
    await p[load](p[kind + 'Version'], 1, true); assert.equal(calls[kind].length, 1);
    calls[kind][0].resolve(result(kind, [2, 2])); await tick();
    assert.equal(p[kind + 'Refreshing'], false); assert.equal(p[kind + 'Items'].length, 1);
    const pending = p[load](p[kind + 'Version'], 2, true);
    calls[kind][1].resolve(result(kind, [2, 3], 2)); await pending;
    assert.deepEqual(p[kind + 'Items'].map(x => x[kind + 'Id']), [2, 3]);
  });
  test(`${kind}: stale pagination cannot overwrite refresh or end its loading state`, async () => {
    const { page: p, calls } = fixture(); const old = p[load](1, 3, true);
    p.refreshChannel(channel); calls[kind][0].resolve(result(kind, [99], 3)); await old;
    assert.equal(p[kind + 'Refreshing'], true); assert.equal(p[kind + 'Items'][0][kind + 'Id'], 1);
    calls[kind][1].resolve(result(kind, [2])); await tick();
    assert.deepEqual(p[kind + 'Items'].map(x => x[kind + 'Id']), [2]);
  });
  test(`${kind}: failure/malformed data retain cards; retry and empty success finish`, async () => {
    const { page: p, calls } = fixture(); p.refreshChannel(channel);
    calls[kind][0].reject(new Error('offline')); await tick();
    assert.equal(p[kind + 'Refreshing'], false); assert.equal(p[kind + 'Error'], 'offline');
    assert.equal(p[kind + 'State'], HallContentState.CONTENT); assert.equal(p[kind + 'HasMore'], false);
    p.refreshChannel(channel); calls[kind][1].resolve(null); await tick();
    assert.equal(p[kind + 'Refreshing'], false); assert.equal(p[kind + 'Items'].length, 1);
    p.refreshChannel(channel); calls[kind][2].resolve(result(kind, [], 1, 0)); await tick();
    assert.equal(p[kind + 'State'], HallContentState.EMPTY); assert.equal(p[kind + 'Refreshing'], false);
    assert.equal(p[kind + 'Error'], ''); assert.deepEqual(p[kind + 'Items'], []);
  });
  test(`${kind}: filter reload invalidates an in-flight refresh`, async () => {
    const { page: p, calls } = fixture(); p.refreshChannel(channel); p.reload();
    calls[kind][0].resolve(result(kind, [99])); await tick();
    assert.equal(p[kind + 'Refreshing'], true); assert.deepEqual(p[kind + 'Items'], []);
    calls[kind][1].resolve(result(kind, [4])); await tick();
    assert.equal(p[kind + 'Items'][0][kind + 'Id'], 4);
  });
}
test('concurrent channels settle independently without cancelling or overwriting each other', async () => {
  const { page: p, calls } = fixture(); p.refreshChannel(HallChannel.SHOWCASES); p.refreshChannel(HallChannel.DEMANDS);
  calls.demand[0].resolve(result('demand', [7])); await tick();
  assert.equal(p.serviceRefreshing, true); assert.equal(p.demandRefreshing, false);
  calls.service[0].resolve(result('service', [8])); await tick();
  assert.equal(p.serviceItems[0].serviceId, 8); assert.equal(p.demandItems[0].demandId, 7);
});

function loadMethods(file, from, to, globals = {}) {
  const text = fs.readFileSync(path.join(__dirname, '../entry/src/main/ets', file), 'utf8');
  const body = text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from)));
  const output = ts.transpileModule(`class Subject { ${body} }; module.exports = Subject`, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', ...Object.keys(globals), output)(loaded, ...Object.values(globals));
  return new loaded.exports();
}
test('entering Hall preserves navigation; only reselecting Hall emits refresh epoch', () => {
  const shell = loadMethods('features/shell/PortraAppShell.ets', '  private selectTab(', '  build()');
  shell.selectedTab = 2; shell.hallReselectEpoch = 0;
  shell.selectTab(0); assert.equal(shell.selectedTab, 0); assert.equal(shell.hallReselectEpoch, 0);
  shell.selectTab(0); assert.equal(shell.hallReselectEpoch, 1);
  shell.selectTab(1); shell.selectTab(1); assert.equal(shell.hallReselectEpoch, 1);
});
test('Hall reselect animates to top and refreshes the selected channel without changing it', () => {
  const view = loadMethods('features/hall/HallView.ets', '  private onHallReselected()', '  private selectChannel(', { Curve: { EaseOut: 'easeOut' } });
  for (const channel of [HallChannel.SHOWCASES, HallChannel.DEMANDS]) {
    let scroll, requested;
    view.channel = channel; view.contentScroller = { scrollTo(value) { scroll = value; } };
    view.onRefresh = value => requested = value;
    view.onHallReselected(); assert.equal(scroll.yOffset, 0); assert.ok(scroll.animation.duration > 0);
    assert.equal(requested, channel); assert.equal(view.channel, channel);
  }
});
