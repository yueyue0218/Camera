export const ADMIN_NAV_ITEMS = [
  { label: '大厅', path: '/admin/hall', key: 'hall' },
  { label: '动态', path: '/admin/feed', key: 'feed' },
  { label: '用户', path: '/admin/users', key: 'users' },
  { label: '举报', path: '/admin/reports', key: 'reports' },
  { label: '审核', path: '/admin/certifications', key: 'certifications' },
  { label: '申诉', path: '/admin/complaints', key: 'complaints' },
  { label: '概览', path: '/admin', key: 'dashboard' }
]

const available = { available: true, message: '' }

export const ADMIN_CAPABILITIES = {
  listHallItems: available,
  takeDownHallItem: available,
  restoreHallItem: available,
  listMoments: available,
  takeDownMoment: available,
  restoreMoment: available,
  listUsers: available,
  getUserAdminProfile: available,
  updateUserStatus: available,
  listReports: available,
  getReport: available,
  resolveReport: available
}

export function getAdminActiveKey(pathname = '') {
  const match = ADMIN_NAV_ITEMS.find(item => (
    item.path !== '/admin'
    && (pathname === item.path || pathname.startsWith(`${item.path}/`))
  ))
  return match?.key || 'dashboard'
}

export function resolveNavbarActivePath({ adminSurface = false, locationPathname = '', activePath = '' } = {}) {
  return adminSurface ? (locationPathname || activePath) : activePath
}

export function getLegacyAdminTarget(search = '') {
  const params = new URLSearchParams(search)
  const route = {
    certifications: '/admin/certifications',
    complaints: '/admin/complaints'
  }[params.get('tab')]

  if (!route) return ''
  return params.get('demo') === '1' ? `${route}?demo=1` : route
}
