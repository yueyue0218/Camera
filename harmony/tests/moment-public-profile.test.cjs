const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
require.extensions['.ets'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
}).outputText, filename);
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject }; }
function profile(id = 12) { return { userId: id, currentRole: 'PROVIDER', nickname: '真实作者',
  bio: '公开简介', followerCount: 3, followingCount: 2, momentCount: 1 }; }
function moment(id = 12) { return { momentId: 7, authorId: id, authorRole: 'PROVIDER',
  likeCount: 1, favoriteCount: 2, likedByCurrentUser: false, favoritedByCurrentUser: false }; }
function fixture() {
  let version = 3; const profiles = [], moments = [], cancellations = [];
  const app = { sessionManager: { getSessionVersion: () => version, isAuthenticated: () => true }, apiService: {
    getPublicProfile(id, role, key) { const p = deferred(); profiles.push({ id, role, key, ...p }); return p.promise; },
    listProfileMoments(id, role, page, size, key) { const p = deferred(); moments.push({ id, role, page, size, key, ...p }); return p.promise; },
    cancelPublicProfile(profile, moments) { cancellations.push({ profile, moments }); }
  } };
  const filename = path.join(root, 'pages/PublicProfilePage.ets');
  const source = fs.readFileSync(filename, 'utf8');
  const plain = (source.slice(0, source.indexOf('  build() {')) + '\n}')
    .replace(/^@Component\s*$/m, '').replace('export struct ', 'export class ')
    .replace(/@Watch\('[^']+'\)\s*/g, '').replace(/@(State|Prop)\s+/g, '');
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  const original = loaded.require.bind(loaded);
  loaded.require = name => name === '../app/AppClient' ? { AppClient: { shared: app } } : original(name);
  loaded._compile(ts.transpileModule(plain, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021
  } }).outputText, filename);
  function create() { const page = new loaded.exports.PublicProfilePage();
    Object.assign(page, { targetUserId: 12, targetRole: 'PROVIDER', active: true }); return page; }
  return { page: create(), create, profiles, moments, cancellations, changeSession() { version++; } };
}
async function tick() { await new Promise(resolve => setImmediate(resolve)); }
test('public author page uses existing real profile and matching role moment APIs', async () => {
  const f = fixture(); const read = f.page.load(); f.profiles[0].resolve(profile()); await tick();
  assert.equal(f.page.displayName(), '真实作者'); assert.equal(f.moments[0].id, 12);
  f.moments[0].resolve({ records: [moment()], total: 1 }); await read;
  assert.equal(f.page.moments.length, 1); assert.equal(f.page.loading, false);
});
test('target changes clear old profile and ignore old profile success/catch/finally', async () => {
  for (const fail of [false, true]) {
    const f = fixture(); const old = f.page.load(); f.page.targetUserId = 13; f.page.onTargetChanged();
    if (fail) f.profiles[0].reject(new Error('old')); else f.profiles[0].resolve(profile());
    await old; assert.equal(f.page.profile, undefined); assert.equal(f.page.loading, true);
    assert.equal(f.page.errorMessage, ''); f.profiles[1].resolve(profile(13)); await tick();
    f.moments[0].resolve({ records: [moment(13)], total: 1 }); await tick();
    assert.equal(f.page.profile.userId, 13);
  }
});
test('a hidden page and changed account cannot accept an old public profile result', async () => {
  const f = fixture(); const read = f.page.load(); f.changeSession(); f.page.aboutToDisappear();
  f.profiles[0].resolve(profile()); await read;
  assert.equal(f.page.profile, undefined); assert.deepEqual(f.page.moments, []);
});

test('account change between profile and moments clears the partially loaded view', async () => {
  const f = fixture(); const read = f.page.load(); f.profiles[0].resolve(profile()); await tick();
  assert.equal(f.page.profile.userId, 12); f.changeSession();
  f.moments[0].resolve({ records: [moment()], total: 1 }); await read;
  assert.equal(f.page.profile, undefined); assert.deepEqual(f.page.moments, []);
  assert.equal(f.page.loading, false);
});
test('wrong user, role or malformed counters are never shown', async () => {
  for (const value of [profile(99), { ...profile(), currentRole: 'CUSTOMER' }, { ...profile(), followerCount: -1 }]) {
    const f = fixture(); const read = f.page.load(); f.profiles[0].resolve(value); await read;
    assert.equal(f.page.profile, undefined); assert.ok(f.page.errorMessage.length > 0);
  }
});
test('each public page cancels only its own keys and legacy B card stays readonly', async () => {
  const f = fixture(); const a = f.page.load(); const other = f.create(); const b = other.load();
  assert.notEqual(f.profiles[0].key, f.profiles[1].key);
  f.page.aboutToDisappear(); assert.equal(f.cancellations.at(-1).profile, f.profiles[0].key);
  assert.notEqual(f.cancellations.at(-1).profile, f.profiles[1].key);
  f.profiles[0].resolve(profile()); f.profiles[1].resolve(profile()); await tick();
  f.moments[0].resolve({ records: [], total: 0 }); await Promise.all([a, b]);
  const source = fs.readFileSync(path.join(root, 'pages/PublicProfilePage.ets'), 'utf8');
  assert.match(source, /MomentCard\(\{ item: item \}\)/);
});
