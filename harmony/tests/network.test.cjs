// Host-side logic tests. Only NetworkKit is replaced; no backend or device is used.
// Run with DEVECO_SDK_HOME set, using DevEco's bundled Node.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sdk = process.env.DEVECO_SDK_HOME;
if (!sdk) throw new Error('Set DEVECO_SDK_HOME to the DevEco SDK directory.');
const ts = require(path.join(sdk, 'default/openharmony/ets/build-tools/ets-loader/node_modules/typescript'));
const sourceRoot = path.resolve(__dirname, '../entry/src/main/ets');
const calls = [];
const http = {
  RequestMethod: { GET: 'GET', POST: 'POST' }, HttpDataType: { STRING: 1 },
  createHttp() {
    const call = { destroyed: 0 };
    calls.push(call);
    return {
      request(url, options) {
        Object.assign(call, { url, options });
        return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
      },
      // Deliberately allow late completion after destroy, to exercise race protection.
      destroy() { call.destroyed++; }
    };
  }
};
class TestBuildProfile {
  static PORTRA_ENVIRONMENT = 'dev';
  static PORTRA_BASE_URL = 'http://192.168.1.23:8080';
}
require.extensions['.ets'] = (module, filename) => {
  assert.ok(filename.startsWith(sourceRoot + path.sep));
  const originalRequire = module.require.bind(module);
  module.require = name => {
    if (name === '@kit.NetworkKit') return { http };
    if (name.endsWith('/BuildProfile')) return { default: TestBuildProfile };
    return originalRequire(name);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
  });
  module._compile(output.outputText, filename);
};
const { HttpClient } = require('../entry/src/main/ets/network/HttpClient.ets');
const { ApiService } = require('../entry/src/main/ets/network/ApiService.ets');
const { EnvironmentConfig } = require('../entry/src/main/ets/common/config/EnvironmentConfig.ets');
function complete(call, data = null) {
  call.resolve({ responseCode: 200, result: JSON.stringify({ code: 200, message: 'success', data }) });
}
function hasKind(kind) { return error => error.kind === kind; }

test('valid payload and explicit null success are preserved', async () => {
  const client = new HttpClient();
  for (const data of [{ records: [], page: 1, size: 10, total: 0 }, null]) {
    const result = client.get('/test');
    complete(calls.at(-1), data);
    assert.deepEqual(await result, data);
  }
});

for (const result of ['null', '[]', '{}', 'true', '<html>failure</html>',
  '{"code":"200","message":"success","data":[]}', '{"code":200,"message":"success"}',
  '{"code":200,"data":[]}', new ArrayBuffer(4)]) {
  test(`malformed envelope is a parse error: ${String(result)}`, async () => {
    const promise = new HttpClient().get('/test');
    const call = calls.at(-1);
    call.resolve({ responseCode: 200, result });
    await assert.rejects(promise, hasKind('parse'));
    assert.equal(call.destroyed, 1);
  });
}

test('HTTP failures are checked before parsing the body', async () => {
  for (const status of [401, 403, 404, 503]) {
    const promise = new HttpClient().get('/test');
    calls.at(-1).resolve({ responseCode: status, result: '<html>error</html>' });
    await assert.rejects(promise, error => error.kind === 'http' && error.httpStatus === status);
  }
});

test('business failures retain codes and hide internal SQL details', async () => {
  for (const code of [40101, 40301, 40401, 50001]) {
    const promise = new HttpClient().get('/test');
    calls.at(-1).resolve({ responseCode: 200,
      result: JSON.stringify({ code, message: 'SQL internal database details', data: null }) });
    await assert.rejects(promise, error => error.kind === 'business' &&
      error.businessCode === code && !error.message.includes('SQL'));
  }
});

test('timeout and connection failure are distinct, cleaned up, and never retried', async () => {
  for (const [code, kind] of [[2300028, 'timeout'], [2300007, 'network']]) {
    const before = calls.length;
    const promise = new HttpClient().get('/test');
    const call = calls.at(-1);
    call.reject({ code });
    await assert.rejects(promise, hasKind(kind));
    assert.equal(call.destroyed, 1);
    assert.equal(calls.length, before + 1);
  }
});

test('same-key late success cannot overwrite a newer result', async () => {
  const client = new HttpClient();
  const old = client.get('/old', 'list');
  const oldCall = calls.at(-1);
  const current = client.get('/new', 'list');
  complete(calls.at(-1), 'new');
  complete(oldCall, 'old');
  assert.equal(await current, 'new');
  await assert.rejects(old, hasKind('stale'));
});

test('explicit cancel suppresses a late transport error and leaves other keys alone', async () => {
  const client = new HttpClient();
  const old = client.get('/old', 'first');
  const oldCall = calls.at(-1);
  const other = client.get('/other', 'second');
  const otherCall = calls.at(-1);
  client.cancelRequest('first');
  oldCall.reject({ code: 2300028 });
  complete(otherCall, 'other');
  await assert.rejects(old, hasKind('stale'));
  assert.equal(await other, 'other');
  assert.equal(oldCall.destroyed, 1);
});

test('token replacement and clearing invalidate in-flight results', async () => {
  const client = new HttpClient();
  for (const change of [() => client.setAccessToken('test-token'), () => client.clearAccessToken()]) {
    const result = client.get('/private');
    const call = calls.at(-1);
    change();
    complete(call);
    await assert.rejects(result, hasKind('stale'));
  }
});

test('public lists omit Bearer, use exact backend paths, and disable redirects/cache', async () => {
  const client = new HttpClient();
  client.setAccessToken('test-token');
  const api = new ApiService(client);
  for (const [invoke, suffix] of [[() => api.listDemands(2, 5), '/demands?page=2&size=5'],
    [() => api.listServicePackages(), '/service-packages?page=1&size=10']]) {
    const result = invoke();
    const call = calls.at(-1);
    assert.equal(call.url, EnvironmentConfig.current().baseUrl + suffix);
    assert.equal(call.options.header.Authorization, undefined);
    assert.equal(call.options.maxRedirects, 0);
    assert.equal(call.options.usingCache, false);
    assert.equal(call.options.connectTimeout, 10000);
    assert.equal(call.options.readTimeout, 15000);
    complete(call, { records: [], page: 1, size: 10, total: 0 });
    await result;
  }
  const result = client.get('/private');
  assert.equal(calls.at(-1).options.header.Authorization, 'Bearer test-token');
  complete(calls.at(-1));
  await result;
});

test('native phone login uses public SMS endpoints and authenticated session endpoints', async () => {
  const client = new HttpClient();
  client.setAccessToken('current-token');
  const api = new ApiService(client);

  const send = api.sendLoginCode('+8613800138000', 'device-id');
  let call = calls.at(-1);
  assert.equal(call.url, EnvironmentConfig.current().baseUrl + '/auth/sms/send');
  assert.equal(call.options.header.Authorization, undefined);
  assert.deepEqual(JSON.parse(call.options.extraData),
    { phone: '+8613800138000', purpose: 'LOGIN', deviceId: 'device-id' });
  complete(call);
  await send;

  const verify = api.verifyLoginCode('+8613800138000', '123456', 'device-id');
  call = calls.at(-1);
  assert.equal(call.url, EnvironmentConfig.current().baseUrl + '/auth/native/sms/verify');
  assert.equal(call.options.header.Authorization, undefined);
  assert.deepEqual(JSON.parse(call.options.extraData), {
    phone: '+8613800138000', purpose: 'LOGIN', code: '123456',
    deviceId: 'device-id', deviceName: 'Portra HarmonyOS'
  });
  const session = { accessToken: 'new-token', refreshToken: 'refresh-token', userId: 4,
    nickname: '测试用户', role: 'CUSTOMER', adminCapable: false, newUser: false };
  complete(call, session);
  assert.deepEqual(await verify, session);

  const current = api.currentSession();
  call = calls.at(-1);
  assert.equal(call.url, EnvironmentConfig.current().baseUrl + '/auth/session');
  assert.equal(call.options.header.Authorization, 'Bearer current-token');
  complete(call, { userId: 4, nickname: '测试用户', role: 'CUSTOMER' });
  assert.equal((await current).nickname, '测试用户');

  const logout = api.logout();
  call = calls.at(-1);
  assert.equal(call.url, EnvironmentConfig.current().baseUrl + '/auth/native/logout');
  assert.equal(call.options.header.Authorization, 'Bearer current-token');
  assert.equal(call.options.extraData, undefined);
  complete(call, true);
  assert.equal(await logout, true);
});

test('native login rejects incomplete token responses', async () => {
  const api = new ApiService(new HttpClient());
  const verify = api.verifyLoginCode('+8613800138000', '123456', 'device-id');
  complete(calls.at(-1), { accessToken: 'token', userId: 1 });
  await assert.rejects(verify, hasKind('parse'));
});

test('business read-only pages use the existing API paths and authentication boundary', async () => {
  const client = new HttpClient();
  client.setAccessToken('current-token');
  const api = new ApiService(client);

  const detail = api.getDemand(12);
  let call = calls.at(-1);
  assert.equal(call.url, EnvironmentConfig.current().baseUrl + '/demands/12');
  assert.equal(call.options.header.Authorization, undefined);
  complete(call, { demandId: 12, scene: '校园摄影' });
  assert.equal((await detail).demandId, 12);

  const conversations = api.listConversations();
  call = calls.at(-1);
  assert.equal(call.url, EnvironmentConfig.current().baseUrl + '/conversations');
  assert.equal(call.options.header.Authorization, 'Bearer current-token');
  complete(call, []);
  assert.deepEqual(await conversations, []);

  const orders = api.listOrders();
  call = calls.at(-1);
  assert.equal(call.url, EnvironmentConfig.current().baseUrl + '/orders');
  assert.equal(call.options.header.Authorization, 'Bearer current-token');
  complete(call, []);
  assert.deepEqual(await orders, []);

  const count = calls.length;
  await assert.rejects(api.getDemand(0), hasKind('parse'));
  assert.equal(calls.length, count);
});

test('demand detail rejects missing or mismatched records', async () => {
  const api = new ApiService(new HttpClient());
  for (const data of [null, { demandId: 99 }]) {
    const request = api.getDemand(12);
    complete(calls.at(-1), data);
    await assert.rejects(request, hasKind('parse'));
  }
});

test('appointment flow uses authenticated demand, conversation and quote endpoints', async () => {
  const client = new HttpClient();
  client.setAccessToken('appointment-token');
  const api = new ApiService(client);
  const checks = [
    [() => api.createDemand({ scene: '人像', cityCode: 'NJ', location: '公园', timeDescription: '周末',
      description: '' }), '/demands', 'POST'],
    [() => api.respondToDemand(7, '可以拍摄', 30000), '/demands/7/responses', 'POST'],
    [() => api.listDemandResponses(7), '/demands/7/responses', 'GET'],
    [() => api.acceptDemandResponse(7, 9), '/demands/7/responses/9/accept', 'POST'],
    [() => api.listMessages(14), '/conversations/14/messages', 'GET'],
    [() => api.sendMessage(14, '你好'), '/conversations/14/messages', 'POST'],
    [() => api.listQuotes(14), '/conversations/14/quotations', 'GET'],
    [() => api.createQuote({ conversationId: 14, amountCent: 30000,
      shootStartTime: '2026-10-12T14:00:00', shootEndTime: '2026-10-12T16:00:00',
      deliveryDeadline: '2026-10-19T18:00:00', location: '公园', serviceContent: '人像' }),
      '/quotations', 'POST'],
    [() => api.confirmQuote(19), '/quotations/19/confirm', 'POST'],
    [() => api.startServiceChat(21), '/service-packages/21/start-chat', 'POST']
  ];
  for (const [invoke, route, method] of checks) {
    const promise = invoke();
    const call = calls.at(-1);
    assert.equal(call.url, EnvironmentConfig.current().baseUrl + route);
    assert.equal(call.options.method, method);
    assert.equal(call.options.header.Authorization, 'Bearer appointment-token');
    complete(call, {});
    await promise;
  }

  const service = api.getServicePackage(21);
  const call = calls.at(-1);
  assert.equal(call.url, EnvironmentConfig.current().baseUrl + '/service-packages/21');
  assert.equal(call.options.header.Authorization, undefined);
  complete(call, { serviceId: 21, title: '自然人像' });
  assert.equal((await service).serviceId, 21);
});

test('absolute URLs and ambiguous paths are rejected before network access', async () => {
  const before = calls.length;
  for (const url of ['https://example.com', '//example.com', '/bad\\path', '/bad path', '/bad#fragment']) {
    await assert.rejects(new HttpClient().get(url), hasKind('config'));
  }
  assert.equal(calls.length, before);
});

test('build products select one endpoint without a committed fallback', () => {
  const buildProfile = fs.readFileSync(path.resolve(__dirname, '../build-profile.json5'), 'utf8');
  const hvigorfile = fs.readFileSync(path.resolve(__dirname, '../hvigorfile.ts'), 'utf8');
  for (const name of ['dev', 'staging', 'production']) {
    assert.match(buildProfile, new RegExp(`"name": "${name}"`));
  }
  assert.doesNotMatch(buildProfile, /127\.0\.0\.1|192\.168\./);
  assert.match(hvigorfile, /process\.env\.PORTRA_BASE_URL/);
  assert.match(hvigorfile, /requires an HTTPS PORTRA_BASE_URL/);
  assert.equal(EnvironmentConfig.current().name, 'dev');
  assert.equal(EnvironmentConfig.current().baseUrl, 'http://192.168.1.23:8080');
  assert.equal(EnvironmentConfig.profile('staging').enabled, false);
  assert.equal(EnvironmentConfig.profile('production').enabled, false);
  assert.equal(EnvironmentConfig.fromBuildFields('dev', '').enabled, false);
  assert.equal(EnvironmentConfig.fromBuildFields('invalid', 'https://api.example.com').enabled, false);
});

test('system cleartext policy is isolated by product target', () => {
  const projectProfile = fs.readFileSync(path.resolve(__dirname, '../build-profile.json5'), 'utf8');
  const moduleProfile = fs.readFileSync(path.resolve(__dirname, '../entry/build-profile.json5'), 'utf8');
  const sharedPolicy = path.resolve(__dirname,
    '../entry/src/main/resources/base/profile/network_config.json');
  const readPolicy = environment => JSON.parse(fs.readFileSync(path.resolve(__dirname,
    `../entry/src/${environment}/resources/base/profile/network_config.json`), 'utf8'));
  const permitsCleartext = policy =>
    policy['network-security-config']['base-config'].cleartextTrafficPermitted;

  assert.equal(fs.existsSync(sharedPolicy), false);
  assert.equal(permitsCleartext(readPolicy('dev')), true);
  assert.equal(permitsCleartext(readPolicy('staging')), false);
  assert.equal(permitsCleartext(readPolicy('production')), false);
  for (const name of ['default', 'dev', 'staging', 'production']) {
    assert.match(projectProfile,
      new RegExp(`"name": "${name}"[\\s\\S]*?"applyToProducts": \\[\\s*"${name}"\\s*\\]`));
  }
  for (const [target, resourceEnvironment] of [
    ['default', 'dev'], ['dev', 'dev'], ['staging', 'staging'], ['production', 'production']
  ]) {
    assert.match(moduleProfile,
      new RegExp(`"name": "${target}"[\\s\\S]*?"\\./src/${resourceEnvironment}/resources"`));
  }
});

test('environment validation rejects unapproved protocols, credentials and non-dev HTTP', () => {
  assert.equal(EnvironmentConfig.isUsable(), true);
  const dev = EnvironmentConfig.fromBuildFields('dev', 'http://192.168.1.23:8080');
  for (const baseUrl of ['ftp://host', 'host', 'HTTPS://host', 'https://user:password@host',
    'https://host?x=1', 'http://192.168.1.23:0', 'http://192.168.1.23:65536']) {
    assert.equal(EnvironmentConfig.isUsable({ ...dev, baseUrl }), false);
  }
  const stagingHttp = EnvironmentConfig.fromBuildFields('staging', 'http://staging.example.com');
  const stagingHttps = EnvironmentConfig.fromBuildFields('staging', 'https://staging.example.com');
  const productionHttps = EnvironmentConfig.fromBuildFields('production', 'https://api.example.com');
  assert.equal(EnvironmentConfig.isUsable(stagingHttp), false);
  assert.equal(EnvironmentConfig.isUsable(stagingHttps), true);
  assert.equal(EnvironmentConfig.isUsable(productionHttps), true);
});
