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

const { AppRoute } = require('../entry/src/main/ets/model/NavigationModels.ets');
const { ConversationVisibility } =
  require('../entry/src/main/ets/features/conversation/ConversationVisibility.ets');

test('polling signal stops on route hide and background, resumes on foreground', () => {
  const events = [];
  ConversationVisibility.setForeground(true);
  ConversationVisibility.show(AppRoute.MESSAGE);
  ConversationVisibility.subscribe('list', value => events.push(value));
  ConversationVisibility.setForeground(false);
  ConversationVisibility.setForeground(true);
  ConversationVisibility.show(AppRoute.CONVERSATION_DETAIL, { conversationId: 8 });
  ConversationVisibility.hide(AppRoute.CONVERSATION_DETAIL, { conversationId: 8 });
  ConversationVisibility.unsubscribe('list');
  assert.deepEqual(events, [true, false, true, false]);
});

test('only matching conversation is visible', () => {
  const events = [];
  ConversationVisibility.setForeground(true);
  ConversationVisibility.show(AppRoute.CONVERSATION_DETAIL, { conversationId: 8 });
  ConversationVisibility.subscribe('detail:8', value => events.push(value));
  ConversationVisibility.show(AppRoute.CONVERSATION_DETAIL, { conversationId: 9 });
  ConversationVisibility.hide(AppRoute.CONVERSATION_DETAIL, { conversationId: 8 });
  ConversationVisibility.unsubscribe('detail:8');
  assert.deepEqual(events, [true, false]);
});

const stored = new Map();
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@kit.ArkData') return { preferences: { getPreferencesSync: () => ({
    getSync: (key, fallback) => stored.get(key) ?? fallback,
    putSync: (key, value) => stored.set(key, value),
    flushSync: () => undefined
  }) } };
  if (request.endsWith('/EnvironmentConfig')) return {
    EnvironmentConfig: { current: () => ({ cacheNamespace: 'portra:dev' }) }
  };
  return originalLoad.call(this, request, parent, isMain);
};
const { ConversationDraftStore } =
  require('../entry/src/main/ets/features/conversation/ConversationDraftStore.ets');
Module._load = originalLoad;

test('drafts are isolated by account, conversation and environment namespace', () => {
  ConversationDraftStore.configure({});
  ConversationDraftStore.write(1, 7, '你好');
  assert.equal(ConversationDraftStore.read(1, 7), '你好');
  assert.equal(ConversationDraftStore.read(2, 7), '');
  assert.equal(ConversationDraftStore.read(1, 8), '');
  assert.equal(ConversationDraftStore.key(1, 7), 'portra:dev:draft:1:7');
  assert.equal(ConversationDraftStore.key(0, 7), '');
});

test('clearing a confirmed draft leaves another conversation untouched', () => {
  ConversationDraftStore.write(1, 8, '另一段');
  ConversationDraftStore.write(1, 7, '');
  assert.equal(ConversationDraftStore.read(1, 7), '');
  assert.equal(ConversationDraftStore.read(1, 8), '另一段');
});
