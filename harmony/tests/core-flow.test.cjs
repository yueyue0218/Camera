const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
require.extensions['.ets'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};
const { HallDataPolicy } = require('../entry/src/main/ets/features/hall/HallDataPolicy.ets');

test('hall pagination validates PageResult and removes repeated backend records', () => {
  assert.equal(HallDataPolicy.validPage({ records: [], page: 1, size: 20, total: 0 }), true);
  assert.equal(HallDataPolicy.validPage({ records: [], page: 0, size: 20, total: 0 }), false);
  assert.deepEqual(HallDataPolicy.mergeServices([{ serviceId: 1 }],
    [{ serviceId: 1 }, { serviceId: 2 }, { serviceId: 0 }]).map(item => item.serviceId), [1, 2]);
  assert.deepEqual(HallDataPolicy.mergeDemands([{ demandId: 7 }],
    [{ demandId: 7 }, { demandId: 8 }, { demandId: -1 }]).map(item => item.demandId), [7, 8]);
  assert.equal(HallDataPolicy.hasMore(20, 21), true);
  assert.equal(HallDataPolicy.hasMore(21, 21), false);
});

test('core pages preserve server-authoritative role and state transitions', () => {
  const source = name => fs.readFileSync(path.resolve(__dirname, `../entry/src/main/ets/pages/${name}`), 'utf8');
  const demand = source('DemandDetailPage.ets');
  const service = source('ServiceDetailPage.ets');
  const publish = source('PublishPage.ets');
  const conversation = source('ConversationDetailPage.ets');
  const api = fs.readFileSync(path.resolve(__dirname, '../entry/src/main/ets/network/ApiService.ets'), 'utf8');
  assert.match(demand, /listMyDemandResponses\(\)/);
  assert.match(demand, /result\.responseStatus !== 'ACCEPTED'/);
  assert.match(service, /listServicePackageInterests/);
  assert.match(service, /addServicePackageInterest/);
  assert.match(service, /cancelServicePackageInterest/);
  assert.match(publish, /this\.role !== 'CUSTOMER'/);
  assert.match(api, /result\.quotationStatus !== 'CONFIRMED'/);
  assert.doesNotMatch(conversation, /付款成功|支付成功/);
});
