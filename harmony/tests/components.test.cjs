// Host-side tests for nonvisual component policies; no ArkUI runtime or device required.
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

const { ActionClickGuard, AvatarFallbackPolicy, PublicImagePolicy } =
  require('../entry/src/main/ets/common/components/ComponentPolicy.ets');

test('button actions reject rapid repeats', () => {
  const guard = new ActionClickGuard(350);
  assert.equal(guard.accept(1000), true);
  assert.equal(guard.accept(1200), false);
  assert.equal(guard.accept(1350), true);
  assert.equal(guard.accept(Number.NaN), false);
});

test('string image sources accept public HTTPS only', () => {
  for (const source of [
    'https://cdn.example.com/avatar.png',
    ' https://cdn.example.com/image.webp?size=small '
  ]) {
    assert.equal(PublicImagePolicy.accepts(source), true);
  }

  for (const source of [
    '',
    'http://cdn.example.com/avatar.png',
    '//cdn.example.com/avatar.png',
    'https://user:secret@cdn.example.com/avatar.png',
    'https://cdn.example.com/image.png#fragment',
    'https://cdn.example.com\\image.png',
    'file:///data/storage/avatar.png',
    'data:image/png;base64,AAAA'
  ]) {
    assert.equal(PublicImagePolicy.accepts(source), false);
  }
});

test('avatar fallback is deterministic without profile data', () => {
  assert.equal(AvatarFallbackPolicy.label(''), 'P');
  assert.equal(AvatarFallbackPolicy.label('  '), 'P');
  assert.equal(AvatarFallbackPolicy.label(' portra '), 'P');
  assert.equal(AvatarFallbackPolicy.label('小明'), '小');
});
