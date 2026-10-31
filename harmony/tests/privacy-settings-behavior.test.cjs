// Production privacy settings event handlers with a deferred API boundary; no ArkUI or server.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const filename = path.resolve(__dirname, '../entry/src/main/ets/privacy/PrivacySettingsPage.ets');
function deferred() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
function fixture() {
  const rights = [], withdrawals = [], closures = [], stored = new Map();
  let finish = 0, withdrawnEvents = 0, closedEvents = 0, generated = 0, cancelled = 0;
  const app = {
    getDeviceId: () => 'installation-test', restoreForPrivacyRights: async () => {},
    sessionManager: { isAuthenticated: () => true, getSessionVersion: () => 1 },
    privacyApi: {
      cancelReads() { cancelled++; },
      submitRight(body) { const pending = deferred(); rights.push({ ...pending, body }); return pending.promise; },
      rights: async () => ({ records: [], page: 1, size: 20, total: 0 }),
      consent: async () => ({ status: 'GRANTED' }),
      closeAccount(phone, code) { const pending = deferred(); closures.push({ ...pending, phone, code }); return pending.promise; }
    },
    withdrawRequiredPrivacyConsent() { const pending = deferred(); withdrawals.push(pending); return pending.promise; },
    async finishAccountClosure() { finish++; }
  };
  const source = fs.readFileSync(filename, 'utf8');
  const plain = (source.slice(0, source.indexOf('  @Builder')) + '\n}')
    .replace(/^@Component\s*$/m, '').replace('export struct ', 'export class ')
    .replace(/@Watch\('[^']+'\)\s*/g, '').replace(/@(State|Prop)\s+/g, '');
  const loaded = new Module(filename, module);
  loaded.require = name => {
    if (name.endsWith('/AppClient')) return { AppClient: { shared: app } };
    if (name === '@kit.ArkData') return { preferences: { getPreferencesSync() { return {
      getSync: (key, fallback) => stored.get(key) ?? fallback,
      putSync: (key, value) => stored.set(key, value), deleteSync: key => stored.delete(key), flushSync() {}
    }; } } };
    if (name === '@kit.ArkTS') return { util: { generateRandomUUID() { return `00000000-0000-4000-8000-${String(++generated).padStart(12, '0')}`; } } };
    if (name.endsWith('/LegalDocumentContent')) return { LegalDocumentKind: { NONE: 'NONE' } };
    return {};
  };
  loaded._compile(ts.transpileModule(plain, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  }).outputText, filename);
  const page = new loaded.exports.PrivacySettingsPage();
  page.getUIContext = () => ({ getHostContext: () => ({}) });
  page.authenticated = true;
  page.onWithdrawn = () => withdrawnEvents++; page.onClosed = () => closedEvents++;
  return { page, app, rights, withdrawals, closures, stored,
    get finish() { return finish; }, get withdrawnEvents() { return withdrawnEvents; },
    get closedEvents() { return closedEvents; }, get generated() { return generated; }, get cancelled() { return cancelled; } };
}
const options = { timeout: 5000 };

test('rights submission sends only once during a double click and announces submitted only after a real server ID', options, async () => {
  const f = fixture(), p = f.page; p.view = 'rights'; p.description = '请删除不再需要的资料'; p.typeIndex = 3;
  const pending = p.submit(); await p.submit();
  assert.equal(f.rights.length, 1); assert.equal(p.busy, true); assert.equal(p.notice, '');
  assert.equal(f.rights[0].body.type, 'DELETE'); assert.equal(f.rights[0].body.description, '请删除不再需要的资料');
  f.rights[0].resolve({ id: 29, status: 'SUBMITTED' }); await pending;
  assert.match(p.notice, /申请已提交.*29/); assert.match(p.notice, /不代表信息已删除/);
  assert.equal(p.description, ''); assert.equal(p.busy, false);
  assert.equal(f.stored.has('key'), false);
});

test('failed submission retains text and the same persistent idempotency key for a safe retry', options, async () => {
  const f = fixture(), p = f.page; p.description = '复制本人账号资料';
  const first = p.submit(); f.rights[0].reject(new Error('网络不可用')); await first;
  assert.equal(p.notice, ''); assert.equal(p.description, '复制本人账号资料'); assert.match(p.error, /网络不可用/);
  const key = f.rights[0].body.idempotencyKey;
  const retry = p.submit(); assert.equal(f.rights[1].body.idempotencyKey, key); assert.equal(f.generated, 1);
  f.rights[1].resolve({ id: 0 }); await retry;
  assert.equal(p.notice, ''); assert.match(p.error, /服务器未确认/); assert.equal(p.description, '复制本人账号资料');
});

test('a changed rights request receives a distinct persisted key and unauthenticated or short forms never send', options, async () => {
  const f = fixture(), p = f.page;
  p.description = '短'; await p.submit(); assert.equal(f.rights.length, 0);
  p.description = '查询本人账号资料'; p.authenticated = false; await p.submit(); assert.equal(f.rights.length, 0);
  p.authenticated = true; const first = p.submit(); f.rights[0].reject(new Error('失败')); await first;
  p.description = '复制本人所有资料'; const second = p.submit();
  assert.notEqual(f.rights[0].body.idempotencyKey, f.rights[1].body.idempotencyKey);
  f.rights[1].reject(new Error('失败')); await second;
});

test('closure requires explicit second confirmation and failure cannot clear credentials or claim closure', options, async () => {
  const f = fixture(), p = f.page; p.phone = '13800138000'; p.code = '123456';
  await p.closeAccount(); assert.equal(f.closures.length, 0); assert.equal(f.finish, 0);
  p.confirmClosure = true; const first = p.closeAccount(); await p.closeAccount(); assert.equal(f.closures.length, 1);
  f.closures[0].reject(new Error('服务器拒绝注销')); await first;
  assert.equal(f.finish, 0); assert.equal(f.closedEvents, 0); assert.equal(p.authenticated, true);
  assert.equal(p.notice, ''); assert.match(p.error, /拒绝注销/); assert.equal(p.code, '123456');
});

test('an unconfirmed state cannot close; server CLOSED terminates credentials and shows a result before navigation', options, async () => {
  const f = fixture(), p = f.page; p.phone = '13800138000'; p.code = '123456'; p.confirmClosure = true;
  const first = p.closeAccount(); f.closures[0].resolve({ status: 'PROCESSING' }); await first;
  assert.equal(f.finish, 0); assert.equal(f.closedEvents, 0); assert.equal(p.notice, ''); assert.match(p.error, /未确认账号注销/);
  const confirmed = p.closeAccount(); assert.equal(f.finish, 0);
  f.closures[1].resolve({ status: 'CLOSED', retainedDataNotice: '必要业务记录受限保留。' }); await confirmed;
  assert.equal(f.finish, 1); assert.equal(f.closedEvents, 0); assert.equal(p.accountClosed, true); assert.equal(p.authenticated, false);
  assert.equal(p.code, ''); assert.equal(p.phone, ''); assert.match(p.notice, /服务器注销/);
});

test('withdrawal requires confirmation, sends once, and a failed backend response cannot invoke success navigation', options, async () => {
  const f = fixture(), p = f.page;
  await p.withdraw(); assert.equal(f.withdrawals.length, 0);
  p.confirmWithdrawal = true; const pending = p.withdraw(); await p.withdraw(); assert.equal(f.withdrawals.length, 1);
  f.withdrawals[0].reject(new Error('撤回状态不确定')); await pending;
  assert.equal(f.withdrawnEvents, 0); assert.equal(p.notice, ''); assert.match(p.error, /状态不确定/);
  assert.match(p.error, /业务请求已暂时停止/); assert.equal(p.confirmWithdrawal, true); assert.equal(f.finish, 0);
  const retry = p.withdraw(); f.withdrawals[1].resolve({ status: 'WITHDRAWN' }); await retry;
  assert.equal(f.withdrawnEvents, 1); assert.match(p.notice, /服务器已记录撤回/); assert.equal(f.finish, 0);
});

test('leaving while a rights or withdrawal operation is pending suppresses all late UI success/error and callbacks', options, async () => {
  for (const kind of ['rights', 'withdrawal']) {
    const f = fixture(), p = f.page; p.description = '删除本人公开内容'; p.confirmWithdrawal = true;
    const pending = kind === 'rights' ? p.submit() : p.withdraw();
    p.aboutToDisappear(); p.notice = 'new view'; p.error = 'new error';
    if (kind === 'rights') f.rights[0].resolve({ id: 30 }); else f.withdrawals[0].resolve({ status: 'WITHDRAWN' });
    await pending;
    assert.equal(p.notice, 'new view'); assert.equal(p.error, 'new error');
    assert.equal(f.withdrawnEvents, 0); assert.equal(f.cancelled, 1);
  }
});

test('closure completed after leaving still terminates the closed account but never repaints the departed page', options, async () => {
  const f = fixture(), p = f.page; p.phone = '13800138000'; p.code = '123456'; p.confirmClosure = true;
  const pending = p.closeAccount(); p.aboutToDisappear(); p.notice = 'new view';
  f.closures[0].resolve({ status: 'CLOSED' }); await pending;
  assert.equal(f.finish, 1); assert.equal(f.closedEvents, 0); assert.equal(p.notice, 'new view');
});
