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
const { ConversationTimeline, TimelineKind } =
  require('../entry/src/main/ets/features/conversation/ConversationTimeline.ets');

test('text messages and real quotes share one timestamp-ordered stream', () => {
  const messages = [
    { messageId: 11, senderId: 1, messageType: 'TEXT', content: '后发', createdAt: '2026-10-29T10:03:00' },
    { messageId: 10, senderId: 2, messageType: 'TEXT', content: '先发', createdAt: '2026-10-29T10:01:00' }
  ];
  const quotes = [{ quotationId: 7, providerUserId: 2, createdAt: '2026-10-29T10:02:00' }];
  const timeline = ConversationTimeline.build(messages, quotes);
  assert.deepEqual(timeline.map(item => item.key), ['message:10', 'quote:7', 'message:11']);
  assert.equal(timeline[1].kind, TimelineKind.QUOTE);
});

test('duplicate IDs and explicit quote-linked messages do not duplicate events', () => {
  const messages = [
    { messageId: 1, senderId: 2, messageType: 'TEXT', createdAt: '2026-10-29T10:00:00' },
    { messageId: 1, senderId: 2, messageType: 'TEXT', createdAt: '2026-10-29T10:00:00' },
    { messageId: 2, senderId: 2, messageType: 'QUOTE', quotationId: 7, createdAt: '2026-10-29T10:02:00' }
  ];
  assert.deepEqual(ConversationTimeline.build(messages, [{ quotationId: 7, providerUserId: 2,
    createdAt: '2026-10-29T10:02:00' }]).map(item => item.key), ['message:1', 'quote:7']);
});

test('same-second messages keep numeric order and time separators follow gaps', () => {
  const messages = [11, 2, 10].map(messageId => ({ messageId, senderId: 1,
    messageType: 'TEXT', createdAt: messageId === 11 ? '2026-10-29T10:07:00' : '2026-10-29T10:00:00' }));
  const timeline = ConversationTimeline.build(messages, []);
  assert.deepEqual(timeline.map(item => item.key), ['message:2', 'message:10', 'message:11']);
  assert.ok(timeline[0].timeLabel);
  assert.equal(timeline[1].timeLabel, undefined);
  assert.ok(timeline[2].timeLabel);
});
