const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root=path.resolve(__dirname,'../entry/src/main/ets');
const states={ON_SHOWN:0,ON_HIDDEN:1,ON_APPEAR:2,ON_DISAPPEAR:3,ON_WILL_SHOW:4,ON_WILL_HIDE:5,ON_WILL_APPEAR:6,ON_WILL_DISAPPEAR:7};
function load(file) {
 const m=new Module(file,module);m.filename=file;
 m.require=name=>name==='@kit.ArkUI'?{uiObserver:{NavDestinationState:states}}:
   name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ets')):{};
 m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,file);
 return m.exports;
}
const {DetailVisibility}=load(path.join(root,'common/performance/DetailVisibility.ets'));
function fixture() {
 const nav=new Set(),dest=new Set(),app=new Set();let size=1,route={navDestinationId:'A',index:0,state:states.ON_SHOWN},fail=false;
 const events=[];let unavailable=0;
 const context={getUIObserver:()=>({on:(type,f)=>(type==='navDestinationSwitch'?nav:dest).add(f),off:(type,f)=>(type==='navDestinationSwitch'?nav:dest).delete(f)}),
 getHostContext:()=>({getApplicationContext:()=>({on:(_type,f)=>{if(fail)throw Error('registration');app.add(f)},off:(_type,f)=>app.delete(f)})}),runScopedTask:f=>f()};
 const lifecycle=DetailVisibility.create(context,()=>({pathStack:{size:()=>size}}),()=>route,v=>events.push(v),()=>unavailable++);
 return {lifecycle,events,get unavailable(){return unavailable},counts:()=>[nav.size,dest.size,app.size],
 route:(nextSize,nextRoute)=>{size=nextSize;route=nextRoute;nav.forEach(f=>f({}))},update:info=>dest.forEach(f=>f(info)),
 background:()=>app.forEach(f=>f.onApplicationBackground()),foreground:()=>app.forEach(f=>f.onApplicationForeground()),
 failRegistration:()=>fail=true};
}
test('actual DetailVisibility deduplicates first entry and repeated native notifications',()=>{
 const f=fixture();f.lifecycle.start();f.lifecycle.start();f.update({navDestinationId:'A',index:0,state:states.ON_SHOWN});f.foreground();
 assert.deepEqual(f.events,[true]);assert.deepEqual(f.counts(),[1,1,1]);f.lifecycle.stop();assert.deepEqual(f.counts(),[0,0,0]);
});
test('actual DetailVisibility handles A to child B and return, ignoring unrelated destination updates',()=>{
 const f=fixture();f.lifecycle.start();f.route(2,{navDestinationId:'A',index:0,state:states.ON_SHOWN});
 f.update({navDestinationId:'B',index:1,state:states.ON_SHOWN});assert.deepEqual(f.events,[true,false]);
 f.route(1,{navDestinationId:'A',index:0,state:states.ON_SHOWN});assert.deepEqual(f.events,[true,false,true]);f.lifecycle.stop();
});
test('actual DetailVisibility hides on every terminal native state and resumes once in foreground',()=>{
 for(const state of [states.ON_HIDDEN,states.ON_WILL_HIDE,states.ON_DISAPPEAR,states.ON_WILL_DISAPPEAR]) {
  const f=fixture();f.lifecycle.start();f.update({navDestinationId:'A',index:0,state});assert.deepEqual(f.events,[true,false]);
  f.background();f.route(1,{navDestinationId:'A',index:0,state:states.ON_SHOWN});assert.deepEqual(f.events,[true,false]);
  f.foreground();f.foreground();assert.deepEqual(f.events,[true,false,true]);f.lifecycle.stop();
 }
});
test('actual DetailVisibility fails closed on missing navigation destination and removes listeners',()=>{
 const f=fixture();f.lifecycle.start();f.route(1,undefined);assert.equal(f.unavailable,1);assert.deepEqual(f.counts(),[0,0,0]);
 f.foreground();assert.deepEqual(f.events,[true]);
});
test('actual DetailVisibility registration failure unwinds partial subscriptions',()=>{
 const f=fixture();f.failRegistration();assert.throws(()=>f.lifecycle.start(),/subscription failed/);assert.deepEqual(f.counts(),[0,0,0]);
});
