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

const { ConversationListModel } = require('../entry/src/main/ets/features/conversation/ConversationListModel.ets');
const { ConversationMemory } = require('../entry/src/main/ets/features/conversation/ConversationMemory.ets');
const summary = { conversationId: 8, participantAId: 1, participantBId: 2, otherUserId: 2,
  lastMessageTime: '2026-10-29T14:00:00' };

test('list accepts a participant and rejects malformed or foreign conversations', () => {
  assert.equal(ConversationListModel.validSummary(summary, 1), true);
  assert.equal(ConversationListModel.validSummary({ ...summary, otherUserId: 1 }, 1), false);
  assert.equal(ConversationListModel.validSummary({ ...summary, conversationId: 'local-8' }, 1), false);
  assert.equal(ConversationListModel.validSummary(summary, 3), false);
});

test('normal Chinese names and image/file previews are preserved', () => {
  assert.equal(ConversationListModel.safeName({ userId: 2, nickname: '林屿' }), '林屿');
  assert.equal(ConversationListModel.preview([{ messageType: 'IMAGE' }]), '[图片]');
  assert.equal(ConversationListModel.preview([{ messageType: 'FILE', fileName: '作品.zip' }]), '[附件] 作品.zip');
  assert.equal(ConversationListModel.preview([]), '开始对话');
  assert.equal(ConversationListModel.preview([{ messageType: 'TEXT', content: 'online-check provider reply message' }]), null);
});

test('message list dates use compact familiar labels', () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 28);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 14);
  assert.equal(ConversationListModel.timeLabel(today.toISOString()), '14:28');
  assert.equal(ConversationListModel.timeLabel(yesterday.toISOString()), '昨天 20:14');
  assert.equal(ConversationListModel.timeLabel('invalid'), '');
});

test('message list keeps search and long-press hide without row action buttons', () => {
  const page = fs.readFileSync(path.join(sourceRoot, 'pages/MessagePage.ets'), 'utf8');
  assert.match(page, /搜索联系人或最近消息/);
  assert.match(page, /filteredConversations\(\)/);
  assert.match(page, /LongPressGesture\(\)\.onAction\(\(\) =>\s*this\.confirmHide/);
  assert.doesNotMatch(page, /Button\('查看'\)/);
});

test('memory list cannot be read with another token or account', () => {
  ConversationMemory.clear();
  const row = ConversationListModel.row(summary, { userId: 2, nickname: '周一' },
    [{ messageType: 'TEXT', content: '你好', createdAt: '2026-10-29T14:00:00' }]);
  ConversationMemory.write('token-A', 1, [row]);
  assert.equal(ConversationMemory.read('token-A', 1).length, 1);
  assert.equal(ConversationMemory.read('token-B', 1).length, 0);
  assert.equal(ConversationMemory.read('token-A', 2).length, 0);
  ConversationMemory.noteMessage('token-A', 1, 8, { messageType: 'TEXT', content: '已收到' });
  assert.equal(ConversationMemory.read('token-A', 1)[0].preview, '已收到');
  ConversationMemory.writeListOffset('token-A', 1, 140);
  assert.equal(ConversationMemory.readListOffset('token-A', 1), 140);
  assert.equal(ConversationMemory.readListOffset('token-B', 1), 0);
  ConversationMemory.establishAccount('token-B', 2);
  assert.equal(ConversationMemory.read('token-B', 2).length, 0);
  assert.equal(ConversationMemory.readListOffset('token-B', 2), 0);
  ConversationMemory.clear();
});
