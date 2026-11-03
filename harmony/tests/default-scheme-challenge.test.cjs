const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

test('Web API forwards the exact challenge returned by send', async () => {
  const calls = [];
  const source = fs.readFileSync(path.join(root, 'frontend/src/api/authApi.js'), 'utf8')
    .replace(/^import .*$/gm, '').replace('export const authApi', 'globalThis.authApi');
  const context = vm.createContext({ SMS_PURPOSE: 'LOGIN', request: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { challengeId: 'server-issued-id', expiresAt: '2026-11-03T12:00:00' };
  } });
  vm.runInContext(source, context);
  const challenge = await context.authApi.sendSmsCode({phone:'13800138000',deviceId:'browser'});
  await context.authApi.verifySmsCode({phone:'13800138000',code:'123456',challengeId:challenge.challengeId,deviceId:'browser'});
  assert.equal(calls[1].url, '/auth/sms/verify');
  assert.equal(calls[1].body.challengeId, 'server-issued-id');
  assert.equal(calls[1].body.purpose, 'LOGIN');
});

test('Harmony API forwards the exact challenge returned by send', async () => {
  if (!process.env.DEVECO_SDK_HOME) throw new Error('DEVECO_SDK_HOME required');
  const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
  const source = fs.readFileSync(path.join(root, 'harmony/entry/src/main/ets/network/ApiService.ets'),'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
  const exports = {};
  const context=vm.createContext({exports, require: name => {
    if(name==='./HttpClient') return {HttpClient:class {}};
    if(name==='./ErrorMapper') return {ErrorMapper:{parse:()=>new Error('parse error')}};
    throw new Error('Unexpected runtime import '+name);
  }});
  vm.runInContext(compiled,context);
  const calls=[];
  const session={accessToken:'access',refreshToken:'refresh',userId:1,nickname:'test',role:'CUSTOMER',adminCapable:false,newUser:false};
  const api=new exports.ApiService({postPublic:async (url, body) => {
    calls.push({url,body});
    return url.endsWith('/send')?{challengeId:'native-issued-id',expiresAt:'2026-11-03T12:00:00'}:session;
  }});
  const challenge=await api.sendLoginCode('13800138000','native');
  await api.verifyLoginCode('13800138000','123456','native',challenge.challengeId);
  assert.equal(calls[1].url,'/auth/native/sms/verify');
  assert.equal(calls[1].body.challengeId,'native-issued-id');
  assert.equal(calls[1].body.purpose,'LOGIN');
});
