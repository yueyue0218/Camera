import assert from 'node:assert/strict'
import test, { before, after, afterEach } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'DocumentFragment', 'ShadowRoot', 'CustomEvent', 'Event', 'MouseEvent', 'localStorage']) globalThis[key] = dom.window[key]
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.getComputedStyle = dom.window.getComputedStyle
globalThis.ResizeObserver = class { observe() {} disconnect() {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createElement: h } = await import('react')
const { render, cleanup, fireEvent, screen, waitFor } = await import('@testing-library/react')
const { MemoryRouter, Routes, Route } = await import('react-router-dom')
let vite, calls = [], reportResponse
const viewer = { userId: 11, role: 'CUSTOMER', token: 'test-access' }
function response(data, code = 200, message = 'success') {
  return { ok: true, status: 200, text: async () => JSON.stringify({ code, data, message }) }
}
function installFetch(ownerId = 21) {
  calls = []
  reportResponse = () => response({ reportId: 81, status: 'PENDING' })
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname
    calls.push({ path, options })
    if (path === '/reports') return reportResponse()
    if (path === '/auth/refresh') return response({ ...viewer, nickname: '测试用户' })
    if (path === '/demands/123') return response({ demandId: 123, customerId: ownerId, scene: '需求标题', status: 'OPEN', styleTags: [], imageFileIds: [] })
    if (path === '/service-packages/456') return response({ serviceId: 456, providerId: ownerId, title: '橱窗标题', status: 'ONLINE', images: [], portfolioIds: [] })
    if (path.endsWith('/public-profile')) return response({ userId: ownerId, nickname: '公开用户', currentRole: 'PROVIDER', providerProfile: {}, followedByCurrentUser: false })
    if (path.endsWith('/brief')) return response({ userId: ownerId, nickname: '发布者' })
    if (path.includes('credit')) return response({ creditScore: 80 })
    if (path.includes('interests')) return response({ records: [] })
    return response([])
  }
}
before(async () => { vite = await createServer({ root: new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } }) })
afterEach(() => { cleanup(); localStorage.clear() })
after(async () => { await vite.close(); dom.window.close() })
async function action(props = {}) {
  installFetch()
  const { ReportAction } = await vite.ssrLoadModule('/src/components/reports/ReportAction.jsx')
  render(h(ReportAction, { targetType: 'DEMAND', targetId: 123, ownerId: 21, currentUser: viewer, ...props }))
}
async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: '举报' }))
  return screen.findByRole('dialog', { name: '举报此内容' })
}
for (const [type, route, modulePath, exportName, id, title] of [
  ['DEMAND', '/demands/123', '/src/pages/hall/HallDetailPages.jsx', 'DemandDetailPage', 123, '需求标题'],
  ['SERVICE_PACKAGE', '/service-packages/456', '/src/pages/hall/HallDetailPages.jsx', 'ServicePackageDetailPage', 456, '橱窗标题'],
  ['USER', '/users/21', '/src/pages/profile/PublicProfilePage.jsx', 'PublicProfilePage', 21, '公开用户']
]) {
  async function page(ownerId) {
    installFetch(ownerId)
    const mod = await vite.ssrLoadModule(modulePath)
    const { AuthProvider, useAuth } = await vite.ssrLoadModule('/src/AuthContext.jsx')
    function Ready() { return useAuth().currentUser ? h(mod[exportName]) : null }
    const location = type === 'USER' && ownerId === 11 ? '/users/11' : route
    const path = route.replace(/\/\d+$/, type === 'USER' ? '/:userId' : type === 'DEMAND' ? '/:demandId' : '/:serviceId')
    render(h(MemoryRouter, { initialEntries: [location] }, h(AuthProvider, null, h(Routes, null, h(Route, { path, element: h(Ready) }), h(Route, { path: '/profile', element: h('h1', null, '我的主页') })))))
  }
  test(type + ' page sends the real target id and preserves existing actions', async () => {
    await page(21)
    await screen.findByRole('heading', { name: title, level: 1 })
    assert.equal(screen.getAllByRole('button', { name: '更多操作' }).length, 1)
    if (type === 'USER') assert.ok(screen.getByRole('button', { name: '发消息' }))
    if (type === 'SERVICE_PACKAGE') assert.ok(screen.getByRole('button', { name: /意向/ }))
    await openDialog()
    fireEvent.click(screen.getByLabelText('虚假或误导性信息'))
    fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
    await screen.findByText('举报已提交，平台管理员将核查处理。')
    const request = calls.find(c => c.path === '/reports')
    assert.deepEqual(JSON.parse(request.options.body), { targetType: type, targetId: id, reason: '虚假或误导性信息', description: null })
    assert.equal(request.options.headers.Authorization, 'Bearer test-access')
  })
  test(type + ' hides self reporting', async () => {
    if (type === 'USER') { await page(11); await screen.findByRole('heading', { name: '我的主页' }) }
    else { await page(11); await screen.findByRole('heading', { name: title, level: 1 }); assert.ok(screen.getByRole('button', { name: '编辑' })) }
    assert.equal(screen.queryByRole('button', { name: '更多操作' }), null)
  })
}
test('invalid targets do not expose report operation', async () => {
  await action({ targetId: undefined })
  assert.equal(screen.queryByRole('button', { name: '更多操作' }), null)
})
test('cancel and Escape close the dialog and restore focus', async () => {
  await action()
  await openDialog()
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  await waitFor(() => assert.equal(screen.queryByRole('dialog') === null, true))
  await waitFor(() => assert.equal(document.activeElement === screen.getByRole('button', { name: '更多操作' }), true))
  await openDialog()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' })
  await waitFor(() => assert.equal(screen.queryByRole('dialog') === null, true))
  await waitFor(() => assert.equal(document.activeElement === screen.getByRole('button', { name: '更多操作' }), true))
})
test('requires a reason, rejects whitespace description and limits input to 1000', async () => {
  await action(); await openDialog()
  assert.equal(screen.getByRole('button', { name: '提交举报' }).disabled, true)
  fireEvent.click(screen.getByLabelText('其他违规行为'))
  const input = screen.getByLabelText('补充说明（选填）')
  assert.equal(input.maxLength, 1000)
  fireEvent.change(input, { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByText('补充说明不能只包含空白字符。')
  assert.equal(calls.filter(c => c.path === '/reports').length, 0)
  fireEvent.change(input, { target: { value: '字'.repeat(1001) } })
  assert.equal(input.value.length, 1000)
  assert.ok(screen.getByText('还可输入 0 字'))
})
test('pending submission blocks double clicks Escape and cancel; success closes', async () => {
  await action(); await openDialog()
  fireEvent.click(screen.getByLabelText('广告或垃圾信息'))
  let complete
  reportResponse = () => new Promise(resolve => { complete = resolve })
  const submit = screen.getByRole('button', { name: '提交举报' })
  fireEvent.click(submit); fireEvent.click(submit)
  assert.equal(calls.filter(c => c.path === '/reports').length, 1)
  assert.equal(screen.getByRole('button', { name: '提交中…' }).disabled, true)
  assert.equal(screen.getByRole('button', { name: '取消' }).disabled, true)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  assert.ok(screen.getByRole('dialog'))
  complete(response({ reportId: 81, status: 'PENDING' }))
  await screen.findByText('举报已提交，平台管理员将核查处理。')
  await waitFor(() => assert.equal(screen.queryByRole('dialog') === null, true))
})
for (const [code, message] of [
  [40902, '你已举报过此对象，平台正在处理中。'],
  [40401, '举报对象不存在或已无法访问。'],
  [40301, '你暂时无权举报此对象。'],
  [40001, '举报信息不符合要求，请检查后重试。'],
  [40101, '请先登录后再提交举报。']
]) test('error ' + code + ' preserves form and displays feedback', async () => {
  await action(); await openDialog()
  fireEvent.click(screen.getByLabelText('骚扰或不当行为'))
  fireEvent.change(screen.getByLabelText('补充说明（选填）'), { target: { value: '保留说明' } })
  reportResponse = () => response(null, code, 'server error')
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByText(message)
  assert.equal(screen.getByLabelText('补充说明（选填）').value, '保留说明')
  assert.equal(screen.getByLabelText('骚扰或不当行为').checked, true)
})
test('network failure preserves input and supports retry with trimmed description', async () => {
  await action(); await openDialog()
  fireEvent.click(screen.getByLabelText('侵权或盗用他人作品'))
  fireEvent.change(screen.getByLabelText('补充说明（选填）'), { target: { value: '  原作品链接  ' } })
  reportResponse = () => { throw new Error('offline') }
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByText('网络连接失败，请稍后重试。')
  assert.equal(screen.getByLabelText('补充说明（选填）').value, '  原作品链接  ')
  reportResponse = () => response({ reportId: 81, status: 'PENDING' })
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByText('举报已提交，平台管理员将核查处理。')
  assert.equal(JSON.parse(calls.filter(c => c.path === '/reports').at(-1).options.body).description, '原作品链接')
})
test('unauthenticated users get a login prompt without API request', async () => {
  await action({ currentUser: null }); await openDialog()
  await screen.findByText('请先登录后再提交举报。')
  assert.equal(screen.getByRole('button', { name: '提交举报' }).disabled, true)
  assert.equal(calls.filter(c => c.path === '/reports').length, 0)
})
test('refresh relies on server duplicate policy', async () => {
  await action(); await openDialog()
  fireEvent.click(screen.getByLabelText('其他违规行为'))
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByText('举报已提交，平台管理员将核查处理。')
  cleanup(); await action()
  reportResponse = () => response(null, 40902)
  await openDialog()
  fireEvent.click(screen.getByLabelText('其他违规行为'))
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByText('你已举报过此对象，平台正在处理中。')
})

async function routedPage(modulePath, exportName, path, location) {
  const mod = await vite.ssrLoadModule(modulePath)
  const { AuthProvider, useAuth } = await vite.ssrLoadModule('/src/AuthContext.jsx')
  const { useNavigate } = await import('react-router-dom')
  let navigate
  function Ready() { navigate = useNavigate(); return useAuth().currentUser ? h(mod[exportName]) : null }
  const { act } = await import('@testing-library/react')
  await act(async () => render(h(MemoryRouter, { initialEntries: [location] }, h(AuthProvider, null, h(Routes, null, h(Route, { path, element: h(Ready) }))))))
  return next => act(async () => navigate(next))
}

test('profile navigation failure cannot expose a report for the previous user', async () => {
  installFetch()
  const fetchBase = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname
    if (path === '/users/22/public-profile' || path === '/users/22/brief') return response(null, 40401, 'Not found')
    return fetchBase(url, options)
  }
  const navigate = await routedPage('/src/pages/profile/PublicProfilePage.jsx', 'PublicProfilePage', '/users/:userId', '/users/21')
  await screen.findByRole('heading', { name: '公开用户', level: 1 })
  assert.ok(screen.getByRole('button', { name: '更多操作' }))
  await navigate('/users/22')
  await screen.findByRole('heading', { name: '公开用户', level: 1 })
  assert.ok(screen.getByText('UID：22 · Portra ID'))
  assert.equal(screen.queryByRole('button', { name: '更多操作' }) === null, true)
  assert.equal(calls.filter(c => c.path === '/reports').length, 0)
})

test('late service provider response cannot expose a report for a previous route', async () => {
  installFetch()
  const fetchBase = globalThis.fetch
  let completeOldBrief
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname
    if (path === '/users/21/brief') return new Promise(resolve => { completeOldBrief = resolve })
    if (path === '/service-packages/457') return response({ serviceId: 457, providerId: 22, title: '新橱窗', status: 'ONLINE', images: [], portfolioIds: [] })
    if (path === '/users/22/brief') return response({ userId: 22, nickname: '新发布者' })
    return fetchBase(url, options)
  }
  const navigate = await routedPage('/src/pages/hall/HallDetailPages.jsx', 'ServicePackageDetailPage', '/service-packages/:serviceId', '/service-packages/456')
  await waitFor(() => assert.equal(typeof completeOldBrief, 'function'))
  await navigate('/service-packages/457')
  await screen.findByRole('heading', { name: '新橱窗', level: 1 })
  assert.ok(screen.getByRole('button', { name: '更多操作' }))
  const { act } = await import('@testing-library/react')
  await act(async () => completeOldBrief(response({ userId: 21, nickname: '旧发布者' })))
  await screen.findByRole('heading', { name: '橱窗标题', level: 1 })
  assert.equal(screen.queryByRole('button', { name: '更多操作' }) === null, true)
  assert.equal(calls.filter(c => c.path === '/reports').length, 0)
})

test('UTF-16 emoji limit accepts exactly 1000 code units', async () => {
  await action(); await openDialog()
  fireEvent.click(screen.getByLabelText('其他违规行为'))
  const input = screen.getByLabelText('补充说明（选填）')
  fireEvent.change(input, { target: { value: '😀'.repeat(500) } })
  assert.equal(input.value.length, 1000)
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByText('举报已提交，平台管理员将核查处理。')
  assert.equal(JSON.parse(calls.find(c => c.path === '/reports').options.body).description, '😀'.repeat(500))
})

test('expired token reaches server validation and gives login feedback without losing draft', async () => {
  const token = 'header.' + window.btoa(JSON.stringify({ exp: 1 })) + '.signature'
  await action({ currentUser: { ...viewer, token } }); await openDialog()
  let timeouts = 0
  const timeout = () => { timeouts++ }
  window.addEventListener('portra:authentication-timeout', timeout)
  try {
    fireEvent.click(screen.getByLabelText('其他违规行为'))
    fireEvent.change(screen.getByLabelText('补充说明（选填）'), { target: { value: '会话过期仍保留' } })
    reportResponse = () => ({ ok: false, status: 401, text: async () => JSON.stringify({ code: 40101, message: 'Expired', data: null }) })
    fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
    await screen.findByText('请先登录后再提交举报。')
    assert.equal(calls.filter(c => c.path === '/reports').length, 1)
    assert.equal(calls.find(c => c.path === '/reports').options.headers.Authorization, 'Bearer ' + token)
    assert.equal(screen.getByLabelText('补充说明（选填）').value, '会话过期仍保留')
    assert.equal(timeouts, 0)
    assert.equal(screen.queryByText('举报已提交，平台管理员将核查处理。'), null)
  } finally { window.removeEventListener('portra:authentication-timeout', timeout) }
})
