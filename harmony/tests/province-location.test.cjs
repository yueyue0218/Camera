const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root=path.resolve(__dirname,'../entry/src/main/ets');
function fixture(){
 let granted=true,consent=true,business=true,enabled=true,geocoder=true,coordinateError,geocodeError;
 let grantOnPrompt=false,requestResult,settingsGrant=false,afterCoordinates;
 let calls=0,prompts=0,reverse=0,settings=0,promptContext;
 let addresses=[{countryCode:'CN',administrativeArea:'江苏省',locality:'南京市',street:'never retain'}];
 const trace=[];
 const geo={LocationRequestPriority:{FIRST_FIX:0},isLocationEnabled:()=>enabled,isGeocoderAvailable:()=>geocoder,
 async getCurrentLocation(){calls++;if(coordinateError)throw coordinateError;afterCoordinates?.();return {latitude:32,longitude:118};},
 async getAddressesFromLocation(){reverse++;if(geocodeError)throw geocodeError;return addresses;}};
 const access={GrantStatus:{PERMISSION_GRANTED:0},createAtManager:()=>({checkAccessTokenSync:()=>granted?0:-1,
 async requestPermissionsFromUser(context){prompts++;promptContext=context;if(grantOnPrompt)granted=true;
 return requestResult??{authResults:[granted?0:-1],dialogShownResults:[true],errorReasons:[0]};},
 async requestPermissionOnSetting(){settings++;granted=settingsGrant;return [granted?0:-1];}})};
 function load(file){const name=path.join(root,file),mod=new Module(name,module);mod.require=n=>{
 if(n==='@kit.LocationKit')return {geoLocationManager:geo};
 if(n==='@kit.AbilityKit')return {abilityAccessCtrl:access};
 if(n.endsWith('/AppClient'))return {AppClient:{shared:{hasRequiredPrivacyConsent:()=>consent,canUseBusinessNetwork:()=>consent&&business}}};
 if(n.endsWith('/ProvinceCatalog'))return load('common/region/ProvinceCatalog.ets');
 if(n.endsWith('/UiPerf'))return {UiPerf:{mark:l=>trace.push(l)}};
 return {};};mod._compile(ts.transpileModule(fs.readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,name);return mod.exports;}
 const {ProvinceLocation:service}=load('common/location/ProvinceLocation.ets');
 return {service,context:{applicationInfo:{accessTokenId:1}},trace,geo,
 get calls(){return calls},get prompts(){return prompts},get reverse(){return reverse},
 get settings(){return settings},get promptContext(){return promptContext},
 set grantOnPrompt(v){grantOnPrompt=v},set requestResult(v){requestResult=v},set settingsGrant(v){settingsGrant=v},
 set afterCoordinates(v){afterCoordinates=v},
 set granted(v){granted=v},set consent(v){consent=v},set business(v){business=v},set enabled(v){enabled=v},set geocoder(v){geocoder=v},
 set coordinateError(v){coordinateError=v},set geocodeError(v){geocodeError=v},set addresses(v){addresses=v}};
}
test('concurrent requests deduplicate, share province/city, cache without coordinates and notify both consumers',async()=>{
 const f=fixture();let hall=0,profile=0;f.service.observe(()=>hall++);f.service.observe(()=>profile++);
 const [a,b]=await Promise.all([f.service.locate(f.context),f.service.locate(f.context)]);
 assert.equal(a,b);assert.equal(f.calls,1);assert.equal(f.reverse,1);assert.equal(f.prompts,0);
 assert.equal(a.province,'江苏省');assert.equal(a.label(),'江苏省 · 南京市');assert.deepEqual(Object.keys(a),['province','city']);
 assert.equal(hall,1);assert.equal(profile,1);assert.equal(await f.service.locate(f.context),a);assert.equal(f.calls,1);
});
test('passive entry never requests permission and denial never obtains coordinates',async()=>{
 const f=fixture();f.granted=false;await f.service.refreshAuthorized(f.context);assert.equal(f.prompts,0);assert.equal(f.calls,0);
 await assert.rejects(f.service.locate(f.context),/未授权/);assert.equal(f.prompts,1);assert.equal(f.calls,0);
});
test('switch, coordinate timeout and reverse failure remain distinct',async()=>{
 const f=fixture();f.enabled=false;await assert.rejects(f.service.locate(f.context),/开启位置服务/);assert.equal(f.calls,0);
 f.enabled=true;f.coordinateError={code:3301200};await assert.rejects(f.service.locate(f.context),/超时/);
 f.coordinateError=undefined;f.geocodeError={code:3301300};await assert.rejects(f.service.locate(f.context),/已取得位置.*3301300/);
 assert.equal(f.service.cached(f.context),undefined);assert.ok(f.trace.includes('location.coordinates.valid'));
});
test('permission withdrawal removes cached location and passive failure is throttled',async()=>{
 const f=fixture();await f.service.locate(f.context);f.granted=false;assert.equal(f.service.cached(f.context),undefined);
 await f.service.refreshAuthorized(f.context);f.granted=true;f.coordinateError={code:3301200};
 await f.service.refreshAuthorized(f.context);await f.service.refreshAuthorized(f.context);assert.equal(f.calls,2);
});
test('unknown region never succeeds; street-level locality never becomes display text',async()=>{
 const f=fixture();f.addresses=[{administrativeArea:'unknown'}];await assert.rejects(f.service.locate(f.context),/无法识别/);
 f.addresses=[{administrativeArea:'北京市',locality:'某某路10号'}];const a=await f.service.locate(f.context);assert.equal(a.label(),'北京市');
});
test('first successful authorization uses the supplied UIAbilityContext, then reuses permission without prompting',async()=>{
 const f=fixture();f.granted=false;f.grantOnPrompt=true;
 const a=await f.service.locate(f.context);
 assert.equal(f.promptContext,f.context);assert.equal(f.prompts,1);assert.equal(a.label(),'江苏省 · 南京市');
 let evidence=f.service.diagnostics();assert.equal(evidence.switchState,'on');assert.equal(evidence.permissionState,'granted');
 assert.deepEqual(evidence.authResults,[0]);assert.deepEqual(evidence.dialogShownResults,[true]);
 assert.equal(evidence.coordinatesState,'valid');assert.equal(evidence.geocoderState,'resolved');assert.equal(evidence.phase,'complete');
 assert.equal(await f.service.locate(f.context),a);assert.equal(f.prompts,1);assert.equal(f.calls,1);
 assert.equal(f.service.diagnostics().phase,'cache');
});
test('system switch is checked before permission prompt and before returning cached success',async()=>{
 const f=fixture();f.granted=false;f.enabled=false;
 await assert.rejects(f.service.locate(f.context),/开启位置服务/);assert.equal(f.prompts,0);assert.equal(f.calls,0);
 assert.equal(f.service.diagnostics().switchState,'off');assert.equal(f.service.diagnostics().permissionState,'not-checked');
 f.enabled=true;f.granted=true;await f.service.locate(f.context);f.enabled=false;
 await assert.rejects(f.service.locate(f.context),/开启位置服务/);assert.equal(f.calls,1);
});
test('permanent denial is distinguished from a fresh refusal and settings grant is verified',async()=>{
 const f=fixture();f.granted=false;f.requestResult={authResults:[-1],dialogShownResults:[false],errorReasons:[0]};
 await assert.rejects(f.service.locate(f.context),e=>e.permissionSettingsRequired===true&&e.phase==='permission');
 assert.equal(f.calls,0);assert.deepEqual(f.service.diagnostics().dialogShownResults,[false]);
 await assert.rejects(f.service.authorizeOnSettings(f.context),/仍未授权/);assert.equal(f.calls,0);
 f.settingsGrant=true;await f.service.authorizeOnSettings(f.context);assert.equal(f.settings,2);
 const a=await f.service.locate(f.context);assert.equal(a.province,'江苏省');assert.equal(f.prompts,1);
});
test('invalid or empty authResults cannot be treated as success even when no dialog is shown',async()=>{
 for(const results of [[2],[],[-1]]){
  const f=fixture();f.granted=false;f.requestResult={authResults:results,dialogShownResults:[false],errorReasons:[3]};
  await assert.rejects(f.service.locate(f.context));assert.equal(f.calls,0);
  assert.deepEqual(f.service.diagnostics().authResults,results);assert.deepEqual(f.service.diagnostics().permissionErrorReasons,[3]);
 }
});
test('privacy withdrawal while obtaining coordinates prevents reverse geocoding and cache publication',async()=>{
 const f=fixture();f.afterCoordinates=()=>{f.consent=false;};
 await assert.rejects(f.service.locate(f.context),/同意已失效/);assert.equal(f.calls,1);assert.equal(f.reverse,0);
 assert.equal(f.service.cached(f.context),undefined);assert.equal(f.service.diagnostics().coordinatesState,'valid');
});
test('withdrawal suspension stops system reverse geocoding before the server withdrawal completes',async()=>{
 const f=fixture();f.afterCoordinates=()=>{f.business=false;};
 await assert.rejects(f.service.locate(f.context),/同意已失效/);assert.equal(f.calls,1);assert.equal(f.reverse,0);
 assert.equal(f.service.cached(f.context),undefined);
});
test('simulator geocoder unavailability and system errors preserve the actual failing stage without fake region',async()=>{
 const f=fixture();f.geocoder=false;
 await assert.rejects(f.service.locate(f.context),/不支持地区解析/);
 let evidence=f.service.diagnostics();assert.equal(evidence.coordinatesState,'valid');assert.equal(evidence.geocoderState,'unsupported');
 assert.equal(evidence.phase,'geocoder');assert.equal(f.service.cached(f.context),undefined);
 f.geocoder=true;f.geocodeError={code:3301300};await assert.rejects(f.service.locate(f.context),/3301300/);
 evidence=f.service.diagnostics();assert.equal(evidence.systemErrorCode,3301300);assert.equal(evidence.phase,'geocoder');
 assert.equal(evidence.geocoderState,'failed');assert.equal(f.service.cached(f.context),undefined);
 assert.equal(JSON.stringify(evidence).includes('latitude'),false);assert.equal(JSON.stringify(evidence).includes('longitude'),false);
 evidence.authResults.push(99);assert.equal(f.service.diagnostics().authResults.includes(99),false);
});
