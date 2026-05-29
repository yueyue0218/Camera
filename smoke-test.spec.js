/**
 * 全链路冒烟测试  v2
 * 路径: 注册→登录→发需求→服务方响应→接受→创建对话→报价→确认→支付→上传交付→评价
 *
 * 运行: node smoke-test.spec.js
 * 要求: Node.js 18+（内置 fetch）
 *
 * 认证策略:
 *   - 大多数步骤: X-User-Id header（AuthInterceptor demo 模式）
 *   - Step 02/03:  POST /sessions（免验证码 demo 登录，获取 JWT token）
 *   - Step 13/16:  Authorization: Bearer <token>（COrderHttpAdapter 需要转发此 header）
 */

const fs   = require('fs');
const path = require('path');

const BASE_URL    = 'http://localhost:8080';
const ISSUES_FILE = path.join(__dirname, 'smoke_test_issues.md');

// 使用数据库中已知的演示用户（由 SessionController 定义的 demo 账号）
const CUSTOMER_ID = '1001';   // DEMO_CUSTOMER_ID in SessionController
const PROVIDER_ID = '2001';   // DEMO_PROVIDER_ID in SessionController

// 从 /sessions 获取的 JWT token（Step 02/03 初始化）
let customerToken = null;
let providerToken = null;

// ─────────────────────────────────────────
// 问题收集
// ─────────────────────────────────────────
const issues = [];
function recordIssue(type, step, detail) {
  issues.push({ type, step, detail, time: new Date().toISOString() });
  process.stderr.write(`  [ISSUE] ${type} @ ${step}: ${detail}\n`);
}

// ─────────────────────────────────────────
// HTTP 工具
// ─────────────────────────────────────────

/**
 * 通用 HTTP 请求
 * @param {string} method
 * @param {string} url
 * @param {object} opts
 *   - body: JSON body
 *   - headers: 额外 header
 *   - userId: 若传入则设 X-User-Id（demo 模式）
 *   - token:  若传入则设 Authorization: Bearer（JWT 模式，优先于 userId）
 *   - asProvider: 是否加 X-User-Role: PROVIDER
 */
async function api(method, url, { body, headers: extra = {}, userId = null, token = null, asProvider = false } = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (userId) {
    headers['X-User-Id'] = String(userId);
  }
  if (asProvider) headers['X-User-Role'] = 'PROVIDER';

  let res;
  try {
    res = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    recordIssue('NetworkError', url, err.message);
    throw new Error(`NETWORK_ERROR: ${err.message}`);
  }

  let data = {};
  try { data = JSON.parse(await res.text()); } catch { /* ignore */ }

  if (res.status >= 500) {
    const detail = `HTTP ${res.status} — ${JSON.stringify(data).slice(0, 300)}`;
    recordIssue('HTTP_500_Fatal', url, detail);
    throw new Error(`FATAL_500: ${detail}`);
  }
  if (res.status === 401) recordIssue('HTTP_401_Unauthorized', url, JSON.stringify(data).slice(0, 200));
  else if (res.status === 403) recordIssue('HTTP_403_Forbidden', url, JSON.stringify(data).slice(0, 200));
  else if (res.status === 400) recordIssue('HTTP_400_Validation', url, JSON.stringify(data).slice(0, 200));
  else if (res.status >= 400)  recordIssue(`HTTP_${res.status}`, url, JSON.stringify(data).slice(0, 200));

  if (res.status === 200 && data.code !== undefined && data.code !== 200) {
    recordIssue(`BusinessError(code=${data.code})`, url, (data.message || '').slice(0, 300));
  }

  return { httpStatus: res.status, bizCode: data.code, message: data.message, data: data.data, _raw: data };
}

/** 上传文件 multipart/form-data */
async function uploadFile(url, fileBuffer, fileName, { userId = null, token = null } = {}) {
  const boundary = '----SmokeBoundary' + Date.now();
  const CRLF     = '\r\n';
  const prelude  = `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}Content-Type: application/octet-stream${CRLF}${CRLF}`;
  const epilogue = `${CRLF}--${boundary}--${CRLF}`;
  const body     = Buffer.concat([Buffer.from(prelude), fileBuffer, Buffer.from(epilogue)]);
  const headers  = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': String(body.length),
  };
  if (token)  headers['Authorization'] = `Bearer ${token}`;
  else if (userId) headers['X-User-Id'] = String(userId);

  let res;
  try { res = await fetch(`${BASE_URL}${url}`, { method: 'POST', headers, body }); }
  catch (err) { recordIssue('NetworkError', url, err.message); throw new Error(`NETWORK_ERROR: ${err.message}`); }

  let data = {};
  try { data = JSON.parse(await res.text()); } catch { /* ignore */ }

  if (res.status >= 500) {
    const detail = `HTTP ${res.status} — ${JSON.stringify(data).slice(0, 300)}`;
    recordIssue('HTTP_500_Fatal', url, detail);
    throw new Error(`FATAL_500: ${detail}`);
  }
  if (res.status >= 400) recordIssue(`HTTP_${res.status}`, url, JSON.stringify(data).slice(0, 200));
  if (res.status === 200 && data.code !== undefined && data.code !== 200)
    recordIssue(`BusinessError(code=${data.code})`, url, (data.message || '').slice(0, 300));

  return { httpStatus: res.status, bizCode: data.code, data: data.data };
}

const bizOk = r => r.httpStatus === 200 && r.bizCode === 200;

function assertField(step, obj, ...fields) {
  for (const f of fields) {
    if (obj == null || obj[f] === undefined || obj[f] === null)
      recordIssue('MissingField', step, `响应缺少字段: ${f}`);
  }
}

async function waitForServer(ms = 60000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE_URL}/test/success`)).ok) return true; }
    catch { /* wait */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

// ─────────────────────────────────────────
// 日志
// ─────────────────────────────────────────
function log(step, msg) { console.log(`\n[Step ${String(step).padStart(2,'0')}] ${msg}`); }
function ok(msg)        { console.log(`  ✓ ${msg}`); }
function skip(msg)      { console.log(`  ~ ${msg}`); }

// ─────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────
async function runSmokeTest() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Camera 平台 全链路冒烟测试  v2');
  console.log(`  ${new Date().toLocaleString('zh-CN')}`);
  console.log('═══════════════════════════════════════════════════');

  // 等待服务
  process.stdout.write('\n[Wait] 等待后端服务就绪 (最长90s)...');
  if (!(await waitForServer(90000))) {
    recordIssue('ServerUnavailable', 'Startup', 'http://localhost:8080 在90s内未响应');
    console.log(' ✗ 服务不可达，终止。');
    return finalize();
  }
  console.log(' ✓ 服务已就绪\n');

  let demandId, responseId, conversationId, quoteId, orderId;

  // ────────────────────────────────────────────────
  // Step 01 健康检查
  // ────────────────────────────────────────────────
  log(1, '健康检查 GET /test/success');
  {
    const r = await api('GET', '/test/success');
    if (bizOk(r)) ok(`Health OK — ${r.data}`);
    else recordIssue('HealthCheckFailed', 'Step01', JSON.stringify(r._raw).slice(0, 200));
  }

  // ────────────────────────────────────────────────
  // Step 02 演示注册 — 使用 /sessions 免验证码机制
  // SessionController 不验证手机号真实性，任意6位数字码均通过
  // ────────────────────────────────────────────────
  log(2, '演示注册 POST /sessions (role=CUSTOMER) — 免验证码 demo 账号激活');
  {
    const r = await api('POST', '/sessions', {
      body: { loginType: 'MOBILE', mobile: '13800138001', verifyCode: '123456', role: 'CUSTOMER' },
    });
    if (bizOk(r) && r.data?.token) {
      customerToken = r.data.token;
      ok(`演示账号就绪 userId=${r.data.user?.userId} token=${customerToken.slice(0, 20)}...`);
    } else {
      recordIssue('StepFailed', 'Step02/演示注册', `bizCode=${r.bizCode} "${r.message}"`);
    }
  }

  // ────────────────────────────────────────────────
  // Step 03 演示登录 — 使用 /sessions 获取服务方 JWT token
  // ────────────────────────────────────────────────
  log(3, '演示登录 POST /sessions (role=PROVIDER) — 获取服务方 JWT');
  {
    const r = await api('POST', '/sessions', {
      body: { loginType: 'MOBILE', mobile: '13900139002', verifyCode: '654321', role: 'PROVIDER' },
    });
    if (bizOk(r) && r.data?.token) {
      providerToken = r.data.token;
      ok(`服务方登录成功 userId=${r.data.user?.userId} token=${providerToken.slice(0, 20)}...`);
    } else {
      recordIssue('StepFailed', 'Step03/演示登录', `bizCode=${r.bizCode} "${r.message}"`);
    }
  }

  // ────────────────────────────────────────────────
  // Step 04 发布需求 (客户 X-User-Id: 1001)
  // ────────────────────────────────────────────────
  log(4, `发布拍摄需求 POST /demands (客户 X-User-Id: ${CUSTOMER_ID})`);
  {
    const r = await api('POST', '/demands', {
      userId: CUSTOMER_ID,
      body: {
        scene: 'PORTRAIT', styleTags: ['vintage', 'natural'],
        expectedDate: '2026-06-15', timeSlot: 'AFTERNOON',
        cityCode: 'nanjing', location: '南京大学鼓楼校区',
        budgetMinCent: 30000, budgetMaxCent: 80000,
        description: '冒烟测试：寻找校园人像摄影师',
      },
    });
    if (bizOk(r) && r.data?.demandId) {
      demandId = r.data.demandId;
      ok(`需求已发布 demandId=${demandId}`);
      assertField('Step04', r.data, 'demandId', 'scene', 'status');
    } else {
      recordIssue('StepFailed', 'Step04/发布需求',
        `bizCode=${r.bizCode} "${r.message}" data=${JSON.stringify(r.data)}`);
    }
  }
  if (!demandId) { skip('demandId 未获取，跳过后续步骤'); return finalize(); }

  // ────────────────────────────────────────────────
  // Step 05 服务方响应需求 (摄影师 X-User-Id: 2001)
  // ────────────────────────────────────────────────
  log(5, `服务方响应 POST /demands/${demandId}/responses (摄影师 X-User-Id: ${PROVIDER_ID})`);
  {
    const r = await api('POST', `/demands/${demandId}/responses`, {
      userId: PROVIDER_ID, asProvider: true,
      body: { providerProfileId: Number(PROVIDER_ID), message: '冒烟测试：可以承接', expectedPriceCent: 50000 },
    });
    if (bizOk(r) && r.data?.responseId) {
      responseId = r.data.responseId;
      ok(`响应已提交 responseId=${responseId}`);
      assertField('Step05', r.data, 'responseId', 'status');
    } else {
      recordIssue('StepFailed', 'Step05/服务方响应',
        `bizCode=${r.bizCode} "${r.message}" data=${JSON.stringify(r.data)}`);
    }
  }
  if (!responseId) { skip('responseId 未获取，跳过后续步骤'); return finalize(); }

  // ────────────────────────────────────────────────
  // Step 06 客户接受响应
  // ────────────────────────────────────────────────
  log(6, `客户接受响应 POST /demands/${demandId}/responses/${responseId}/accept`);
  let acceptResult;
  {
    const r = await api('POST', `/demands/${demandId}/responses/${responseId}/accept`, {
      userId: CUSTOMER_ID,
    });
    if (bizOk(r) && r.data) {
      acceptResult = r.data;
      ok(`响应已接受 customerId=${acceptResult.customerId} providerId=${acceptResult.providerId}`);
      assertField('Step06', acceptResult, 'responseId', 'demandId', 'customerId', 'providerId');
    } else {
      recordIssue('StepFailed', 'Step06/接受响应', `bizCode=${r.bizCode} "${r.message}"`);
    }
  }
  if (!acceptResult) { skip('acceptResult 未获取，跳过后续步骤'); return finalize(); }

  // ────────────────────────────────────────────────
  // Step 07 创建对话
  // ────────────────────────────────────────────────
  log(7, 'POST /conversations/from-response 创建对话');
  {
    const r = await api('POST', '/conversations/from-response', {
      userId: CUSTOMER_ID,
      body: {
        responseId:    acceptResult.responseId,
        demandId:      acceptResult.demandId,
        customerId:    acceptResult.customerId,
        providerUserId: acceptResult.providerId,
        status:        acceptResult.responseStatus || 'ACCEPTED',
      },
    });
    if (bizOk(r) && r.data?.conversationId) {
      conversationId = r.data.conversationId;
      ok(`对话已创建 conversationId=${conversationId}`);
    } else {
      recordIssue('StepFailed', 'Step07/创建对话',
        `bizCode=${r.bizCode} "${r.message}" data=${JSON.stringify(r.data)}`);
    }
  }
  if (!conversationId) { skip('conversationId 未获取，跳过后续步骤'); return finalize(); }

  // ────────────────────────────────────────────────
  // Step 08 摄影师发送报价
  // ────────────────────────────────────────────────
  log(8, `摄影师发送报价 POST /quotations (X-User-Id: ${PROVIDER_ID})`);
  {
    const now = new Date();
    const fmt = d => d.toISOString().replace('Z', '').slice(0, 19);
    const r = await api('POST', '/quotations', {
      userId: PROVIDER_ID,
      body: {
        conversationId,
        amountCent: 50000,
        shootStartTime:   fmt(new Date(now.getTime() + 7  * 86400000)),
        shootEndTime:     fmt(new Date(now.getTime() + 7  * 86400000 + 3 * 3600000)),
        location:         '南京大学鼓楼校区',
        serviceContent:   '全程拍摄含后期修片',
        originalCount:    200, refinedCount: 30,
        deliveryDeadline: fmt(new Date(now.getTime() + 14 * 86400000)),
        photoUsageScope:  '个人使用',
        terms:            '冒烟测试条款',
        contractTerms:    '无特殊条款',
        safetyNoticeVersion: 'v1.0',
        expireTime:       fmt(new Date(now.getTime() + 24 * 3600000)),
        remark:           '冒烟测试报价',
      },
    });
    if (bizOk(r) && r.data?.quotationId) {
      quoteId = r.data.quotationId;
      ok(`报价已提交 quoteId=${quoteId} 金额=${r.data.amountCent}分`);
      assertField('Step08', r.data, 'quotationId', 'amountCent', 'status');
    } else {
      recordIssue('StepFailed', 'Step08/发送报价',
        `bizCode=${r.bizCode} "${r.message}" data=${JSON.stringify(r.data)}`);
    }
  }
  if (!quoteId) { skip('quoteId 未获取，跳过后续步骤'); return finalize(); }

  // ────────────────────────────────────────────────
  // Step 09 客户确认报价 → 生成订单
  // ────────────────────────────────────────────────
  log(9, `确认报价 POST /quotations/${quoteId}/confirm → 生成订单`);
  {
    const r = await api('POST', `/quotations/${quoteId}/confirm`, {
      userId: CUSTOMER_ID,
      body: { confirmRemark: '冒烟测试：确认报价' },
    });
    if (bizOk(r) && r.data?.orderId) {
      orderId = r.data.orderId;
      ok(`报价确认 orderId=${orderId} orderStatus=${r.data.orderStatus}`);
      assertField('Step09', r.data, 'orderId', 'orderStatus', 'quotationId');
    } else {
      recordIssue('StepFailed', 'Step09/确认报价',
        `bizCode=${r.bizCode} "${r.message}" data=${JSON.stringify(r.data)}`);
    }
  }
  if (!orderId) { skip('orderId 未获取，跳过后续步骤'); return finalize(); }

  // ────────────────────────────────────────────────
  // Step 10 模拟支付
  // ────────────────────────────────────────────────
  log(10, `模拟支付 POST /orders/${orderId}/payments`);
  {
    const r = await api('POST', `/orders/${orderId}/payments`, {
      userId: CUSTOMER_ID,
      body: { payMethod: 'MOCK_PAY', amountCent: 50000 },
    });
    if (bizOk(r) && r.data) {
      ok(`支付成功 orderStatus=${r.data.orderStatus} paymentId=${r.data.paymentId}`);
      assertField('Step10', r.data, 'orderStatus', 'paymentId');
    } else {
      recordIssue('StepFailed', 'Step10/模拟支付', `bizCode=${r.bizCode} "${r.message}"`);
    }
  }

  // ────────────────────────────────────────────────
  // Step 11 开始拍摄 PAID_PENDING_SHOOT → SHOOTING
  // ────────────────────────────────────────────────
  log(11, `开始拍摄 → SHOOTING (摄影师 X-User-Id: ${PROVIDER_ID})`);
  {
    const r = await api('POST', `/orders/${orderId}/status-transitions`, {
      userId: PROVIDER_ID,
      body: { targetStatus: 'SHOOTING', reason: '冒烟测试：开始拍摄' },
    });
    if (bizOk(r)) ok('状态 → SHOOTING');
    else recordIssue('StepFailed', 'Step11/开始拍摄', `bizCode=${r.bizCode} "${r.message}"`);
  }

  // ────────────────────────────────────────────────
  // Step 12 拍摄完成 SHOOTING → PENDING_DELIVERY
  // ────────────────────────────────────────────────
  log(12, '拍摄完成 → PENDING_DELIVERY (摄影师)');
  {
    const r = await api('POST', `/orders/${orderId}/status-transitions`, {
      userId: PROVIDER_ID,
      body: { targetStatus: 'PENDING_DELIVERY', reason: '冒烟测试：拍摄完成' },
    });
    if (bizOk(r)) ok('状态 → PENDING_DELIVERY');
    else recordIssue('StepFailed', 'Step12/拍摄完成', `bizCode=${r.bizCode} "${r.message}"`);
  }

  // ────────────────────────────────────────────────
  // Step 13 上传交付照片
  //
  // 使用 Authorization: Bearer <providerToken>
  // COrderHttpAdapter 会把此 token 转发给内部 GET /orders/{id} 调用
  // ────────────────────────────────────────────────
  log(13, `上传交付 POST /orders/${orderId}/deliveries (Authorization: Bearer providerToken)`);
  {
    const authOpt = providerToken ? { token: providerToken } : { userId: PROVIDER_ID };
    const fakePhoto = Buffer.from('[smoke-test-delivery-2026]', 'utf8');
    const r = await uploadFile(`/orders/${orderId}/deliveries`, fakePhoto, 'smoke_delivery.jpg', authOpt);
    if (r.bizCode === 200 && r.data) {
      ok(`交付已上传 deliveryId=${r.data.deliveryId} orderStatus=${r.data.orderStatus}`);
      // DeliveryService 内部已调用 changeStatus → DELIVERED_PENDING_CONFIRM
    } else {
      recordIssue('StepFailed', 'Step13/上传交付',
        `bizCode=${r.bizCode} "${r.data?.message || ''}" — 如为40401，检查 camera.order.adapter=c-http 配置`);
    }
  }

  // ────────────────────────────────────────────────
  // Step 14 确认收货 DELIVERED_PENDING_CONFIRM → COMPLETED
  // (DeliveryService 已在 Step13 内部将状态推至 DELIVERED_PENDING_CONFIRM)
  // ────────────────────────────────────────────────
  log(14, `确认收货 → COMPLETED (客户 X-User-Id: ${CUSTOMER_ID})`);
  {
    const r = await api('POST', `/orders/${orderId}/status-transitions`, {
      userId: CUSTOMER_ID,
      body: { targetStatus: 'COMPLETED', reason: '冒烟测试：客户确认满意' },
    });
    if (bizOk(r)) ok('订单 → COMPLETED');
    else recordIssue('StepFailed', 'Step14/确认收货', `bizCode=${r.bizCode} "${r.message}"`);
  }

  // ────────────────────────────────────────────────
  // Step 15 客户评价
  //
  // 使用 Authorization: Bearer <customerToken>
  // COrderHttpAdapter 会转发此 token 查询订单
  // ────────────────────────────────────────────────
  log(15, `客户评价 POST /orders/${orderId}/reviews (Authorization: Bearer customerToken)`);
  {
    const authOpt = customerToken ? { token: customerToken } : { userId: CUSTOMER_ID };
    const r = await api('POST', `/orders/${orderId}/reviews`, {
      ...authOpt,
      body: { rating: 5, content: '冒烟测试评价：服务非常好，照片质量很高！' },
    });
    if (bizOk(r) && r.data) {
      ok(`评价成功 rating=${r.data.rating} reviewId=${r.data.id ?? r.data.reviewId ?? '?'}`);
      assertField('Step15', r.data, 'rating', 'content');
    } else {
      recordIssue('StepFailed', 'Step15/客户评价',
        `bizCode=${r.bizCode} "${r.message}"`);
    }
  }

  finalize();
}

// ─────────────────────────────────────────
// 写出问题报告
// ─────────────────────────────────────────
function finalize() {
  const total    = issues.length;
  const fatal    = issues.filter(i => i.type === 'HTTP_500_Fatal' || i.type === 'NetworkError' || i.type === 'ServerUnavailable');
  const blocking = issues.filter(i => i.type === 'StepFailed');
  const nonBlock = issues.filter(i => !fatal.includes(i) && !blocking.includes(i));

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  测试完成 — 合计 ${total} 个问题`);
  console.log(`  致命: ${fatal.length}  阻断: ${blocking.length}  非阻断/警告: ${nonBlock.length}`);
  console.log('═══════════════════════════════════════════════════\n');

  const runAt = new Date().toLocaleString('zh-CN');

  if (total === 0) {
    fs.writeFileSync(ISSUES_FILE,
      `# Smoke Test Issues\n\n**运行时间:** ${runAt}\n\n**结果: ✅ 全部 15 步骤通过，无任何问题！**\n`, 'utf8');
    console.log('✅ 冒烟测试全部通过！全链路已闭环。');
    return;
  }

  const lines = [
    `# Smoke Test Issues`,
    ``,
    `**运行时间:** ${runAt}`,
    `**发现问题数:** ${total}（致命 ${fatal.length} / 阻断 ${blocking.length} / 非阻断 ${nonBlock.length}）`,
    ``,
    `> - **致命**：HTTP 500 / 网络不可达`,
    `> - **阻断**：业务步骤失败，流程中断`,
    `> - **非阻断**：业务错误、字段缺失、警告`,
    ``,
    `---`,
    ``,
    `| # | 问题类型 | 发生步骤 | 错误详情 |`,
    `|---|---------|---------|---------|`,
  ];
  issues.forEach((iss, i) => {
    const detail = iss.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 200);
    lines.push(`| ${i + 1} | \`${iss.type}\` | ${iss.step} | ${detail} |`);
  });
  lines.push('', '---', '', '## 详细说明', '');
  issues.forEach((iss, i) => {
    lines.push(
      `### #${i + 1} — ${iss.type}`,
      `- **步骤:** ${iss.step}`,
      `- **时间:** ${iss.time}`,
      `- **详情:**`,
      '  ```',
      iss.detail.slice(0, 600),
      '  ```',
      ''
    );
  });

  fs.writeFileSync(ISSUES_FILE, lines.join('\n'), 'utf8');
  console.log(`📋 问题报告已写入: ${ISSUES_FILE}`);

  if (fatal.length)    { console.log(`\n❌ 致命 (${fatal.length}):`);    fatal.forEach(i    => console.log(`   ✗ [${i.type}] ${i.step}: ${i.detail.slice(0,120)}`)); }
  if (blocking.length) { console.log(`\n🔴 阻断 (${blocking.length}):`); blocking.forEach(i  => console.log(`   ✗ ${i.step}: ${i.detail.slice(0,120)}`)); }
  if (nonBlock.length) { console.log(`\n⚠️  非阻断 (${nonBlock.length}):`); nonBlock.forEach(i  => console.log(`   ⚠ [${i.type}] ${i.step}: ${i.detail.slice(0,120)}`)); }
}

// ─────────────────────────────────────────
// 入口
// ─────────────────────────────────────────
runSmokeTest().catch(err => {
  if (err.message.startsWith('FATAL_500') || err.message.startsWith('NETWORK_ERROR')) {
    console.error(`\n❌ 测试因致命错误中断: ${err.message}`);
  } else {
    console.error('\n❌ 测试框架异常:', err);
  }
  finalize();
  process.exit(1);
});
