const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root=path.resolve(__dirname,'../entry/src/main/ets');
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
// Execute the actual page methods with transport/lifecycle stubs. ArkUI builders are compiled separately by Hvigor.
function fixture(name,api={}) {
 let epoch=1,auth=true;const listeners=new Set();let visibility;
 const sessionManager={getSessionVersion:()=>epoch,isAuthenticated:()=>auth,observeIdentity:f=>listeners.add(f),unobserveIdentity:f=>listeners.delete(f)};
 const content=new Set();
 const context={exports:{},AppClient:{shared:{apiService:api,sessionManager}},UiPerf:{mark(){}},Scroller:class {},
   ContentChanges:{observe:f=>content.add(f),unobserve:f=>content.delete(f),publish:k=>content.forEach(f=>f(k??'content'))},
   DetailVisibility:{create:(_a,_b,_c,changed)=>{visibility=changed;return {start(){changed(true)},stop(){}}}},
   ConversationVisibility:{subscribe:(_k,f)=>{visibility=f;f(true)},unsubscribe(){}},
   OrderWorkflow:{canPay:(o,u)=>o.status==='PENDING_PAYMENT'&&o.customerId===u},
   ErrorKind:{NETWORK:'network',TIMEOUT:'timeout'},promptAction:{showToast(){}},console};
 let source=fs.readFileSync(path.join(root,'pages',name+'.ets'),'utf8');
 source=source.slice(0,source.indexOf('  @Builder')>=0?source.indexOf('  @Builder'):source.indexOf('  build()'))+'\n}';
 source=source.replace(/^import .*;\r?\n/gm,'').replace(/@\w+(?:\([^\n]*?\))?\s*/g,'').replace('export struct','export class');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,context);
 const page=new context.exports[name]();page.getUIContext=()=>({});page.queryNavigationInfo=()=>({});page.queryNavDestinationInfo=()=>({});
 return {page,api,context,show(){visibility(true)},hide(){visibility(false)},start(){page.aboutToAppear();if(page.observe)page.observe()},
   change(){epoch++;listeners.forEach(f=>f())},logout(){auth=false;this.change()},publish(){context.ContentChanges.publish()}};
}
function demandApi(){return {getDemand:async id=>({demandId:id,customerId:7,status:'OPEN'}),currentSession:async()=>({userId:7,role:'CUSTOMER'}),listDemandResponses:async()=>[]};}
function serviceApi(){return {getServicePackage:async id=>({serviceId:id,providerId:9,status:'ONLINE',isAvailable:true}),currentSession:async()=>({userId:7,role:'CUSTOMER'}),listServicePackageInterests:async()=>({records:[],size:100,total:0})};}
for(const [name,id,body,base,secondary] of [
 ['DemandDetailPage','demandId','demand',demandApi,'listDemandResponses'],
 ['ServiceDetailPage','serviceId','detail',serviceApi,'listServicePackageInterests']]) {
 test(name+' displays primary before deferred secondary and fails secondary independently',async()=>{
  const d=deferred(),api=base();api[secondary]=()=>d.promise;const f=fixture(name,api);f.page[id]=1;f.start();await tick();
  assert.equal(f.page[body][id],1);assert.equal(f.page.loading,false);assert.equal(f.page.secondaryLoading,true);assert.equal(f.page.secondaryReady,false);
  d.reject(new Error('secondary unavailable'));await tick();assert.equal(f.page[body][id],1);assert.equal(f.page.secondaryLoading,false);assert.ok(f.page.actionError);assert.equal(f.page.secondaryReady,false);
 });
 test(name+' return preserves body and coalesces in-flight refresh',async()=>{
  const api=base(),f=fixture(name,api);f.page[id]=1;f.start();await tick();const old=f.page[body];f.hide();
  const d=deferred();let calls=0;api[name==='DemandDetailPage'?'getDemand':'getServicePackage']=()=>{calls++;return d.promise};
  f.show();f.page.load();assert.equal(f.page[body],old);assert.equal(f.page.loading,false);assert.equal(calls,1);
  d.resolve({...old,title:'updated'});await tick();assert.equal(f.page[body].title,'updated');
 });
 test(name+' new target, identity and content writes invalidate immediately; late replies cannot overwrite',async()=>{
  const api=base(),f=fixture(name,api);f.page[id]=1;f.start();await tick();
  const old=deferred();api[name==='DemandDetailPage'?'getDemand':'getServicePackage']=()=>old.promise;f.hide();f.show();
  f.page[id]=2;f.page.onTargetChanged();assert.equal(f.page[body],null);
  old.resolve({...await base()[name==='DemandDetailPage'?'getDemand':'getServicePackage'](1)});await tick();assert.equal(f.page[body],null);
  api[name==='DemandDetailPage'?'getDemand':'getServicePackage']=base()[name==='DemandDetailPage'?'getDemand':'getServicePackage'];await f.page.load();assert.equal(f.page[body][id],2);
  f.change();assert.equal(f.page[body],null);await f.page.load();f.publish();assert.equal(f.page[body],null);
 });
 test(name+' retains public body only for transport failure; revoked/deleted body is removed',async()=>{
  for(const error of [{kind:'network',message:'offline'},{httpStatus:403,message:'revoked'},{httpStatus:404,message:'deleted'}]){
   const api=base(),f=fixture(name,api);f.page[id]=1;f.start();await tick();f.hide();
   api[name==='DemandDetailPage'?'getDemand':'getServicePackage']=async()=>{throw error};api.getDemandInterest=async()=>{throw error};f.show();await tick();
   assert.equal(f.page[body]!==null,error.kind==='network');assert.equal(f.page.loading,false);assert.equal(f.page.secondaryReady,false);
  }
 });
}
test('demand cannot respond while own response lookup is pending or malformed',async()=>{
 const d=deferred();let writes=0;const api=demandApi();api.currentSession=async()=>({userId:8,role:'PROVIDER'});api.getDemandInterest=async()=>({demandId:1,targetType:'DEMAND',interested:false});api.listMyDemandResponses=()=>d.promise;api.respondToDemand=async()=>{writes++};
 const f=fixture('DemandDetailPage',api);f.page.demandId=1;f.start();await tick();f.page.responseMessage='plan';await f.page.respond();assert.equal(writes,0);d.resolve(null);await tick();assert.equal(f.page.secondaryReady,false);await f.page.respond();assert.equal(writes,0);
});
test('service does not submit intention before all scanned pages complete',async()=>{
 const d=deferred();let writes=0;const api=serviceApi();api.listServicePackageInterests=async page=>page===1?{records:[{serviceId:99}],size:100,total:101}:d.promise;api.addServicePackageInterest=async()=>{writes++};
 const f=fixture('ServiceDetailPage',api);f.page.serviceId=1;f.start();await tick();await f.page.toggleInterest();assert.equal(writes,0);assert.equal(f.page.loading,false);
 d.resolve({records:[{serviceId:1}],size:100,total:101});await tick();assert.equal(f.page.interested,true);assert.equal(f.page.secondaryReady,true);
});
test('order primary and load promise do not await logs; log failure retains authorized body',async()=>{
 const d=deferred(),api={currentSession:async()=>({userId:7,role:'CUSTOMER'}),getOrder:async id=>({orderId:id,customerId:7,status:'COMPLETED'}),getOrderStatusLogs:()=>d.promise};
 const f=fixture('OrderDetailPage',api);f.page.orderId=1;f.start();await tick();assert.equal(f.page.order.orderId,1);assert.equal(f.page.loading,false);assert.equal(f.page.inFlight,false);assert.equal(f.page.secondaryLoading,true);
 d.reject(new Error('logs unavailable'));await tick();assert.equal(f.page.order.orderId,1);assert.ok(f.page.logsError);f.change();assert.equal(f.page.order,null);assert.equal(f.page.logs.length,0);
});
test('order waits for authorization and discards a different owner',async()=>{
 const d=deferred();const f=fixture('OrderDetailPage',{currentSession:()=>d.promise,getOrder:async()=>({orderId:1,customerId:99,providerUserId:88})});f.page.orderId=1;f.start();assert.equal(f.page.order,null);assert.equal(f.page.loading,true);d.resolve({userId:7});await tick();assert.equal(f.page.order,null);assert.equal(f.page.loading,false);
});
test('order list return keeps cards while refreshing and clears them on logout',async()=>{
 const api={currentSession:async()=>({userId:7,role:'CUSTOMER'}),listOrders:async()=>[{orderId:1}],cancelOrders(){},cancelCurrentSession(){}};
 const f=fixture('OrderPage',api);f.start();await tick();const d=deferred();api.listOrders=()=>d.promise;f.hide();f.show();f.page.onReloadRequested();await tick();assert.equal(f.page.orders[0].orderId,1);assert.equal(f.page.loading,false);d.resolve([{orderId:2}]);await tick();assert.equal(f.page.orders[0].orderId,2);f.logout();assert.equal(f.page.orders.length,0);
});

test('guest service displays body without requesting private identity or intention endpoints',async()=>{
 let reads=0,logins=0;const api=serviceApi();api.currentSession=async()=>{reads++;throw Error('guest')};const f=fixture('ServiceDetailPage',api);f.logout();f.page.serviceId=1;f.start();await tick();
 assert.equal(reads,0);assert.equal(f.page.detail.serviceId,1);assert.equal(f.page.secondaryReady,true);f.page.onRequireLogin=()=>logins++;await f.page.toggleInterest();assert.equal(logins,1);
});
test('order log endpoint failure never removes the already authorized order',async()=>{
 for(const httpStatus of [403,404,500]) {
  const f=fixture('OrderDetailPage',{currentSession:async()=>({userId:7}),getOrder:async()=>({orderId:1,customerId:7}),getOrderStatusLogs:async()=>{throw {httpStatus,message:'logs unavailable'}}});
  f.page.orderId=1;f.start();await tick();assert.equal(f.page.order.orderId,1);assert.equal(f.page.loading,false);assert.equal(f.page.logsError,'logs unavailable');
 }
});

test('demand denial followed by unavailable history never retains the old public body',async()=>{
 const api=demandApi(),f=fixture('DemandDetailPage',api);f.page.demandId=1;f.start();await tick();f.hide();
 api.getDemand=async()=>{throw {httpStatus:403,message:'revoked'}};api.getDemandInterest=async()=>{throw {kind:'network',message:'offline'}};f.show();await tick();assert.equal(f.page.demand,null);
});

for(const [name,id,body,base,get] of [
 ['DemandDetailPage','demandId','demand',demandApi,'getDemand'],
 ['ServiceDetailPage','serviceId','detail',serviceApi,'getServicePackage']]) {
 test(name+' logout/account change while primary is pending discards late success and failure',async()=>{
  for(const logout of [false,true])for(const reject of [false,true]) {
   const d=deferred(),api=base();api[get]=()=>d.promise;const f=fixture(name,api);f.page[id]=1;f.start();
   if(logout)f.logout();else f.change();assert.equal(f.page[body],null);
   if(reject)d.reject({kind:'timeout',message:'late timeout'});else d.resolve(await base()[get](1));await tick();
   assert.equal(f.page[body],null);assert.equal(f.page.secondaryReady,false);assert.equal(f.page.loading,false);
  }
 });
 test(name+' stale secondary never enables actions or replaces refreshed state after fast return',async()=>{
  const d=deferred(),api=base();api.currentSession=()=>d.promise;const f=fixture(name,api);f.page[id]=1;f.start();await tick();
  assert.equal(f.page.secondaryReady,false);f.hide();api.currentSession=base().currentSession;f.show();await tick();
  assert.equal(f.page.secondaryReady,true);const user=f.page.userId;d.resolve({userId:999,role:'PROVIDER'});await tick();assert.equal(f.page.userId,user);
 });
}
test('order A to B clears A immediately and old order/log response cannot overwrite B',async()=>{
 const old=deferred(),fresh=deferred(),logs=deferred();const api={currentSession:async()=>({userId:7}),getOrder:id=>id===1?old.promise:fresh.promise,getOrderStatusLogs:()=>logs.promise};
 const f=fixture('OrderDetailPage',api);f.page.orderId=1;f.start();await tick();f.page.orderId=2;f.page.onTargetChanged();await tick();
 assert.equal(f.page.order,null);fresh.resolve({orderId:2,customerId:7,status:'COMPLETED'});await tick();old.resolve({orderId:1,customerId:7});await tick();assert.equal(f.page.order.orderId,2);
 f.logout();logs.resolve([{toStatus:'COMPLETED'}]);await tick();assert.equal(f.page.order,null);assert.equal(f.page.logs.length,0);
});
test('order return refreshes actual status without blanking cards, rejects revoked primary',async()=>{
 const api={currentSession:async()=>({userId:7}),getOrder:async()=>({orderId:1,customerId:7,status:'PENDING_PAYMENT'}),getOrderStatusLogs:async()=>[]};
 const f=fixture('OrderDetailPage',api);f.page.orderId=1;f.start();await tick();const d=deferred();f.hide();api.getOrder=()=>d.promise;f.show();
 assert.equal(f.page.order.status,'PENDING_PAYMENT');assert.equal(f.page.loading,false);assert.equal(f.page.secondaryReady,false);await tick();d.resolve({orderId:1,customerId:7,status:'COMPLETED'});await tick();assert.equal(f.page.order.status,'COMPLETED');
 f.hide();api.getOrder=async()=>{throw {httpStatus:403}};f.show();await tick();assert.equal(f.page.order,null);
});

test('a detached detail invalidates cached identity before its first reappearance render',async()=>{
 for(const [name,id,body,api] of [['DemandDetailPage','demandId','demand',demandApi()],['ServiceDetailPage','serviceId','detail',serviceApi()],
  ['OrderDetailPage','orderId','order',{currentSession:async()=>({userId:7}),getOrder:async()=>({orderId:1,customerId:7}),getOrderStatusLogs:async()=>[]}]]) {
  const f=fixture(name,api);f.page[id]=1;f.start();await tick();assert.ok(f.page[body]);f.page.aboutToDisappear();f.change();f.page.aboutToAppear();assert.equal(f.page[body],null);
 }
});
