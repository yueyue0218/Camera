const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
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

const { MomentFeedCache, MomentFeedFormatter } =
  require('../entry/src/main/ets/features/moments/MomentFeedModels.ets');

function moment(overrides = {}) {
  return {
    momentId: 7,
    authorId: 12,
    authorRole: 'PROVIDER',
    title: '  雨夜人像  ',
    content: '  一组夜景记录  ',
    imageData: 'data:image/png;base64,AAAA',
    imageDataList: [],
    mentions: [' @小明 ', '', '@@摄影'],
    likeCount: 3,
    likedByCurrentUser: false,
    favoriteCount: 2,
    favoritedByCurrentUser: true,
    createdAt: '2026-10-20T12:34:56',
    ...overrides
  };
}

test('moment formatter exposes only real DTO fields with deterministic fallbacks', () => {
  const item = moment();
  assert.equal(MomentFeedFormatter.title(item), '雨夜人像');
  assert.equal(MomentFeedFormatter.content(item), '一组夜景记录');
  assert.equal(MomentFeedFormatter.author(item), '摄影师 #12');
  assert.equal(MomentFeedFormatter.time(item.createdAt), '2026-10-20 12:34');
  assert.equal(MomentFeedFormatter.mentions(item), '@小明  @摄影');
  assert.deepEqual(MomentFeedFormatter.images(item), ['data:image/png;base64,AAAA']);
  assert.equal(MomentFeedFormatter.title(moment({ title: ' ' })), '未填写标题');
  assert.equal(MomentFeedFormatter.content(moment({ content: undefined })), '未填写正文');
});

test('moment feed validates IDs and counts and removes repeated records', () => {
  assert.equal(MomentFeedFormatter.isValid(moment()), true);
  assert.equal(MomentFeedFormatter.isValid(moment({ momentId: 0 })), false);
  assert.equal(MomentFeedFormatter.isValid(moment({ likeCount: -1 })), false);
  assert.deepEqual(MomentFeedFormatter.deduplicate([
    moment({ momentId: 1 }), moment({ momentId: 1, title: '重复项' }), moment({ momentId: 2 })
  ]).map(item => item.momentId), [1, 2]);
});

test('feed cache is short-lived and isolated by authentication session version', () => {
  const cache = new MomentFeedCache(1000);
  cache.write([moment()], 100, 3);
  assert.equal(cache.read(500, 3).length, 1);
  assert.equal(cache.read(500, 4), undefined);
  assert.equal(cache.read(1101, 3), undefined);
  cache.clear();
  assert.equal(cache.read(200, 3), undefined);
});

test('feed cache never returns a different scope and invalidates all scopes after interaction', () => {
  const cache = new MomentFeedCache(1000);
  cache.write([moment({ momentId: 1 })], 100, 3, 'latest');
  cache.write([moment({ momentId: 2 })], 100, 3, 'hot');
  assert.deepEqual(cache.read(500, 3, 'latest').map(item => item.momentId), [1]);
  assert.deepEqual(cache.read(500, 3, 'hot').map(item => item.momentId), [2]);
  assert.equal(cache.read(500, 3, 'following'), undefined);
  assert.equal(cache.read(99, 3, 'latest'), undefined);
  assert.equal(cache.read(500, 4, 'hot'), undefined);
  cache.clear();
  assert.equal(cache.read(500, 3, 'hot'), undefined);
});

test('runtime shell renders the real feed page without placeholder actions', () => {
  const shell = fs.readFileSync(path.resolve(sourceRoot, 'features/shell/PortraAppShell.ets'), 'utf8');
  const page = fs.readFileSync(path.resolve(sourceRoot, 'pages/MomentFeedPage.ets'), 'utf8');
  const card = fs.readFileSync(path.resolve(sourceRoot, 'features/moments/MomentCard.ets'), 'utf8');
  assert.match(shell, /MomentFeedPage/);
  assert.doesNotMatch(shell, /动态业务不在本轮实现范围内/);
  assert.match(page, /listMoments\(scope, this.listRequestKey\)/);
  assert.match(page, /requestInFlight/);
  assert.match(page, /MomentFeedCache/);
  assert.match(card, /allowInlineData: true/);
  assert.doesNotMatch(card, /onLike|onFavorite|发布成功/);
});
