const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const ID='12345678-1234-1234-1234-123456789abc';
function pending(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(){
  const sends=[],verifies=[];let signed=0;
  const app={getDeviceId:()=> 'device-a',synchronizePrivacyConsent:async()=>{},
    sessionManager:{getSessionVersion:()=>1,signIn:async()=>{signed++;return true;}},
    apiService:{sendLoginCode(...args){const p=pending();sends.push({...p,args});return p.promise;},
      verifyLoginCode(...args){const p=pending();verifies.push({...p,args});return p.promise;},
      cancelSendLoginCode(){},cancelVerifyLoginCode(){}}};
  const filename=path.resolve(__dirname,'../entry/src/main/ets/pages/LoginPage.ets');
  const source=fs.readFileSync(filename,'utf8').split('  @Builder')[0]+'\n}';
  const plain=source.replace(/^@Component\s*$/m,'').replace('export struct ','export class ').replace(/@(State|Prop)\s+/g,'');
  const m=new Module(filename,module);
  m.require=name=>name.endsWith('/AppClient')?{AppClient:{shared:app}}:name.endsWith('/PhoneLoginPolicy')?
    {PhoneLoginPolicy:{normalizePhone:p=>/^1[3-9]\d{9}$/.test(p)?'+86'+p:undefined,validCode:c=>/^\d{6}$/.test(c)}}:
    name.endsWith('/LegalDocumentContent')?{LegalDocumentKind:{NONE:'NONE'}}:{};
  m._compile(ts.transpileModule(plain,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,filename);
  const p=new m.exports.LoginPage();p.phone='13800138000';p.agreementsAccepted=true;
  // Avoid real timers; cooldown behavior is irrelevant to these binding/race assertions.
  p.startCooldown=()=>{};
  return {p,app,sends,verifies,get signed(){return signed;}};
}
test('login binds returned challenge to phone and device and consumes it on success',async()=>{
  const f=fixture(),p=f.p;const send=p.sendCode();f.sends[0].resolve({challengeId:ID});await send;
  p.code='123456';const login=p.signIn();assert.deepEqual(f.verifies[0].args,['+8613800138000','123456','device-a',ID]);
  f.verifies[0].resolve({accessToken:'a',refreshToken:'r'});await login;assert.equal(f.signed,1);assert.equal(p.challengeId,'');
});
test('no challenge, changed phone or changed device never calls authentication',async()=>{
  for(const mode of ['missing','phone','device']){
    const f=fixture(),p=f.p;p.code='123456';
    if(mode!=='missing'){const send=p.sendCode();f.sends[0].resolve({challengeId:ID});await send;p.code='123456';}
    if(mode==='phone')p.phone='13900139000';if(mode==='device')f.app.getDeviceId=()=> 'other-device';
    await p.signIn();assert.equal(f.verifies.length,0);assert.match(p.errorMessage,/重新获取/);
  }
});
test('resend clears old challenge even when delivery fails; malformed envelope is rejected',async()=>{
  const f=fixture(),p=f.p;p.challengeId=ID;p.code='123456';
  const resend=p.sendCode();assert.equal(p.challengeId,'');assert.equal(p.code,'');
  f.sends[0].reject(new Error('failed'));await resend;assert.equal(p.challengeId,'');
  const second=p.sendCode();f.sends[1].resolve(true);await second;assert.equal(p.challengeId,'');assert.match(p.errorMessage,/有效短信挑战/);
});
test('late send after leaving and duplicate send cannot restore a usable challenge',async()=>{
  const f=fixture(),p=f.p;const send=p.sendCode();await p.sendCode();assert.equal(f.sends.length,1);
  p.aboutToDisappear();f.sends[0].resolve({challengeId:ID});await send;assert.equal(p.challengeId,'');
});
