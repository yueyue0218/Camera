const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) { throw new Error('Set DEVECO_SDK_HOME to the DevEco Studio SDK directory.'); }
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
require.extensions['.ets'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
}).outputText, filename);
const { HallUnreadCounter } = require(path.join(root, 'features/notifications/HallUnreadCounter.ets'));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  let version = 1, authenticated = true;
  const requests = [], cancelled = [], changes = [];
  const api = {
    unreadNotificationCount(key) {
      return new Promise((resolve, reject) => requests.push({ key, resolve, reject }));
    },
    cancelNotificationRequests(keys) { cancelled.push(...keys); }
  };
  const session = { getSessionVersion: () => version, isAuthenticated: () => authenticated };
  const counter = new HallUnreadCounter(api, session, (count, epoch) => changes.push([count, epoch]));
  return { counter, requests, cancelled, changes,
    changeAccount() { version++; }, logout() { authenticated = false; version++; } };
}

test('badge uses real count, rings only on later increases and not on decreases', async () => {
  const f = fixture(); f.counter.start(); f.requests[0].resolve(9); await tick();
  assert.deepEqual(f.changes.at(-1), [9, 0], 'first server count is baseline, not a new notification');
  const increase = f.counter.refresh(); f.requests[1].resolve(10); await increase;
  assert.deepEqual(f.changes.at(-1), [10, 1]);
  const decrease = f.counter.refresh(); f.requests[2].resolve(2); await decrease;
  assert.deepEqual(f.changes.at(-1), [2, 1]); f.counter.stop();
});

test('same count and invalid count cannot create a false ring', async () => {
  const f = fixture(); f.counter.start(); f.requests[0].resolve(100); await tick();
  const same = f.counter.refresh(); f.requests[1].resolve(100); await same;
  const invalid = f.counter.refresh(); f.requests[2].resolve(-1); await invalid;
  assert.deepEqual(f.changes.at(-1), [100, 0]); f.counter.stop();
});

test('logout, account switch, and hidden page cannot leak old count', async () => {
  const f = fixture(); f.counter.start(); f.requests[0].resolve(6); await tick();
  f.changeAccount(); const next = f.counter.refresh();
  assert.deepEqual(f.changes.at(-1), [0, 0]); f.requests[1].resolve(4); await next;
  assert.deepEqual(f.changes.at(-1), [4, 0]);
  f.logout(); await f.counter.refresh(); assert.deepEqual(f.changes.at(-1), [0, 0]);
  f.counter.stop();
  assert.ok(f.cancelled.length >= 1);
  assert.equal(f.requests.length, 2, 'unauthenticated users never request unread count');
});

test('a late request after stop is ignored; resumed page reads a fresh baseline', async () => {
  const f = fixture(); f.counter.start(); f.counter.stop(); f.requests[0].resolve(99); await tick();
  assert.deepEqual(f.changes.at(-1), [0, 0]);
  f.counter.start(); f.requests[1].resolve(100); await tick();
  assert.deepEqual(f.changes.at(-1), [100, 0]); f.counter.stop();
});

test('integration keeps badge and real notification endpoint, not placeholder values', () => {
  const bar = fs.readFileSync(path.join(root, 'common/components/PortraAppBar.ets'), 'utf8');
  const view = fs.readFileSync(path.join(root, 'features/hall/HallView.ets'), 'utf8');
  const hall = fs.readFileSync(path.join(root, 'pages/HallPage.ets'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'features/shell/PortraAppShell.ets'), 'utf8');
  assert.match(bar, /99\+/);
  assert.match(bar, /keyframeAnimateTo/);
  assert.match(view, /unreadCount: this\.noticeUnreadCount/);
  assert.match(hall, /HallUnreadCounter/);
  assert.match(shell, /hallActive: this\.selectedTab === 0/);
});
