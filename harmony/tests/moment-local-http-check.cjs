// Explicit, local-only HTTP acceptance. Never run against staging/production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { deflateSync } = require('node:zlib');
if (process.env.PORTRA_LOCAL_HTTP_AUDIT !== '1') throw new Error('Explicit local audit opt-in required.');
const origin = 'http://127.0.0.1:18087';
const logPath = process.env.PORTRA_LOCAL_SMS_LOG;
if (!logPath) throw new Error('Set the log of this isolated smoke process.');
const startup = fs.readFileSync(logPath, 'utf8');
assert.ok(startup.includes('profile is active: "smoke"'));
assert.ok(startup.includes('jdbc:h2:mem:portra_c_20261025'));
const results = [];
async function request(method, route, body, token, expected = 200) {
  const response = await fetch(origin + route, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000)
  });
  const envelope = await response.json();
  assert.equal(envelope.code, expected, `${method} ${route}: business code ${envelope.code}`);
  return envelope.data;
}
async function login(phone) {
  const deviceId = `portra-c-local-${phone.slice(-4)}`;
  await request('POST', '/auth/sms/send', { phone, purpose: 'LOGIN', deviceId });
  // Existing DevSmsSender is the local transport. The real random challenge is
  // consumed by the real verification endpoint; no fixed code, SQL or token mint.
  const masked = phone.slice(0, 3) + '******' + phone.slice(-4);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`Development SMS code for ${escape(masked)} \\(LOGIN\\): (\\d{6})`, 'g');
  const matches = [...fs.readFileSync(logPath, 'utf8').matchAll(pattern)];
  assert.ok(matches.length > 0, 'Local dev transport receipt not found; do not bypass verification.');
  const session = await request('POST', '/auth/native/sms/verify', {
    phone, purpose: 'LOGIN', deviceId, deviceName: 'C isolated local HTTP audit', code: matches.at(-1)[1]
  });
  assert.equal(session.role, 'CUSTOMER');
  assert.ok(Number.isSafeInteger(session.userId));
  return session;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}
function image(index) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, index * 40, 80, 180, 255]))), chunk('IEND', Buffer.alloc(0))]);
  return 'data:image/png;base64,' + png.toString('base64');
}
(async () => {
  const author = await login('+15555550101');
  const reporter = await login('+15555550102');
  results.push({ check: 'normal native SMS verification with existing local dev transport',
    authorId: author.userId, reporterId: reporter.userId, carrierDelivery: false });
  const post = await request('POST', '/moments', { title: 'C 隔离本地验收', content: '仅内存测试对象',
    imageDataList: [0, 1, 2, 3, 4].map(image), mentions: [] }, author.accessToken);
  const momentId = post.momentId;
  assert.ok(Number.isSafeInteger(momentId) && momentId > 0);
  for (const scope of ['latest', 'hot', 'following']) {
    const feed = await request('GET', `/moments?scope=${scope}`, undefined, reporter.accessToken);
    assert.ok(Array.isArray(feed));
    if (scope !== 'following') {
      const preview = feed.find(item => item.momentId === momentId);
      assert.ok(preview); assert.equal(preview.imageDataList.length, 3);
    }
  }
  const detail = await request('GET', `/moments/${momentId}`, undefined, reporter.accessToken);
  assert.equal(detail.imageDataList.length, 5);
  results.push({ check: 'real feed scopes and full detail images', momentId, feedPreviewImages: 3, detailImages: 5 });
  for (const [action, stateField, countField] of [
    ['like', 'likedByCurrentUser', 'likeCount'], ['favorite', 'favoritedByCurrentUser', 'favoriteCount']
  ]) {
    const enabled = await request('PUT', `/moments/${momentId}/${action}`, undefined, reporter.accessToken);
    const repeated = await request('PUT', `/moments/${momentId}/${action}`, undefined, reporter.accessToken);
    assert.equal(enabled[stateField], true); assert.equal(repeated[countField], enabled[countField]);
    const disabled = await request('DELETE', `/moments/${momentId}/${action}`, undefined, reporter.accessToken);
    assert.equal(disabled[stateField], false);
    results.push({ check: `real idempotent ${action} PUT/DELETE`, enabledCount: enabled[countField], disabledCount: disabled[countField] });
  }
  const created = await request('POST', '/reports', { targetType: 'MOMENT', targetId: momentId,
    reason: 'C 隔离本地测试举报', description: '仅测试数据，不请求处理真实内容' }, reporter.accessToken);
  assert.equal(created.targetId, momentId); assert.equal(created.status, 'PENDING');
  const mine = await request('GET', '/reports/my', undefined, reporter.accessToken);
  assert.ok(mine.some(item => item.reportId === created.reportId && item.targetId === momentId));
  results.push({ check: 'real report record and own report read', reportId: created.reportId, momentId, status: created.status });
  await request('GET', '/admin/reports?page=1&size=1', undefined, reporter.accessToken, 40301);
  results.push({ check: 'ordinary user denied admin read', businessCode: 40301 });
  await request('POST', '/auth/native/logout', undefined, author.accessToken);
  await request('POST', '/auth/native/logout', undefined, reporter.accessToken);
  console.log(JSON.stringify({ origin, database: 'isolated H2 memory', deviceAcceptance: false,
    webModerationAcceptance: false, results }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
