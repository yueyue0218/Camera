import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

for (const mode of ['temp-staging', 'development', 'production']) {
  test(`${mode}: report/admin namespace preserves all other APIs and authentication`, async () => {
    const previous = { window: globalThis.window, fetch: globalThis.fetch }
    const calls = []
    globalThis.window = { location: { hostname: 'localhost' }, dispatchEvent() {} }
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return { ok: true, status: 200, text: async () => JSON.stringify({ code: 200, data: { accepted: true } }) }
    }
    const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), mode, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
    try {
      const { request, API_BASE } = await vite.ssrLoadModule('/src/api/client.js')
      const session = { token: 'unit-test-access' }
      const prefix = mode === 'temp-staging' ? '/api/web' : API_BASE
      for (const path of ['/reports', '/reports/my?page=2', '/admin/login', '/admin/dashboard', '/admin/hall-items', '/admin/moments', '/admin/users', '/admin/reports?keyword=%E4%B8%AD', '/admin/certifications', '/admin/review-complaints']) {
        await request(path, {}, session)
        assert.equal(calls.at(-1).url, `${prefix}${path}`)
        assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer unit-test-access')
        assert.equal(calls.at(-1).options.credentials, 'include')
      }
      for (const path of ['/auth/refresh', '/demands', '/service-packages', '/users/me', '/files/upload', '/orders', '/quotations', '/payments', '/moments', '/reviews', '/api/v1/providers/42/profile', '/api/certifications/me', '/api/admin/certifications', '/administrator', '/reports-other']) {
        await request(path, {}, session)
        assert.equal(calls.at(-1).url, `${API_BASE}${path}`)
      }
      const body = { targetType: 'DEMAND', targetId: 42, reason: 'routing test' }
      const { reportApi } = await vite.ssrLoadModule('/src/api/reportApi.js')
      await reportApi.create(body, session)
      assert.equal(calls.at(-1).url, `${prefix}/reports`)
      assert.equal(calls.at(-1).options.method, 'POST')
      assert.deepEqual(JSON.parse(calls.at(-1).options.body), body)
      assert.equal(calls.at(-1).options.suppressAuthTimeout, undefined)
      const { adminApi } = await vite.ssrLoadModule('/src/api/adminApi.js')
      await adminApi.resolveReport(17, { resolution: 'IGNORE' }, session)
      assert.equal(calls.at(-1).url, `${prefix}/admin/reports/17/resolve`)
      assert.equal(calls.at(-1).options.method, 'PATCH')
    } finally {
      await vite.close()
      if (previous.window === undefined) delete globalThis.window
      else globalThis.window = previous.window
      globalThis.fetch = previous.fetch
    }
  })
}
