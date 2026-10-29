const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const filename=path.resolve(__dirname,'../entry/src/main/ets/features/shell/PortraAppShell.ets'),source=fs.readFileSync(filename,'utf8');
const loaded=new Module(filename,module);loaded.filename=filename;
loaded.require=name=>name.endsWith('NavigationModels')?{AppRoute:{SERVICE_DETAIL:'ServiceDetail',DEMAND_DETAIL:'DemandDetail',NOTIFICATIONS:'Notifications'}}:{};
const plain=(source.slice(0,source.indexOf('  build() {'))+'\n}').replace(/^@Component\s*$/m,'').replace('export struct ','export class ').replace(/@(State|Prop)\s+/g,'');
loaded._compile(ts.transpileModule(plain,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,filename);
test('hall search opens independently and a selected result closes before existing detail navigation',()=>{const shell=new loaded.exports.PortraAppShell();let observed;shell.onOpenRoute=(route,id)=>observed={route,id,searchOpen:shell.searchOpen};shell.openSearch();assert.equal(shell.searchOpen,true);shell.openSearchResult('ServiceDetail',31);assert.deepEqual(observed,{route:'ServiceDetail',id:31,searchOpen:false});});
test('hall icon callbacks retain exact search and notification destinations',()=>{assert.match(source,/onSearch:\s*\(\)\s*=>\s*this\.openSearch\(\)/);assert.match(source,/onNotice:\s*\(\)\s*=>\s*this\.onOpenRoute\?\.\(AppRoute\.NOTIFICATIONS\)/);assert.doesNotMatch(source,/搜索功能将在后续业务接入/);});
