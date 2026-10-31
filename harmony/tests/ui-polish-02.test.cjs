const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.join(process.env.DEVECO_SDK_HOME,
  'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
require.extensions['.ets'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
}).outputText, f);
const { HallFilterOptions } = require(path.join(root, 'features/hall/HallFilterOptions.ets'));
const { HallFilterState } = require(path.join(root, 'features/hall/HallFilterState.ets'));
const { OriginalImageController } = require(path.join(root, 'common/components/OriginalImageController.ets'));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise, resolve, reject}; };
const pixel = () => ({ released: 0, async release() { this.released++; } });
function fixture(decode = async () => pixel()) {
  const requests = []; const listeners = new Set(); let epoch = 1, state;
  const service = {
    epoch: () => epoch, observe: f => listeners.add(f), unobserve: f => listeners.delete(f),
    acquire(id, variant) { const d = deferred(); const r = {id, variant, ...d, released: 0}; requests.push(r); return {promise: d.promise, release: () => r.released++}; }
  };
  const controller = new OriginalImageController(service, decode, s => state = s);
  return {controller, requests, listeners, get state() {return state;}, identity() {epoch++; for(const f of listeners) f();}};
}

test('province and style menus reject historical values and share canonical values', () => {
  const { ProvinceCatalog } = require(path.join(root, 'common/region/ProvinceCatalog.ets'));
  const options = HallFilterOptions.cities(['南京','南京市','北京市','LEGACY']);
  assert.equal(options.length, 35); assert.equal(options[0].label, '不限地区');
  assert.equal(new Set(options.map(o=>o.value)).size, 35);
  assert.equal(options.filter(o=>o.value==='JS').length, 1);
  for (const value of ['南京','南京市','JS','320100','苏州','苏州市']) assert.equal(ProvinceCatalog.normalize(value),'江苏省');
  assert.equal(ProvinceCatalog.normalize('北京市'),'北京市');
  assert.equal(ProvinceCatalog.normalize('LEGACY'),'');
  assert.equal(HallFilterOptions.styles(['南京','任意历史标签','胶片']).length,16);
});

test('preset prices preserve inclusive bounds and each dynamic date is one exact local day', () => {
  const current = new HallFilterState(); current.style = '胶片';
  for (const option of HallFilterOptions.prices()) {
    const next = HallFilterOptions.choose(current, 2, option);
    assert.equal(next.validate(), ''); assert.equal(next.style, '胶片');
    assert.equal(next.serviceQuery(2,20,'s').maxPriceCent, option.max ? Math.round(Number(option.max)*100) : undefined);
    assert.equal(next.demandQuery(2,20,'s').minBudgetCent, option.min ? Math.round(Number(option.min)*100) : undefined);
  }
  const dates = HallFilterOptions.dates(new Date(2028, 1, 28, 23, 59));
  assert.equal(dates.length, 15);
  assert.deepEqual(dates.slice(1,4).map(d => d.value), ['2028-02-28','2028-02-29','2028-03-01']);
  const f = HallFilterOptions.choose(current, 3, dates[2]);
  assert.equal(f.serviceQuery(1,20,'s').availableDate, '2028-02-29');
  assert.equal(f.demandQuery(1,20,'s').expectedDate, '2028-02-29');
  assert.equal(HallFilterOptions.choose(f, 3, dates[0]).date, '');
});

test('preview selection never downloads original; explicit load uses original and reuses decoded cache', async () => {
  const f = fixture(); f.controller.select(5); assert.equal(f.requests.length,0);
  const p=f.controller.load(); f.controller.load(); assert.equal(f.requests.length,1);
  assert.equal(f.requests[0].id,5); assert.equal(f.requests[0].variant,'original');
  f.requests[0].resolve(new ArrayBuffer(8)); await p;
  assert.equal(f.state.status,'ready'); const cached=f.state.pixels;
  f.controller.select(6); assert.equal(f.state.pixels,undefined);
  f.controller.select(5); await f.controller.load();
  assert.equal(f.state.pixels,cached); assert.equal(f.requests.length,1);
  f.controller.dispose(); assert.equal(cached.released,1); assert.equal(f.listeners.size,0);
});

test('late download and decode cannot put the previous original on the next image', async () => {
  const d=deferred(); const f=fixture(() => d.promise);
  f.controller.select(1); const p=f.controller.load(); f.requests[0].resolve(new ArrayBuffer(8));
  await new Promise(r=>setImmediate(r)); f.controller.select(2);
  const pixels=pixel(); d.resolve(pixels); await p;
  assert.equal(pixels.released,1); assert.equal(f.state.fileId,2); assert.equal(f.state.pixels,undefined);
  f.controller.select(3); const late=f.controller.load(); f.controller.select(4);
  f.requests[1].reject(new Error('late')); await late;
  assert.equal(f.state.fileId,4); assert.equal(f.state.status,'idle');
});

test('HTTP denial, missing original, timeout and corrupt image remain retryable without replacing medium', async () => {
  for (const error of [{httpStatus:401},{httpStatus:403},{httpStatus:404},new Error('timeout')]) {
    const f=fixture(); f.controller.select(9); const p=f.controller.load(); f.requests[0].reject(error); await p;
    assert.equal(f.state.status,'error'); assert.equal(f.state.pixels,undefined); assert.equal(f.state.fileId,9);
    const retry=f.controller.load(); f.requests[1].resolve(new ArrayBuffer(8)); await retry;
    assert.equal(f.state.status,'ready'); f.controller.dispose();
  }
  const corrupt=fixture(async()=>{throw new Error('decode failed');}); corrupt.controller.select(9);
  const p=corrupt.controller.load(); corrupt.requests[0].resolve(new ArrayBuffer(8)); await p;
  assert.equal(corrupt.state.status,'error'); assert.equal(corrupt.state.pixels,undefined);
});

test('identity change drops private originals and bounded cache releases evicted pixels', async () => {
  const f=fixture(); const images=[];
  for(const id of [1,2,3]) { f.controller.select(id); const p=f.controller.load(); f.requests.at(-1).resolve(new ArrayBuffer(8)); await p; images.push(f.state.pixels); }
  assert.equal(images[0].released,1);
  f.identity(); assert.equal(f.state.pixels,undefined); assert.equal(images[1].released,1); assert.equal(images[2].released,1);
  f.controller.select(0); await f.controller.load(); assert.equal(f.state.status,'unavailable'); assert.equal(f.requests.length,3);
});

test('filters are native anchored overlays; original control is confined to the full-screen preview builder', () => {
  const filters=fs.readFileSync(path.join(root,'features/hall/components/HallFilters.ets'),'utf8');
  assert.match(filters,/bindMenu/); assert.doesNotMatch(filters,/bindSheet|TextInput/);
  const gallery=fs.readFileSync(path.join(root,'common/components/PortraGallery.ets'),'utf8');
  const detail=gallery.slice(gallery.indexOf('  build()'));
  assert.doesNotMatch(detail,/original\.message|上一张'|下一张'|查看原图/);
  assert.match(gallery,/bindContentCover/); assert.match(gallery,/Alignment.BottomEnd/);
  assert.match(gallery,/if \(next < 0 \|\| next >= this.count\(\)\)/);
});


test('15 canonical style presets exist before any page is loaded and map exactly to both queries', () => {
  const options = HallFilterOptions.styles([]);
  assert.equal(options.length, 16);
  assert.equal(new Set(options.map(o => o.value)).size, 16);
  for (const option of options.slice(1)) {
    const f = HallFilterOptions.choose(new HallFilterState(), 1, option);
    assert.equal(f.serviceQuery(1,20,'s').style, option.value);
    assert.equal(f.demandQuery(1,20,'s').styleTag, option.value);
  }
  assert.equal(HallFilterOptions.styles(['日系清新', ' 日系清新 ', '']).length, 16);
});

test('stop immediately cancels pending work without releasing still-mounted pixels', async () => {
  const f = fixture(); f.controller.select(1);
  const p = f.controller.load(); f.requests[0].resolve(new ArrayBuffer(8)); await p;
  const cached = f.state.pixels;
  f.controller.select(2); const late = f.controller.load();
  const last = f.state;
  f.controller.stop();
  assert.equal(f.listeners.size, 0);
  assert.ok(f.requests[1].released > 0);
  assert.equal(cached.released, 0);
  f.requests[1].resolve(new ArrayBuffer(8)); await late;
  assert.equal(f.state, last);
  f.controller.dispose(); assert.equal(cached.released, 1);
  f.controller.dispose(); assert.equal(cached.released, 1);
});

test('closing while decoding releases late pixels without publishing again', async () => {
  const decode = deferred(); const f = fixture(() => decode.promise);
  f.controller.select(1); const p=f.controller.load(); f.requests[0].resolve(new ArrayBuffer(8));
  await new Promise(r=>setImmediate(r)); const last=f.state;
  f.controller.stop(); f.controller.dispose();
  const pixels=pixel(); decode.resolve(pixels); await p;
  assert.equal(pixels.released,1); assert.equal(f.state,last);
});

test('ten preview closes hide immediately; delayed disappear cannot close a new preview', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(root, 'common/components/PortraGallery.ets'), 'utf8');
  const methods = src.slice(src.indexOf('  private close('), src.indexOf('  private async decodeOriginal'));
  const jobs=[];
  const context={OriginalImageState: class {}, hilog:{info(){}}, Date, setTimeout: job=>jobs.push(job)};
  vm.createContext(context);
  vm.runInContext(ts.transpileModule('class Gallery {'+methods+'} globalThis.Gallery=Gallery;', {
    compilerOptions:{target:ts.ScriptTarget.ES2021}
  }).outputText,context);
  const g=new context.Gallery(); g.retiring=[]; g.previewGeneration=0;
  for(let i=0;i<10;i++) {
    const c={stopped:0,disposed:0,stop(){this.stopped++},dispose(){this.disposed++}};
    g.previewOpen=true; g.originals=c;
    g.close(); assert.equal(g.previewOpen,false); assert.equal(c.stopped,0); assert.equal(c.disposed,0);
    g.previewOpen=true; // a newer preview can open before the older onDisappear callback
    g.releaseRetired(); assert.equal(g.previewOpen,true); assert.equal(c.disposed,0);
    while (jobs.length) jobs.shift()(); assert.equal(c.stopped,1); assert.equal(c.disposed,1);
  }
  assert.match(src,/height\(48\)\.flexShrink\(0\)\.zIndex\(20\)/);
  assert.match(src,/this\.close\('button-touch'\)/);
  assert.match(src,/imageHeight: '100%'/);
  const hall=fs.readFileSync(path.join(root,'features/hall/HallView.ets'),'utf8');
  assert.match(hall,/bottom: [246]/); assert.match(hall,/flexShrink\(0\)/);
});
