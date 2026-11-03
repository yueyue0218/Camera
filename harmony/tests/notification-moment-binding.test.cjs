const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root=path.resolve(__dirname,'../entry/src/main/ets');
require.extensions['.ets']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,f);
const {MomentFeedCache}=require(path.join(root,'features/moments/MomentFeedModels.ets'));
test('notification detail joins the existing cross-page interaction barrier',()=>{
 const file=path.join(root,'pages/NotificationMomentPage.ets'),source=fs.readFileSync(file,'utf8');
 const plain=(source.slice(0,source.indexOf('  private observe()'))+'\n}').replace(/^@Component\s*$/m,'').replace('export struct ','export class ').replace(/@(State|Prop)\s+/g,'').replace(/@Watch\('[^']+'\)\s*/g,'');
 const seen=[],loaded=new Module(file,module);loaded.filename=file;loaded.paths=module.paths;const original=loaded.require.bind(loaded);
 class Binding {constructor(){}}
 class Interactions {constructor(api,session,cache){seen.push(cache)}}
 loaded.require=name=>name==='@kit.ArkUI'?{uiObserver:{}}:name==='../app/AppClient'?{AppClient:{shared:{apiService:{},sessionManager:{}}}}:name.endsWith('/MomentInteractions')?{MomentInteractions:Interactions,MomentInteractionSnapshot:class{}}:name.endsWith('/MomentInteractionBindings')?{MomentApiBinding:Binding,MomentSessionBinding:Binding}:name.endsWith('/MomentDetailPanel')||name.endsWith('/MomentFeedLifecycle')?{}:original(name);
 loaded._compile(ts.transpileModule(plain,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,file);
 new loaded.exports.NotificationMomentPage().aboutToAppear();new loaded.exports.NotificationMomentPage().aboutToAppear();
 assert.equal(seen[0],MomentFeedCache.shared);assert.equal(seen[1],MomentFeedCache.shared);
});

test('inline editor and confirmation never suppress real destination hiding',()=>{
 const file=path.join(root,'pages/NotificationMomentPage.ets'),source=fs.readFileSync(file,'utf8');
 const plain=(source.slice(0,source.indexOf('  @Builder'))+'\n}').replace(/^@Component\s*$/m,'').replace('export struct ','export class ').replace(/@(State|Prop)\s+/g,'').replace(/@Watch\('[^']+'\)\s*/g,'');
 const loaded=new Module(file,module);loaded.filename=file;loaded.paths=module.paths;const original=loaded.require.bind(loaded);let routeVisible;
 const states={ON_HIDDEN:1,ON_WILL_HIDE:2,ON_DISAPPEAR:3,ON_WILL_DISAPPEAR:4};
 class Lifecycle{constructor(ctx,read){routeVisible=read}start(){}}
 loaded.require=name=>name==='@kit.ArkUI'?{uiObserver:{NavDestinationState:states}}:name.endsWith('/MomentFeedLifecycle')?{MomentFeedLifecycle:Lifecycle}:name==='../app/AppClient'?{AppClient:{shared:{apiService:{},sessionManager:{}}}}:original(name);
 loaded._compile(ts.transpileModule(plain,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,file);
 const page=new loaded.exports.NotificationMomentPage();let top=true;
 page.getUIContext=()=>({});page.queryNavigationInfo=()=>({pathStack:{size:()=>top?1:2}});
 page.queryNavDestinationInfo=()=>({index:0,navDestinationId:'detail',state:states.ON_HIDDEN});page.observe();
 page.editorOpen=true;assert.equal(routeVisible(),false,'real destination hiding must clear the inline editor');
 page.editorOpen=false;page.deleteOpen=true;assert.equal(routeVisible(),false);
 top=false;assert.equal(routeVisible(),false,'a real destination switch still hides the form');
 top=true;page.deleteOpen=false;assert.equal(routeVisible(),false);
});