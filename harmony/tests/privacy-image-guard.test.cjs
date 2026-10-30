// Execute component gate methods with a mocked app boundary; no ArkUI or device networking.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
function fixture(relative, className) {
  let allowed = false, acquires = 0;
  const listeners = new Set();
  const app = { canUseBusinessNetwork: () => allowed,
    observePrivacyAccess: listener => listeners.add(listener), unobservePrivacyAccess: listener => listeners.delete(listener),
    apiService: {}, sessionManager: {}, fileImages: { observe() {}, unobserve() {}, epoch: () => 1,
      acquire() { acquires++; throw new Error('Unexpected file transport in a restricted view'); } } };
  class Snapshot {}
  class Binding { open() {} close() {} }
  const policyFilename = path.join(root, 'common/components/ComponentPolicy.ets');
  const policy = new Module(policyFilename, module);
  policy._compile(ts.transpileModule(fs.readFileSync(policyFilename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  }).outputText, policyFilename);
  const filename = path.join(root, relative), src = fs.readFileSync(filename, 'utf8');
  const end = src.indexOf('  @Builder') >= 0 ? src.indexOf('  @Builder') : src.indexOf('  build()');
  const plain = (src.slice(0, end) + '\n}').replace(/^@Component\s*$/m, '').replace('export struct ', 'export class ')
    .replace(/@Watch\('[^']+'\)\s*/g, '').replace(/@(State|Prop)\s+/g, '');
  const loaded = new Module(filename, module);
  loaded.require = name => {
    if (name.endsWith('/AppClient')) return { AppClient: { shared: app } };
    if (name.endsWith('/ComponentPolicy')) return policy.exports;
    if (name.endsWith('/PortraTheme')) return { PortraTheme: { radius: 12 } };
    if (name.endsWith('/MomentInteractions')) return { MomentInteractionSnapshot: Snapshot };
    if (name.endsWith('/MomentPublishController')) return { MomentPublishSnapshot: Snapshot, MomentPublishController: Binding };
    if (name.endsWith('/MomentFeedModels')) return { MomentFeedCache: { shared: {} } };
    if (name.endsWith('/MomentInteractionBindings')) return { MomentSessionBinding: Binding };
    if (name.endsWith('/MomentPublishApiBinding')) return { MomentPublishApiBinding: Binding };
    return {};
  };
  loaded._compile(ts.transpileModule(plain, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  }).outputText, filename);
  const component = new loaded.exports[className]();
  component.getUIContext = () => ({ getHostContext: () => undefined });
  return { component, app, get acquires() { return acquires; }, get observerCount() { return listeners.size; },
    setAllowed(value) { allowed = value; for (const listener of listeners) listener(); } };
}

test('PortraImage removes remote source eligibility immediately while retaining Resource and inline photos', async () => {
  const f = fixture('common/components/PortraImage.ets', 'PortraImage'), p = f.component;
  p.source = 'https://image.test/private-photo.png'; p.aboutToAppear();
  assert.equal(p.canLoad(), false); assert.equal(f.observerCount, 1);
  f.setAllowed(true); assert.equal(p.canLoad(), true);
  let released = 0; p.pixelMap = { release: async () => { released++; } };
  f.setAllowed(false); assert.equal(p.canLoad(), false); assert.equal(p.pixelMap, undefined); assert.equal(released, 1);
  p.source = { resource: 'local-bundled-placeholder' }; assert.equal(p.canLoad(), true);
  p.source = 'data:image/png;base64,AAAA'; p.allowInlineData = true; assert.equal(p.canLoad(), true);
  p.allowInlineData = false; assert.equal(p.canLoad(), false);
  p.fileId = 8; await p.reload(); assert.equal(f.acquires, 0);
  p.aboutToDisappear(); assert.equal(f.observerCount, 0);
});

test('the moment album removes remote Image frames on restriction and invalidates old callbacks, preserving inline frames', () => {
  const f = fixture('features/moments/MomentDetailPanel.ets', 'MomentDetailPanel'), p = f.component;
  const inline = 'data:image/png;base64,AAAA';
  p.state = { targetId: 7, images: ['https://image.test/photo.png', inline] }; p.aboutToAppear();
  assert.deepEqual(p.imageFrames().map(frame => frame.source), [inline]); assert.equal(f.observerCount, 1);
  f.setAllowed(true); const old = p.imageFrames()[0]; assert.equal(p.imageFrames().length, 2);
  f.setAllowed(false); assert.deepEqual(p.imageFrames().map(frame => frame.source), [inline]);
  p.imageCompleted(old, 100, 1000); assert.equal(p.dimensions.has(0), false);
  p.aboutToDisappear(); assert.equal(f.observerCount, 0);
});

test('moment publishing retains picker-converted inline thumbnails and removes HTTPS thumbnails under restriction', () => {
  const f = fixture('features/moments/MomentPublishPanel.ets', 'MomentPublishPanel'), p = f.component;
  p.aboutToAppear(); assert.equal(f.observerCount, 1);
  assert.equal(p.canDisplayImage('data:image/jpeg;base64,AAAA'), true);
  assert.equal(p.canDisplayImage('https://image.test/existing-photo.png'), false);
  f.setAllowed(true); assert.equal(p.canDisplayImage('https://image.test/existing-photo.png'), true);
  f.setAllowed(false); assert.equal(p.canDisplayImage('https://image.test/existing-photo.png'), false);
  assert.equal(p.canDisplayImage('data:image/jpeg;base64,AAAA'), true);
  p.aboutToDisappear(); assert.equal(f.observerCount, 0);
});
