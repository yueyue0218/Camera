import assert from 'node:assert/strict'
import test, { before, after, afterEach } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window','document','HTMLElement','Element','Node','DocumentFragment','ShadowRoot','CustomEvent','Event','MouseEvent','localStorage']) globalThis[key]=dom.window[key]
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
globalThis.getComputedStyle=dom.window.getComputedStyle
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const {createElement:h}=await import('react')
const {render,cleanup,fireEvent,screen,act}=await import('@testing-library/react')
const { MemoryRouter, Routes, Route }=await import('react-router-dom')
let vite, Page, Provider, calls, sendData, verifyFailure
const id='12345678-1234-4123-8123-123456789abc'
before(async()=>{
  vite=await createServer({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),appType:'custom',logLevel:'silent',server:{middlewareMode:true}})
  Page=(await vite.ssrLoadModule('/src/pages/auth/AuthPages.jsx')).PhoneAuthPage
  Provider=(await vite.ssrLoadModule('/src/AuthContext.jsx')).AuthProvider
})
afterEach(()=>cleanup())
after(async()=>{await vite.close();dom.window.close()})
async function mount(data={challengeId:id}){
  calls=[];sendData=data;verifyFailure=false
  globalThis.fetch=async(url,options={})=>{
    const body=options.body ? JSON.parse(options.body) : null
    calls.push({url,body})
    let result={code:40101,message:'no session'}
    if(url.endsWith('/sms/send')) result={code:200,data:await sendData}
    if(url.endsWith('/sms/verify')) result=verifyFailure ? {code:40002,message:'验证码错误或已过期'} : {code:200,data:{token:'fixture-access',userId:1,nickname:'fixture',role:'CUSTOMER',newUser:false}}
    return {ok:true,status:200,text:async()=>JSON.stringify(result)}
  }
  await act(async()=>render(h(MemoryRouter,{initialEntries:['/login/phone']},h(Provider,null,h(Routes,null,
    h(Route,{path:'/login/phone',element:h(Page)}),h(Route,{path:'/hall',element:h('h1',null,'Authenticated destination')}))))))
  fireEvent.change(screen.getByPlaceholderText('请输入手机号'),{target:{value:'13800138000'}})
  fireEvent.click(screen.getByRole('checkbox'))
}
async function send(){await act(async()=>fireEvent.click(screen.getByRole('button',{name:'获取验证码'})))}
async function verify(){
  fireEvent.change(screen.getByPlaceholderText('6 位验证码'),{target:{value:'123456'}})
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'验证并进入 Portra'})))
}
test('real React page + authApi + AuthProvider sends challengeId and establishes browser session',async()=>{
  await mount();await send();await verify();assert.ok(screen.getByText('Authenticated destination'))
  const request=calls.find(x=>x.url.endsWith('/sms/verify'))
  assert.equal(request.body.challengeId,id);assert.equal(request.body.phone,'13800138000');assert.equal(request.body.purpose,'LOGIN')
  assert.equal(localStorage.getItem('camera-p4-auth'),null)
})
test('phone change clears challenge and prevents verify for another number',async()=>{
  await mount();await send();fireEvent.change(screen.getByPlaceholderText('请输入手机号'),{target:{value:'13900139000'}})
  assert.equal(screen.getByPlaceholderText('6 位验证码').disabled,true)
  assert.equal(screen.getByRole('button',{name:'验证并进入 Portra'}).disabled,true)
  assert.equal(calls.filter(x=>x.url.endsWith('/sms/verify')).length,0)
})
test('old server boolean response fails closed without a usable challenge',async()=>{
  await mount(true);await send();assert.ok(screen.getByText('请更新客户端后重新获取验证码'))
  assert.equal(screen.getByRole('button',{name:'验证并进入 Portra'}).disabled,true)
})
test('expired or rejected code never establishes a browser session',async()=>{
  await mount();await send();verifyFailure=true;await verify()
  assert.equal(screen.queryByText('Authenticated destination'),null);assert.ok(screen.getByText(/验证码.*过期/))
})
