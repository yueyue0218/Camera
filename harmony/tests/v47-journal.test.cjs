// Host-side execution of production methods, with only platform/network boundaries replaced.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
let epoch = 1, authenticated = true, events = 0;
const notices = [];
const app = {sessionManager: {getSessionVersion: () => epoch, isAuthenticated: () => authenticated}, apiService: {}};
const prefs = new Map();
const files = new Set();
let copyError = false, fileClosed = 0;
const fileIo = {
  OpenMode: {READ_ONLY: 0}, accessSync: p => files.has(p), mkdirSync: p => files.add(p),
  open: async () => ({fd: 8}), stat: async () => ({size: 100}), close: async () => fileClosed++,
  async copyFile(fd, p) { files.add(p); if(copyError) throw new Error('disk full'); },
  unlinkSync: p => files.delete(p)
};
const store = {getSync: (k,d) => prefs.has(k)?prefs.get(k):d, putSync: (k,v) => prefs.set(k,v),
  deleteSync: k => prefs.delete(k), flushSync() {}};
let origin = 'https://test.invalid';
function load(relative, page = false) {
  const filename = path.join(root, relative);
  let source = fs.readFileSync(filename,'utf8');
  if (page) source = (source.slice(0, Math.min(...[source.indexOf('  @Builder'),source.indexOf('  build()')].filter(i=>i>=0)))+'\n}')
    .replace(/^@Component\s*$/m,'').replace('export struct ', 'export class ')
    .replace(/@(State|Prop)\s+/g,'').replace(/@Watch\('[^']+'\)\s*/g,'');
  const mod = new Module(filename,module);
  mod.require = name => {
    if(name.endsWith('/AppClient')) return {AppClient:{shared:app}};
    if(name === '@kit.ArkUI') return {promptAction:{showToast: o=>notices.push(o.message)}};
    if(name === '@kit.ArkData') return {preferences:{getPreferencesSync:()=>store}};
    if(name === '@kit.CoreFileKit') return {fileIo};
    if(name.endsWith('/EnvironmentConfig')) return {EnvironmentConfig:{current:()=>({cacheNamespace:'dev',baseUrl:origin})}};
    if(name.endsWith('/ContentChanges')) return {ContentChanges:{publish:()=>events++}};
    if(name.endsWith('/JournalUI')) return {JournalStyle:{paper:'#F6F3EE'}};
    if(name.endsWith('/JournalText')) return load('features/publish/JournalText.ets');
    if(name.endsWith('/ReportSubmissionStore')) return load('features/user/ReportSubmissionStore.ets');
    if(name.endsWith('/PublishDraftStore')) return load('features/publish/PublishDraftStore.ets');
    if(name.endsWith('/ErrorMapper')) return load('network/ErrorMapper.ets');
    return {};
  };
  mod._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,filename);
  return mod.exports;
}
global.Scroller = class {scrollEdge() {}};
global.Edge = {Bottom:1};
const {JournalText} = load('features/publish/JournalText.ets');
const {PublishPage} = load('pages/PublishPage.ets',true);
const {ServiceDetailPage} = load('pages/ServiceDetailPage.ets',true);
const {DemandDetailPage} = load('pages/DemandDetailPage.ets',true);
const {PublishDraftStore} = load('features/publish/PublishDraftStore.ets');
const {ApiService} = load('network/ApiService.ets');
function deferred() {let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject};}
function page(role='CUSTOMER') {
  const p=new PublishPage(); Object.assign(p,{identity:epoch,role,sessionLoading:false,title:'拍',description:'光',city:'上海',
    place:'',time:'时间可商量',minBudget:'0',maxBudget:'0'});
  if(role==='PROVIDER') Object.assign(p,{minBudget:'100',scene:'人像',duration:'60',days:'7',originals:'10',refined:'3',fileIds:[10]});
  return p;
}

test('description round-trips, remains readable, preserves legacy prose and never duplicates metadata',()=>{
  const text=JournalText.encode('正文','介绍','第一行\n第二行','2 人',true);
  const d=JournalText.decode(text);
  assert.equal(d.story,'正文'); assert.equal(d.subtitle,'介绍'); assert.equal(d.delivery,'第一行\n第二行');
  assert.equal(d.people,'2 人'); assert.equal(d.negotiable,true);
  assert.equal(JournalText.encode(text,'介绍','第一行\n第二行','2 人',true),text);
  assert.equal(JournalText.encode(d.story,d.subtitle,d.delivery,d.people,d.negotiable),text);
  const legacy='旧文'+JournalText.marker+'这里是普通段落，不是结构字段';
  assert.equal(JournalText.decode(legacy).story,legacy);
  assert.equal(JournalText.decode('旧介绍').story,'旧介绍');
});

test('one-character demand with zero images/budgets previews without creation, publishes real ID with file IDs only',async()=>{
  const p=page();let creates=0,opened=0,payload;
  app.apiService.createDemand=async body=>{creates++;payload=body;return {demandId:77}};
  p.onPublished=id=>opened=id;
  p.showPreview();assert.equal(p.preview,true);assert.equal(creates,0);
  p.back();assert.equal(p.preview,false);assert.equal(p.description,'光');
  await p.publish();assert.equal(creates,1);assert.equal(opened,77);
  assert.deepEqual(payload.referenceFileIds,[]); assert.equal(payload.location,'具体地点可沟通');
  assert.equal(payload.budgetMinCent,0); assert.equal(payload.budgetMaxCent,0);
  assert.equal(JournalText.decode(payload.description).people,'1 人');
});

test('maximum lengths, invalid calendar dates and numeric limits reject before creating',()=>{
  const p=page();
  for(const [field,value] of [['title','字'.repeat(31)],['description','字'.repeat(501)],['city','字'.repeat(21)],
    ['place','字'.repeat(51)],['minBudget','-1'],['maxBudget','100000'],['date','2026-02-30'],['styles','一,二,三,四']]) {
    const old=p[field];p[field]=value;assert.notEqual(p.validateForm(),'',field);p[field]=old;
  }
  p.date='2028-02-29';assert.equal(p.validateForm(),'');
});

test('provider creation sends backend required counts and description supplements, denies zero price and missing photos',async()=>{
  const p=page('PROVIDER'); p.subtitle='自然光';p.delivery='精修说明\n七天交片';let payload;
  app.apiService.createServicePackage=async body=>{payload=body;return {serviceId:55}};
  let id=0;p.onServicePublished=v=>id=v;await p.publish();assert.equal(id,55);
  assert.equal(payload.originalCount,10);assert.equal(payload.refinedCount,3);assert.equal(payload.durationMinutes,60);
  assert.equal(JournalText.decode(payload.description).subtitle,p.subtitle);
  assert.equal(JournalText.decode(payload.description).delivery,p.delivery);
  assert.deepEqual(payload.portfolioIds,[10]);assert.equal(JSON.stringify(payload).includes('file://'),false);
  const q=page('PROVIDER');q.minBudget='0';assert.match(q.validateForm(),/大于 0/);
  q.minBudget='1';q.fileIds=[];assert.match(q.validateForm(),/至少一张/);
  q.fileIds=[1];q.days='0';assert.match(q.validateForm(),/正整数/);
});

test('server identity determines form regardless of client intent; forbidden edit cannot become a publish',async()=>{
  const p=page();p.getUIContext=()=>({getHostContext:()=>({filesDir:'/private'})});
  app.apiService.currentSession=async()=>({userId:5,role:'PROVIDER'});
  await p.loadRole();assert.equal(p.role,'PROVIDER');
  const q=page();q.serviceId=6;q.getUIContext=p.getUIContext;
  app.apiService.currentSession=async()=>({userId:5,role:'CUSTOMER'});
  app.apiService.getServicePackage=async()=>({providerId:5});
  await q.loadRole();assert.equal(q.role,'');assert.match(q.errorMessage,/不能编辑/);
});

test('drafts isolate account/role/origin; copies survive picker permission loss and failed copies clean up',async()=>{
  prefs.clear();files.clear(); const context={filesDir:'/private'};
  const a=new PublishDraftStore(context,1,'CUSTOMER',0),b=new PublishDraftStore(context,2,'CUSTOMER',0),c=new PublishDraftStore(context,1,'PROVIDER',0);
  a.write('saved');assert.equal(b.read(),'');assert.equal(c.read(),'');
  origin='https://other.invalid';assert.equal(new PublishDraftStore(context,1,'CUSTOMER',0).read(),'');origin='https://test.invalid';
  const uri=await a.keepPhoto('picker://photo');assert.ok(a.hasPhoto(uri));assert.ok(uri.startsWith('file:///private/publish-drafts/'));
  a.removePhoto('file:///private/publish-drafts/../secret');assert.ok(a.hasPhoto(uri));
  const before=files.size;copyError=true;await assert.rejects(a.keepPhoto('picker://bad'),/disk full/);copyError=false;
  assert.equal(files.size,before);assert.equal(fileClosed,2);
  a.removePhoto(uri);assert.equal(a.hasPhoto(uri),false);
});

test('draft round-trip restores failed uploads and missing local files without turning URIs into IDs',()=>{
  const p=page();p.drafts=new PublishDraftStore({filesDir:'/private'},3,'CUSTOMER',0);p.draftReady=true;
  p.images=[{uri:'file:///private/publish-drafts/1-1.photo',sourceUri:'picker://a',fileId:0,error:'failed'}];
  p.saveDraft(false);const q=page();q.drafts=p.drafts;q.restoreDraft();
  assert.equal(q.title,'拍');assert.equal(q.images.length,1);assert.equal(q.images[0].fileId,0);assert.match(q.images[0].error,/重新选择/);
  assert.deepEqual(q.fileIds,[]);
});

test('interest pagination finds page two; failed toggle never confirms; successful toggle broadcasts and toasts',async()=>{
  const p=new ServiceDetailPage();p.serviceId=999;p.detail={serviceId:999,providerId:8,status:'ONLINE',isAvailable:true};
  app.apiService.currentSession=async()=>({userId:7,role:'CUSTOMER'});const pages=[];
  app.apiService.listServicePackageInterests=async page=>{pages.push(page);return {records:page===1?[{serviceId:1}]:[{serviceId:999}],size:100,total:101}};
  await p.restorePrivateState(0);assert.deepEqual(pages,[1,2]);assert.equal(p.interested,true);
  const before=events;app.apiService.cancelServicePackageInterest=async()=>{throw new Error('403')};
  await p.toggleInterest();assert.equal(p.interested,true);assert.equal(events,before);
  app.apiService.cancelServicePackageInterest=async()=>{};await p.toggleInterest();assert.equal(p.interested,false);
  assert.equal(notices.at(-1),'已移出我的意向');assert.equal(events,before+1);
});

test('chat is deduplicated and unavailable/self/provider/guest rules do not call service endpoint',async()=>{
  const p=new ServiceDetailPage();Object.assign(p,{serviceId:9,role:'CUSTOMER',userId:7,detail:{providerId:8,status:'ONLINE',isAvailable:true}});
  let calls=0,opened=0,logins=0;const d=deferred();app.apiService.startServiceChat=()=>{calls++;return d.promise};
  p.onOpenConversation=id=>opened=id;p.onRequireLogin=()=>logins++;
  const pending=p.startChat();await p.startChat();assert.equal(calls,1);d.resolve({serviceId:9,conversationId:12});await pending;assert.equal(opened,12);
  p.detail.status='OFFLINE';await p.startChat();p.detail.status='ONLINE';p.userId=8;await p.startChat();p.userId=7;p.role='PROVIDER';await p.startChat();
  authenticated=false;await p.startChat();authenticated=true;assert.equal(logins,1);assert.equal(calls,1);
});

test('demand cannot chat before accepted response; accepted response opens real conversation and stale result is suppressed',async()=>{
  const p=new DemandDetailPage();Object.assign(p,{demandId:2,role:'PROVIDER',userId:7,demand:{customerId:8,status:'OPEN'}});
  let calls=0,opened=0;app.apiService.openAcceptedDemandChat=async()=>{calls++;return {conversationId:33}};p.onOpenConversation=id=>opened=id;
  await p.startChat();assert.equal(calls,0);assert.match(p.actionError,/先填写/);
  p.ownResponse={responseId:3,status:'PENDING_CUSTOMER_ACCEPT'};await p.startChat();assert.equal(calls,0);
  p.ownResponse.status='ACCEPTED';await p.startChat();assert.equal(calls,1);assert.equal(opened,33);
  const d=deferred();app.apiService.openAcceptedDemandChat=()=>d.promise;opened=0;const pending=p.startChat();p.requestVersion++;d.resolve({conversationId:34});await pending;assert.equal(opened,0);
});

test('accepted-chat adapter verifies server snapshot and identity before posting exact existing contract',async()=>{
  const calls=[];let id=1;let snapshot={responseId:3,demandId:4,customerId:5,providerId:6,responseStatus:'ACCEPTED'};
  const client={getIdentityEpoch:()=>id,get:async url=>{calls.push(url);return snapshot},post:async(url,body)=>{calls.push([url,body]);return {conversationId:7}}};
  const api=new ApiService(client);assert.equal((await api.openAcceptedDemandChat(3)).conversationId,7);
  assert.deepEqual(calls[1],['/conversations/from-response',{responseId:3,demandId:4,customerId:5,providerUserId:6,status:'ACCEPTED'}]);
  snapshot={...snapshot,responseStatus:'PENDING_CUSTOMER_ACCEPT'};await assert.rejects(api.openAcceptedDemandChat(3));assert.equal(calls.length,3);
  snapshot={...snapshot,responseStatus:'ACCEPTED'};client.get=async()=>{id++;return snapshot};await assert.rejects(api.openAcceptedDemandChat(3));
});

test('four-page UI includes native cover, dynamic titles, borderless yellow star and both role entry wiring',()=>{
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const service=read('pages/ServiceDetailPage.ets'),demand=read('pages/DemandDetailPage.ets'),publish=read('pages/PublishPage.ets');
  assert.match(service,/title: this.detail\?\.title/);assert.match(demand,/title: this.demand\?\.scene/);
  for(const s of [service,demand]) assert.match(s,/journal: true, moduleHeight: 304/);
  const ui=read('features/publish/JournalUI.ets');assert.match(ui,/#F5C522/);assert.match(ui,/strokeWidth\(this.selected \? 0/);
  assert.ok(ui.indexOf('onStar?.()')<ui.indexOf('onChat?.()'));
  assert.match(demand,/需求收藏暂未开放/);
  for(const label of ['橱窗介绍','拍摄想法','拍摄服务','时间与地点','预约与交付','预算预期','作品影集','灵感参考','预览橱窗','预览需求'])assert.ok(publish.includes(label),label);
  assert.doesNotMatch(service+demand+publish,/WebView|localStorage|unsplash/);
  const shell=read('features/shell/PortraAppShell.ets');assert.match(shell,/onPublish:.*AppRoute.PUBLISH/);assert.match(shell,/onOpenPublish:.*AppRoute.PUBLISH/);
});

test('return from preview preserves fields; system back is consumed during preview or submission',()=>{
  const p=page();let handler; p.onBackHandler=h=>handler=h;p.loadRole=()=>{};
  p.aboutToAppear();p.preview=true;assert.equal(handler(),true);assert.equal(p.preview,false);assert.equal(p.title,'拍');
  p.submitting=true;assert.equal(handler(),true);let popped=0;p.onBack=()=>popped++;p.back();assert.equal(popped,0);
  p.submitting=false;assert.equal(handler(),false);
});

test('late old detail response cannot overwrite a different business ID',async()=>{
  const p=new ServiceDetailPage(),old=deferred(),fresh=deferred();p.serviceId=10;
  authenticated=false;app.apiService.getServicePackage=id=>id===10?old.promise:fresh.promise;
  const first=p.load();p.serviceId=11;const second=p.load();fresh.resolve({serviceId:11,title:'new'});await second;
  old.resolve({serviceId:10,title:'old'});await first;assert.equal(p.detail.serviceId,11);assert.equal(p.loading,false);authenticated=true;
});

test('failed draft update retains old local image; successful update releases only the removed file',()=>{
  const p=page();p.drafts=new PublishDraftStore({filesDir:'/private'},100,'CUSTOMER',0);p.draftReady=true;
  const uri='file:///private/publish-drafts/9-9.photo';files.add(uri.slice(7));
  p.images=[{uri,sourceUri:'picker://a',fileId:9,error:''}];p.fileIds=[9];p.saveDraft(false);
  const write=store.putSync;store.putSync=()=>{throw Error('full')};p.removeImage(uri,9);assert.ok(files.has(uri.slice(7)));store.putSync=write;
  p.restoreDraft();assert.equal(p.images.length,1);p.removeImage(uri,9);assert.equal(files.has(uri.slice(7)),false);
});

const {PublicationActions} = load('features/publish/PublicationActions.ets',true);
function management(service=true) {
  const p=new PublicationActions();Object.assign(p,{service,contentId:10,ownerId:7,currentUserId:7,role:service?'PROVIDER':'CUSTOMER',status:service?'ONLINE':'OPEN'});
  app.apiService.currentSession=async()=>({userId:7,role:p.role});return p;
}
test('owner management hides from visitors and rechecks real identity before edit',async()=>{
  authenticated=true;const p=management();let id=0;p.onEdit=v=>id=v;
  p.currentUserId=8;assert.equal(p.owned(),false);await p.manage(true);assert.equal(id,0);
  p.currentUserId=7;app.apiService.currentSession=async()=>({userId:8,role:'PROVIDER'});await p.manage(true);assert.equal(id,0);assert.match(p.error,/身份/);
  app.apiService.currentSession=async()=>({userId:7,role:'PROVIDER'});await p.manage(true);assert.equal(id,10);
});
test('service offline is server confirmed, double click sends once and refresh follows true state',async()=>{
  const p=management(),pending=deferred();let calls=0,changed=0;const before=events;
  app.apiService.offlineService=()=>{calls++;return pending.promise};p.onChanged=()=>changed++;
  const first=p.manage(false);await new Promise(r=>setImmediate(r));await p.manage(false);assert.equal(calls,1);assert.equal(changed,0);
  pending.resolve({serviceId:10,providerId:7,status:'OFFLINE',isAvailable:false});await first;assert.equal(changed,1);assert.equal(events,before+1);
});
test('demand close refuses matched state and validates returned CLOSED identity',async()=>{
  const p=management(false);let calls=0;app.apiService.closeDemand=async()=>{calls++;return {demandId:10,customerId:7,status:'CLOSED'}};
  app.apiService.getDemand=async()=>({demandId:10,customerId:7,status:'MATCHED'});await p.manage(false);assert.equal(calls,0);
  app.apiService.getDemand=async()=>({demandId:10,customerId:7,status:'OPEN'});let changed=0;p.onChanged=()=>changed++;await p.manage(false);assert.equal(calls,1);assert.equal(changed,1);
  p.status='MATCHED';await p.manage(true);await p.manage(false);assert.equal(calls,1);
});
test('management rejects malformed success, retains failures, and stale account cannot write',async()=>{
  const p=management();let changed=0;p.onChanged=()=>changed++;
  app.apiService.offlineService=async()=>({serviceId:99,providerId:7,status:'OFFLINE',isAvailable:false});await p.manage(false);assert.equal(changed,0);assert.match(p.error,/未确认/);
  app.apiService.offlineService=async()=>{throw new Error('403 denied')};await p.manage(false);assert.match(p.error,/403/);
  let writes=0;const identity=deferred();app.apiService.currentSession=()=>identity.promise;app.apiService.offlineService=async()=>{writes++};
  const late=p.manage(false);epoch++;identity.resolve({userId:7,role:'PROVIDER'});await late;assert.equal(writes,0);
});
test('offline confirmation captures target and session; late success broadcasts without navigating another page',async()=>{
  const p=management();let dialog;global.AlertDialog={show:o=>dialog=o};p.confirmOffline();assert.match(dialog.message,/不再公开/);
  let calls=0;app.apiService.offlineService=async()=>{calls++};p.contentId=11;dialog.secondaryButton.action();assert.equal(calls,0);
  p.contentId=10;const pending=deferred();app.apiService.offlineService=()=>pending.promise;let changed=0;p.onChanged=()=>changed++;
  const before=events,flight=p.manage(false);await new Promise(r=>setImmediate(r));p.aboutToDisappear();pending.resolve({serviceId:10,providerId:7,status:'OFFLINE',isAvailable:false});await flight;
  assert.equal(events,before+1);assert.equal(changed,0);
});
test('both edit modes use update only, preserve existing file IDs and cover order, never create',async()=>{
  let creates=0;app.apiService.createDemand=async()=>{creates++};app.apiService.createServicePackage=async()=>{creates++};
  for(const role of ['PROVIDER','CUSTOMER']) {
    const p=page(role);p[role==='PROVIDER'?'serviceId':'demandId']=12;p.fileIds=[10,11];p.images=[{fileId:13,uri:'private://13'}];p.syncImageIds();p.moveImageFirst(13);p.syncImageIds();assert.deepEqual(p.fileIds,[13,10,11]);
    let payload;app.apiService[role==='PROVIDER'?'updateService':'updateDemand']=async(id,body)=>{assert.equal(id,12);payload=body;return role==='PROVIDER'?{serviceId:12}:{demandId:12}};
    p.showPreview();assert.equal(payload,undefined);await p.publish();assert.deepEqual(payload[role==='PROVIDER'?'portfolioIds':'referenceFileIds'],[13,10,11]);
  }
  assert.equal(creates,0);
});
test('clean filters, shared city selector, owner callbacks and original report integration are present',()=>{
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');const filters=read('features/hall/components/HallFilters.ets'),form=read('pages/PublishPage.ets');
  assert.doesNotMatch(filters,/TextInput|customValue|按输入值|仅匹配|chooseDate/);assert.match(filters,/bindMenu/);assert.match(filters,/scrollBar/);
  assert.match(form,/Select\(HallFilterOptions.cities/);assert.match(form,/请选择服务城市/);assert.doesNotMatch(form,/填写拍摄城市/);
  for(const name of ['Service','Demand']) {const s=read('pages/'+name+'DetailPage.ets');assert.match(s,/PublicationActions/);assert.match(s,/onChanged: \(\) => this.load\(\)/);assert.match(s,/ReportPanel\(/);}
  assert.match(read('pages/Index.ets'),/returnRoute !== AppRoute.SERVICE_DETAIL/);
});

const {ReportPanel}=load('features/user/ReportPanel.ets',true);
for(const targetType of ['SERVICE_PACKAGE','DEMAND'])test(targetType+' report reuses original component: real target, failure draft, duplicate lock, confirmed result',async()=>{
 const p=new ReportPanel();Object.assign(p,{targetType,targetId:targetType==='DEMAND'?712:711,ownerId:9,currentUserId:7,reason:'侵权或盗用他人作品',description:'说明'});
 app.apiService.cancelReports=()=>{};let writes=0,payload;
 app.apiService.createReport=async body=>{writes++;payload=body;throw {httpStatus:403,message:'无权限'}};
 await p.submit();assert.equal(p.submitted,false);assert.equal(p.description,'说明');assert.equal(p.reason,'侵权或盗用他人作品');assert.match(p.errorMessage,/无权限/);
 const pending=deferred();app.apiService.createReport=body=>{writes++;payload=body;return pending.promise};
 const first=p.submit();await p.submit();assert.equal(writes,2);assert.equal(payload.targetType,targetType);assert.equal(payload.targetId,p.targetId);
 pending.resolve({reportId:88,reporterId:7,targetType,targetId:p.targetId,status:'PENDING'});await first;assert.equal(p.submitted,true);await p.submit();assert.equal(writes,2);
});
test('detail report prevents own target and requires authentication before writes',async()=>{
 const p=new ReportPanel();Object.assign(p,{targetType:'DEMAND',targetId:900,ownerId:7,currentUserId:7,reason:'其他违规行为'});
 let writes=0,login=0;app.apiService.createReport=async()=>{writes++};p.onRequireLogin=()=>login++;
 await p.submit();assert.equal(writes,0);p.ownerId=9;authenticated=false;await p.submit();assert.equal(login,1);assert.equal(writes,0);authenticated=true;
});

test('existing edit and offline adapters retain exact verbs, paths and payloads',async()=>{
  const calls=[];const api=new ApiService({put:async(path,body)=>{calls.push(['PUT',path,body]);return {}},patch:async(path,body)=>{calls.push(['PATCH',path,body]);return {}}});
  const service={title:'改',portfolioIds:[13,10]},demand={scene:'改',referenceFileIds:[21]};
  await api.updateService(12,service);await api.updateDemand(23,demand);await api.offlineService(12);await api.closeDemand(23);
  assert.deepEqual(calls,[['PUT','/service-packages/12',service],['PUT','/demands/23',demand],['PATCH','/service-packages/12/offline',undefined],['PATCH','/demands/23/close',undefined]]);
});
