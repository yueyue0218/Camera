// Host-side tests for ArkTS navigation rules; no ArkUI runtime or device required.
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

const { AppRoute } = require('../entry/src/main/ets/model/NavigationModels.ets');
const { NavigationClickGuard, NavigationPolicy } =
  require('../entry/src/main/ets/navigation/NavigationPolicy.ets');

test('all planned destinations have one stable route name', () => {
  assert.deepEqual(NavigationPolicy.routes, [
    AppRoute.LOGIN, AppRoute.HALL, AppRoute.DEMAND_DETAIL, AppRoute.SERVICE_DETAIL,
    AppRoute.CONVERSATION_DETAIL, AppRoute.PUBLISH,
    AppRoute.MESSAGE, AppRoute.ORDER, AppRoute.PROFILE
  ]);
  assert.equal(new Set(NavigationPolicy.routes).size, 9);
});

test('hall, public details and login remain public', () => {
  for (const route of [AppRoute.LOGIN, AppRoute.HALL, AppRoute.DEMAND_DETAIL, AppRoute.SERVICE_DETAIL]) {
    const result = NavigationPolicy.resolve(route, {}, false);
    assert.equal(result.route, route);
    assert.equal(NavigationPolicy.requiresAuthentication(route), false);
  }
});

test('protected guest destinations redirect to login and preserve the target', () => {
  for (const route of [AppRoute.PUBLISH, AppRoute.MESSAGE, AppRoute.CONVERSATION_DETAIL,
    AppRoute.ORDER, AppRoute.PROFILE]) {
    const result = NavigationPolicy.resolve(route, {}, false);
    assert.equal(result.route, AppRoute.LOGIN);
    assert.equal(result.param.returnRoute, route);
    assert.match(NavigationPolicy.loginDescription(result.param), /登录后继续前往/);
  }
});

test('authenticated sessions can enter protected destinations', () => {
  for (const route of [AppRoute.PUBLISH, AppRoute.MESSAGE, AppRoute.CONVERSATION_DETAIL,
    AppRoute.ORDER, AppRoute.PROFILE]) {
    const result = NavigationPolicy.resolve(route, {}, true);
    assert.equal(result.route, route);
    assert.equal(result.param.returnRoute, undefined);
  }
});

test('demand detail accepts only positive safe integer IDs', () => {
  for (const demandId of [1, 42, Number.MAX_SAFE_INTEGER]) {
    assert.equal(NavigationPolicy.validDemandId({ demandId }), demandId);
  }
  for (const demandId of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(NavigationPolicy.validDemandId({ demandId }), undefined);
  }
  assert.equal(NavigationPolicy.validDemandId({}), undefined);
});

test('service and conversation details reject invalid IDs and preserve conversation target through login', () => {
  assert.equal(NavigationPolicy.validServiceId({ serviceId: 13 }), 13);
  assert.equal(NavigationPolicy.validConversationId({ conversationId: -1 }), undefined);
  const result = NavigationPolicy.resolve(AppRoute.CONVERSATION_DETAIL, { conversationId: 42 }, false);
  assert.equal(result.param.conversationId, 42);
});

test('route labels and direct login description are deterministic', () => {
  for (const route of NavigationPolicy.routes) {
    assert.notEqual(NavigationPolicy.label(route), '目标页面');
  }
  assert.equal(NavigationPolicy.loginDescription({}), '');
});

test('rapid repeated navigation is accepted only after the cooldown', () => {
  const guard = new NavigationClickGuard(350);
  assert.equal(guard.accept(1000), true);
  assert.equal(guard.accept(1001), false);
  assert.equal(guard.accept(1349), false);
  assert.equal(guard.accept(1350), true);
  assert.equal(guard.accept(Number.NaN), false);
});
