const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));

// Execute the production event method, without emulating ArkUI rendering.
const source = fs.readFileSync(path.join(__dirname, '../entry/src/main/ets/pages/ProfilePage.ets'), 'utf8');
const method = source.slice(source.indexOf('  private async switchRole()'), source.indexOf('  private openSection('));
const code = ts.transpileModule(`class Page { ${method} }; module.exports = Page;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }
}).outputText;
const mod = { exports: {} }; new Function('module', code)(mod);
function fixture() {
  let epoch = 10, requests = 0, broadcasts = 0, loads = 0, resolve, reject;
  const page = new mod.exports();
  Object.assign(page, { role: 'CUSTOMER', userId: 7, switchingRole: false, roleSwitchVersion: 0,
    loadVersion: 1, section: 'identity', contentTab: 'secondary', interestGeneration: 0,
    profile: { id: 7 }, moments: [{ momentId: 9 }],
    appClient: { apiService: { switchRole(role) {
      assert.equal(role, 'PROVIDER'); requests++;
      return new Promise((res, rej) => { resolve = res; reject = rej; });
    } }, sessionManager: { getSessionVersion: () => epoch,
      async notifyIdentityChanged() { epoch++; return true; } } },
    onIdentityChanged() { broadcasts++; },
    async load() { loads++; page.role = 'PROVIDER'; },
    safeErrorLabel(error) { return error.message; }
  });
  return { page, confirm: () => resolve({ id: 7, currentRole: 'PROVIDER' }), fail: () => reject(new Error('40301')),
    logout: () => epoch++, get requests() { return requests; }, get broadcasts() { return broadcasts; }, get loads() { return loads; } };
}
test('role is changed and shell refreshed only after server confirmation; double click sends once', async () => {
  const f = fixture(); const pending = f.page.switchRole(); await f.page.switchRole();
  assert.equal(f.requests, 1); assert.equal(f.page.role, 'CUSTOMER'); assert.equal(f.broadcasts, 0);
  f.confirm(); await pending;
  assert.equal(f.page.role, 'PROVIDER'); assert.equal(f.broadcasts, 1); assert.equal(f.loads, 1);
  assert.equal(f.page.switchingRole, false);
});
test('403 keeps identity, current view and content while displaying the failure', async () => {
  const f = fixture(); const pending = f.page.switchRole(); f.fail(); await pending;
  assert.equal(f.page.role, 'CUSTOMER'); assert.equal(f.page.section, 'identity');
  assert.equal(f.page.contentTab, 'secondary'); assert.deepEqual(f.page.moments, [{ momentId: 9 }]);
  assert.equal(f.page.roleSwitchError, '40301'); assert.equal(f.broadcasts, 0); assert.equal(f.loads, 0);
});
test('an unrelated profile reload cannot swallow a successful server role change', async () => {
  const f = fixture(); const pending = f.page.switchRole(); f.page.loadVersion++; f.page.userId = 0;
  f.confirm(); await pending;
  assert.equal(f.broadcasts, 1); assert.equal(f.loads, 1);
});
test('logout makes a late role response unable to refresh the next identity', async () => {
  const f = fixture(); const pending = f.page.switchRole(); f.logout(); f.confirm(); await pending;
  assert.equal(f.broadcasts, 0); assert.equal(f.loads, 0); assert.equal(f.page.role, 'CUSTOMER');
});
test('malformed server confirmation never updates the shell', async () => {
  const f = fixture(); f.page.appClient.apiService.switchRole = async () => ({ id: 8, currentRole: 'PROVIDER' });
  await f.page.switchRole(); assert.equal(f.broadcasts, 0); assert.equal(f.loads, 0);
  assert.ok(f.page.roleSwitchError);
});

test('hall switches primary content for confirmed identities and keeps public browsing on unknown identity', () => {
  const source = fs.readFileSync(path.join(__dirname, '../entry/src/main/ets/features/hall/HallView.ets'), 'utf8');
  const method = source.slice(source.indexOf('  private onRoleChanged()'), source.indexOf('  private selectChannel('));
  const compiled = ts.transpileModule(`class View { ${method} }; module.exports = View;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'HallChannel', compiled)(loaded, { SHOWCASES: 'showcases', DEMANDS: 'demands' });
  const view = new loaded.exports(); view.selectChannel = channel => view.channel = channel;
  view.currentRole = 'PROVIDER'; view.onRoleChanged(); assert.equal(view.channel, 'demands');
  view.currentRole = ''; view.onRoleChanged(); assert.equal(view.channel, 'demands');
  view.currentRole = 'CUSTOMER'; view.onRoleChanged(); assert.equal(view.channel, 'showcases');
});
