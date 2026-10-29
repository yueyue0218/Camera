const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root=path.resolve(__dirname,'../entry/src/main/ets');
require.extensions['.ets']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,f);
const {MomentFeedCache}=require(path.join(root,'features/moments/MomentFeedModels.ets'));
test('notification detail joins the existing cross-page interaction barrier',()=>{
 const file=path.join(root,'pages/NotificationMomentPage.ets'),source=fs.readFileSync(file,'utf8');
 const plain=(source.slice(0,source.indexOf('  private observe()'))+'\n}').replace(/^@Component\s*$/m,'').replace('export struct ','export class ').replace(/@(State|Prop)\s+/g,'');
 const seen=[],loaded=new Module(file,module);loaded.filename=file;loaded.paths=module.paths;const original=loaded.require.bind(loaded);
 class Binding {constructor(){}}
 class Interactions {constructor(api,session,cache){seen.push(cache)}}
 loaded.require=name=>name==='@kit.ArkUI'?{uiObserver:{}}:name==='../app/AppClient'?{AppClient:{shared:{apiService:{},sessionManager:{}}}}:name.endsWith('/MomentInteractions')?{MomentInteractions:Interactions,MomentInteractionSnapshot:class{}}:name.endsWith('/MomentInteractionBindings')?{MomentApiBinding:Binding,MomentSessionBinding:Binding}:name.endsWith('/MomentDetailPanel')||name.endsWith('/MomentFeedLifecycle')?{}:original(name);
 loaded._compile(ts.transpileModule(plain,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,file);
 new loaded.exports.NotificationMomentPage().aboutToAppear();new loaded.exports.NotificationMomentPage().aboutToAppear();
 assert.equal(seen[0],MomentFeedCache.shared);assert.equal(seen[1],MomentFeedCache.shared);
});
