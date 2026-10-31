const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
function fixture() {
  let granted = true, privacy = true, enabled = true, epoch = 1, switchError, coordinateError, geocodeError, permissionError;
  let available = true, grantOnPrompt = false, dialogShown = true, afterCoordinates, coordinates, permissionChanged;
  let addresses = [{ countryCode: 'CN', administrativeArea: '江苏省', locality: '南京市' }];
  let calls = 0, prompts = 0, reverse = 0, switches = 0;
  const privacyObservers = new Set(), trace = [];
  const manager = { checkAccessTokenSync: () => { if(permissionError) throw {code:permissionError}; return granted ? 0 : -1; },
    on: (_type, _list, fn) => { permissionChanged = fn; },
    async requestPermissionsFromUser() { prompts++; if (grantOnPrompt) granted = true;
      return { authResults: [granted ? 0 : -1], dialogShownResults: [dialogShown], errorReasons: [0] }; },
    async requestPermissionOnSetting() { if (grantOnPrompt) granted = true; return [granted ? 0 : -1]; } };
  const geo = { LocationRequestPriority: { FIRST_FIX: 0x203 },
    isLocationEnabled() { switches++; if (switchError) throw { code: switchError }; return enabled; },
    async getCurrentLocation(request) { calls++; assert.equal(request.timeoutMs, 10000); if (coordinateError) throw { code: coordinateError };
      const value = coordinates ? await coordinates : { latitude: 0, longitude: 0 }; afterCoordinates?.(); return value; },
    isGeocoderAvailable: () => available,
    async getAddressesFromLocation() { reverse++; if (geocodeError) throw { code: geocodeError }; return addresses; } };
  function load(file) {
    const name = path.join(root, file), mod = new Module(name, module);
    mod.require = n => {
      if (n === '@kit.LocationKit') return { geoLocationManager: geo };
      if (n === '@kit.AbilityKit') return { abilityAccessCtrl: { createAtManager: () => manager,
        GrantStatus: { PERMISSION_GRANTED: 0 }, PermissionStateChangeType: { PERMISSION_REVOKED_OPER: 0 } } };
      if (n.endsWith('/AppClient')) return { AppClient: { shared: { hasRequiredPrivacyConsent: () => privacy,
        canUseBusinessNetwork: () => privacy, sessionManager: { getSessionVersion: () => epoch },
        observePrivacyAccess: fn => privacyObservers.add(fn) } } };
      if (n.endsWith('/ProvinceCatalog')) return load('common/region/ProvinceCatalog.ets');
      if (n.endsWith('/UiPerf')) return { UiPerf: { mark: s => trace.push(s) } };
      return {};
    };
    mod._compile(ts.transpileModule(fs.readFileSync(name, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, name);
    return mod.exports;
  }
  const { ProvinceLocation: service } = load('common/location/ProvinceLocation.ets');
  const { ProvinceCatalog: catalog } = load('common/region/ProvinceCatalog.ets');
  return { service, catalog, context: { applicationInfo: { accessTokenId: 1 } }, trace,
    get calls() { return calls; }, get prompts() { return prompts; }, get reverse() { return reverse; }, get switches() { return switches; },
    set permissionError(v) { permissionError = v; }, set enabled(v) { enabled = v; }, set switchError(v) { switchError = v; }, set granted(v) { granted = v; },
    set coordinateError(v) { coordinateError = v; }, set geocodeError(v) { geocodeError = v; }, set available(v) { available = v; },
    set grantOnPrompt(v) { grantOnPrompt = v; }, set dialogShown(v) { dialogShown = v; },
    set afterCoordinates(v) { afterCoordinates = v; }, set coordinates(v) { coordinates = v; }, set addresses(v) { addresses = v; },
    revoke() { granted = false; permissionChanged?.({ change: 0 }); }, regrant() { granted = true; permissionChanged?.({ change: 1 }); },
    withdraw() { privacy = false; privacyObservers.forEach(fn => fn()); }, identityChanged() { epoch++; } };
}
test('34 unique provinces and canonical names; legacy city aliases never become options', () => {
  const f = fixture(); assert.equal(f.catalog.all.length, 34);
  assert.equal(new Set(f.catalog.all.map(p => p.code)).size, 34);
  assert.equal(f.catalog.all.filter(p => p.name.endsWith('省')).length, 23);
  assert.equal(f.catalog.all.filter(p => p.name.endsWith('自治区')).length, 5);
  for (const [value, code] of [['南京', 'JS'], ['南京市', 'JS'], ['NJ', 'JS'], ['JS', 'JS'], ['江苏', 'JS'], ['江苏省', 'JS'],
    ['320102', 'JS'], ['杭州市', 'ZJ'], ['深圳市', 'GD'], ['北京', 'BJ'], ['香港', 'HK'], ['台湾', 'TW']]) assert.equal(f.catalog.code(value), code);
  assert.equal(f.catalog.code(''), ''); assert.equal(f.catalog.code('unknown'), ''); assert.equal(f.catalog.code('320ABC'), '');
  assert.throws(() => f.catalog.requireCode('unknown'));
});
test('switch off stops before permission; re-enabled switch permits real request path', async () => {
  const f = fixture(); f.enabled = false; f.granted = false;
  await assert.rejects(f.service.locate(f.context), e => e.kind === 'switch-off');
  assert.equal(f.prompts, 0); assert.equal(f.calls, 0); assert.equal(f.service.diagnostics().switchState, 'off');
  f.enabled = true; f.grantOnPrompt = true; const region = await f.service.locate(f.context);
  assert.equal(region.code, 'JS'); assert.equal(region.label(), '江苏省'); assert.equal(f.calls, 1);
});
for (const [code, kind] of [[801, 'unsupported'], [3301000, 'service-unavailable'], [201, 'permission-denied']]) {
  test(`switch query error ${code} remains unknown, never switch-off`, async () => {
    const f = fixture(); f.switchError = code;
    await assert.rejects(f.service.locate(f.context), e => e.kind === kind && e.systemErrorCode === code);
    assert.equal(f.service.diagnostics().switchState, 'unknown'); assert.equal(f.calls, 0);
  });
}
test('first grant and granted re-entry reuse permission; simultaneous requests are deduplicated', async () => {
  const f = fixture(); f.granted = false; f.grantOnPrompt = true;
  const [a,b] = await Promise.all([f.service.locate(f.context), f.service.locate(f.context)]);
  assert.equal(a,b); await f.service.locate(f.context); assert.equal(f.prompts,1); assert.equal(f.calls,1); assert.equal(f.reverse,1);
  assert.ok(f.switches >= 2); assert.deepEqual(Object.keys(a), ['code','province']);
});
test('denial never requests coordinates; permanent denial exposes explicit settings action', async () => {
  const f = fixture(); f.granted = false; f.dialogShown = false;
  await assert.rejects(f.service.locate(f.context), e => e.kind === 'permission-denied' && e.permissionSettingsRequired);
  assert.equal(f.calls,0); f.grantOnPrompt = true; await f.service.authorizeOnSettings(f.context); await f.service.locate(f.context);
  assert.equal(f.calls,1);
});
for (const [code, kind] of [[201,'permission-denied'],[3301100,'switch-off'],[3301200,'position-unavailable'],[3301000,'service-unavailable'],[801,'unsupported']]) {
  test(`coordinate error ${code} is accurately classified`, async () => {
    const f=fixture(); f.coordinateError=code;
    await assert.rejects(f.service.locate(f.context), e => e.kind===kind && e.systemErrorCode===code);
    assert.equal(f.reverse,0); assert.equal(f.service.cached(f.context),undefined);
  });
}
for (const [code,kind] of [[3301300,'geocoder-failed'],[801,'geocoder-unsupported'],[3301000,'service-unavailable']]) {
  test(`valid synthetic position followed by geocoder ${code} never claims region success`, async () => {
    const f=fixture(); f.geocodeError=code;
    await assert.rejects(f.service.locate(f.context),e=>e.kind===kind && e.systemErrorCode===code);
    assert.equal(f.service.diagnostics().coordinatesState,'valid'); assert.equal(f.service.cached(f.context),undefined);
  });
}
test('unsupported geocoder and unrecognized/empty addresses have manual fallback errors', async () => {
  const f=fixture();f.available=false;await assert.rejects(f.service.locate(f.context),e=>e.kind==='geocoder-unsupported');
  f.available=true;for(const addresses of [[],[{administrativeArea:'unknown'}]]){f.addresses=addresses;await assert.rejects(f.service.locate(f.context),e=>e.kind==='region-invalid');}
});
test('permission event clears cache permanently across regrant and notifies every observer',async()=>{
  const f=fixture();f.service.bind();await f.service.locate(f.context);let delivered=0;
  f.service.observe(()=>{throw new Error('synthetic observer failure')});f.service.observe(()=>delivered++);
  f.revoke();f.regrant();assert.equal(f.service.cached(f.context),undefined);assert.ok(delivered>0);
  await f.service.locate(f.context);assert.equal(f.calls,2);assert.ok(delivered>1);
});
test('cached permission-check failure clears, even without permission observer support',async()=>{
  const f=fixture();await f.service.locate(f.context);f.granted=false;assert.equal(f.service.cached(f.context),undefined);
  f.granted=true;assert.equal(f.service.cached(f.context),undefined);
});
test('privacy withdrawal and session change reject in-flight publication',async()=>{
  for(const privacy of [true,false]){const f=fixture();f.service.bind();f.afterCoordinates=()=>privacy?f.withdraw():f.identityChanged();
    await assert.rejects(f.service.locate(f.context));assert.equal(f.reverse,0);assert.equal(f.service.cached(f.context),undefined);}
});
test('foreground rechecks switch after settings and refreshes granted region without popup',async()=>{
  const f=fixture();f.enabled=false;await assert.rejects(f.service.locate(f.context));f.service.onBackground();f.enabled=true;
  await f.service.onForeground(f.context);assert.equal(f.service.cached(f.context).code,'JS');assert.equal(f.prompts,0);
  f.service.onBackground();assert.equal(f.service.cached(f.context),undefined);await f.service.onForeground(f.context);assert.equal(f.calls,2);
});
test('expiry and identity change cannot return previous cached region',async()=>{
  const f=fixture();await f.service.locate(f.context);f.service.expires=0;await f.service.locate(f.context);assert.equal(f.calls,2);
  f.identityChanged();assert.equal(f.service.cached(f.context),undefined);
});
test('diagnostics contain no location/address/identity payload and are defensive copies',async()=>{
  const f=fixture();await f.service.locate(f.context);const d=f.service.diagnostics();
  assert.doesNotMatch(JSON.stringify(d),/latitude|longitude|南京|江苏|token|address/i);
  d.authResults.push(99);assert.equal(f.service.diagnostics().authResults.includes(99),false);
});

test('manual picker/query/publish boundaries use canonical codes and reject arbitrary text', () => {
  const previous = require.extensions['.ets'];
  require.extensions['.ets'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, filename);
  try {
    const { HallFilterState } = require('../entry/src/main/ets/features/hall/HallFilterState.ets');
    const { HallFilterOptions } = require('../entry/src/main/ets/features/hall/HallFilterOptions.ets');
    const { ProvincePayload } = require('../entry/src/main/ets/common/region/ProvincePayload.ets');
    const options = HallFilterOptions.cities(); assert.equal(options.length,35);
    const selected = HallFilterOptions.choose(new HallFilterState(),0,options.find(p=>p.value==='JS'));
    assert.equal(selected.serviceQuery(1,20,'seed').cityCode,'JS');
    assert.equal(selected.demandQuery(2,20,'seed').cityCode,'JS');
    assert.equal(ProvincePayload.demand({cityCode:'南京',location:'校园'}).cityCode,'JS');
    assert.equal(ProvincePayload.service({cityCode:'深圳市',serviceArea:'校园'}).cityCode,'GD');
    assert.throws(()=>ProvincePayload.demand({cityCode:'校园'}));
    assert.throws(()=>ProvincePayload.service({cityCode:'unknown'}));
    assert.equal(ProvincePayload.demand({cityCode:'JS',location:'校园'}).location,'校园');
    const { RegionSelectionGuard }=require('../entry/src/main/ets/common/region/RegionSelectionGuard.ets');
    const guard=new RegionSelectionGuard();guard.appear();const request=guard.begin(1);
    assert.equal(guard.accepts(request,1,true),true);assert.equal(guard.accepts(request,2,true),false);
    assert.equal(guard.accepts(request,1,false),false);guard.invalidate();assert.equal(guard.accepts(request,1,true),false);
    const next=guard.begin(1);guard.leave();assert.equal(guard.accepts(next,1,true),false);
  } finally { require.extensions['.ets']=previous; }
});

test('permission-query SDK failure keeps its original code and never opens a permission prompt',async()=>{
  const f=fixture();f.permissionError=201;
  await assert.rejects(f.service.locate(f.context),e=>e.kind==='permission-denied'&&e.systemErrorCode===201);
  assert.equal(f.prompts,0);assert.equal(f.calls,0);assert.equal(f.service.diagnostics().systemErrorCode,201);
});

test('both UI consumers observe shared in-flight state and the same published province',async()=>{
  const f=fixture();let finish;f.coordinates=new Promise(resolve=>{finish=resolve});
  const hall=[],profile=[];
  const observe=target=>()=>target.push({busy:f.service.isLocating(),code:f.service.cached(f.context)?.code});
  f.service.observe(observe(hall));f.service.observe(observe(profile));
  const request=f.service.locate(f.context);assert.equal(f.service.isLocating(),true);
  finish({latitude:0,longitude:0});await request;
  assert.equal(f.service.isLocating(),false);assert.deepEqual(hall,profile);
  assert.ok(hall.some(v=>v.busy));assert.equal(hall.at(-1).code,'JS');assert.equal(hall.at(-1).busy,false);
});
