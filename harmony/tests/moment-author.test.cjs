const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require(path.join(process.env.DEVECO_SDK_HOME,
  'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const file = path.join(root, 'features/moments/MomentAuthor.ets');
const source = fs.readFileSync(file, 'utf8');
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; });
  return { promise, resolve, reject }; }
function fixture() {
  let version=1, authenticated=true; const requests=[], cancellations=[];
  const app={sessionManager:{getSessionVersion:()=>version, isAuthenticated:()=>authenticated}, apiService:{
    getPublicProfile(id,role,key) { const request=deferred(); requests.push({id,role,key,...request}); return request.promise; },
    cancelPublicProfile(key) { cancellations.push(key); }
  }};
  const plain=(source.slice(0,source.indexOf('  build()'))+'\n}')
    .replace(/^@Component\s*$/m,'').replace('export struct ','export class ')
    .replace(/@Watch\('[^']+'\)\s*/g,'').replace(/@(State|Prop)\s+/g,'');
  const loaded=new Module(file,module); loaded.filename=file; loaded.paths=module.paths;
  let key=0;
  loaded.require=name=> name.endsWith('/AppClient')?{AppClient:{shared:app}}:
    name==='./MomentFeedModels'?{createMomentFeedRequestKey:()=>`author.${++key}`,
      MomentFeedFormatter:{author:item=>`${item.authorRole} #${item.authorId}`}}:{};
  loaded._compile(ts.transpileModule(plain,{compilerOptions:{module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2021}}).outputText,file);
  function create() { const view=new loaded.exports.MomentAuthor();
    view.item={authorId:12,authorRole:'PROVIDER'}; view.active=true; return view; }
  return {view:create(),create,requests,cancellations,changeSession(){version++;},logout(){authenticated=false;}};
}
const profile=(id=12)=>({userId:id,currentRole:'PROVIDER',nickname:'真实摄影师',avatarFileId:91});
test('real public nickname and avatar file are displayed and both use the original author navigation',async()=>{
  const f=fixture(), read=f.view.load(); assert.equal(f.requests[0].id,12); assert.equal(f.requests[0].role,'PROVIDER');
  f.requests[0].resolve(profile()); await read;
  assert.equal(f.view.name(),'真实摄影师'); assert.equal(f.view.avatarFileId(),91);
  let opened; f.view.onOpenAuthor=item=>opened=item; f.view.open(); assert.equal(opened,f.view.item);
  await f.view.load(); assert.equal(f.requests.length,1);
  assert.match(source,/PortraAvatar\(\{ fileId: this\.avatarFileId\(\)/);
  for(const name of ['MomentCard','MomentDetailPanel']) assert.match(fs.readFileSync(
    path.join(root,`features/moments/${name}.ets`),'utf8'),/MomentAuthor\(\{/);
});
test('no avatar and invalid file identifiers keep the existing fallback',async()=>{
  for(const id of [undefined,null,0,-1,1.5,NaN,'91']) {
    const f=fixture(), read=f.view.load(); f.requests[0].resolve({...profile(),avatarFileId:id}); await read;
    assert.equal(f.view.avatarFileId(),0);
  }
});
test('a recycled card never shows the previous author or accepts its late response',async()=>{
  const f=fixture(), old=f.view.load(); f.view.item={authorId:13,authorRole:'PROVIDER'};
  const next=f.view.load(); f.requests[0].resolve(profile()); await old;
  assert.equal(f.view.avatarFileId(),0); assert.notEqual(f.view.name(),'真实摄影师');
  f.requests[1].resolve({...profile(13),nickname:'下一位作者',avatarFileId:92}); await next;
  assert.equal(f.view.name(),'下一位作者'); assert.equal(f.view.avatarFileId(),92);
});
test('switching session or logging out hides loaded and pending identities',async()=>{
  for(const loaded of [false,true]) for(const logout of [false,true]) {
    const f=fixture(), read=f.view.load(); if(loaded){f.requests[0].resolve(profile());await read;}
    if(logout)f.logout();else f.changeSession();
    if(!loaded){f.requests[0].resolve(profile());await read;}
    assert.equal(f.view.avatarFileId(),0); assert.notEqual(f.view.name(),'真实摄影师');
  }
});
test('wrong-user and wrong-role responses cannot populate the card',async()=>{
  for(const value of [profile(99),{...profile(),currentRole:'CUSTOMER'}]) {
    const f=fixture(),read=f.view.load();f.requests[0].resolve(value);await read;
    assert.equal(f.view.avatarFileId(),0);assert.notEqual(f.view.name(),'真实摄影师');
  }
});
test('closing one author component cancels only its request and rejects old results',async()=>{
  const f=fixture(),a=f.view.load(),other=f.create(),b=other.load();
  assert.notEqual(f.requests[0].key,f.requests[1].key);f.view.aboutToDisappear();
  assert.equal(f.cancellations.at(-1),f.requests[0].key);
  f.requests[0].resolve(profile());f.requests[1].resolve(profile());await Promise.all([a,b]);
  assert.equal(f.view.avatarFileId(),0);assert.equal(other.avatarFileId(),91);
});
