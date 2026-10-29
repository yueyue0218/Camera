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
const { ConversationMemory } = require('../entry/src/main/ets/features/conversation/ConversationMemory.ets');
const { ConversationMessageState, SendStatus } =
  require('../entry/src/main/ets/features/conversation/ConversationMessageState.ets');
const { ConversationTextSender } =
  require('../entry/src/main/ets/features/conversation/ConversationTextSender.ets');
const { ErrorMapper } = require('../entry/src/main/ets/network/ErrorMapper.ets');

function pending() {
  ConversationMemory.clear();
  ConversationMemory.establishAccount('token', 1);
  const item = ConversationMessageState.pending(7, 1, '你好', '2026-10-29T14:00:00');
  ConversationMemory.writeMessages('token', 1, 7, [item]);
  return item;
}

test('confirmed POST replaces the local bubble and updates cached list preview', async () => {
  const item = pending();
  const row = { conversation: { conversationId: 7 }, peerName: '张老师', preview: '旧消息', previewTime: '' };
  ConversationMemory.write('token', 1, [row]);
  const sent = { messageId: 40, conversationId: 7, senderId: 1,
    messageType: 'TEXT', content: '你好', createdAt: '2026-10-29T14:00:01' };
  const result = await ConversationTextSender.send(async () => sent, 'token', 1, 7, item);
  assert.equal(result.sent.messageId, 40);
  assert.deepEqual(result.messages.map(message => message.messageId), [40]);
  assert.equal(ConversationMemory.read('token', 1)[0].preview, '你好');
});

test('definite 403 failure keeps one retryable local bubble', async () => {
  const item = pending();
  const result = await ConversationTextSender.send(async () => {
    throw ErrorMapper.fromHttpStatus(403);
  }, 'token', 1, 7, item);
  assert.equal(result.sent, undefined);
  assert.equal(result.messages[0].messageId, item.messageId);
  assert.equal(result.messages[0].deliveryStatus, SendStatus.FAILED);
  assert.equal(result.messages[0].content, '你好');
});

test('transport uncertainty is not labeled failed or automatically resent', async () => {
  const item = pending();
  let attempts = 0;
  const result = await ConversationTextSender.send(async () => {
    attempts++;
    throw ErrorMapper.network();
  }, 'token', 1, 7, item);
  assert.equal(attempts, 1);
  assert.equal(result.messages[0].deliveryStatus, SendStatus.UNCERTAIN);
  assert.match(result.errorText, /核对|查询/);
});
