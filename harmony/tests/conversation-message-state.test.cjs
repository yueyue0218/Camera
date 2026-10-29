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
const { ConversationMessageState, SendStatus } =
  require('../entry/src/main/ets/features/conversation/ConversationMessageState.ets');

test('pending text appears immediately with stable temporary ID', () => {
  const first = ConversationMessageState.pending(7, 1, '你好', '2026-10-29T14:00:00');
  const second = ConversationMessageState.pending(7, 1, '再见', '2026-10-29T14:00:01');
  assert.ok(first.messageId < 0 && second.messageId < first.messageId);
  assert.equal(first.deliveryStatus, SendStatus.SENDING);
  assert.equal(first.content, '你好');
});

test('POST confirmation replaces pending and deduplicates an earlier poll result', () => {
  const pending = ConversationMessageState.pending(7, 1, '你好', '2026-10-29T14:00:00');
  const remote = { messageId: 42, conversationId: 7, senderId: 1,
    messageType: 'TEXT', content: '你好', createdAt: '2026-10-29T14:00:02' };
  const polled = ConversationMessageState.merge([pending], [remote]);
  assert.deepEqual(polled.map(item => item.messageId), [42]);
  assert.deepEqual(ConversationMessageState.confirm(polled, pending.messageId, remote)
    .map(item => item.messageId), [42]);
});

test('ambiguous equal-content messages remain unresolved instead of falsely merging', () => {
  const one = ConversationMessageState.pending(7, 1, '收到', '2026-10-29T14:00:00');
  const two = ConversationMessageState.pending(7, 1, '收到', '2026-10-29T14:00:01');
  const remote = { messageId: 43, conversationId: 7, senderId: 1,
    messageType: 'TEXT', content: '收到', createdAt: '2026-10-29T14:00:02' };
  const merged = ConversationMessageState.merge([one, two], [remote]);
  assert.equal(merged.length, 3);
});

test('failed and uncertain messages keep their original content and ID for retry', () => {
  const pending = ConversationMessageState.pending(7, 1, '保留', '2026-10-29T14:00:00');
  for (const status of [SendStatus.FAILED, SendStatus.UNCERTAIN]) {
    const item = ConversationMessageState.status([pending], pending.messageId, status)[0];
    assert.equal(item.messageId, pending.messageId);
    assert.equal(item.content, '保留');
    assert.equal(item.deliveryStatus, status);
  }
});
