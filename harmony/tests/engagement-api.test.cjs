const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root=process.env.PORTRA_API_TEST_SOURCE||path.resolve(__dirname,'../entry/src/main/ets');
const calls=[];
const http={RequestMethod:{GET:'GET',POST:'POST',PUT:'PUT',DELETE:'DELETE',PATCH:'PATCH'},HttpDataType:{STRING:1},createHttp(){const c={};calls.push(c);return {request(url,options){Object.assign(c,{url,options});return new Promise((resolve,reject)=>Object.assign(c,{resolve,reject}))},destroy(){c.destroyed=true}}}};
require.extensions['.ets']=(m,f)=>{const original=m.require.bind(m);m.require=n=>n==='@kit.NetworkKit'?{http}:n.endsWith('/BuildProfile')?{default:{PORTRA_ENVIRONMENT:'staging',PORTRA_BASE_URL:'https://test.invalid'}}:original(n);m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,f)};
const {HttpClient}=require(path.join(root,'network/HttpClient.ets'));
const {ApiService}=require(path.join(root,'network/ApiService.ets'));
const client=new HttpClient();client.setAccessToken('test-token-not-a-real-credential');const api=new ApiService(client);
const respond=(data)=>calls.at(-1).resolve({responseCode:200,result:JSON.stringify({code:200,message:'success',data})});

test('engagement reads exact real user paths through authenticated HttpClient',async()=>{
 for(const [method,id,suffix] of [['getOrder',11,'/orders/11'],['listOrderReviews',11,'/orders/11/reviews'],['getReview',22,'/reviews/22'],['listReviewComplaints',22,'/reviews/22/complaints'],['getReviewComplaint',33,'/reviews/complaints/33'],['listOrderDisputes',11,'/orders/11/disputes'],['getDispute',44,'/disputes/44']]){
  assert.equal(typeof api[method],'function',method+' missing');const p=api[method](id,'read.'+method);assert.ok(calls.at(-1).url.endsWith(suffix));assert.equal(calls.at(-1).options.method,'GET');assert.equal(calls.at(-1).options.header.Authorization,'Bearer test-token-not-a-real-credential');respond({});await p;
 }
});
test('review followup complaint dispute and reply preserve exact POST payload and IDs',async()=>{
 for(const [method,id,suffix,payload] of [['createReview',11,'/orders/11/reviews',{rating:5,content:'评价'}],['followUpReview',22,'/reviews/22/follow-up',{content:'追评'}],['createReviewComplaint',22,'/reviews/22/complaints',{reason:'评价内容不实：说明',evidenceFileIds:''}],['createDispute',11,'/orders/11/disputes',{reason:'订单争议'}],['replyDispute',44,'/disputes/44/replies',{content:'回复说明'}]]){
  assert.equal(typeof api[method],'function',method+' missing');const p=api[method](id,payload,'write.'+method);assert.ok(calls.at(-1).url.endsWith(suffix));assert.equal(calls.at(-1).options.method,'POST');assert.deepEqual(JSON.parse(calls.at(-1).options.extraData),payload);respond({});await p;
 }
});
test('unsafe business IDs make no HTTP request',async()=>{assert.equal(typeof api.getOrder,'function');const count=calls.length;for(const id of [0,-1,NaN,Number.MAX_SAFE_INTEGER+1])await assert.rejects(api.getOrder(id,'bad'));assert.equal(calls.length,count);});
test('cancel engagement A preserves B and legacy orders list',async()=>{assert.equal(typeof api.cancelEngagementRequests,'function');const a=api.getOrder(11,'a.order'),b=api.getOrder(12,'b.order'),legacy=api.listOrders();const first=calls.at(-3),second=calls.at(-2),last=calls.at(-1);api.cancelEngagementRequests(['a.order']);first.resolve({responseCode:200,result:JSON.stringify({code:200,message:'success',data:{}})});await assert.rejects(a);assert.notEqual(second.destroyed,true);assert.notEqual(last.destroyed,true);second.resolve({responseCode:200,result:JSON.stringify({code:200,message:'success',data:{}})});last.resolve({responseCode:200,result:JSON.stringify({code:200,message:'success',data:[]})});await Promise.all([b,legacy]);});
