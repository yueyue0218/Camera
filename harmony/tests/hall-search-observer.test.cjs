const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
let failObserver=false;
class Lifecycle {constructor(ui,visible,onVisibility,onUnavailable){this.fail=onUnavailable;}start(){if(failObserver)this.fail();}stop(){}}
class Snapshot {constructor(){this.role='';this.error='';}}
const filename=path.resolve(__dirname,'../entry/src/main/ets/features/search/HallSearchPanel.ets'),source=fs.readFileSync(filename,'utf8');
const plain=(source.slice(0,source.indexOf('  build() {'))+'\n}').replace(/^@Component\s*$/m,'').replace('export struct ','export class ').replace(/@(State|Prop)\s+/g,'');
const loaded=new Module(filename,module);loaded.filename=filename;loaded.require=name=>name.endsWith('MomentFeedLifecycle')?{MomentFeedLifecycle:Lifecycle}:name.endsWith('HallSearchController')?{HallSearchSnapshot:Snapshot}:{};
loaded._compile(ts.transpileModule(plain,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,filename);
function fixture(){const panel=new loaded.exports.HallSearchPanel(),calls={resume:0,suspend:0,close:0,hostClose:0};panel.getUIContext=()=>({});panel.routeVisible=()=>true;panel.controller={resume(){calls.resume++;},suspend(){calls.suspend++;},close(){calls.close++;}};panel.onClose=()=>calls.hostClose++;return {panel,calls};}
test('lifecycle observer failure cannot resume search through the identity retry button',()=>{failObserver=true;const f=fixture();f.panel.observe();assert.equal(f.calls.suspend,1);f.panel.retryIdentity();assert.equal(f.calls.resume,0);assert.equal(f.calls.close,1);assert.equal(f.calls.hostClose,1);});
test('ordinary identity read retry remains available when observation is healthy',()=>{failObserver=false;const f=fixture();f.panel.retryIdentity();assert.equal(f.calls.resume,1);assert.equal(f.calls.hostClose,0);});
