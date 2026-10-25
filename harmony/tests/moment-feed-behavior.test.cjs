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
    context: {
      getUIObserver: () => observer,
      getHostContext: () => ({ getApplicationContext: () => appContext }),
      runScopedTask: task => task()
    },
    bind(page) {
      page.getUIContext = () => this.context;
      page.queryNavigationInfo = () => ({ navigationId: '', pathStack: { size: () => stackSize } });
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
  const lists = [], favorites = [], sessions = [];
  const app = {
    sessionManager: { isAuthenticated: () => authenticated, getSessionVersion: () => sessionVersion },
    apiService: {
      listMoments(scope, key) { const pending = deferred(); lists.push({ scope, key, ...pending }); return pending.promise; },
      cancelMoments(key) { cancellations.push(key); },
      favoriteMoment(id) { const pending = deferred(); favorites.push({ id, desired: true, ...pending }); return pending.promise; },
      unfavoriteMoment(id) { const pending = deferred(); favorites.push({ id, desired: false, ...pending }); return pending.promise; },
      currentSession() { const pending = deferred(); sessions.push(pending); return pending.promise; }
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
  MomentFeedCache.shared.clear();
  const events = nativeEvents();
  const createPage = () => { const created = new loaded.exports.MomentFeedPage(); events.bind(created); return created; };
  const page = createPage();
  page.aboutToAppear();
  return { page, lists, favorites, sessions, createPage, events, cancellations,
    changeSession() { sessionVersion++; }, expire() { sessionVersion++; authenticated = false; } };
}
async function tick() { await new Promise(resolve => setImmediate(resolve)); }

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
