import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_CAPABILITIES,
  ADMIN_NAV_ITEMS,
  getAdminActiveKey,
  getLegacyAdminTarget,
  resolveNavbarActivePath
} from '../src/pages/admin/adminSurfaceConfig.js'
import {
  buildAdminDashboardStats,
  filterAdminMoments,
  normalizeAdminHallItems,
  parseExactUserId
} from '../src/pages/admin/adminData.js'

test('admin navigation uses the approved order and routes', () => {
  assert.deepEqual(
    ADMIN_NAV_ITEMS.map(({ label, path }) => [label, path]),
    [
      ['大厅', '/admin/hall'],
      ['动态', '/admin/feed'],
      ['用户', '/admin/users'],
      ['举报', '/admin/reports'],
      ['审核', '/admin/certifications'],
      ['申诉', '/admin/complaints'],
      ['概览', '/admin']
    ]
  )
})

test('nested admin paths select one admin navigation item', () => {
  assert.equal(getAdminActiveKey('/admin/users/42'), 'users')
  assert.equal(getAdminActiveKey('/admin/complaints'), 'complaints')
  assert.equal(getAdminActiveKey('/admin'), 'dashboard')
})

test('admin route matching never maps ordinary platform paths', () => {
  assert.equal(getAdminActiveKey('/hall'), 'dashboard')
  assert.equal(getAdminActiveKey('/feed'), 'dashboard')
  assert.equal(getAdminActiveKey('/users/42'), 'dashboard')
})

test('admin navbar resolves active state from location pathname', () => {
  assert.equal(resolveNavbarActivePath({
    adminSurface: true,
    locationPathname: '/admin/feed',
    activePath: '/admin'
  }), '/admin/feed')
})

test('ordinary navbar continues to resolve active state from activePath', () => {
  assert.equal(resolveNavbarActivePath({
    adminSurface: false,
    locationPathname: '/users/42',
    activePath: '/profile'
  }), '/profile')
})

test('legacy admin tabs map to product routes and preserve demo mode', () => {
  assert.equal(getLegacyAdminTarget('?tab=certifications&demo=1'), '/admin/certifications?demo=1')
  assert.equal(getLegacyAdminTarget('?tab=complaints'), '/admin/complaints')
  assert.equal(getLegacyAdminTarget('?demo=1'), '')
})

test('unsupported moderation capabilities are never marked available', () => {
  assert.equal(ADMIN_CAPABILITIES.takeDownHallItem.available, false)
  assert.equal(ADMIN_CAPABILITIES.restoreMoment.available, false)
  assert.equal(ADMIN_CAPABILITIES.resolveReport.message, '接口待接入')
})

test('public hall records receive only public status', () => {
  assert.deepEqual(
    normalizeAdminHallItems([{ demandId: 7, title: '约拍' }], [{ serviceId: 8, title: '橱窗' }]),
    [
      { type: 'demand', id: 7, status: 'PUBLIC', record: { demandId: 7, title: '约拍' } },
      { type: 'service', id: 8, status: 'PUBLIC', record: { serviceId: 8, title: '橱窗' } }
    ]
  )
})

test('moment search matches title content and hydrated author name', () => {
  const moments = [
    { momentId: 1, authorId: 10, title: '夜景', content: '南京城墙' },
    { momentId: 2, authorId: 11, title: '早餐', content: '咖啡' }
  ]
  const profiles = { 10: { nickname: '林摄影' }, 11: { nickname: '周同学' } }
  assert.deepEqual(filterAdminMoments(moments, profiles, '林摄影').map(item => item.momentId), [1])
  assert.deepEqual(filterAdminMoments(moments, profiles, '咖啡').map(item => item.momentId), [2])
})

test('user lookup accepts positive integer ids only', () => {
  assert.equal(parseExactUserId('42'), 42)
  assert.equal(parseExactUserId('0'), null)
  assert.equal(parseExactUserId('abc'), null)
})

test('unknown dashboard values remain unknown instead of becoming zero', () => {
  const stats = buildAdminDashboardStats({ totalUsers: 12, pendingAuditCount: 3, pendingArbitrationCount: 2 })
  assert.equal(stats.find(item => item.key === 'reports').value, null)
  assert.equal(stats.find(item => item.key === 'removed').value, null)
})
