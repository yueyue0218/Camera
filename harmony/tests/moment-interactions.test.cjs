const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
require.extensions['.ets'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021
  } }).outputText, filename);
const { MomentInteractions, MomentDetailData } =
  require('../entry/src/main/ets/features/moments/MomentInteractions.ets');
const { MomentFeedCache } = require('../entry/src/main/ets/features/moments/MomentFeedModels.ets');
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject }; }
function moment(extra = {}) { return { momentId: 7, authorId: 12, authorRole: 'CUSTOMER',
  title: 'test', imageDataList: ['1', '2', '3', '4', '5'], likeCount: 3,
  likedByCurrentUser: false, favoriteCount: 1, favoritedByCurrentUser: false, ...extra }; }
function fixture(cache = new MomentFeedCache()) {
  let version = 1, authenticated = true, state;
  const reads = [], likes = [], favorites = [], cancelled = [], updates = [];
  const api = {
    getMoment(id, key) { const p = deferred(); reads.push({ id, key, ...p }); return p.promise; },
    cancelMomentDetail(key) { cancelled.push(key); },
    likeMoment(id, key) { const p = deferred(); likes.push({ id, key, desired: true, ...p }); return p.promise; },
    unlikeMoment(id, key) { const p = deferred(); likes.push({ id, key, desired: false, ...p }); return p.promise; },
    cancelMomentLike(id, key) { cancelled.push(key); },
    favoriteMoment(id) { const p = deferred(); favorites.push({id, desired:true, ...p}); return p.promise; },
    unfavoriteMoment(id) { const p = deferred(); favorites.push({id, desired:false, ...p}); return p.promise; }
  };
  const controller = new MomentInteractions(api, {
    getSessionVersion: () => version, isAuthenticated: () => authenticated
  }, cache, value => { state = value; }, value => updates.push(value));
  controller.resume();
  return { controller, reads, likes, favorites, cancelled, updates, cache, get state() { return state; },
    changeSession(guest = false) { version++; authenticated = !guest; } };
}
test('detail starts empty and uses full GET response, not the Feed preview', async () => {
  const f = fixture(); const open = f.controller.open(7);
  assert.equal(f.state.loading, true); assert.equal(f.state.item, undefined);
  f.reads[0].resolve(moment()); await open;
  assert.equal(f.state.images.length, 5); assert.equal(f.state.targetId, 7);
  assert.equal(f.updates[0].imageDataList.length, 3, 'Feed remains a preview after detail reconciliation');
});
test('switch target ignores old success, old catch and old finally', async () => {
  for (const failed of [false, true]) {
    const f = fixture(); const a = f.controller.open(7); const b = f.controller.open(8);
    if (failed) f.reads[0].reject(new Error('old failure')); else f.reads[0].resolve(moment());
    await a; assert.equal(f.state.targetId, 8); assert.equal(f.state.loading, true);
    assert.equal(f.state.message, ''); f.reads[1].resolve(moment({ momentId: 8 })); await b;
    assert.equal(f.state.item.momentId, 8);
  }
});
test('close and reopen requests again; late response cannot resurrect the closed detail', async () => {
  const f = fixture(); const a = f.controller.open(7); f.controller.close();
  f.reads[0].resolve(moment()); await a;
  assert.equal(f.state.targetId, 0); assert.equal(f.state.item, undefined);
  const b = f.controller.open(7); assert.equal(f.reads.length, 2);
  f.reads[1].resolve(moment()); await b;
});
test('account change or background clears images and rejects old completion', async () => {
  for (const guest of [false, true]) {
    const f = fixture(); const a = f.controller.open(7); f.changeSession(guest);
    f.controller.suspend(); f.controller.resume(); f.reads[0].resolve(moment()); await a;
    assert.equal(f.state.item, undefined); assert.equal(f.state.images.length, 0);
    assert.equal(f.state.targetId, 0);
  }
});
test('like uses server state/count, blocks repeated tap and then DELETEs', async () => {
  const f = fixture(); const a = f.controller.toggleLike(moment());
  const repeated = f.controller.toggleLike(moment()); assert.equal(f.likes.length, 1); await repeated;
  f.likes[0].resolve(moment({ likedByCurrentUser: true, likeCount: 41 })); await a;
  assert.equal(f.updates[0].likeCount, 41); assert.equal(f.state.likeBusyId, 0);
  const b = f.controller.toggleLike(f.updates[0]); assert.equal(f.likes[1].desired, false);
  f.likes[1].resolve(moment({ likeCount: 40 })); await b;
  assert.equal(f.updates[1].likedByCurrentUser, false);
});
test('uncertain like blocks resubmission until an explicit GET verifies the object', async () => {
  const f = fixture(); const a = f.controller.toggleLike(moment());
  f.likes[0].reject({ kind: 'timeout', message: 'timeout' }); await a;
  assert.equal(f.state.uncertainMomentId, 7);
  await f.controller.toggleLike(moment()); assert.equal(f.likes.length, 1);
  const verify = f.controller.open(7); f.reads[0].resolve(moment({ likedByCurrentUser: true })); await verify;
  assert.equal(f.state.uncertainMomentId, 0);
  assert.equal(f.state.item.likedByCurrentUser, true);
});
test('late like never updates another account or releases a newer request busy flag', async () => {
  const f = fixture(); const old = f.controller.toggleLike(moment());
  f.changeSession(); f.controller.suspend(); f.controller.resume();
  const fresh = f.controller.toggleLike(moment({ momentId: 8 }));
  f.likes[0].resolve(moment({ likedByCurrentUser: true })); await old;
  assert.equal(f.updates.length, 0); assert.equal(f.state.likeBusyId, 8);
  f.likes[1].resolve(moment({ momentId: 8, likedByCurrentUser: true })); await fresh;
  assert.equal(f.updates[0].momentId, 8);
});
test('malformed or mismatched detail is never rendered as a partial album', async () => {
  for (const value of [moment({ momentId: 8 }), moment({ imageDataList: ['one', null] }), null]) {
    const f = fixture(); const read = f.controller.open(7); f.reads[0].resolve(value); await read;
    assert.equal(f.state.item, undefined); assert.equal(f.state.images.length, 0);
    assert.ok(f.state.message.length > 0);
  }
});
test('an explicit empty detail album stays empty, duplicate images preserve server order', () => {
  assert.deepEqual(MomentDetailData.images(moment({ imageDataList: [], imageData: 'legacy' })), []);
  assert.deepEqual(MomentDetailData.images(moment({ imageDataList: ['a', 'a', 'b'] })), ['a', 'a', 'b']);
});
test('shared pending write barrier and unique request keys protect two Feed instances', async () => {
  const cache = new MomentFeedCache(); const a = fixture(cache), b = fixture(cache);
  const first = a.controller.toggleLike(moment()); await b.controller.toggleLike(moment());
  assert.equal(b.likes.length, 0);
  a.likes[0].resolve(moment({ likedByCurrentUser: true })); await first;
  const readA = a.controller.open(7); const readB = b.controller.open(8);
  assert.notEqual(a.reads[0].key, b.reads[0].key);
  a.reads[0].resolve(moment()); b.reads[0].resolve(moment({ momentId: 8 }));
  await Promise.all([readA, readB]);
});

test('detail waits for another view write before requesting authoritative state', async () => {
  const cache = new MomentFeedCache(); const a = fixture(cache), b = fixture(cache);
  const write = a.controller.toggleLike(moment()); const read = b.controller.open(7);
  assert.equal(b.reads.length, 0, 'do not race GET against a known pending write');
  a.likes[0].resolve(moment({ likedByCurrentUser: true })); await write;
  await Promise.resolve(); assert.equal(b.reads.length, 1);
  b.reads[0].resolve(moment({ likedByCurrentUser: true })); await read;
});

test('GET issued before another view write cannot clear its uncertain result', async () => {
  const cache = new MomentFeedCache(); const a = fixture(cache), b = fixture(cache);
  const read = a.controller.open(7); const write = b.controller.toggleLike(moment());
  b.likes[0].reject({ kind: 'timeout' }); await write;
  a.reads[0].resolve(moment()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(cache.hasUncertainLike(1, 7), true);
  assert.equal(a.updates.length, 0); assert.equal(a.reads.length, 2);
  a.reads[1].resolve(moment({ likedByCurrentUser: true })); await read;
  assert.equal(cache.hasUncertainLike(1, 7), false);
  assert.equal(a.state.item.likedByCurrentUser, true);
});

test('404 state is cleared before a later successful detail can reconcile Feed', async () => {
  const f = fixture(); const hidden = f.controller.open(7);
  f.reads[0].reject({ httpStatus: 404 }); await hidden;
  assert.equal(f.state.unavailableMomentId, 7); f.controller.close();
  assert.equal(f.state.unavailableMomentId, 0);
  const restored = f.controller.open(7); f.reads[1].resolve(moment()); await restored;
  assert.equal(f.state.unavailableMomentId, 0); assert.equal(f.state.item.momentId, 7);
});

test('an old GET 404 cannot hide an object after another view completed a newer write', async () => {
  const cache = new MomentFeedCache(); const a = fixture(cache), b = fixture(cache);
  const read = a.controller.open(7); const write = b.controller.toggleLike(moment());
  b.likes[0].resolve(moment({ likedByCurrentUser: true })); await write;
  a.reads[0].reject({ httpStatus: 404 }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.state.unavailableMomentId, 0); assert.equal(a.reads.length, 2);
  a.reads[1].resolve(moment({ likedByCurrentUser: true })); await read;
  assert.equal(a.state.item.likedByCurrentUser, true);
});


test('detail favorite and cancel use current server state/count and retain the full album', async () => {
 const f=fixture();const read=f.controller.open(7);f.reads[0].resolve(moment());await read;
 const stale=f.state.item; const save=f.controller.toggleFavorite(stale);
 assert.equal(f.favorites[0].desired,true);assert.equal(f.state.item.favoritedByCurrentUser,false);
 await f.controller.toggleFavorite(stale);await f.controller.toggleLike(stale);
 assert.equal(f.favorites.length,1);assert.equal(f.likes.length,0);
 f.favorites[0].resolve(moment({favoritedByCurrentUser:true,favoriteCount:42}));await save;
 assert.equal(f.state.item.favoriteCount,42);assert.equal(f.state.images.length,5);
 assert.equal(f.updates.at(-1).imageDataList.length,3);
 const remove=f.controller.toggleFavorite(stale);assert.equal(f.favorites[1].desired,false);
 f.favorites[1].resolve(moment({favoritedByCurrentUser:false,favoriteCount:41}));await remove;
 assert.equal(f.state.item.favoritedByCurrentUser,false);assert.equal(f.state.item.favoriteCount,41);
 assert.equal(f.state.favoriteBusyId,0);
});

test('unknown favorite survives a new page instance and requires a real GET before retry', async () => {
 const cache=new MomentFeedCache();const f=fixture(cache);const read=f.controller.open(7);f.reads[0].resolve(moment());await read;
 const save=f.controller.toggleFavorite(f.state.item);f.favorites[0].reject({kind:'timeout'});await save;
 assert.equal(f.state.favoriteUncertainMomentId,7);await f.controller.toggleFavorite(f.state.item);
 assert.equal(f.favorites.length,1);assert.equal(cache.hasUncertainFavorite(1,7),true);
 const next=fixture(cache);await next.controller.toggleFavorite(moment());assert.equal(next.favorites.length,0);
 const verify=next.controller.open(7);next.reads[0].resolve(moment({favoritedByCurrentUser:true}));await verify;
 assert.equal(cache.hasUncertainFavorite(1,7),false);
 const remove=next.controller.toggleFavorite(next.state.item);assert.equal(next.favorites[0].desired,false);
 next.favorites[0].resolve(moment());await remove;
});

test('hidden favorite response cannot reopen detail and another instance waits for the write', async () => {
 const cache=new MomentFeedCache(),f=fixture(cache);const read=f.controller.open(7);f.reads[0].resolve(moment());await read;
 const save=f.controller.toggleFavorite(f.state.item);f.controller.suspend();
 const next=fixture(cache);const open=next.controller.open(7);assert.equal(next.reads.length,0);
 f.favorites[0].resolve(moment({favoritedByCurrentUser:true,favoriteCount:9}));await save;
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.state.item,undefined);
 next.reads[0].resolve(moment({favoritedByCurrentUser:true,favoriteCount:9}));await open;
 assert.equal(next.state.item.favoriteCount,9);assert.equal(next.state.favoriteBusyId,0);
});

test('favorite old success/error/finally cannot alter a different account request', async () => {
 for(const failure of [false,true]){
  const f=fixture();const read=f.controller.open(7);f.reads[0].resolve(moment());await read;
  const old=f.controller.toggleFavorite(f.state.item);f.changeSession();f.controller.suspend();f.controller.resume();
  const freshRead=f.controller.open(8);f.reads[1].resolve(moment({momentId:8}));await freshRead;
  const fresh=f.controller.toggleFavorite(f.state.item);
  if(failure)f.favorites[0].reject({kind:'timeout'});else f.favorites[0].resolve(moment({favoritedByCurrentUser:true}));
  await old;assert.equal(f.state.targetId,8);assert.equal(f.state.favoriteBusyId,8);assert.equal(f.state.message,'');
  f.favorites[1].resolve(moment({momentId:8,favoritedByCurrentUser:true}));await fresh;
  assert.equal(f.state.item.momentId,8);assert.equal(f.state.favoriteBusyId,0);
 }
});

test('a DELETED detail readable by its author never restores obsolete content or actions',async()=>{const f=fixture();const open=f.controller.open(7);f.reads[0].resolve(moment({status:'DELETED'}));await open;assert.equal(f.state.item,undefined);assert.deepEqual(f.state.images,[]);assert.equal(f.state.unavailableMomentId,7);assert.match(f.state.message,/删除/);assert.equal(f.updates.length,0)});