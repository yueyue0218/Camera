const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
let epoch = 1, selection = [], uploaded = [], closed = 0, offset = 0, failUpload = false;
let bytes = Uint8Array.from([255,216,255,1,2,3,4,5]);
const app = { sessionManager: { getSessionVersion: () => epoch, isAuthenticated: () => true }, apiService: {
  cancelCurrentSession() {},
  async uploadImage(data, biz, mime) { uploaded.push({data, biz, mime}); if (failUpload) throw new Error('HTTP 413'); return {fileId: uploaded.length + 100}; }
}};
const picker = { PhotoViewMIMETypes: {IMAGE_TYPE: 'image'}, PhotoViewPicker: class {
  async select(options) { assert.ok(options.maxSelectNumber <= 9); return {photoUris: selection}; }
}};
const fileIo = { OpenMode: {READ_ONLY: 0}, async open() { offset = 0; return {fd: 1}; },
  async stat() {return {size: bytes.length};}, async read(fd, buffer) {
    const count = Math.min(3, bytes.length - offset); new Uint8Array(buffer).set(bytes.slice(offset, offset + count)); offset += count; return count;
  }, async close() {closed++;}
};
function load(relative, page = false) {
  const filename = path.resolve(__dirname, '../entry/src/main/ets', relative);
  let source = fs.readFileSync(filename, 'utf8');
  if (page) source = (source.slice(0, source.includes('  @Builder') ? source.indexOf('  @Builder') : source.indexOf('  build()')) + '\n}')
    .replace(/^@Component\s*$/m, '').replace('export struct ', 'export class ').replace(/@(State|Prop)\s+/g, '').replace(/@Watch\('[^']+'\)\s*/g, '');
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name.endsWith('/AppClient')) return {AppClient: {shared: app}};
    if (name === '@kit.MediaLibraryKit') return {photoAccessHelper: picker};
    if (name === '@kit.CoreFileKit') return {fileIo};
    if (name.endsWith('/JournalText')) return load('features/publish/JournalText.ets');
    if (name.endsWith('/ImageUpload')) return {ImageUpload};
    if (name.endsWith('/ErrorMapper')) return errors;
    if (name.endsWith('/ContentChanges')) return {ContentChanges: {publish() {events++;}}};
    if (name.endsWith('/HallFilterState')) return load('features/hall/HallFilterState.ets');
    if (name.endsWith('/HallUiModels')) return load('features/hall/HallUiModels.ets');
    if (name.endsWith('/HallDataPolicy')) return load('features/hall/HallDataPolicy.ets');
    if (name.endsWith('/HallUnreadCounter')) return load('features/notifications/HallUnreadCounter.ets');
    return {};
  };
  m._compile(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021}}).outputText, filename);
  return m.exports;
}
let events = 0;
const errors = load('network/ErrorMapper.ets');
const { ImageUpload } = load('network/ImageUpload.ets');
const { PublishPage } = load('pages/PublishPage.ets', true);
function page() { const p = new PublishPage(); Object.assign(p, {identity: epoch, role: 'CUSTOMER', sessionLoading: false,
  title: '主题', city: '上海', place: '公园', time: '周六', description: '描述', minBudget: '100', maxBudget: '200'}); return p; }
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }

test('picker cancellation, partial URI reads, valid file ID and file close', async () => {
  selection=[]; assert.equal(await ImageUpload.pick('DEMAND_REFERENCE'), undefined);
  selection=['uri:a']; const before=closed;
  assert.ok(await ImageUpload.pick('DEMAND_REFERENCE') > 0);
  assert.deepEqual(new Uint8Array(uploaded.at(-1).data), bytes);
  assert.equal(closed,before+1); assert.equal(uploaded.at(-1).mime,'image/jpeg');
  await assert.rejects(ImageUpload.upload('uri:a','DEMAND_REFERENCE',epoch-1), /账号/);
});

test('multi-select deduplicates, caps at nine, failed uploads block publish, retry and delete synchronize IDs', async () => {
  const p=page(); selection=['uri:1','uri:1','uri:2']; failUpload=true;
  await p.pickImage(); assert.equal(p.images.length,2); assert.equal(p.fileIds.length,0);
  let creates=0; app.apiService.createDemand=async()=>{creates++;return {demandId:88};};
  await p.publish(); assert.equal(creates,0); assert.match(p.errorMessage,/上传/);
  failUpload=false; await p.retryImages(); assert.equal(p.fileIds.length,2);
  p.removeImage(p.images[0].uri,p.images[0].fileId); assert.equal(p.fileIds.length,1);
  selection=Array.from({length:12},(_,i)=>`uri:new${i}`); await p.pickImage(); assert.equal(p.imageCount(),9);
  const payloads=[]; app.apiService.createDemand=async payload=>{payloads.push(payload);return {demandId:88};};
  await p.publish(); assert.deepEqual(payloads[0].referenceFileIds,p.fileIds); assert.equal(payloads[0].portfolioIds,undefined);
});

test('double click and post-success click create once; real ID navigates and invalidates hall', async () => {
  const p=page(), pending=deferred(); let calls=0, opened=0; const before=events;
  app.apiService.createDemand=()=>{calls++;return pending.promise;}; p.onPublished=id=>opened=id;
  const save=p.publish(); await p.publish(); assert.equal(calls,1); assert.equal(p.submitting,true);
  pending.resolve({demandId:72}); await save; await p.publish();
  assert.equal(calls,1); assert.equal(opened,72); assert.equal(events,before+1);
});

test('timeout preserves form and references without replay; malformed success does not navigate', async () => {
  const p=page(); p.fileIds=[45]; let calls=0, opened=0;
  app.apiService.createDemand=async()=>{calls++;throw errors.ErrorMapper.fromTransportCode(2300028);};
  p.onPublished=()=>opened++;
  await p.publish(); assert.equal(calls,1); assert.equal(p.title,'主题'); assert.deepEqual(p.fileIds,[45]);
  assert.match(p.errorMessage,/未自动重发/); assert.equal(p.submitting,false);
  app.apiService.createDemand=async()=>({demandId:0}); await p.publish(); assert.equal(opened,0); assert.equal(p.completed,false);
});

test('late success after close invalidates hall but cannot navigate; old identity errors cannot overwrite', async () => {
  const p=page(), pending=deferred(); let opened=0; const before=events;
  app.apiService.createDemand=()=>pending.promise; p.onPublished=()=>opened++;
  const save=p.publish(); p.aboutToDisappear(); pending.resolve({demandId:73}); await save;
  assert.equal(opened,0); assert.equal(events,before+1);
  const q=page(), failure=deferred(); app.apiService.createDemand=()=>failure.promise;
  const other=q.publish(); epoch++; q.errorMessage='新身份'; failure.reject(new Error('旧错误')); await other;
  assert.equal(q.errorMessage,'新身份');
});


test('hall content change invalidates old cursors and starts both feeds without touching filters', async () => {
  const {HallPage} = load('pages/HallPage.ets', true);
  const h = new HallPage(); const filters=h.demandFilters; filters.city='上海';
  h.servicePage=5; h.demandPage=7; h.serviceHasMore=true; h.demandHasMore=true;
  h.serviceItems=[{serviceId:3}]; h.demandItems=[{demandId:4}];
  let cancelled=0; const loads=[];
  app.apiService.cancelServicePackages=()=>cancelled++;
  app.apiService.cancelDemands=()=>cancelled++;
  h.loadServices=(version,page,append)=>loads.push(['services',version,page,append]);
  h.loadDemands=(version,page,append)=>loads.push(['demands',version,page,append]);
  await h.refreshContent();
  assert.equal(cancelled,2); assert.equal(h.servicePage,0); assert.equal(h.demandPage,0);
  assert.equal(h.demandHasMore,false); assert.deepEqual(h.demandItems,[]);
  assert.deepEqual(loads,[['services',1,1,false],['demands',1,1,false]]);
  assert.equal(h.demandFilters,filters); assert.equal(h.demandFilters.city,'上海');
});
