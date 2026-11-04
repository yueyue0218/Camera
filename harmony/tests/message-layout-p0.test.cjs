const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs'), path = require('node:path');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
require.extensions['.ets'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText,f);
function compile(body, bindings = {}) {
  const code = ts.transpileModule(`class Page { ${body} }; module.exports=Page;`, {compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}}; new Function('module', ...Object.keys(bindings), code)(mod, ...Object.values(bindings)); return new mod.exports();
}
function scrolls(source) {
  return [...source.matchAll(/\bScroll\([^\n]*\)\s*\{/g)].map(m => {
    let depth=1, i=m.index+m[0].length;
    while(depth && i<source.length) { if(source[i]==='{')depth++;if(source[i]==='}')depth--;i++; }
    return source.slice(i, source.indexOf('\n',i)+1) + source.slice(source.indexOf('\n',i)+1).match(/^\s*\.[^\n]*(?:\n\s*\.[^\n]*)*/)?.[0];
  });
}
// Declarative ArkUI constraints, not a device/pixel layout simulation.
for (const name of ['MessagePage','ConversationDetailPage','QuoteFormPage','QuoteDetailPage','OrderPage',
  'OrderDetailPage','OrderEngagementPage','DeliveryUploadPage','DeliveryGalleryPage','PhotoAuthorizationPage',
  'OrderReviewsPage','NotificationPage','CreditPage']) {
  test(`${name}: every body Scroll explicitly anchors short content at the top`, () => {
    const views=scrolls(read(`pages/${name}.ets`));assert.ok(views.length);
    for(const view of views.filter(v=>!v.includes('ScrollDirection.Horizontal'))) assert.match(view,/\.align\(Alignment.Top(?:Start)?\)/);
  });
}
for (const name of ['MomentDetailPanel','MomentPublishPanel']) test(`${name}: notification detail/editor top alignment`,()=>{
  for(const view of scrolls(read(`features/moments/${name}.ets`))) assert.match(view,/\.align\(Alignment.Top(?:Start)?\)/);
});
const chat = read('pages/ConversationDetailPage.ets');
const {ConversationTimeline} = require(path.join(root,'features/conversation/ConversationTimeline.ets'));
const {ConversationMessageState} = require(path.join(root,'features/conversation/ConversationMessageState.ets'));
const message = id => ({messageId:id,conversationId:7,senderId:id%2+1,messageType:'TEXT',content:`text ${id}`,createdAt:`2026-11-02T10:00:${String(id).padStart(2,'0')}`});
for(const count of [0,1,3,20]) test(`chat ${count} messages: timeline keeps all messages and follow-bottom does not alter top constraint`,()=>{
  const page=compile(chat.slice(chat.indexOf('  private showMessages('),chat.indexOf('  private scrollToBottom(')));
  Object.assign(page,{messages:[],unreadBelow:0,threadScroller:{isAtEnd:()=>true},scrollToBottom(){this.scrolled=true;}});
  page.showMessages(Array.from({length:count},(_,i)=>message(i+1)),true);
  assert.equal(page.messages.length,count);
  assert.equal(ConversationTimeline.build(page.messages,[],[],[],[]).filter(x=>x.message!==undefined).length,count);
  if(count)assert.equal(page.scrolled,true);
  assert.match(scrolls(chat)[1],/align\(Alignment.TopStart\)/);
});
test('history merge preserves ordering/deduplication and does not pull a reader to the bottom',()=>{
  const page=compile(chat.slice(chat.indexOf('  private showMessages('),chat.indexOf('  private scrollToBottom(')));
  Object.assign(page,{messages:[message(3)],unreadBelow:0,threadScroller:{isAtEnd:()=>false},scrollToBottom(){throw Error('unexpected jump')}});
  page.showMessages(ConversationMessageState.merge(page.messages,[message(1),message(2),message(3)]));
  assert.deepEqual(page.messages.map(x=>x.messageId),[1,2,3]);
  page.scrollToBottom=()=>page.scrolled=true;page.showMessages([...page.messages,message(4)],true);assert.equal(page.scrolled,true);
  assert.match(read('network/ApiService.ets'),/`\/conversations\/\$\{conversationId\}\/messages`/);
});
test('keyboard resize mode restores on leaving and is re-established on return',()=>{
  const page=compile(chat.slice(chat.indexOf('  private setVisible('),chat.indexOf('  private invalidateAccount(')), {
    KeyboardAvoidMode:{RESIZE:'resize'},setInterval:()=>42,clearInterval:()=>{}
  });
  let mode='original', refreshes=0;
  Object.assign(page,{visible:false,activeToken:'token',conversation:{},userId:1,contentVersion:0,
    getUIContext:()=>({getKeyboardAvoidMode:()=>mode,setKeyboardAvoidMode:v=>mode=v}),
    appClient:{sessionManager:{getSession:()=>({accessToken:'token'})},apiService:{cancelConversationDetail(){}}},
    refreshContent:()=>refreshes++});
  page.setVisible(true);assert.equal(mode,'resize');page.setVisible(false);assert.equal(mode,'original');
  page.setVisible(true);assert.equal(mode,'resize');assert.equal(refreshes,2);
  assert.ok(chat.indexOf('Scroll(this.threadScroller)')<chat.lastIndexOf('TextInput({ text: this.draft'));
});
