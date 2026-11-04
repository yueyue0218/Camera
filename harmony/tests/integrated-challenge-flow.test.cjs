// Execute production page handlers and API adapters; replace only transport and platform UI.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const id = '12345678-1234-4123-8123-123456789abc';
function fixture() {
  const calls = [], cache = new Map();
  let version = 1, signedIn = 0, closed = 0, consent = 0;
  let sendResult = { challengeId: id, expiresAt: '2026-11-04T12:00:00' };
  let verifyError, closureError;
  const transport = {
    async postPublic(route, body) { return this.post(route, body); },
    async post(route, body) {
      calls.push({ route, body });
      if (route.endsWith('/send') || route.endsWith('/code')) return await sendResult;
      if (route.endsWith('/verify')) {
        if (verifyError) throw verifyError;
        return { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', userId: 1, nickname: 'fixture', role: 'CUSTOMER' };
      }
      if (closureError) throw closureError;
      return await closureResult;
    }, cancelRequest() {}
  };
  let closureResult = { status: 'CLOSED' };
  const app = {
    getDeviceId: () => 'fixture-device',
    sessionManager: { getSessionVersion: () => version, async signIn() { signedIn++; version++; return true; } },
    async synchronizePrivacyConsent() { consent++; }, async finishAccountClosure() { closed++; }
  };
  function load(relative, page = false) {
    const filename = path.resolve(root, relative.endsWith('.ets') ? relative : relative + '.ets');
    if (cache.has(filename)) return cache.get(filename).exports;
    let source = fs.readFileSync(filename, 'utf8');
    if (page) source = (source.slice(0, source.indexOf('  @Builder')) + '\n}')
      .replace(/^@Component\s*$/m, '').replace('export struct ', 'export class ')
      .replace(/@Watch\('[^']+'\)\s*/g, '').replace(/@(State|Prop)\s+/g, '');
    const m = new Module(filename, module); cache.set(filename, m);
    m.require = name => {
      if (name.endsWith('/AppClient')) return { AppClient: { shared: app } };
      if (name.endsWith('/HttpClient')) return { HttpClient: class {} };
      if (name.endsWith('/PortraButton') || name.startsWith('@kit.')) return {};
      if (name.endsWith('/LegalDocumentContent')) return { LegalDocumentKind: { NONE: 'NONE' } };
      return load(path.relative(root, path.resolve(path.dirname(filename), name)));
    };
    m._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, filename);
    return m.exports;
  }
  app.apiService = new (load('network/ApiService').ApiService)(transport);
  app.privacyApi = new (load('privacy/PrivacyApi').PrivacyApi)(transport);
  const login = new (load('pages/LoginPage', true).LoginPage)();
  login.phone = '13800138000'; login.code = '123456'; login.agreementsAccepted = true;
  // Do not create wall-clock timers in the handler harness.
  login.startCooldown = () => {};
  const closure = new (load('privacy/PrivacySettingsPage', true).PrivacySettingsPage)();
  closure.phone = '13800138000'; closure.code = '123456'; closure.authenticated = true; closure.confirmClosure = true;
  return { calls, app, login, closure, setSend: x => sendResult = x, changeSession: () => version++,
    failVerify: x => verifyError = x, failClosure: x => closureError = x, setClosure: x => closureResult = x,
    get signedIn() { return signedIn; }, get closed() { return closed; }, get consent() { return consent; } };
}
async function sendClosure(f) {
  await f.closure.sendCode();
  if (f.closure.timer >= 0) { clearInterval(f.closure.timer); f.closure.timer = -1; }
}
test('LOGIN page -> API -> native verify forwards challenge and synchronizes consent before success', async () => {
  const f = fixture(); await f.login.sendCode(); await f.login.signIn();
  assert.equal(f.calls[0].route, '/auth/sms/send');
  assert.deepEqual(f.calls[1].body, { phone: '+8613800138000', purpose: 'LOGIN', code: '123456', challengeId: id, deviceId: 'fixture-device', deviceName: 'Portra HarmonyOS' });
  assert.equal(f.signedIn, 1); assert.equal(f.consent, 1);
});
test('LOGIN phone change, unaccepted terms and expired-code response cannot establish a session', async () => {
  const f = fixture(); f.login.agreementsAccepted = false; await f.login.sendCode(); assert.equal(f.calls.length, 0);
  f.login.agreementsAccepted = true; await f.login.sendCode(); f.login.phone = '13900139000'; await f.login.signIn(); assert.equal(f.calls.length, 1);
  f.login.phone = '13800138000'; f.failVerify({ businessCode: 40002 }); await f.login.signIn(); assert.equal(f.signedIn, 0); assert.match(f.login.errorMessage, /过期/);
});
test('both page flows reject an old backend boolean send response', async () => {
  const f = fixture(); f.setSend(true); await f.login.sendCode(); await sendClosure(f);
  assert.equal(f.login.challengeId, ''); assert.equal(f.closure.challengeId, '');
  await f.login.signIn(); await f.closure.closeAccount(); assert.equal(f.calls.length, 2);
});
test('late send responses after a session change are ignored by both pages', async () => {
  const f = fixture(); let resolve; f.setSend(new Promise(r => resolve = r));
  const login = f.login.sendCode(), closure = sendClosure(f); f.changeSession(); resolve({ challengeId: id });
  await Promise.all([login, closure]); assert.equal(f.login.challengeId, ''); assert.equal(f.closure.challengeId, '');
});
test('REAUTH page -> API forwards challenge and explicit confirmation; success clears session only after CLOSED', async () => {
  const f = fixture(); await sendClosure(f); await f.closure.closeAccount();
  assert.equal(f.calls[0].route, '/privacy/account-closure/code');
  assert.deepEqual(f.calls[1].body, { phone: '13800138000', code: '123456', confirmed: true, challengeId: id });
  assert.equal(f.closed, 1); assert.equal(f.closure.accountClosed, true);
  await f.closure.closeAccount(); assert.equal(f.calls.length, 2);
});
test('REAUTH bound phone/session changes require a fresh challenge', async () => {
  const f = fixture(); await sendClosure(f); f.closure.phone = '13900139000'; await f.closure.closeAccount();
  f.closure.phone = '13800138000'; f.changeSession(); await f.closure.closeAccount(); assert.equal(f.calls.length, 1); assert.equal(f.closed, 0);
});
test('failed sensitive operation cannot resubmit a possibly consumed challenge or clear credentials', async () => {
  const f = fixture(); await sendClosure(f); f.failClosure(new Error('operation failed')); await f.closure.closeAccount(); await f.closure.closeAccount();
  assert.equal(f.calls.length, 2); assert.equal(f.closure.challengeId, ''); assert.equal(f.closed, 0); assert.equal(f.closure.authenticated, true);
});
test('closure success for an old session cannot clear a newly logged-in account', async () => {
  const f = fixture(); await sendClosure(f); let resolve; f.setClosure(new Promise(r => resolve = r));
  const pending = f.closure.closeAccount(); f.changeSession(); resolve({ status: 'CLOSED' }); await pending;
  assert.equal(f.closed, 0); assert.equal(f.closure.accountClosed, false);
});
