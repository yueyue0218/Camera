const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
require.extensions['.ets'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};
const { AftercarePolicy } = require('../entry/src/main/ets/features/aftercare/AftercarePolicy.ets');
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
const { AftercareDraftStore } = require('../entry/src/main/ets/features/aftercare/AftercareDraftStore.ets');
Module._load = originalLoad;

test('only completed-order provider can request photo display', () => {
  const order = { status: 'COMPLETED', providerUserId: 2, customerId: 1 };
  assert.equal(AftercarePolicy.authorizable(order, 2), true);
  assert.equal(AftercarePolicy.authorizable(order, 1), false);
  assert.equal(AftercarePolicy.authorizable({ ...order, status: 'DELIVERED_PENDING_CONFIRM' }, 2), false);
});

test('selection excludes ZIP, message attachments, and previously requested photos', () => {
  const deliveries = [{ files: [
    { fileId: 10, fileType: 'IMAGE' }, { fileId: 11, fileType: 'ZIP' },
    { fileId: 12, fileType: 'IMAGE' }, { fileId: 10, fileType: 'IMAGE' }
  ] }];
  const authorizations = [{ files: [{ fileId: 12 }], status: 'REJECTED' }];
  assert.deepEqual(AftercarePolicy.availablePhotos(deliveries, authorizations).map(file => file.fileId), [10]);
});

test('customer alone can decide a pending request', () => {
  const request = { status: 'PENDING', customerId: 1, providerUserId: 2,
    photoUsageScope: 'PORTFOLIO_DISPLAY' };
  assert.equal(AftercarePolicy.authorizationStatus(request, 1), '待你确认');
  assert.equal(AftercarePolicy.authorizationStatus(request, 2), '等待客户确认');
  assert.equal(AftercarePolicy.canDecide(request, 1), true);
  assert.equal(AftercarePolicy.canDecide(request, 2), false);
  assert.equal(AftercarePolicy.canDecide({ ...request, status: 'GRANTED' }, 1), false);
  assert.equal(AftercarePolicy.canDecide({ ...request, photoUsageScope: 'OTHER' }, 1), false);
  assert.equal(AftercarePolicy.authorizationStatus({ ...request, status: 'GRANTED' }, 1), '已同意');
  assert.equal(AftercarePolicy.authorizationStatus({ ...request, status: 'REJECTED' }, 1), '已拒绝');
});

test('review permission respects both directions and refund fault', () => {
  const order = { status: 'COMPLETED', customerId: 1, providerUserId: 2 };
  assert.equal(AftercarePolicy.canReview(order, 1, []), true);
  assert.equal(AftercarePolicy.canReview(order, 2, []), true);
  assert.equal(AftercarePolicy.canReview(order, 1, [{ reviewerId: 1 }]), false);
  assert.equal(AftercarePolicy.canReview({ ...order, status: 'REFUNDED', refundStatus: 'PROVIDER_FAULT' }, 1, []), true);
  assert.equal(AftercarePolicy.canReview({ ...order, status: 'REFUNDED', refundStatus: 'PROVIDER_FAULT' }, 2, []), false);
  assert.equal(AftercarePolicy.canReview({ ...order, status: 'REFUNDED', refundStatus: 'BOTH_FAULT' }, 1, []), true);
  assert.equal(AftercarePolicy.canReview({ ...order, status: 'REFUNDED', refundStatus: 'BOTH_FAULT' }, 2, []), true);
  assert.equal(AftercarePolicy.canReview({ ...order, status: 'REFUNDED', refundStatus: 'MUTUAL_AGREEMENT' }, 1, []), false);
});

test('only original author can follow up and only the reviewed person can complain', () => {
  const review = { reviewId: 12, reviewerId: 1, targetUserId: 2, isVisible: true };
  assert.equal(AftercarePolicy.canFollowUp(review, 1), true);
  assert.equal(AftercarePolicy.canFollowUp(review, 2), false);
  assert.equal(AftercarePolicy.canComplain(review, 1, []), false);
  assert.equal(AftercarePolicy.canComplain(review, 2, []), true);
  const pending = { reviewId: 12, complainantId: 2, status: 'PENDING' };
  assert.equal(AftercarePolicy.canComplain(review, 2, [pending]), false);
  assert.equal(AftercarePolicy.canCancelComplaint(pending, 2), true);
  assert.equal(AftercarePolicy.canCancelComplaint(pending, 1), false);
  assert.equal(AftercarePolicy.canCancelComplaint({ ...pending, status: 'RESOLVED' }, 2), false);
  assert.equal(AftercarePolicy.canFollowUp({ ...review, isVisible: false }, 1), false);
});

test('aftercare drafts stay scoped to account, order, operation and target', () => {
  AftercareDraftStore.configure({});
  AftercareDraftStore.write(1, 10, 'review', 10, '评价草稿');
  AftercareDraftStore.write(1, 10, 'complaint', 33, '投诉草稿');
  assert.equal(AftercareDraftStore.read(1, 10, 'review', 10), '评价草稿');
  assert.equal(AftercareDraftStore.read(1, 10, 'complaint', 33), '投诉草稿');
  assert.equal(AftercareDraftStore.read(2, 10, 'review', 10), '');
  assert.equal(AftercareDraftStore.read(1, 11, 'review', 10), '');
  assert.equal(AftercareDraftStore.read(1, 10, 'complaint', 34), '');
  assert.equal(AftercareDraftStore.key(0, 10, 'review', 10), '');
});

test('conversation keeps each pending application once and only the latest settled record per order', () => {
  const items = [
    { id: 1, orderId: 10, status: 'GRANTED' },
    { id: 2, orderId: 10, status: 'REJECTED' },
    { id: 3, orderId: 10, status: 'PENDING' },
    { id: 4, orderId: 11, status: 'PENDING' }
  ];
  assert.deepEqual(AftercarePolicy.conversationAuthorizations(items).map(item => item.id), [4, 3, 2]);
});
