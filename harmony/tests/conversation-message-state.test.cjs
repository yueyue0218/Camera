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
    assert.equal(ConversationMessageState.retryForContent([item], 1, '保留')?.messageId, pending.messageId);
    assert.equal(ConversationMessageState.retryForContent([item], 2, '保留'), undefined);
  }
});

test('picked image keeps its preview and uploaded ID across polling and retry', () => {
  const pending = ConversationMessageState.pendingAttachment(7, 1, 'IMAGE', 'photo.jpg',
    'image/jpeg', 2048, 'file://picked/photo.jpg', '', '2026-10-29T14:00:00');
  const uploaded = ConversationMessageState.uploaded([pending], pending.messageId, 91)[0];
  const failed = ConversationMessageState.status([uploaded], pending.messageId, SendStatus.FAILED)[0];
  assert.equal(failed.fileId, 91);
  assert.equal(failed.localUri, 'file://picked/photo.jpg');
  assert.equal(ConversationMessageState.retryForContent([failed], 1, ''), undefined);
  const remote = { messageId: 55, conversationId: 7, senderId: 1, messageType: 'IMAGE',
    fileId: 91, createdAt: '2026-10-29T14:00:01' };
  const merged = ConversationMessageState.merge([failed], [remote]);
  assert.deepEqual(merged.map(item => item.messageId), [55]);
  assert.equal(merged[0].localUri, 'file://picked/photo.jpg');
  assert.equal(ConversationMessageState.confirm(merged, pending.messageId, remote)[0].localUri,
    'file://picked/photo.jpg');
});

test('simultaneous pending photos remain in picked order', () => {
  const first = ConversationMessageState.pendingAttachment(7, 1, 'IMAGE', 'one.jpg',
    'image/jpeg', 10, 'one', '', '2026-10-29T14:00:00');
  const second = ConversationMessageState.pendingAttachment(7, 1, 'IMAGE', 'two.jpg',
    'image/jpeg', 10, 'two', '', '2026-10-29T14:00:00');
  assert.deepEqual(ConversationMessageState.merge([second, first], []).map(item => item.messageId),
    [first.messageId, second.messageId]);
});
