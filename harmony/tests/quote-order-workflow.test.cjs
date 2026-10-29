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
const { QuoteWorkflow } = require('../entry/src/main/ets/features/conversation/QuoteWorkflow.ets');
const { OrderWorkflow } = require('../entry/src/main/ets/features/conversation/OrderWorkflow.ets');
const { ConversationTimeline, TimelineKind } =
  require('../entry/src/main/ets/features/conversation/ConversationTimeline.ets');

const quote = { quotationId: 9, conversationId: 7, providerUserId: 2, customerId: 1,
  amountCent: 29900, shootStartTime: '2026-11-08T14:00:00', shootEndTime: '2026-11-08T16:00:00',
  deliveryDeadline: '2026-11-15T18:00:00', location: '城市公园', serviceContent: '双人写真',
  status: 'PENDING_CONFIRM', createdAt: '2026-11-01T10:00:00' };

test('quote form converts money to cents and validates dates and counts', () => {
  const draft = QuoteWorkflow.fromQuote(quote);
  assert.equal(QuoteWorkflow.payload(7, draft).amountCent, 29900);
  assert.equal(QuoteWorkflow.payload(7, QuoteWorkflow.withField(draft, 'amount', '299.50')).amountCent, 29950);
  assert.throws(() => QuoteWorkflow.payload(7, QuoteWorkflow.withField(draft, 'amount', '299.999')));
  assert.throws(() => QuoteWorkflow.payload(7, QuoteWorkflow.withField(draft, 'shootEnd', '2026-11-08 13:00')));
  assert.throws(() => QuoteWorkflow.payload(7, QuoteWorkflow.withField(draft, 'delivery', '2026-02-30 18:00')));
  assert.throws(() => QuoteWorkflow.payload(7, QuoteWorkflow.withField(draft, 'refined', '-1')));
  assert.equal(QuoteWorkflow.isDraft(draft), true);
  assert.equal(QuoteWorkflow.isDraft({ amount: '1' }), false);
});

test('quote role matrix and expired state are consistent', () => {
  assert.equal(QuoteWorkflow.canEdit(quote, 2), true);
  assert.equal(QuoteWorkflow.canEdit(quote, 1), false);
  assert.equal(QuoteWorkflow.canDecide(quote, 1), true);
  assert.equal(QuoteWorkflow.canDecide(quote, 2), false);
  assert.equal(QuoteWorkflow.status({ ...quote, expireTime: '2020-01-01T00:00:00' }), '已过期');
  assert.equal(QuoteWorkflow.canDecide({ ...quote, expireTime: '2020-01-01T00:00:00' }, 1), false);
  assert.equal(QuoteWorkflow.active([{ ...quote, status: 'REJECTED' }]), undefined);
});

test('order payment is limited to its customer and pending status', () => {
  const order = { orderId: 4, conversationId: 7, customerId: 1, providerUserId: 2,
    status: 'PENDING_PAYMENT', amountCent: 29900, createdAt: '2026-11-01T10:01:00' };
  assert.equal(OrderWorkflow.canPay(order, 1), true);
  assert.equal(OrderWorkflow.canPay(order, 2), false);
  assert.equal(OrderWorkflow.canPay({ ...order, status: 'PAID_PENDING_SHOOT' }, 1), false);
  assert.equal(OrderWorkflow.task(order, 2), '等待客户支付');
  assert.deepEqual(OrderWorkflow.inConversation([order, { ...order, orderId: 5, conversationId: 8 }], 7), [order]);
});

test('quote and order appear once in chronological conversation stream', () => {
  const order = { orderId: 4, conversationId: 7, providerUserId: 2,
    createdAt: '2026-11-01T10:01:00' };
  const timeline = ConversationTimeline.build([], [quote, quote], [order, order]);
  assert.deepEqual(timeline.map(item => item.key), ['quote:9', 'order:4']);
  assert.equal(timeline[1].kind, TimelineKind.ORDER);
});
