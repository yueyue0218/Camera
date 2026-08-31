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

export function buildAdminDashboardStats(data = {}) {
  return [
    { key: 'users', label: '平台用户', value: data.totalUsers ?? null, path: '/admin/users' },
    { key: 'gmv', label: '今日成交', value: data.todayGmvCent ?? null, path: '/admin' },
    { key: 'certifications', label: '待审核认证', value: data.pendingAuditCount ?? null, path: '/admin/certifications' },
    { key: 'complaints', label: '待处理申诉', value: data.pendingArbitrationCount ?? null, path: '/admin/complaints' },
    { key: 'reports', label: '待处理举报', value: null, path: '/admin/reports', available: false },
    { key: 'removed', label: '已下架内容', value: null, path: '/admin/hall', available: false }
  ]
}
