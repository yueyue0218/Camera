import assert from 'node:assert/strict'
import test, { before, after, afterEach } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window','document','HTMLElement','Element','Node','DocumentFragment','ShadowRoot','CustomEvent','Event','MouseEvent','localStorage']) globalThis[key]=dom.window[key]
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
globalThis.getComputedStyle=dom.window.getComputedStyle
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {createElement:h}=await import('react')
const {render,cleanup,fireEvent,screen,act}=await import('@testing-library/react')
let vite, Gate, state, writes, logoutCount
const user={userId:101,token:'fixture-token'}
const grant={status:'GRANTED',privacyPolicyVersion:'2026-10-29-v1',crossBorderConsentVersion:'2026-10-29-v1'}
before(async()=>{
  vite=await createServer({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),appType:'custom',logLevel:'silent',server:{middlewareMode:true}})
  Gate=(await vite.ssrLoadModule('/src/privacy/PrivacyGate.jsx')).default
})
afterEach(()=>cleanup())
after(async()=>{await vite.close();dom.window.close()})
function mount(initial){
  state=initial;writes=[];logoutCount=0
  globalThis.fetch=async(url,options={})=>{
    if(options.method==='PUT'){const decision=JSON.parse(options.body);writes.push(decision);state={...decision}}
    return {ok:true,status:200,text:async()=>JSON.stringify({code:200,data:state})}
  }
  render(h(Gate,{currentUser:user,logout:()=>{logoutCount++}},h('h1',null,'业务内容')))
}
test('legacy NOT_RECORDED can read documents and explicitly consent without login loop',async()=>{
  await act(async()=>mount({status:'NOT_RECORDED'}))
  assert.equal(screen.queryByText('正在核实账户授权；业务内容暂不加载。'),null)
  assert.equal(screen.queryByText('业务内容'),null)
  assert.ok(screen.getByText('个人信息出境单独同意书'))
  const submit=screen.getByRole('button',{name:'明确同意并继续'})
  assert.equal(submit.disabled,true);assert.equal(writes.length,0)
  fireEvent.click(screen.getByLabelText('我已阅读并同意隐私政策'))
  assert.equal(submit.disabled,true)
  fireEvent.click(screen.getByLabelText('我单独同意个人信息出境处理'))
  fireEvent.click(submit)
  await screen.findByText('业务内容')
  assert.equal(writes.length,1);assert.equal(writes[0].status,'GRANTED');assert.equal(logoutCount,0)
})
test('cross-device withdrawal reloads server state, blocks content and keeps rights available',async()=>{
  await act(async()=>mount(grant));assert.ok(screen.getByText('业务内容'))
  state={status:'WITHDRAWN'}
  await act(async()=>window.dispatchEvent(new CustomEvent('portra:consent-required')))
  await screen.findByText(/你已撤回同意/)
  assert.equal(screen.queryByText('业务内容'),null)
  assert.ok(screen.getByText('个人信息权利申请（无需同意业务授权）'))
  assert.equal(logoutCount,0);assert.equal(writes.length,0)
})
test('explicit refusal logs out without manufacturing a grant',async()=>{
  await act(async()=>mount({status:'NOT_RECORDED'}))
  fireEvent.click(screen.getByRole('button',{name:'暂不同意，退出登录'}))
  assert.equal(logoutCount,1);assert.equal(writes.length,0)
})
