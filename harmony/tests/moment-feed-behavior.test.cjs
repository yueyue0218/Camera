const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const sourceRoot = path.resolve(__dirname, '../entry/src/main/ets');
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot + path.sep));
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};
const { MomentFeedCache } = require('../entry/src/main/ets/features/moments/MomentFeedModels.ets');
const { ErrorMapper } = require('../entry/src/main/ets/network/ErrorMapper.ets');

function nativeEvents() {
  const navigation = new Set(), destinations = new Set(), application = new Set();
  const routes = [];
  let destination;
  let stackSize = 0;
  let failRegistration = false;
  const appContext = {
    on(type, callback) {
      assert.equal(type, 'applicationStateChange');
      if (failRegistration) { failRegistration = false; throw new Error('registration failed'); }
      application.add(callback);
    },
    off(type, callback) { assert.equal(type, 'applicationStateChange'); application.delete(callback); }
  };
  const observer = {
    on(type, callback) {
      assert.ok(['navDestinationSwitch', 'navDestinationUpdate'].includes(type));
      (type === 'navDestinationSwitch' ? navigation : destinations).add(callback);
    },
    off(type, callback) {
      assert.ok(['navDestinationSwitch', 'navDestinationUpdate'].includes(type));
      (type === 'navDestinationSwitch' ? navigation : destinations).delete(callback);
    }
  };
  return {
    routes,
    context: {
      getUIObserver: () => observer,
      getHostContext: () => ({ getApplicationContext: () => appContext }),
      runScopedTask: task => task()
    },
    bind(page) {
      page.getUIContext = () => this.context;
      page.queryNavigationInfo = () => ({ navigationId: '', pathStack: { size: () => stackSize, pushPathByName: (name, param) => routes.push({ name, param }) } });
      page.queryNavDestinationInfo = () => destination;
    },
    route(size, info) { stackSize = size; destination = info; for (const cb of navigation) cb({}); },
    destinationUpdate(info) { for (const cb of destinations) cb(info); },
    background() { for (const cb of application) cb.onApplicationBackground(); },
    foreground() { for (const cb of application) cb.onApplicationForeground(); },
    listeners() { return [navigation.size, application.size, destinations.size]; },
    failApplicationRegistrationOnce() { failRegistration = true; }
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function moment(overrides = {}) {
  return { momentId: 7, authorId: 12, authorRole: 'PROVIDER', title: '真实标题', content: '正文',
    imageDataList: [], likeCount: 3, likedByCurrentUser: false,
    favoriteCount: 2, favoritedByCurrentUser: false, ...overrides };
}
function setup() {
  let sessionVersion = 3, authenticated = true;
  const lists = [], favorites = [], sessions = [], details = [], likes = [], identityCancellations = [];
  const app = {
    sessionManager: { isAuthenticated: () => authenticated, getSessionVersion: () => sessionVersion },
    apiService: {
      listMoments(scope, key) { const pending = deferred(); lists.push({ scope, key, ...pending }); return pending.promise; },
      cancelMoments(key) { cancellations.push(key); },
      getMoment(id, key) { const p = deferred(); details.push({ id, key, ...p }); return p.promise; },
      cancelMomentDetail() {},
      likeMoment(id, key) { const p = deferred(); likes.push({ id, key, desired: true, ...p }); return p.promise; },
      unlikeMoment(id, key) { const p = deferred(); likes.push({ id, key, desired: false, ...p }); return p.promise; },
      cancelMomentLike() {},
      favoriteMoment(id) { const pending = deferred(); favorites.push({ id, desired: true, ...pending }); return pending.promise; },
      unfavoriteMoment(id) { const pending = deferred(); favorites.push({ id, desired: false, ...pending }); return pending.promise; },
      currentSession(key) { const pending = deferred(); sessions.push({key, ...pending}); return pending.promise; },
      cancelCurrentSession(key) { identityCancellations.push(key); }
    }
  };
  const cancellations = [];
  // Execute the actual page methods. Only ArkUI rendering/decorators are omitted;
  // these Node checks cannot validate rendering, device lifecycle or HAP compatibility.
  const filename = path.join(sourceRoot, 'pages/MomentFeedPage.ets');
  const source = fs.readFileSync(filename, 'utf8');
  const logic = source.slice(0, source.indexOf('  build() {')) + '\n}';
  const plain = logic.replace(/^@Component\s*$/m, '').replace('export struct ', 'export class ')
    .replace(/@(State|Prop)\s+/g, '');
  const compiled = ts.transpileModule(plain, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === '../app/AppClient') return { AppClient: { shared: app } };
    if (name === '@kit.ArkUI') return { uiObserver: { NavDestinationState: {
      ON_SHOWN: 0, ON_HIDDEN: 1, ON_APPEAR: 2, ON_DISAPPEAR: 3, ON_WILL_SHOW: 4,
      ON_WILL_HIDE: 5, ON_WILL_APPEAR: 6, ON_WILL_DISAPPEAR: 7, ON_ACTIVE: 8,
      ON_INACTIVE: 9, ON_BACKPRESS: 100
    } } };
    return originalRequire(name);
  };
  loaded._compile(compiled.outputText, filename);
  MomentFeedCache.shared = new MomentFeedCache();
  const events = nativeEvents();
  const createPage = () => { const created = new loaded.exports.MomentFeedPage(); events.bind(created); return created; };
  const page = createPage();
  page.aboutToAppear();
  return { page, lists, favorites, sessions, details, likes, createPage, events, cancellations, identityCancellations,
    changeSession() { sessionVersion++; }, expire() { sessionVersion++; authenticated = false; } };
}
async function tick() { await new Promise(resolve => setImmediate(resolve)); }

test('author callback uses the current real author and is blocked by a same-object report draft', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); await tick();
  const calls = []; f.page.onOpenAuthor = (id, role) => calls.push({ id, role });
  f.page.selectedReportId = 7; f.page.openAuthor(f.page.items[0]); assert.deepEqual(calls, []);
  f.page.selectedReportId = 0; f.page.openAuthor(moment({ authorId: 999 }));
  assert.deepEqual(calls, [{ id: 12, role: 'PROVIDER' }], 'never trust stale row author data');
  f.events.background(); f.page.handleVisibility(false); f.page.openAuthor(moment());
  assert.equal(calls.length, 1);
});

test('author navigation closes detail and accepts only real supported roles', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); await tick();
  const calls = []; f.page.onOpenAuthor = (id, role) => calls.push({ id, role });
  const read = f.page.readDetail(7, true); f.details[0].resolve(moment()); await read;
  f.page.openAuthor(moment()); assert.equal(f.page.detailOpen, false); assert.equal(calls.length, 1);
  f.page.items = [moment({ authorRole: 'ADMIN' })]; f.page.openAuthor(f.page.items[0]); assert.equal(calls.length, 1);
});

test('Feed verification reads full GET without a sheet, keeps previews and updates server like state', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); await tick();
  const read = f.page.readDetail(7, true); assert.equal(f.details.length, 1);
  f.details[0].resolve(moment({ imageDataList: ['1', '2', '3', '4', '5'] })); await read;
  assert.equal(f.page.detailOpen, false); assert.equal(f.page.interaction.images.length, 5);
  assert.equal(f.page.items[0].imageDataList.length, 3);
  f.page.closeDetail(); assert.equal(f.page.detailOpen, false);
  const like = f.page.toggleLike(f.page.items[0]); assert.equal(f.likes.length, 1);
  f.likes[0].resolve(moment({ likedByCurrentUser: true, likeCount: 17 })); await like;
  assert.equal(f.page.items[0].likeCount, 17); assert.equal(f.page.items[0].likedByCurrentUser, true);
});

test('like and detail preserve same-object report drafts and reject queued report during like', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); f.sessions[0].resolve({ userId: 21 }); await tick();
  f.page.openReport(f.page.items[0]); assert.equal(f.page.selectedReportId, 7);
  await f.page.toggleLike(f.page.items[0]); await f.page.openDetail(f.page.items[0]);
  assert.equal(f.likes.length, 0); assert.equal(f.details.length, 0); assert.equal(f.page.selectedReportId, 7);
  f.page.selectedReportId = 0; const like = f.page.toggleLike(f.page.items[0]);
  f.page.openReport(f.page.items[0]); assert.equal(f.page.selectedReportId, 0);
  f.likes[0].resolve(moment({ likedByCurrentUser: true })); await like;
});

test('background invalidates a result verification and 404 removes stale Feed content', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); await tick(); f.page.observeLifecycle();
  const old = f.page.readDetail(7, true); f.events.background();
  assert.equal(f.page.detailOpen, false); f.details[0].resolve(moment()); await old;
  assert.equal(f.page.interaction.item, undefined); f.events.foreground();
  f.lists[1].resolve([moment()]); await tick();
  const hidden = f.page.readDetail(7, true);
  f.details[1].reject(ErrorMapper.fromHttpStatus(404)); await hidden;
  assert.deepEqual(f.page.items, []); assert.equal(f.page.interaction.item, undefined);
});

test('top-level uncertain result verification protects a same-object report draft', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); f.sessions[0].resolve({ userId: 21 }); await tick();
  const write = f.page.toggleLike(f.page.items[0]); f.likes[0].reject({ kind: 'timeout' }); await write;
  f.page.openReport(f.page.items[0]); assert.equal(f.page.selectedReportId, 7);
  await f.page.verifyLikeResult(); assert.equal(f.details.length, 0);
  assert.equal(f.page.selectedReportId, 7);
  f.page.selectedReportId = 0; f.page.items = [];
  const read = f.page.verifyLikeResult(); assert.equal(f.details.length, 1, 'verification works after scope changed');
  f.details[0].resolve(moment({ likedByCurrentUser: true })); await read;
});

test('a Feed response issued before another instance write must re-read before painting', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); await tick();
  const other = f.createPage(); other.aboutToAppear();
  const write = f.page.toggleLike(f.page.items[0]);
  f.likes[0].resolve(moment({ likedByCurrentUser: true, likeCount: 17 })); await write;
  f.lists[1].resolve([moment()]); await tick();
  assert.equal(f.lists.length, 3); assert.equal(other.requestInFlight, true);
  f.lists[2].resolve([moment({ likedByCurrentUser: true, likeCount: 17 })]); await tick();
  assert.equal(other.items[0].likeCount, 17);
});

test('same-ID server replacements and a new view cannot reuse an old rendered feed row', () => {
  const { page } = setup();
  const source = fs.readFileSync(path.join(sourceRoot, 'pages/MomentFeedPage.ets'), 'utf8');
  const expression = source.match(/\}, \(item: MomentSummary\) => (.+)\)/)[1];
  // Exercise the production key generator under ArkUI's documented same-key reuse
  // rule. This does not replace the device rendering regression.
  const key = Function('item', `return (${expression});`).bind(page);
  const first = moment();
  const original = key(first);
  assert.equal(key({ ...first }), original, 'unchanged records keep their row');
  assert.notEqual(key({ ...first, title: '后台更新后的标题' }), original, 'server replacement must repaint');
  assert.notEqual(key({ ...first, favoritedByCurrentUser: true, favoriteCount: 3 }), original);
  page.viewVersion++;
  assert.notEqual(key(first), original, 'an account/view transition must discard old row closures');
});

test('rapid scope switches use real scopes and only the last response reaches the feed', async () => {
  const { page, lists } = setup();
  page.selectScope('hot');
  page.selectScope('following');
  assert.deepEqual(lists.map(call => call.scope), ['latest', 'hot', 'following']);
  lists[2].resolve([moment({ momentId: 9 })]);
  await tick();
  lists[0].resolve([moment({ momentId: 1 })]);
  lists[1].resolve([moment({ momentId: 2 })]);
  await tick();
  assert.deepEqual(page.items.map(item => item.momentId), [9]);
  assert.equal(page.requestInFlight, false);
});

test('refresh failure preserves valid items and a successful empty response clears them', async () => {
  const { page, lists } = setup();
  lists[0].resolve([moment()]); await tick();
  const failed = page.load(true);
  lists[1].reject(ErrorMapper.parse()); await failed;
  assert.equal(page.items.length, 1);
  assert.ok(page.errorMessage.length > 0);
  const empty = page.load(true);
  lists[2].resolve([]); await empty;
  assert.deepEqual(page.items, []);
  assert.equal(page.errorMessage, '');
});

test('old account and off-page favorite responses cannot update items or cache', async () => {
  for (const action of ['changeSession', 'leave']) {
    const state = setup();
    state.lists[0].resolve([moment()]); await tick();
    const pending = state.page.toggleFavorite(state.page.items[0]);
    if (action === 'leave') state.page.aboutToDisappear(); else state.changeSession();
    state.favorites[0].resolve(moment({ favoriteCount: 99, favoritedByCurrentUser: true }));
    await pending;
    assert.notEqual(state.page.items[0]?.favoriteCount, 99);
    assert.equal(MomentFeedCache.shared.read(Date.now(), 3)?.[0]?.favoriteCount, undefined);
  }
});

test('favorite is serialized, preserves server data, and refresh cannot overwrite an in-flight mutation', async () => {
  const { page, lists, favorites } = setup();
  lists[0].resolve([moment(), moment({ momentId: 8 })]); await tick();
  const pending = page.toggleFavorite(page.items[0]);
  await page.toggleFavorite(page.items[1]);
  page.load(true);
  assert.equal(favorites.length, 1);
  assert.equal(lists.length, 1);
  favorites[0].resolve(moment({ favoriteCount: 42, favoritedByCurrentUser: true }));
  await pending;
  assert.equal(page.items[0].favoriteCount, 42);
  assert.equal(page.favoriteBusyId, 0);
});

test('a list request already in flight prevents mutations based on an obsolete snapshot', async () => {
  const { page, lists, favorites } = setup();
  lists[0].resolve([moment()]); await tick();
  const refresh = page.load(true);
  page.toggleFavorite(page.items[0]);
  assert.equal(favorites.length, 0);
  lists[1].resolve([]); await refresh;
});

test('an ambiguous favorite failure invalidates cached state and requires a real read before replay', async () => {
  const { page, lists, favorites } = setup();
  lists[0].resolve([moment()]); await tick();
  const pending = page.toggleFavorite(page.items[0]);
  favorites[0].reject(ErrorMapper.parse()); await pending;
  assert.equal(page.items[0].favoritedByCurrentUser, false);
  assert.equal(MomentFeedCache.shared.read(Date.now(), 3), undefined);
  await page.toggleFavorite(page.items[0]);
  assert.equal(favorites.length, 1);
  const refresh = page.load(true);
  lists[1].resolve([moment({ favoritedByCurrentUser: true })]); await refresh;
  assert.equal(page.items[0].favoritedByCurrentUser, true);
});

test('re-entering a cached feed still revalidates moderation visibility with the server', async () => {
  const { page, lists } = setup();
  lists[0].resolve([moment()]); await tick();
  page.aboutToDisappear();
  page.aboutToAppear();
  assert.equal(lists.length, 2);
  lists[1].resolve([]); await tick();
  assert.deepEqual(page.items, []);
});

test('a recreated page paints a same-session cached snapshot while revalidating', async () => {
  const { page, lists, createPage } = setup();
  lists[0].resolve([moment()]); await tick();
  page.aboutToDisappear();
  const recreated = createPage();
  recreated.aboutToAppear();
  assert.equal(recreated.items[0]?.momentId, 7);
  assert.equal(lists.length, 2);
  lists[1].resolve([]); await tick();
  assert.deepEqual(recreated.items, []);
});

test('a recreated feed waits for a previous instance favorite before reading authoritative state', async () => {
  const { page, lists, favorites, createPage } = setup();
  lists[0].resolve([moment()]); await tick();
  const pending = page.toggleFavorite(page.items[0]);
  page.aboutToDisappear();
  const recreated = createPage();
  recreated.aboutToAppear();
  assert.equal(recreated.requestInFlight, true);
  assert.equal(lists.length, 1, 'must not read before the outstanding write finishes');
  await recreated.toggleFavorite(moment());
  assert.equal(favorites.length, 1);
  favorites[0].resolve(moment({ favoritedByCurrentUser: true, favoriteCount: 4 }));
  await pending; await tick();
  assert.equal(lists.length, 2);
  lists[1].resolve([moment({ favoritedByCurrentUser: true, favoriteCount: 4 })]); await tick();
  assert.equal(recreated.items[0].favoritedByCurrentUser, true);
  assert.equal(MomentFeedCache.shared.read(Date.now(), 3)[0].favoriteCount, 4);
});

test('session changes discard old list results instead of writing them to the new session cache', async () => {
  const state = setup();
  state.changeSession();
  state.lists[0].resolve([moment()]); await tick();
  assert.deepEqual(state.page.items, []);
  assert.equal(MomentFeedCache.shared.read(Date.now(), 4), undefined);
});

test('report uses real session identity, refuses own content and selects one real target', async () => {
  const { page, lists, sessions } = setup();
  lists[0].resolve([moment(), moment({ momentId: 8, authorId: 21 })]);
  sessions[0].resolve({ userId: 21, nickname: '举报人', role: 'CUSTOMER' }); await tick();
  page.openReport(page.items[1]);
  assert.equal(page.selectedReportId, 0);
  page.openReport(page.items[0]);
  assert.equal(page.selectedReportId, 7);
  assert.equal(page.currentUserId, 21);
  page.openReport(moment({ momentId: 99 }));
  assert.equal(page.selectedReportId, 7);
  page.selectScope('hot');
  assert.equal(page.selectedReportId, 0);
});

test('report identity from an old session or disappeared page never enables a report', async () => {
  for (const action of ['changeSession', 'leave']) {
    const state = setup();
    if (action === 'leave') state.page.aboutToDisappear(); else state.changeSession();
    state.sessions[0].resolve({ userId: 21, nickname: '旧用户', role: 'CUSTOMER' }); await tick();
    assert.equal(state.page.currentUserId, 0);
    assert.equal(state.page.selectedReportId, 0);
  }
});

test('a report draft blocks favorite changes to its own row until it closes', async () => {
  const { page, lists, sessions, favorites } = setup();
  lists[0].resolve([moment(), moment({ momentId: 8 })]);
  sessions[0].resolve({ userId: 21 }); await tick();
  page.openReport(page.items[0]);
  const before = JSON.stringify(page.items[0]);
  const blocked = page.toggleFavorite(page.items[0]);
  const attemptedWrites = favorites.length;
  if (attemptedWrites > 0) {
    favorites[0].resolve(moment({ favoritedByCurrentUser: true, favoriteCount: 3 }));
  }
  await blocked;
  assert.equal(attemptedWrites, 0, 'do not rebuild a row containing an active report');
  const other = page.toggleFavorite(page.items[1]);
  favorites[0].resolve(moment({ momentId: 8, favoritedByCurrentUser: true, favoriteCount: 3 }));
  await other;
  assert.equal(page.selectedReportId, 7);
  assert.equal(JSON.stringify(page.items[0]), before, 'another row must leave the report row intact');
  page.selectedReportId = 0;
  const afterClose = page.toggleFavorite(page.items[0]);
  assert.equal(favorites.length, 2, 'closing the report restores the real favorite action');
  favorites[1].resolve(moment({ favoritedByCurrentUser: true, favoriteCount: 3 }));
  await afterClose;
});

test('a queued report cannot open while a favorite result could replace the row', async () => {
  const { page, lists, sessions, favorites } = setup();
  lists[0].resolve([moment()]); sessions[0].resolve({ userId: 21 }); await tick();
  const pending = page.toggleFavorite(page.items[0]);
  page.openReport(page.items[0]);
  const selectedWhilePending = page.selectedReportId;
  favorites[0].resolve(moment({ favoritedByCurrentUser: true, favoriteCount: 3 }));
  await pending;
  assert.equal(selectedWhilePending, 0, 'also guard queued callbacks before the UI disables the button');
  page.openReport(page.items[0]);
  assert.equal(page.selectedReportId, 7);
});

test('report identity failure is visible and retry reads the real session again', async () => {
  const { page, sessions } = setup();
  sessions[0].reject(ErrorMapper.parse()); await tick();
  assert.equal(page.currentUserId, 0);
  assert.ok(page.reportIdentityError.length > 0);
  const retry = page.loadReportIdentity();
  sessions[1].resolve({ userId: 21, nickname: '举报人', role: 'CUSTOMER' }); await retry;
  assert.equal(page.currentUserId, 21);
  assert.equal(page.reportIdentityError, '');
});

// These invoke SDK-shaped event callbacks, not device navigation. Physical paths
// and framework callback delivery still require the separate device acceptance.
test('root navigation cover and role-change return clear report state and reload the selected scope once', async () => {
  const state = setup();
  const { page, lists, sessions, events } = state;
  page.observeLifecycle();
  lists[0].resolve([moment()]); sessions[0].resolve({ userId: 21 }); await tick();
  page.selectScope('following'); lists[1].resolve([moment()]); await tick();
  page.openReport(page.items[0]);
  events.route(1, undefined);
  assert.deepEqual(page.items, []);
  assert.equal(page.currentUserId, 0);
  assert.equal(page.selectedReportId, 0);
  state.changeSession();
  events.route(0, undefined); events.route(0, undefined);
  assert.equal(lists.length, 3);
  assert.equal(lists[2].scope, 'following');
  assert.equal(sessions.length, 2);
  lists[2].resolve([moment({ momentId: 8 })]); sessions[1].resolve({ userId: 22 }); await tick();
  assert.equal(page.items[0].momentId, 8);
  assert.equal(page.currentUserId, 22);
});

test('sign-out behind a covered root returns to a login prompt without reusing cached identity', async () => {
  const state = setup();
  state.page.observeLifecycle();
  state.lists[0].resolve([moment()]); state.sessions[0].resolve({ userId: 21 }); await tick();
  state.events.route(1, undefined);
  state.expire();
  state.events.route(0, undefined);
  assert.equal(state.page.authenticationRequired, true);
  assert.deepEqual(state.page.items, []);
  assert.equal(state.page.currentUserId, 0);
  assert.equal(state.lists.length, 1);
});

test('HALL destination visibility is based on its own stack position and state, not another HALL name', async () => {
  const { page, lists, events } = setup();
  const hall = { navigationId: '', name: 'Hall', index: 0, navDestinationId: 'hall-1', state: 0 };
  events.route(1, hall);
  page.observeLifecycle();
  lists[0].resolve([moment()]); await tick();
  events.route(2, { ...hall, state: 1 });
  assert.equal(page.active, false);
  events.foreground();
  assert.equal(lists.length, 1);
  events.route(1, { ...hall, state: 0 });
  assert.equal(lists.length, 2);
  lists[1].resolve([]); await tick();
  assert.deepEqual(page.items, []);
});

test('background invalidates old list and identity callbacks; foreground revalidates once', async () => {
  const { page, lists, sessions, events } = setup();
  page.observeLifecycle();
  events.background();
  lists[0].resolve([moment()]); sessions[0].resolve({ userId: 21 }); await tick();
  assert.deepEqual(page.items, []);
  assert.equal(page.currentUserId, 0);
  events.foreground(); events.foreground();
  assert.equal(lists.length, 2);
  assert.equal(sessions.length, 2);
});

test('background while covered does not reload until its own route is shown', async () => {
  const { page, lists, events } = setup();
  page.observeLifecycle();
  events.route(1, undefined); events.background(); events.foreground();
  assert.equal(lists.length, 1);
  events.route(0, undefined);
  assert.equal(lists.length, 2);
});

test('each feed only unregisters its own listeners and list request key', async () => {
  const { page, events, lists, createPage, cancellations } = setup();
  page.observeLifecycle();
  const second = createPage(); second.aboutToAppear(); second.observeLifecycle();
  assert.deepEqual(events.listeners(), [2, 2, 2]);
  assert.ok(lists[0].key);
  assert.notEqual(lists[0].key, lists[1].key);
  page.aboutToDisappear();
  assert.deepEqual(events.listeners(), [1, 1, 1]);
  assert.equal(cancellations.at(-1), lists[0].key);
  second.aboutToDisappear();
  assert.deepEqual(events.listeners(), [0, 0, 0]);
});

test('HALL returns recheck role changes and sign-out without a component remount', async () => {
  for (const action of ['changeSession', 'expire']) {
    const state = setup();
    const hall = { name: 'Hall', index: 0, navDestinationId: 'hall-1', state: 0 };
    state.events.route(1, hall); state.page.observeLifecycle();
    state.lists[0].resolve([moment()]); state.sessions[0].resolve({ userId: 21 }); await tick();
    state.page.openReport(state.page.items[0]);
    state.events.route(2, { ...hall, state: 1 });
    state[action]();
    state.events.route(1, hall);
    assert.equal(state.page.selectedReportId, 0);
    assert.equal(state.page.currentUserId, 0);
    assert.deepEqual(state.page.items, []);
    assert.equal(state.page.authenticationRequired, action === 'expire');
    assert.equal(state.lists.length, action === 'expire' ? 1 : 2);
  }
});

test('root and HALL instances sharing one navigation only activate their own visible view', async () => {
  const { page, events, createPage, lists } = setup();
  page.queryNavDestinationInfo = () => undefined;
  page.observeLifecycle();
  const hall = createPage();
  hall.queryNavDestinationInfo = () => ({ name: 'Hall', index: 0, navDestinationId: 'hall-1', state: 0 });
  events.route(1, undefined);
  hall.aboutToAppear(); hall.observeLifecycle();
  assert.equal(page.active, false);
  assert.equal(hall.active, true);
  const callsBeforePop = lists.length;
  events.route(0, undefined);
  assert.equal(page.active, true);
  assert.equal(hall.active, false);
  assert.equal(lists.length, callsBeforePop + 1);
});

test('partial native registration failure removes its listener and permits an explicit safe retry', async () => {
  const { page, events, lists } = setup();
  events.failApplicationRegistrationOnce();
  page.observeLifecycle();
  assert.equal(page.lifecycleUnavailable, true);
  assert.equal(page.active, false);
  assert.deepEqual(page.items, []);
  assert.deepEqual(events.listeners(), [0, 0, 0]);
  page.handleErrorAction();
  assert.equal(page.lifecycleUnavailable, false);
  assert.equal(page.active, true);
  assert.deepEqual(events.listeners(), [1, 1, 1]);
  assert.equal(lists.length, 2);
});

test('foreground before HALL shown resumes on its own ON_SHOWN without another switch', async () => {
  const { page, lists, events } = setup();
  const hall = { name: 'Hall', index: 0, navDestinationId: 'hall-1', state: 0 };
  events.route(1, hall); page.observeLifecycle();
  lists[0].resolve([moment()]); await tick();
  events.background();
  events.route(1, { ...hall, state: 1 });
  events.foreground();
  assert.equal(lists.length, 1);
  events.destinationUpdate({ ...hall, navDestinationId: 'different-hall', state: 0 });
  assert.equal(lists.length, 1, 'another HALL instance must not resume this one');
  events.destinationUpdate({ ...hall, state: 0 });
  events.destinationUpdate({ ...hall, state: 0 });
  assert.equal(lists.length, 2);
  assert.equal(page.active, true);
});


test('favorite on and off uses current server state, retains three previews and survives refresh', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); await tick();
  const stale = f.page.items[0];
  const save = f.page.toggleFavorite(stale);
  assert.equal(f.favorites[0].desired, true);
  f.favorites[0].resolve(moment({ favoritedByCurrentUser: true, favoriteCount: 42, imageDataList: ['1','2','3','4','5'] }));
  await save;
  assert.equal(f.page.items[0].favoriteCount, 42);
  assert.equal(f.page.items[0].imageDataList.length, 3);
  const remove = f.page.toggleFavorite(stale);
  assert.equal(f.favorites[1].desired, false, 'a stale row must still cancel the current server-backed state');
  f.favorites[1].resolve(moment({ favoritedByCurrentUser: false, favoriteCount: 41, imageDataList: ['1','2','3','4','5'] }));
  await remove;
  assert.equal(f.page.items[0].favoriteCount, 41);
  assert.equal(f.page.items[0].favoritedByCurrentUser, false);
  const refresh = f.page.load(true);
  f.lists[1].resolve([moment({ favoritedByCurrentUser: false, favoriteCount: 41 })]); await refresh;
  assert.equal(f.page.items[0].favoritedByCurrentUser, false);
});


test('picture opens the existing full-page MomentDetail route once, never a Feed sheet or preview album', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); await tick();
  const first = f.page.openDetail(f.page.items[0]); const repeated = f.page.openDetail(f.page.items[0]);
  assert.deepEqual(f.events.routes, [{name:'MomentDetail', param:{momentId:7}}]);
  assert.equal(f.details.length, 0, 'destination owns full GET; Feed never passes a preview album');
  await first; await repeated;
  assert.equal(f.page.detailOpen, false);
  f.page.aboutToDisappear(); await f.page.openDetail(moment());
  assert.equal(f.events.routes.length, 1);
});

test('picture navigation rejects report drafts, pending writes, stale rows and changed sessions', async () => {
  const f = setup(); f.lists[0].resolve([moment()]); await tick();
  f.page.selectedReportId=7; await f.page.openDetail(moment()); f.page.selectedReportId=0;
  f.page.favoriteBusyId=7; await f.page.openDetail(moment()); f.page.favoriteBusyId=0;
  await f.page.openDetail(moment({momentId:99})); f.changeSession(); await f.page.openDetail(moment());
  assert.deepEqual(f.events.routes, []);
});


test('returning from a picture destination allows the next one-tap navigation', async () => {
 const f=setup();f.lists[0].resolve([moment()]);await tick();f.page.observeLifecycle();
 await f.page.openDetail(f.page.items[0]);assert.equal(f.events.routes.length,1);
 f.events.route(1,undefined);assert.deepEqual(f.page.items,[]);
 f.events.route(0,undefined);f.lists[1].resolve([moment()]);await tick();
 await f.page.openDetail(f.page.items[0]);assert.equal(f.events.routes.length,2);
});


test('failed result verification retains its warning without leaving a hidden detail lock', async () => {
 const f=setup();f.lists[0].resolve([moment(),moment({momentId:8})]);await tick();
 const like=f.page.toggleLike(f.page.items[0]);f.likes[0].reject({kind:'timeout'});await like;
 const verify=f.page.verifyLikeResult();f.details[0].reject({kind:'network',message:'无法核实，请重试'});await verify;
 assert.match(f.page.interaction.message,/无法核实/);
 const other=f.page.toggleLike(f.page.items[1]);assert.equal(f.page.detailOpen,false);
 f.likes[1].resolve(moment({momentId:8,likedByCurrentUser:true}));await other;
 const save=f.page.toggleFavorite(f.page.items[1]);assert.equal(f.favorites.length,1);
 f.favorites[0].resolve(moment({momentId:8,likedByCurrentUser:true,favoritedByCurrentUser:true}));await save;
});


test('each Feed owns its report identity request and only cancels that instance on hide', async () => {
 const f=setup();f.lists[0].resolve([moment()]);await tick();
 const other=f.createPage();other.aboutToAppear();
 assert.equal(typeof f.sessions[0].key,'string');assert.notEqual(f.sessions[0].key,'auth.session');
 assert.notEqual(f.sessions[0].key,f.sessions[1].key);
 f.page.aboutToDisappear();assert.ok(f.identityCancellations.includes(f.sessions[0].key));
 assert.ok(!f.identityCancellations.includes(f.sessions[1].key));
 f.sessions[0].resolve({userId:21});f.sessions[1].resolve({userId:21});
 f.lists[1].resolve([moment()]);await tick();
 assert.equal(f.page.currentUserId,0);assert.equal(other.currentUserId,21);assert.equal(other.reportIdentityError,'');
});

test('transient report identity failure remains retryable and successful retry clears the warning', async () => {
 const f=setup();f.lists[0].resolve([moment()]);f.sessions[0].reject({kind:'network'});await tick();
 assert.match(f.page.reportIdentityError,/举报身份/);assert.equal(f.page.currentUserId,0);
 const retry=f.page.loadReportIdentity();f.sessions[1].resolve({userId:21});await retry;
 assert.equal(f.page.reportIdentityError,'');assert.equal(f.page.currentUserId,21);
});
