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

const {ReportResultApiBinding}=require(path.join(root,'features/report/ReportResultApiBinding.ets'));
const binding=new ReportResultApiBinding(api);
test('own reports use shared authenticated GET and preserve optional safe public feedback',async()=>{
 for(const extra of [{},{resolution:'IGNORE',publicOutcome:'FOLLOW_UP',publicMessage:'感谢你的反馈，你的举报我们已收到并记录，后续会重点关注相关情况。',followUpRecorded:true}]){
  const p=binding.listMyReports('result.a.my');assert.equal(calls.at(-1).url,'https://test.invalid/reports/my');assert.equal(calls.at(-1).options.method,'GET');assert.equal(calls.at(-1).options.header.Authorization,'Bearer test-token-not-a-real-credential');respond([{reportId:51,reporterId:7,targetType:'MOMENT',targetId:22,status:'RESOLVED',reason:'不当内容',...extra}]);const rows=await p;assert.equal(rows[0].reportId,51);assert.equal(rows[0].publicOutcome,extra.publicOutcome);
 }
});
test('report result cancellation never touches default report writes or another page',async()=>{
 const create=api.createReport({targetType:'MOMENT',targetId:22,reason:'不当内容'},'form.b.create'),createCall=calls.at(-1);
 const a=binding.listMyReports('result.a.my'),aCall=calls.at(-1),b=binding.listMyReports('result.b.my'),bCall=calls.at(-1);
 binding.cancelReports('result.a.unused-create','result.a.my');aCall.resolve({responseCode:200,result:JSON.stringify({code:200,message:'success',data:[]})});await assert.rejects(a);
 assert.notEqual(bCall.destroyed,true);assert.notEqual(createCall.destroyed,true);
 bCall.resolve({responseCode:200,result:JSON.stringify({code:200,message:'success',data:[]})});createCall.resolve({responseCode:200,result:JSON.stringify({code:200,message:'success',data:{reportId:51}})});await b;assert.equal((await create).reportId,51);
});
