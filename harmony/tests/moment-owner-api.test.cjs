// Real ApiService + HttpClient; only the OS transport is fake.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const calls = [];
const http = { RequestMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE' },
  HttpDataType: { STRING: 1 }, createHttp() {
    const call = {}; calls.push(call);
    return { request(url, options) {
      Object.assign(call, { url, options });
      return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
    }, destroy() { call.destroyed = true; } };
  } };
class Profile { static PORTRA_ENVIRONMENT = 'staging'; static PORTRA_BASE_URL = 'https://moments.test.invalid'; }
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(root + path.sep));
  const original = module.require.bind(module);
  module.require = name => name === '@kit.NetworkKit' ? { http } :
    name.endsWith('/BuildProfile') ? { default: Profile } : original(name);
  let source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021
  } }).outputText, filename);
};
const { HttpClient } = require(path.join(root, 'network/HttpClient.ets'));
const { ApiService } = require(path.join(root, 'network/ApiService.ets'));
function fixture() {
  const client = new HttpClient(); client.setAccessToken('unit-fixture-only');
  return new ApiService(client);
}
function moment(extra = {}) { return { momentId: 7, authorId: 12, authorRole: 'CUSTOMER',
  imageDataList: ['one', 'two', 'three', 'four', 'five'], likeCount: 6,
  favoriteCount: 2, likedByCurrentUser: false, favoritedByCurrentUser: false, ...extra }; }
function complete(call, data, code = 200) { call.resolve({ responseCode: code,
  result: JSON.stringify({ code: 200, message: 'success', data }) }); }

test('owner update uses authenticated PUT and returns the actual complete album', async () => {
  const api = fixture(), payload = {title:'修改标题',content:'修改正文',imageDataList:['one','two','three','four','five'],mentions:['保留']};
  const request = api.updateMoment(7,payload,'page.a.edit'), call=calls.at(-1);
  assert.equal(call.url,'https://moments.test.invalid/moments/7');
  assert.equal(call.options.method,'PUT'); assert.equal(call.options.header.Authorization,'Bearer unit-fixture-only');
  assert.deepEqual(JSON.parse(call.options.extraData),payload);
  complete(call,moment({title:'服务器标题'})); const value=await request;
  assert.equal(value.title,'服务器标题'); assert.equal(value.imageDataList.length,5);
});
test('owner delete uses authenticated DELETE and accepts only the null success payload', async () => {
  const api=fixture();
  for(const value of [null,false,{deleted:true}]) {
    const request=api.deleteMoment(7,'page.a.delete'),call=calls.at(-1);
    assert.equal(call.url,'https://moments.test.invalid/moments/7');assert.equal(call.options.method,'DELETE');
    assert.equal(call.options.header.Authorization,'Bearer unit-fixture-only');complete(call,value);
    if(value===null)await request;else await assert.rejects(request,e=>e.kind==='parse');
  }
});
test('owner unsafe IDs never send requests',async()=>{
 const api=fixture(),before=calls.length;
 for(const id of[0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  await assert.rejects(api.updateMoment(id,{title:'x',content:'y',imageDataList:[]}));
  await assert.rejects(api.deleteMoment(id));
 }
 assert.equal(calls.length,before);
});
test('owner update and delete cancellation is isolated by instance',async()=>{
 const api=fixture();
 for(const action of['update','delete']){
  const a=action==='update'?api.updateMoment(7,{title:'x',content:'y',imageDataList:[]},'a.'+action):api.deleteMoment(7,'a.'+action),ca=calls.at(-1);
  const b=action==='update'?api.updateMoment(7,{title:'x',content:'y',imageDataList:[]},'b.'+action):api.deleteMoment(7,'b.'+action),cb=calls.at(-1);
  const outcomes=Promise.allSettled([a,b]);api[action==='update'?'cancelMomentUpdate':'cancelMomentDelete'](7,'a.'+action);
  complete(ca,action==='update'?moment():null);complete(cb,action==='update'?moment():null);
  const results=await outcomes;assert.equal(results[0].status,'rejected');assert.equal(results[0].reason.kind,'stale');assert.equal(results[1].status,'fulfilled');
 }
});
test('owner writes retain shared error handling and never replay',async()=>{
 const api=fixture();
 for(const action of['updateMoment','deleteMoment'])for(const code of[401,403,404]){
  const start=calls.length,p=action==='updateMoment'?api[action](7,{title:'x',content:'y',imageDataList:[]}):api[action](7);
  complete(calls.at(-1),null,code);await assert.rejects(p,e=>e.httpStatus===code);assert.equal(calls.length,start+1);
 }
});