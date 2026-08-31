function publicHallItem(type, id, record) {
  return { type, id, status: 'PUBLIC', record }
}

export function normalizeAdminHallItems(demands = [], services = []) {
  return [
    ...demands.map(record => publicHallItem('demand', record.demandId, record)),
    ...services.map(record => publicHallItem('service', record.serviceId, record))
  ]
}

export function buildAdminHallRequestParams(keyword = '') {
  const normalizedKeyword = String(keyword).trim()
  const keywordParam = normalizedKeyword ? { keyword: normalizedKeyword } : {}
  return {
    demands: { page: 1, size: 20, status: 'OPEN', ...keywordParam },
    services: { page: 1, size: 20, ...keywordParam }
  }
}

export function buildAdminFeedRequestParams() {
  return { scope: 'latest' }
}

export function filterAdminMoments(moments = [], profiles = {}, keyword = '', authorId = null) {
  const normalizedAuthorId = Number(authorId)
  const authorMoments = Number.isSafeInteger(normalizedAuthorId) && normalizedAuthorId > 0
    ? moments.filter(moment => Number(moment.authorId) === normalizedAuthorId)
    : moments
  const normalizedKeyword = String(keyword).trim().toLocaleLowerCase('zh-CN')
  if (!normalizedKeyword) return authorMoments

  return authorMoments.filter(moment => {
    const authorName = profiles[moment.authorId]?.nickname || ''
    return [authorName, moment.title, moment.content]
      .some(value => String(value || '').toLocaleLowerCase('zh-CN').includes(normalizedKeyword))
  })
}

export function parseExactUserId(value) {
  const normalized = String(value ?? '').trim()
  if (!/^\d+$/.test(normalized)) return null

  const userId = Number(normalized)
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null
}

function adminUserFact(key, label, value, helper = '', unavailableHelper = '接口待接入') {
  const available = value !== null && value !== undefined
  return {
    key,
    label,
    value: available ? value : null,
    displayValue: available ? String(value) : '—',
    helper: available ? helper : unavailableHelper,
    available
  }
}

export function buildAdminUserFacts(user = {}, credit, contentCount = 0) {
  const creditScore = credit?.creditScore ?? credit?.score ?? null
  const normalizedContentCount = contentCount === null || contentCount === undefined
    ? null
    : (Number.isFinite(Number(contentCount)) ? Number(contentCount) : null)
  return [
    adminUserFact('userId', '用户 ID', user?.userId ?? user?.id ?? null),
    adminUserFact('role', '当前角色', user?.currentRole ?? user?.role ?? null),
    adminUserFact('creditScore', '信用分', creditScore, '', '公开信用暂不可用'),
    adminUserFact('contentCount', '公开动态', normalizedContentCount, '', '公开动态暂不可用'),
    adminUserFact('accountStatus', '账号状态', null),
    adminUserFact('certificationStatus', '认证管理状态', null),
    adminUserFact('reportCount', '举报次数', null),
    adminUserFact('handlingRecords', '处理记录', null)
  ]
}

export function buildCertificationReviewBody(result, reason = '') {
  const normalizedResult = String(result || '').trim().toUpperCase()
  if (!['APPROVED', 'REJECTED'].includes(normalizedResult)) {
    throw new Error('认证审核结果无效')
  }

  const normalizedReason = String(reason || '').trim()
  if (normalizedResult === 'REJECTED' && !normalizedReason) {
    throw new Error('请填写驳回原因')
  }

  return { result: normalizedResult, reason: normalizedReason }
}

export function buildCertificationListQueries(type = 'ALL', status = 'PENDING') {
  const normalizedType = String(type || 'ALL').trim().toUpperCase()
  const normalizedStatus = String(status || 'PENDING').trim().toUpperCase()
  const types = normalizedType === 'ALL'
    ? ['REAL_NAME', 'STUDENT']
    : [normalizedType]

  return types.map((certificationType) => ({
    type: certificationType,
    ...(normalizedStatus === 'PENDING' ? {} : { status: normalizedStatus }),
  }))
}

export function shouldUseAdminDemoFixtures(isDev, search = '') {
  return Boolean(isDev) && new URLSearchParams(search).get('demo') === '1'
}

export async function loadCertificationSource({ demoMode, loadReal, loadDemo }) {
  return demoMode ? loadDemo() : loadReal()
}

function formatCount(value) {
  return value === null ? '—' : new Intl.NumberFormat('zh-CN').format(value)
}

function formatYuanFromCent(value) {
  if (value === null) return '—'
  const yuan = Number(value) / 100
  const hasFraction = Number(value) % 100 !== 0
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0
  }).format(yuan)
}

function dashboardStat({ key, label, value, helper, path, currency = false }) {
  const available = value !== null
  return {
    key,
    label,
    value,
    displayValue: currency ? formatYuanFromCent(value) : formatCount(value),
    helper: available ? helper : '接口待接入',
    path,
    available
  }
}

export function buildAdminDashboardStats(data = {}) {
  return [
    dashboardStat({ key: 'users', label: '平台用户', value: data.totalUsers ?? null, helper: '平台累计注册用户', path: '/admin/users' }),
    dashboardStat({ key: 'gmv', label: '今日成交', value: data.todayGmvCent ?? null, helper: '今日已完成订单金额', path: '/admin', currency: true }),
    dashboardStat({ key: 'certifications', label: '待审核认证', value: data.pendingAuditCount ?? null, helper: '等待管理员审核', path: '/admin/certifications' }),
    dashboardStat({ key: 'complaints', label: '待处理申诉', value: data.pendingArbitrationCount ?? null, helper: '等待管理员处理', path: '/admin/complaints' }),
    dashboardStat({ key: 'reports', label: '待处理举报', value: null, helper: '', path: '/admin/reports' }),
    dashboardStat({ key: 'removed', label: '已下架内容', value: null, helper: '', path: '/admin/hall' })
  ]
}
