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
  RequestMethod: { GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE' },
  HttpDataType: { STRING: 1 },
  createHttp() {
    const call = { destroyed: 0 };
    calls.push(call);
    return {
      request(url, options) {
        Object.assign(call, { url, options });
        return new Promise((resolve, reject) => Object.assign(call, { resolve, reject }));
      },
      destroy() { call.destroyed++; }
    };
  }
};
class TestBuildProfile {
  static PORTRA_ENVIRONMENT = 'staging';
  static PORTRA_BASE_URL = 'https://47.76.106.57';
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

function complete(call, data) {
  call.resolve({ responseCode: 200, result: JSON.stringify({ code: 200, message: 'success', data }) });
}

async function expectRequest(invoke, method, suffix, data, body) {
  const promise = invoke();
  const call = calls.at(-1);
  assert.equal(call.options.method, method);
  assert.equal(call.url, TestBuildProfile.PORTRA_BASE_URL + suffix);
  assert.equal(call.options.header.Authorization, suffix.includes('/public-profile?') ? undefined : 'Bearer session-token');
  if (body !== undefined) assert.deepEqual(JSON.parse(call.options.extraData), body);
  complete(call, data);
  return promise;
}

test('user, role, social and favorite APIs use the existing authenticated contracts', async () => {
  const client = new HttpClient();
  client.setAccessToken('session-token');
  const api = new ApiService(client);
  await expectRequest(() => api.getMyProfile(), 'GET', '/users/me',
    { id: 3, nickname: 'N', currentRole: 'CUSTOMER' });
  await expectRequest(() => api.switchRole('provider'), 'POST', '/users/me/role',
    { id: 3, nickname: 'N', currentRole: 'PROVIDER' }, { role: 'PROVIDER' });
  await expectRequest(() => api.getPublicProfile(8, 'provider'), 'GET',
    '/users/8/public-profile?role=PROVIDER',
    { userId: 8, currentRole: 'PROVIDER', followerCount: 1, followingCount: 2,
      followedByCurrentUser: false, momentCount: 3 });
  await expectRequest(() => api.followUser(8, 'provider'), 'PUT',
    '/users/8/follow?targetRole=PROVIDER',
    { targetUserId: 8, followed: true, followerCount: 2, followingCount: 1 });
  await expectRequest(() => api.unfollowUser(8, 'provider'), 'DELETE',
    '/users/8/follow?targetRole=PROVIDER',
    { targetUserId: 8, followed: false, followerCount: 1, followingCount: 0 });
  await expectRequest(() => api.listFavoriteMoments(2, 4), 'GET',
    '/moments/me/interactions?interaction=FAVORITED&page=2&size=4',
    { records: [], page: 2, size: 4, total: 0 });
});

test('conversation hiding and reports preserve server-authoritative results', async () => {
  const client = new HttpClient();
  client.setAccessToken('session-token');
  const api = new ApiService(client);
  await expectRequest(() => api.hideConversation(12), 'DELETE', '/conversations/12', null);
  await expectRequest(() => api.createReport({ targetType: 'DEMAND', targetId: 7,
    reason: '不当内容' }), 'POST', '/reports',
  { reportId: 2, reporterId: 3, targetType: 'DEMAND', targetId: 7,
    reason: '不当内容', status: 'PENDING' },
  { targetType: 'DEMAND', targetId: 7, reason: '不当内容' });
});

test('account cancellation is submitted to and read from the authenticated server', async () => {
  const client = new HttpClient();
  client.setAccessToken('session-token');
  const api = new ApiService(client);
  await expectRequest(() => api.getAccountCancellation(), 'GET',
    '/users/me/cancellation-request',
    { requestId: null, status: 'NOT_REQUESTED' });
  await expectRequest(() => api.requestAccountCancellation(' no longer needed '), 'POST',
    '/users/me/cancellation-request',
    { requestId: 4, status: 'PENDING', reason: 'no longer needed' },
    { reason: 'no longer needed' });
});

test('identity permission errors remain visible instead of falling back to a different profile response', async () => {
  const client = new HttpClient(); client.setAccessToken('session-token'); const api = new ApiService(client);
  const before = calls.length; const request = api.currentSession('hall.identity');
  calls.at(-1).resolve({ responseCode: 200, result: JSON.stringify({ code: 40301, message: 'forbidden', data: null }) });
  await assert.rejects(request, error => error.businessCode === 40301);
  assert.equal(calls.length, before + 1);
});

test('profile and order workspace query the confirmed role with independent cancellation keys', async () => {
  const client = new HttpClient(); client.setAccessToken('session-token'); const api = new ApiService(client);
  for (const role of ['CUSTOMER', 'PROVIDER']) {
    await expectRequest(() => api.listOrders(role, 'profile.orders'), 'GET', '/orders?role=' + role, []);
  }
});

test('publication preview and management refresh cannot cancel each other', async () => {
  const client = new HttpClient(); client.setAccessToken('session-token'); const api = new ApiService(client);
  const preview = api.listMyDemands(1); const first = calls.at(-1);
  const management = api.listMyDemands(1, 'workspace.demands'); const second = calls.at(-1);
  assert.equal(first.destroyed, 0);
  complete(first, { records: [], page: 1, size: 10, total: 0 });
  complete(second, { records: [], page: 1, size: 10, total: 0 });
  await Promise.all([preview, management]);
});

test('pages integrate role isolation, deduplication, follow, favorite and report behavior', () => {
  const read = relative => fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
  const profile = read('pages/ProfilePage.ets');
  const messages = read('pages/MessagePage.ets');
  const feed = read('pages/MomentFeedPage.ets');
  const report = read('features/user/ReportPanel.ets');
  const follow = read('features/user/FollowAction.ets');
  assert.match(profile, /notifyIdentityChanged\(\)/);
  assert.match(profile, /listProfileMoments/);
  assert.match(profile, /listFavoriteMoments/);
  assert.match(profile, /this\.role === 'CUSTOMER'/);
  assert.match(messages, /ConversationListModel\.validSummary/);
  assert.match(messages, /ConversationMemory\.write/);
  assert.match(messages, /hideConversation/);
  assert.match(feed, /MomentFavoriteWrite\.execute/);
  const favorite = read('features/moments/MomentFavoriteWrite.ets');
  assert.match(favorite, /api\.favoriteMoment/);
  assert.match(favorite, /api\.unfavoriteMoment/);
  assert.match(follow, /result\.followed === this\.followed/);
  assert.match(report, /\['USER', 'DEMAND', 'SERVICE_PACKAGE', 'MOMENT', 'REVIEW'\]/);
  assert.match(report, /result\.targetType !== payload\.targetType/);
});

test('profile exposes privacy controls and server-backed account cancellation', () => {
  const read = relative => fs.readFileSync(path.join(sourceRoot, relative), 'utf8');
  const profile = read('pages/ProfilePage.ets');
  const index = read('pages/Index.ets');
  const appClient = read('app/AppClient.ets');
  assert.match(profile, /Portra 用户协议/);
  assert.match(profile, /Portra 隐私政策/);
  assert.match(profile, /个人信息出境单独同意书/);
  assert.match(profile, /撤回隐私及出境同意/);
  assert.match(profile, /在线提交申请并查询处理状态/);
  assert.match(profile, /getAccountCancellation\(\)/);
  assert.match(profile, /requestAccountCancellation/);
  assert.match(profile, /3336578810@qq\.com/);
  assert.match(profile, /await this\.appClient\.sessionManager\.signOut\(\)/);
  assert.match(profile, /this\.appClient\.withdrawRequiredPrivacyConsent\(\)/);
  assert.ok(profile.indexOf('await this.appClient.sessionManager.signOut()') <
    profile.indexOf('this.appClient.withdrawRequiredPrivacyConsent()'));
  assert.match(appClient, /PrivacyConsentStore\.clear/);
  assert.match(index, /consentGateState = ConsentGateState\.REQUIRED/);
  assert.doesNotMatch(profile, /deleteAccount\(/);
});
