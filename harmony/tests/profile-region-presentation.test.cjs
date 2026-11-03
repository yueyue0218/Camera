const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path');
const ts=require(path.join(process.env.DEVECO_SDK_HOME,'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root=path.resolve(__dirname,'../entry/src/main/ets');
const source=fs.readFileSync(path.join(root,'common/region/RegionControl.ets'),'utf8').replace(/\r\n/g,'\n');
const methods=source.slice(source.indexOf('  private selectionLabel('),source.indexOf('  build() {'));
const code=ts.transpileModule(`class Control{${methods}};module.exports=Control`,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};new Function('module','ProvinceCatalog',code)(mod,{display:code=>({JS:'江苏省',SH:'上海市'})[code]||''});
test('compact region shows a successful device region rather than a pending-location placeholder',()=>{
 const c=new mod.exports();c.value='';c.located='江苏省';assert.equal(c.selectionLabel(),'江苏省');
 c.located='上海市';assert.equal(c.selectionLabel(),'上海市');
});
test('manual region remains selected without falsely claiming device location',()=>{
 const c=new mod.exports();c.value='SH';c.located='尚未定位';assert.equal(c.selectionLabel(),'上海市');
 c.value='';assert.equal(c.selectionLabel(),'尚未定位');
});
test('owner compact UI leaves shared full-size region control and public profile available',()=>{
 const profile=fs.readFileSync(path.join(root,'pages/ProfilePage.ets'),'utf8');
 const identity=fs.readFileSync(path.join(root,'features/user/ProfileIdentity.ets'),'utf8');
 const pub=fs.readFileSync(path.join(root,'pages/PublicProfilePage.ets'),'utf8');
 assert.match(profile,/RegionControl\(\{ value: this\.selectedRegion, compact: true/);
 assert.match(profile,/showIdentityLine: false/);assert.match(identity,/@Prop showIdentityLine: boolean = true/);
 assert.doesNotMatch(pub,/showIdentityLine: false/);
 const start=source.indexOf('      if (this.compact) {',source.indexOf('  build() {'));
 const compact=source.slice(start,source.indexOf('      } else {',start));
 assert.doesNotMatch(compact,/设备地区|尚未定位/);assert.match(compact,/this\.confirm\(\)/);assert.match(compact,/this\.pickerOpen = true/);
});

test('the province label opens a picker offering both manual provinces and explicit automatic location',()=>{
 const picker=source.slice(source.indexOf('  private Picker()'),source.indexOf('  private select('));
 assert.match(picker,/自动定位当前地区/);assert.match(picker,/this\.confirm\(\)/);
 assert.match(picker,/ForEach\(ProvinceCatalog\.all/);assert.match(picker,/this\.select\(p\.code\)/);
});

test('cancel and sheet dismissal preserve selection without requesting location or publishing a change',()=>{
 const methods=source.slice(source.indexOf('  private cancelPicker('),source.indexOf('  private select('));
 const output=ts.transpileModule(`class Control{${methods}};module.exports=Control`,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
 const m={exports:{}};new Function('module',output)(m);const c=new m.exports();let changes=0,locations=0;
 Object.assign(c,{pickerOpen:true,value:'JS',located:'江苏省',onChange:()=>changes++,locate:()=>locations++});
 c.cancelPicker();assert.equal(c.pickerOpen,false);assert.equal(c.value,'JS');assert.equal(c.located,'江苏省');assert.equal(changes,0);assert.equal(locations,0);
 const picker=source.slice(source.indexOf('  private Picker()'),source.indexOf('  private cancelPicker('));
 assert.doesNotMatch(picker,/Button\('取消'\)/);assert.match(source,/showClose: true/);assert.match(source,/onDisappear: \(\) => this\.cancelPicker\(\)/);
});

test('declining location dismisses its explanation without opening picker or requesting location',()=>{
 const methods=source.slice(source.indexOf('  private confirm()'),source.indexOf('  private async locate('));
 const output=ts.transpileModule(`class Control{${methods}};module.exports=Control`,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
 const m={exports:{}};let dialog;new Function('module','ProvinceLocation','AlertDialog',output)(m,{authorized:()=>false},{show:value=>dialog=value});
 const c=new m.exports();let locations=0,changes=0;
 Object.assign(c,{locating:false,sharedBusy:false,consentOpen:false,pickerOpen:false,alive:true,requests:{generation:1},value:'JS',getUIContext:()=>({getHostContext:()=>({})}),locate:()=>locations++,onChange:()=>changes++});
 c.confirm();assert.equal(dialog.title,'定位省级地区');assert.equal(c.consentOpen,true);assert.equal(locations,0);
 assert.equal(dialog.primaryButton.value,'不同意定位');dialog.primaryButton.action();
 assert.equal(c.consentOpen,false);assert.equal(c.pickerOpen,false);assert.equal(c.value,'JS');assert.equal(locations,0);assert.equal(changes,0);
 c.confirm();dialog.secondaryButton.action();assert.equal(locations,1);
});
