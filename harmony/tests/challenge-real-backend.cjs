// Explicit opt-in loopback test against the existing candidate JAR + isolated H2 harness.
// Only Harmony NetworkKit is adapted to Node fetch; App API/HTTP/consent code is real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const evidenceDir = path.resolve(__dirname, '../../output/portra-protocol-test');
const log = () => fs.readFileSync(path.join(evidenceDir, 'server.log'), 'utf8');
const port = log().match(/PROTOCOL_PORT=(\d+)/)?.[1];
assert.ok(port, 'Start ProtocolHarness first');
const origin = `http://127.0.0.1:${port}`;
const smsCode = () => [...log().matchAll(/PROTOCOL_SMS=(\d{6})/g)].at(-1)?.[1];
let requests = 0;
const http = {
  RequestMethod: { GET:'GET', POST:'POST', PUT:'PUT', PATCH:'PATCH', DELETE:'DELETE' },
  HttpDataType: { STRING:1, ARRAY_BUFFER:2 },
  createHttp() {
    const controller = new AbortController();
    return { async request(url, options) {
      assert.equal(new URL(url).origin, origin, 'Test must never reach external services');
      requests++;
      const response = await fetch(url, { method: options.method, headers: options.header,
        body: options.extraData, signal: controller.signal });
      return { responseCode:response.status, result:await response.text(), header:Object.fromEntries(response.headers) };
    }, destroy() { controller.abort(); } };
  }
};
class BuildProfile { static PORTRA_ENVIRONMENT='dev'; static PORTRA_BASE_URL=origin; }
require.extensions['.ets'] = (module, filename) => {
  const original = module.require.bind(module);
  module.require = name => name==='@kit.NetworkKit' ? { http } : name.endsWith('/BuildProfile') ? { default:BuildProfile } : original(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText, filename);
};
const { HttpClient }=require('../entry/src/main/ets/network/HttpClient.ets');
const { ApiService }=require('../entry/src/main/ets/network/ApiService.ets');
const { PrivacyApi }=require('../entry/src/main/ets/privacy/PrivacyApi.ets');
const { PrivacyRequestGuard }=require('../entry/src/main/ets/privacy/PrivacyRequestGuard.ets');
const passed=[];
const check=(label)=>{passed.push(label); console.log('PASS '+label);};
const phone='13800138000', device='isolated-protocol-device';
const guard=new PrivacyRequestGuard(()=>({current:true,acceptedAtEpochMs:Date.now(),crossBorderConsentVersion:'2026-10-29-v1',installationId:device}));
const client=new HttpClient(undefined,undefined,guard), api=new ApiService(client), privacy=new PrivacyApi(client);
async function rawVerify(body) {
  const response=await fetch(origin+'/auth/native/sms/verify',{method:'POST',headers:{'Content-Type':'application/json',...guard.headers()},body:JSON.stringify(body)});
  return response.json();
}
(async()=>{
  assert.equal((await rawVerify({phone,purpose:'LOGIN',code:'123456',deviceId:device})).code,40001);
  check('real controller rejects missing challengeId');
  const first=await api.sendLoginCode(phone,device), firstCode=smsCode();
  assert.match(first.challengeId,/^[0-9a-f-]{36}$/); assert.ok(first.expiresAt);
  check('App reads real send challenge envelope');
  const current=await api.sendLoginCode(phone,device), code=smsCode();
  assert.notEqual(first.challengeId,current.challengeId);
  await assert.rejects(api.verifyLoginCode(phone,firstCode,device,first.challengeId),e=>e.businessCode===40002);
  check('resend invalidates prior challenge');
  await assert.rejects(api.verifyLoginCode('13900139000',code,device,current.challengeId),e=>e.businessCode===40002);
  check('challenge cannot authenticate another phone');
  await assert.rejects(api.verifyLoginCode(phone,code==='000000'?'111111':'000000',device,current.challengeId),e=>e.businessCode===40002);
  check('incorrect code rejected');
  const session=await api.verifyLoginCode(phone,code,device,current.challengeId);
  assert.ok(session.accessToken && session.refreshToken && session.userId>0);
  check('real authentication issues native session through App API');
  await assert.rejects(api.verifyLoginCode(phone,code,device,current.challengeId),e=>e.businessCode===40002);
  check('consumed challenge cannot be replayed');
  client.setAccessToken(session.accessToken);
  const consent=await privacy.consent(); assert.equal(consent.status,'NOT_RECORDED');
  // Direct HTTP confirms the server guard too; no local grant can bypass it.
  const business=await fetch(origin+'/users/me',{headers:{Authorization:'Bearer '+session.accessToken}}).then(r=>r.json());
  assert.equal(business.code,40302); check('server requires account consent without client headers');
  const payload={status:'GRANTED',privacyPolicyVersion:'2026-10-29-v1',crossBorderConsentVersion:'2026-10-29-v1',installationId:device,acceptedAtEpochMs:Date.now()};
  assert.equal((await privacy.updateConsent(payload)).status,'GRANTED'); guard.verified();
  assert.ok(await client.get('/users/me')); check('App saves consent and accesses authenticated business API');
  assert.equal((await privacy.updateConsent({...payload,status:'WITHDRAWN',acceptedAtEpochMs:Date.now()})).status,'WITHDRAWN');
  await assert.rejects(client.get('/users/me'),e=>e.businessCode===40302); check('withdrawn consent blocks business');
  assert.equal((await privacy.consent()).status,'WITHDRAWN'); check('privacy entry remains accessible after withdrawal');
  assert.equal((await privacy.updateConsent({...payload,acceptedAtEpochMs:Date.now()+1})).status,'GRANTED'); guard.verified();
  const closure=await privacy.closureCode(phone,device), closureCode=smsCode();
  assert.match(closure.challengeId,/^[0-9a-f-]{36}$/);
  await assert.rejects(api.verifyLoginCode(phone,closureCode,device,closure.challengeId),e=>e.businessCode===40002);
  check('account closure challenge cannot be used as login challenge');
  assert.equal((await privacy.closeAccount(phone,closureCode,closure.challengeId)).status,'CLOSED');
  check('App closure request carries the bound challenge');
  fs.writeFileSync(path.join(evidenceDir,'app-protocol-result.json'),JSON.stringify({passed,failed:0,requests,transport:'real loopback HTTP',database:'isolated in-memory H2',sms:'test transport',productionTouched:false},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
