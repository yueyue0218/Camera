const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(root + path.sep));
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};
const { ConversationTaskModel } = require('../entry/src/main/ets/features/conversation/ConversationTaskModel.ets');

const order = (status) => ({ orderId: 4, conversationId: 7, customerId: 1, providerUserId: 2, status });
const current = (status, userId, authorizations = [], deliveries = []) =>
  ConversationTaskModel.current([order(status)], [], authorizations, deliveries, userId, 2);

test('chat task stays role-specific across payment, delivery, rework and dispute', () => {
  assert.equal(current('PENDING_PAYMENT', 1).action, 'pay');
  assert.equal(current('PENDING_PAYMENT', 2).action, 'order');
  assert.equal(current('PENDING_DELIVERY', 2).action, 'upload');
  assert.equal(current('PENDING_DELIVERY', 1).action, 'order');
  assert.equal(current('DELIVERED_PENDING_CONFIRM', 1).action, 'gallery');
  assert.equal(current('REWORK_REQUIRED', 2).action, 'upload');
  assert.equal(current('APPEALING', 1).action, 'order');
  assert.equal(current('PENDING_PAYMENT', 3), null);
});

test('completed customer sees pending authorization, provider can request unused photos', () => {
  const authorization = { id: 8, orderId: 4, customerId: 1, status: 'PENDING',
    photoUsageScope: 'PORTFOLIO_DISPLAY', files: [] };
  assert.equal(current('COMPLETED', 1, [authorization]).action, 'authorization');
  const delivery = { orderId: 4, files: [{ fileId: 12, fileType: 'IMAGE' }] };
  assert.equal(current('COMPLETED', 2, [], [delivery]).action, 'authorization');
  assert.equal(current('COMPLETED', 2, [], []).action, 'reviews');
});
