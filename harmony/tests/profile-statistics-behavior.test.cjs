const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs'), path = require('node:path');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const source = fs.readFileSync(path.join(root, 'pages/ProfilePage.ets'), 'utf8');
require.extensions['.ets'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText,f);
const {CreditFormat} = require(path.join(root,'features/credit/CreditController.ets'));
function compile(methods, bindings={}) {
  const code=ts.transpileModule(`class Page { ${methods} }; module.exports=Page;`, {compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}}; new Function('module',...Object.keys(bindings),code)(mod,...Object.values(bindings)); return new mod.exports();
}
function fixture(role,total=12) {
  const calls=[]; let epoch=1;
  const page=compile(source.slice(source.indexOf('  private async load('),source.indexOf('  private async loadMoreMoments(')), {
    UiPerf:{request:(_,action)=>action(),mark(){},elapsed(){}}, CreditFormat,
    MomentFeedFormatter:{isValid:()=>true,deduplicate:rows=>rows}
  });
  const api={
    async getMyProfile(){return {id:7,currentRole:role,nickname:'Test'}},
    async currentSession(){return {userId:7,role,nickname:'Test'}},
    async listMyDemands(){calls.push('demands');return {records:[],total}},
    async listMyServices(){calls.push('services');return {records:[],total}},
    async listOrders(actualRole){calls.push(actualRole);return ['COMPLETED','SHOOTING','PENDING_PAYMENT','CANCELLED','REFUNDED'].map((status,i)=>({orderId:i+1,status}))},
    async listFollowers(id,actualRole){calls.push(`followers:${actualRole}`);return [{userId:9,currentRole:'CUSTOMER'}]},
    async listFollowing(id,actualRole){return [{userId:actualRole==='CUSTOMER'?10:11,currentRole:actualRole}]},
    async getCreditSummary(id){return {userId:id,creditScore:86.5}},
    async listProfileMoments(){return {records:[],total:0}}, async listFavoriteMoments(){return {records:[],total:0}}
  };
  Object.assign(page,{appClient:{apiService:api,sessionManager:{getSessionVersion:()=>epoch,isAuthenticated:()=>true}},socialGeneration:0,loadVersion:0,interestGeneration:0,likedGeneration:0,safeErrorLabel:(e,f)=>e.message||f});
  return {page,api,calls,changeSession(){epoch++}};
}
for(const role of ['CUSTOMER','PROVIDER']) {
  test(`${role}: server totals, role-specific orders, relations and credit`,async()=>{
    const f=fixture(role); await f.page.load(); await new Promise(setImmediate);
    assert.ok(f.calls.includes(role==='CUSTOMER'?'demands':'services'));
    assert.ok(!f.calls.includes(role==='CUSTOMER'?'services':'demands'));
    assert.ok(f.calls.includes(role)); assert.ok(f.calls.includes(`followers:${role}`));
    assert.equal(f.page.businessStatValue('published'),'12'); assert.equal(f.page.businessStatValue('ongoing'),'2'); assert.equal(f.page.businessStatValue('completed'),'1');
    assert.equal(f.page.socialStatValue('following'),'2'); assert.equal(f.page.socialStatValue('followers'),'1'); assert.equal(f.page.profileCreditLabel(),'86.5');
  });
  test(`${role}: empty success shows zero; failure never invents zero`,async()=>{
    const f=fixture(role,0); f.api.listOrders=async()=>[]; f.api.listFollowers=async()=>[];f.api.listFollowing=async()=>[];
    await f.page.load(); await new Promise(setImmediate);
    for(const kind of ['published','ongoing','completed'])assert.equal(f.page.businessStatValue(kind),'0');
    assert.equal(f.page.socialStatValue('following'),'0');assert.equal(f.page.socialStatValue('followers'),'0');
    f.api.listOrders=async()=>{throw new Error('offline')}; await f.page.load();
    assert.equal(f.page.businessStatValue('ongoing'),'重试');assert.equal(f.page.businessStatValue('published'),'0');assert.equal(f.page.orderStatsError,'offline');
  });
  test(`${role}: recovered identity still loads independent true statistics`,async()=>{
    const f=fixture(role);f.api.getMyProfile=async()=>{throw new Error('unavailable')};await f.page.load();await new Promise(setImmediate);
    assert.equal(f.page.partialProfile,true);assert.equal(f.page.businessStatValue('published'),'12');assert.equal(f.page.socialStatValue('followers'),'1');assert.equal(f.page.profileCreditLabel(),'86.5');
  });
}
test('late credit cannot repaint a changed account',async()=>{
  const f=fixture('PROVIDER');let resolve;f.page.userId=7;f.page.loadVersion=1;f.api.getCreditSummary=()=>new Promise(r=>resolve=r);
  const pending=f.page.loadProfileCredit(1,1,7);f.changeSession();resolve({userId:7,creditScore:90});await pending;assert.equal(f.page.creditSummary,undefined);
});
test('credit metrics read current state and preserve null denominators and zero',()=>{
  const text=fs.readFileSync(path.join(root,'pages/CreditPage.ets'),'utf8');const page=compile(text.slice(text.indexOf('  private metricValue('),text.indexOf('  @Builder\n  private Metric(')),{CreditFormat});
  page.snapshot={error:''};assert.equal(page.metricValue('orders'),'加载中');
  page.snapshot={summary:{effectiveOrderCount:0,riskRecordCount:0,goodReviewRate:null,defaultRate:null}};
  assert.equal(page.metricValue('orders'),'0');assert.equal(page.metricValue('risks'),'0');assert.equal(page.metricValue('reviews'),'暂无评价');assert.equal(page.metricValue('defaults'),'暂无计分合作');
  page.snapshot={summary:{effectiveOrderCount:8,riskRecordCount:1,goodReviewRate:87.5,defaultRate:12.5}};
  assert.equal(page.metricValue('orders'),'8');assert.equal(page.metricValue('reviews'),'87.5%');assert.equal(page.metricValue('defaults'),'12.5%');
});
test('builders observe state in Text instead of capturing initial strings',()=>{
  for(const [name,reader] of [['StatLink','socialStatValue'],['BusinessStat','businessStatValue']]){
    const rest=source.slice(source.indexOf(`  private ${name}(`));const body=rest.slice(0,rest.indexOf('\n  }'));
    assert.ok(body.includes(`Text(this.${reader}(`));assert.ok(!body.includes('Text(value)'));
  }
  assert.match(fs.readFileSync(path.join(root,'pages/CreditPage.ets'),'utf8'),/Text\(this\.metricValue\(kind\)\)/);
});
