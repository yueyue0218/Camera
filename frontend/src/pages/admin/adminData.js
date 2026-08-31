function publicHallItem(type, id, record) {
  return { type, id, status: 'PUBLIC', record }
}

export function normalizeAdminHallItems(demands = [], services = []) {
  return [
    ...demands.map(record => publicHallItem('demand', record.demandId, record)),
    ...services.map(record => publicHallItem('service', record.serviceId, record))
  ]
}

export function filterAdminMoments(moments = [], profiles = {}, keyword = '') {
  const normalizedKeyword = String(keyword).trim().toLocaleLowerCase('zh-CN')
  if (!normalizedKeyword) return moments

  return moments.filter(moment => {
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
