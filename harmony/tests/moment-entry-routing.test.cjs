const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
require.extensions['.ets'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
}).outputText, filename);
const { AppRoute } = require(path.join(root, 'model/NavigationModels.ets'));
function completion(stack) {
  const source = fs.readFileSync(path.join(root, 'pages/Index.ets'), 'utf8');
  const method = source.slice(source.indexOf('  private completeLogin('), source.indexOf('  private async openPage('));
  const loaded = new Module(__filename, module); loaded.filename = __filename; loaded.paths = module.paths;
  const compiled = ts.transpileModule('export class Completion {\n' + method + '\n}', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  }).outputText;
  loaded._compile('const {AppRoute}=require(' + JSON.stringify(path.join(root, 'model/NavigationModels.ets')) + ');\n' + compiled, __filename);
  const page = new loaded.exports.Completion(); const pushes = [];
  page.appPathStack = { pop() { stack.pop(); }, getAllPathName() { return stack.slice(); } };
  page.pushRoute = (route, param) => { stack.push(route); pushes.push({ route, param }); };
  return { page, stack, pushes };
}
test('root Moments login selects the existing shell without pushing a HALL destination', () => {
  const f = completion([AppRoute.LOGIN]); f.page.completeLogin({ returnRoute: AppRoute.HALL, initialTab: 1 });
  assert.deepEqual(f.stack, []); assert.equal(f.pushes.length, 0); assert.equal(f.page.mainTab, 1);
});
test('logging in from an existing HALL does not grow duplicate HALL destinations', () => {
  const f = completion([AppRoute.HALL, AppRoute.LOGIN]);
  f.page.completeLogin({ returnRoute: AppRoute.HALL, initialTab: 1 });
  assert.deepEqual(f.stack, [AppRoute.HALL]); assert.equal(f.pushes.length, 0);
});
test('other login returns retain prior behavior and author identity parameters', () => {
  const f = completion([AppRoute.LOGIN]);
  f.page.completeLogin({ returnRoute: AppRoute.PUBLIC_PROFILE, userId: 12, userRole: 'PROVIDER' });
  assert.equal(f.pushes[0].route, AppRoute.PUBLIC_PROFILE); assert.equal(f.pushes[0].param.userId, 12);
  assert.equal(f.pushes[0].param.userRole, 'PROVIDER');
  const demand = completion([AppRoute.DEMAND_DETAIL, AppRoute.LOGIN]);
  demand.page.completeLogin({ returnRoute: AppRoute.DEMAND_DETAIL, demandId: 7 });
  assert.deepEqual(demand.stack, [AppRoute.DEMAND_DETAIL]);
});
test('notification moment login return preserves the exact real moment ID',()=>{const f=completion([AppRoute.LOGIN]);f.page.completeLogin({returnRoute:AppRoute.MOMENT_DETAIL,momentId:27});assert.equal(f.pushes[0].param.momentId,27);});


test('message and profile login returns select the main tab without stacking pages', () => {
  for (const [route, tab] of [[AppRoute.MESSAGE, 2], [AppRoute.PROFILE, 3]]) {
    const f = completion([AppRoute.LOGIN]);
    f.page.completeLogin({ returnRoute: route });
    assert.deepEqual(f.stack, []); assert.equal(f.pushes.length, 0); assert.equal(f.page.mainTab, tab);
  }
});
