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

test('hall filtering never invents removed or reported records', () => {
  const items = normalizeAdminHallItems([{ demandId: 1 }], [{ serviceId: 2 }])
  assert.deepEqual(items.filter(item => item.type === 'demand').map(item => item.id), [1])
  assert.deepEqual(items.filter(item => item.status === 'REMOVED'), [])
  assert.deepEqual(items.filter(item => item.status === 'REPORTED'), [])
})

test('admin hall request params stay on public read-only lists', async () => {
  const adminData = await import('../src/pages/admin/adminData.js')
  assert.equal(typeof adminData.buildAdminHallRequestParams, 'function')
  assert.deepEqual(adminData.buildAdminHallRequestParams('  夜景  '), {
    demands: { page: 1, size: 20, status: 'OPEN', keyword: '夜景' },
    services: { page: 1, size: 20, keyword: '夜景' }
  })
})

test('admin hall cards expose only read-only navigation and disabled moderation', async () => {
  const previousWindow = globalThis.window
  globalThis.window = { location: { hostname: 'localhost' } }
  const { createServer } = await import('vite')
  const vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })

  try {
    await assert.doesNotReject(async () => {
      const { AdminHallCard } = await vite.ssrLoadModule('/src/pages/admin/components/AdminHallCard.jsx')
      const [{ createElement }, { renderToStaticMarkup }, { MemoryRouter }] = await Promise.all([
        import('react'),
        import('react-dom/server'),
        import('react-router-dom')
      ])
      const markup = renderToStaticMarkup(createElement(
        MemoryRouter,
        null,
        createElement(AdminHallCard, {
          item: {
            type: 'demand',
            id: 7,
            status: 'PUBLIC',
            record: { demandId: 7, customerId: 42, title: '夜景约拍', description: '城墙边拍摄' }
          },
          currentUser: { userId: 1, role: 'ADMIN' },
          onOpen: () => {},
          onOpenPublisher: () => {}
        })
      ))

      assert.match(markup, /公开展示/)
      assert.match(markup, />查看详情<\/button>/)
      assert.match(markup, />查看发布者<\/button>/)
      assert.match(markup, /<button[^>]*disabled=""[^>]*>下架<\/button>/)
      assert.match(markup, /<button[^>]*disabled=""[^>]*>恢复展示<\/button>/)
      assert.equal((markup.match(/接口待接入/g) || []).length, 2)
      assert.doesNotMatch(markup, /<button[^>]*>(?:响应|预约|编辑|发布)[^<]*<\/button>/)
    })
  } finally {
    await vite.close()
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
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

test('admin feed can narrow public moments to one author id', () => {
  const moments = [{ momentId: 1, authorId: 10 }, { momentId: 2, authorId: 11 }]
  assert.deepEqual(filterAdminMoments(moments, {}, '', 11).map(item => item.momentId), [2])
})

test('admin feed request params stay on the public latest list', async () => {
  const adminData = await import('../src/pages/admin/adminData.js')
  assert.equal(typeof adminData.buildAdminFeedRequestParams, 'function')
  assert.deepEqual(adminData.buildAdminFeedRequestParams(), { scope: 'latest' })
})

test('admin moment cards keep engagement read-only and moderation disabled', async () => {
  const { createServer } = await import('vite')
  const vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })

  try {
    const { AdminMomentCard } = await vite.ssrLoadModule('/src/pages/admin/components/AdminMomentCard.jsx')
    const [{ createElement }, { renderToStaticMarkup }] = await Promise.all([
      import('react'),
      import('react-dom/server')
    ])
    const markup = renderToStaticMarkup(createElement(AdminMomentCard, {
      moment: {
        momentId: 8,
        authorId: 42,
        authorRole: 'PROVIDER',
        title: '雨夜胶片',
        content: '记录城市里的蓝色时刻。',
        imageDataList: ['https://example.test/rain.jpg'],
        likeCount: 12,
        favoriteCount: 3,
        createdAt: '2026-08-30T12:00:00Z'
      },
      author: { nickname: '林摄影', avatarData: '' },
      onOpen: () => {},
      onOpenAuthor: () => {}
    }))

    assert.match(markup, /No\. 000008/)
    assert.match(markup, /林摄影/)
    assert.match(markup, /雨夜胶片/)
    assert.match(markup, /12 个赞/)
    assert.match(markup, /3 个收藏/)
    assert.match(markup, /<img[^>]*width="640"[^>]*height="360"[^>]*loading="lazy"/)
    assert.match(markup, />查看详情<\/button>/)
    assert.match(markup, />查看作者<\/button>/)
    assert.match(markup, /<button[^>]*disabled=""[^>]*>下架动态<\/button>/)
    assert.match(markup, /<button[^>]*disabled=""[^>]*>恢复展示<\/button>/)
    assert.equal((markup.match(/接口待接入/g) || []).length, 2)
    assert.doesNotMatch(markup, /<button[^>]*>(?:点赞|收藏|关注|编辑|删除)[^<]*<\/button>/)
  } finally {
    await vite.close()
  }
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

test('dashboard stats distinguish real zero from unavailable data', () => {
  const stats = buildAdminDashboardStats({
    totalUsers: 0,
    todayGmvCent: 238800,
    pendingAuditCount: 0,
    pendingArbitrationCount: 1
  })
  assert.equal(stats.find(item => item.key === 'users').value, 0)
  assert.equal(stats.find(item => item.key === 'gmv').displayValue, '¥2,388')
  assert.equal(stats.find(item => item.key === 'reports').value, null)
})

test('shared admin controls preserve disabled moderation contracts', async () => {
  const { createServer } = await import('vite')
  const vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })

  try {
    await assert.doesNotReject(async () => {
      const { AdminActionBar } = await vite.ssrLoadModule('/src/pages/admin/components/AdminActionBar.jsx')
      const { AdminStatCard } = await vite.ssrLoadModule('/src/pages/admin/components/AdminStatCard.jsx')
      const { ModerationReasonDialog } = await vite.ssrLoadModule('/src/pages/admin/components/ModerationReasonDialog.jsx')
      const requiredModules = [
        '/src/pages/admin/components/AdminModeBanner.jsx',
        '/src/pages/admin/components/AdminStatusTag.jsx',
        '/src/pages/admin/components/AdminEmptyState.jsx'
      ]
      await Promise.all(requiredModules.map(path => vite.ssrLoadModule(path)))

      const actionBar = AdminActionBar({
        actions: [{
          key: 'remove',
          label: '下架',
          disabled: true,
          hint: '接口待接入',
          onClick: () => assert.fail('disabled admin action must not run')
        }]
      })
      const [actionItem] = actionBar.props.children
      const [button, hint] = actionItem.props.children
      assert.equal(button.props.disabled, true)
      assert.equal(button.props.onClick, undefined)
      assert.equal(hint.props.children, '接口待接入')

      const [{ createElement }, { renderToStaticMarkup }, { MemoryRouter }] = await Promise.all([
        import('react'),
        import('react-dom/server'),
        import('react-router-dom')
      ])
      const statMarkup = renderToStaticMarkup(createElement(
        MemoryRouter,
        null,
        createElement(AdminStatCard, {
          stat: { label: '平台用户', displayValue: '0', helper: '真实值', available: true },
          to: '/admin/users'
        })
      ))
      assert.match(statMarkup, /href="\/admin\/users"/)

      const dialog = ModerationReasonDialog({
        open: true,
        title: '确认下架',
        description: '请填写原因',
        value: '   ',
        onChange: () => {},
        onCancel: () => {},
        onConfirm: () => {},
        submitting: false,
        required: true
      })
      assert.equal(dialog.props['data-confirm-disabled'], true)
    })
  } finally {
    await vite.close()
  }
})

test('reserved admin api methods throw endpoint-pending errors without fetching', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const { createServer } = await import('vite')
  const vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  globalThis.window = { location: { hostname: 'localhost' } }
  let fetchCalled = false
  globalThis.fetch = async () => { fetchCalled = true }

  try {
    const { adminApi } = await vite.ssrLoadModule('/src/api/adminApi.js')
    const cases = [
      [() => adminApi.listReports({}, {}), '/admin/reports'],
      [() => adminApi.takeDownMoment(8, { reason: '违规' }, {}), '/admin/moments/8/take-down'],
      [() => adminApi.listHallItems({}, {}), '/admin/hall-items'],
      [() => adminApi.takeDownHallItem('demand', 7, { reason: '违规' }, {}), '/admin/hall-items/demand/7/take-down'],
      [() => adminApi.restoreHallItem('service', 9, {}, {}), '/admin/hall-items/service/9/restore'],
      [() => adminApi.listMoments({}, {}), '/admin/moments'],
      [() => adminApi.restoreMoment(8, {}, {}), '/admin/moments/8/restore'],
      [() => adminApi.listUsers({}, {}), '/admin/users'],
      [() => adminApi.getUserAdminProfile(42, {}), '/admin/users/42'],
      [() => adminApi.resolveReport(6, { resolution: 'dismissed' }, {}), '/admin/reports/6/resolve']
    ]

    for (const [invoke, path] of cases) {
      assert.throws(invoke, new RegExp(`后端接口待接入：${path}`))
    }
    assert.equal(fetchCalled, false)
  } finally {
    await vite.close()
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousFetch === undefined) delete globalThis.fetch
    else globalThis.fetch = previousFetch
  }
})
