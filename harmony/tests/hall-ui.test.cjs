const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));

require.extensions['.ets'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};

const { HallTextFormatter } = require('../entry/src/main/ets/features/hall/HallUiModels.ets');

test('hall copy formatter keeps API fallbacks deterministic', () => {
  assert.equal(HallTextFormatter.nonEmpty('  校园写真  ', '橱窗'), '校园写真');
  assert.equal(HallTextFormatter.nonEmpty('  ', '橱窗'), '橱窗');
  assert.equal(HallTextFormatter.city('320100'), '南京');
  assert.equal(HallTextFormatter.city(undefined), '城市待定');
});

test('hall prices use backend cents without manufacturing values', () => {
  assert.equal(HallTextFormatter.price('¥299–399', 100), '¥299–399');
  assert.equal(HallTextFormatter.price(undefined, 29900), '¥299 起');
  assert.equal(HallTextFormatter.price(undefined, undefined), '价格面议');
  assert.equal(HallTextFormatter.budget(30000, 50000), '¥300–500');
  assert.equal(HallTextFormatter.budget(undefined, undefined), '预算面议');
});

test('preview fixtures stay outside production source', () => {
  const mainRoot = path.resolve(__dirname, '../entry/src/main');
  const fixtureFile = path.resolve(__dirname, '../entry/src/ohosTest/ets/preview/HallPreview.ets');
  const previewEntry = path.resolve(mainRoot, 'ets/preview/HallPreviewEntry.ets');
  assert.equal(fs.existsSync(fixtureFile), true);
  assert.equal(fixtureFile.startsWith(mainRoot + path.sep), false);
  assert.equal(fs.existsSync(previewEntry), true);
  const indexSource = fs.readFileSync(path.resolve(mainRoot, 'ets/pages/Index.ets'), 'utf8');
  const fixtureSource = fs.readFileSync(fixtureFile, 'utf8');
  const previewSource = fs.readFileSync(previewEntry, 'utf8');
  assert.doesNotMatch(indexSource, /林屿|松野|纸鸢|青禾|29900|36800/);
  assert.doesNotMatch(previewSource, /林屿|松野|纸鸢|青禾|29900|36800/);
  assert.match(fixtureSource, /林屿|松野|纸鸢|青禾|29900|36800/);
  assert.doesNotMatch(indexSource, /HallPreviewEntry/);
  assert.match(previewSource, /@Entry\s+@Component\s+struct HallPreviewInteractive/);
  for (const width of [1080, 1170, 1290]) {
    assert.match(previewSource, new RegExp(`width: ${width}`));
  }
});

test('app shell is native ArkUI and keeps the page split into feature components', () => {
  const shell = fs.readFileSync(path.resolve(__dirname,
    '../entry/src/main/ets/features/shell/PortraAppShell.ets'), 'utf8');
  const hall = fs.readFileSync(path.resolve(__dirname,
    '../entry/src/main/ets/features/hall/HallView.ets'), 'utf8');
  const index = fs.readFileSync(path.resolve(__dirname, '../entry/src/main/ets/pages/Index.ets'), 'utf8');
  assert.doesNotMatch(`${shell}\n${hall}\n${index}`, /WebView\s*\(/);
  assert.match(shell, /PortraBottomNav/);
  assert.match(hall, /HallSegmentedControl/);
  assert.match(hall, /PortraPublishBanner/);
  assert.match(hall, /ShowcaseCard/);
  assert.match(hall, /Scroll\(this\.contentScroller\)/);
  assert.match(hall, /scrollTo\(\{ xOffset: 0, yOffset: 0, animation: false \}\)/);
});

test('hall preview covers channels, load states and narrow-screen edge cases', () => {
  const fixtureSource = fs.readFileSync(path.resolve(__dirname,
    '../entry/src/ohosTest/ets/preview/HallPreview.ets'), 'utf8');
  const previewSource = fs.readFileSync(path.resolve(__dirname,
    '../entry/src/main/ets/preview/HallPreviewEntry.ets'), 'utf8');
  for (const component of [
    'HallDemandPreviewFrame', 'HallLoadingPreviewFrame', 'HallEmptyPreviewFrame',
    'HallErrorPreviewFrame', 'HallEdgeCasesPreviewFrame'
  ]) {
    assert.match(fixtureSource, new RegExp(`export struct ${component}`));
    assert.match(previewSource, new RegExp(component));
  }
  assert.match(fixtureSource, /这是一个用于检查小屏幕省略效果的较长昵称/);
  assert.match(fixtureSource, /coverImage: ''/);
  assert.match(fixtureSource, /photographerAvatarUrl: ''/);
});

test('runtime hall state is data-driven instead of copying prototype examples', () => {
  const appBar = fs.readFileSync(path.resolve(__dirname,
    '../entry/src/main/ets/common/components/PortraAppBar.ets'), 'utf8');
  const controls = fs.readFileSync(path.resolve(__dirname,
    '../entry/src/main/ets/features/hall/components/HallControls.ets'), 'utf8');
  const cards = fs.readFileSync(path.resolve(__dirname,
    '../entry/src/main/ets/features/hall/components/HallCards.ets'), 'utf8');
  assert.match(appBar, /showNoticeDot: boolean = false/);
  assert.doesNotMatch(controls, /label: '南京'.*active: true/);
  assert.match(cards, /isFavorited === true/);
  assert.match(cards, /favoritedByCurrentUser === true/);
  assert.match(cards, /fallbackText: '暂无参考图'/);
  assert.doesNotMatch(cards, /Text\('约拍'\)/);
});
