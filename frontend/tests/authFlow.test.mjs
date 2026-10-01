import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  authSessionFromResponse,
  clearLegacyStoredAuthentication,
  getDeviceName,
  getOrCreateDeviceId,
  isSupportedPhone,
  sanitizeVerificationCode,
  verificationErrorMessage
} from '../src/auth/phoneAuth.js'

test('legacy browser authentication is removed during session bootstrap', () => {
  const values = new Map([
    [['camera', 'p4', 'auth'].join('-'), 'legacy-session'],
    ['camera-p4-user-profiles', 'profile-data']
  ])
  const storage = {
    removeItem: key => values.delete(key)
  }

  clearLegacyStoredAuthentication(storage)

  assert.equal(values.has(['camera', 'p4', 'auth'].join('-')), false)
  assert.equal(values.get('camera-p4-user-profiles'), 'profile-data')
})

test('phone validation accepts supported mainland formats only', () => {
  const supportedPhone = ['138', '0013', '8000'].join('')
  assert.equal(isSupportedPhone(supportedPhone), true)
  assert.equal(isSupportedPhone(`+86 ${supportedPhone.slice(0, 3)}-${supportedPhone.slice(3, 7)}-${supportedPhone.slice(7)}`), true)
  assert.equal(isSupportedPhone(`86${supportedPhone}`), true)
  assert.equal(isSupportedPhone(`12${supportedPhone.slice(2)}`), false)
  assert.equal(isSupportedPhone(supportedPhone.slice(0, -1)), false)
})

test('verification codes keep only the first six digits', () => {
  assert.equal(sanitizeVerificationCode('12a 34-567'), ['123', '456'].join(''))
  assert.equal(sanitizeVerificationCode('abc'), '')
})

test('auth responses become memory-only sessions without refresh material', () => {
  const session = authSessionFromResponse({
    token: 'access.jwt.value',
    userId: 42,
    nickname: '新用户',
    role: 'CUSTOMER',
    adminCapable: false,
    newUser: true,
    refreshToken: 'must-not-be-copied'
  })
  assert.deepEqual(session, {
    token: 'access.jwt.value',
    user: {
      userId: 42,
      nickname: '新用户',
      role: 'CUSTOMER',
      adminCapable: false,
      newUser: true
    }
  })
  assert.equal(JSON.stringify(session).includes('must-not-be-copied'), false)
})

test('device identity is stable and device names are bounded', () => {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  }
  const cryptoApi = { randomUUID: () => '00000000-0000-4000-8000-000000000000' }
  assert.equal(getOrCreateDeviceId(storage, cryptoApi), '00000000-0000-4000-8000-000000000000')
  assert.equal(getOrCreateDeviceId(storage, cryptoApi), '00000000-0000-4000-8000-000000000000')
  assert.equal(getDeviceName({ platform: 'Win32', userAgent: 'Chrome/140.0' }), 'Chrome on Win32')
})

test('verification failures use one account-neutral message', () => {
  assert.equal(verificationErrorMessage(new Error('user does not exist')), '验证码无效或已过期，请重新获取')
  const networkError = new Error('无法连接后端服务')
  networkError.isNetworkError = true
  assert.equal(verificationErrorMessage(networkError), '无法连接后端服务')
})

test('auth API sends only the phone session contract and includes cookies', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const previousCustomEvent = globalThis.CustomEvent
  const calls = []
  const phone = ['138', '0013', '8000'].join('')
  const verificationCode = ['123', '456'].join('')
  globalThis.window = { location: { hostname: 'localhost' }, dispatchEvent: () => {} }
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type } }
  globalThis.fetch = async (url, options) => {
    calls.push([url, options])
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ code: 200, data: { token: 'access.jwt.value' } })
    }
  }

  const { createServer } = await import('vite')
  const vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  try {
    const { authApi } = await vite.ssrLoadModule('/src/api/authApi.js')
    await authApi.sendSmsCode({ phone, deviceId: 'device-1' })
    await authApi.verifySmsCode({
      phone, code: verificationCode, deviceId: 'device-1', deviceName: 'Chrome on Win32'
    })
    await authApi.refresh()

    assert.equal(calls[0][0], 'http://localhost:8080/auth/sms/send')
    assert.deepEqual(JSON.parse(calls[0][1].body), {
      phone, purpose: 'LOGIN', deviceId: 'device-1'
    })
    assert.equal(calls[0][1].credentials, 'include')
    assert.equal(calls[1][0], 'http://localhost:8080/auth/sms/verify')
    assert.deepEqual(JSON.parse(calls[1][1].body), {
      phone, purpose: 'LOGIN', code: verificationCode,
      deviceId: 'device-1', deviceName: 'Chrome on Win32'
    })
    assert.equal(calls[1][1].credentials, 'include')
    assert.equal(calls[2][0], 'http://localhost:8080/auth/refresh')
    assert.equal(calls[2][1].credentials, 'include')

    for (const [, options] of calls.slice(0, 2)) {
      assert.equal(options.body.includes('password'), false)
      assert.equal(options.body.includes('ADMIN'), false)
      assert.equal(options.body.includes('PROVIDER'), false)
    }
  } finally {
    await vite.close()
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousFetch === undefined) delete globalThis.fetch
    else globalThis.fetch = previousFetch
    if (previousCustomEvent === undefined) delete globalThis.CustomEvent
    else globalThis.CustomEvent = previousCustomEvent
  }
})

test('login endpoint 401 errors do not become authentication-timeout events', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const previousCustomEvent = globalThis.CustomEvent
  const dispatched = []
  const phone = ['138', '0013', '8000'].join('')
  globalThis.window = {
    location: { hostname: 'localhost' },
    dispatchEvent: event => dispatched.push(event.type)
  }
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type } }
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => JSON.stringify({ code: 40101, message: '登录凭据无效', data: null })
  })

  const { createServer } = await import('vite')
  const vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  try {
    const { authApi } = await vite.ssrLoadModule('/src/api/authApi.js')

    await assert.rejects(
      () => authApi.verifySmsCode({
        phone, code: '123456', deviceId: 'device-1', deviceName: 'Chrome on Win32'
      }),
      error => error.message === '登录凭据无效' && !error.isAuthenticationTimeout
    )
    await assert.rejects(
      () => authApi.adminLogin({ email: 'admin@example.com', password: 'wrong-password' }),
      error => error.message === '登录凭据无效' && !error.isAuthenticationTimeout
    )
    await assert.rejects(
      () => authApi.tempStagingLogin({
        userId: 101, password: 'wrong-password', deviceId: 'device-1', deviceName: 'Chrome on Win32'
      }),
      error => error.message === '登录凭据无效' && !error.isAuthenticationTimeout
    )
    assert.deepEqual(dispatched, [])
  } finally {
    await vite.close()
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousFetch === undefined) delete globalThis.fetch
    else globalThis.fetch = previousFetch
    if (previousCustomEvent === undefined) delete globalThis.CustomEvent
    else globalThis.CustomEvent = previousCustomEvent
  }
})

test('ordinary auth source has no legacy login or persisted token flow', async () => {
  const [authContext, authApi, authPages] = await Promise.all([
    readFile(new URL('../src/AuthContext.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/api/authApi.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/auth/AuthPages.jsx', import.meta.url), 'utf8')
  ])

  assert.doesNotMatch(authContext, /camera-p4-auth|AUTH_STORAGE_KEY|refreshToken/)
  assert.doesNotMatch(authApi, /\/users\/login|\/auth\/send-code|role:\s*['"]CUSTOMER/)
  assert.doesNotMatch(authPages, /学校邮箱|smail\.nju|设置你的密码|完成注册/)
  assert.match(authPages, /手机号登录或注册/)
  assert.match(authPages, /管理员登录/)
})

test('temp-staging build is isolated from the normal phone login build', async () => {
  const [packageJson, authApi, client, authPages] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../src/api/authApi.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/api/client.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/auth/AuthPages.jsx', import.meta.url), 'utf8')
  ])

  assert.equal(packageJson.scripts.build, 'vite build')
  assert.equal(packageJson.scripts['build:temp-staging'], 'vite build --mode temp-staging')
  assert.match(client, /import\.meta\.env\.MODE === ['"]temp-staging['"]/)
  assert.match(authApi, /tempStagingLogin/)
  assert.match(authApi, /\/auth\/temp-staging\/login/)
  assert.match(authApi, /tempStagingLogin[\s\S]*?suppressAuthTimeout:\s*true/)
  assert.match(authPages, /export function LoginChoicePage\(\) \{\s+const navigate/)
  assert.doesNotMatch(authPages, /StandardLoginChoicePage/)
  assert.doesNotMatch(authPages, /LoginChoicePage\(\) \{\s+return TEMP_STAGING_BUILD/)
  assert.match(authPages, /TEMP_STAGING_BUILD \? <TempStagingLoginPage \/> : <PhoneSmsAuthPage \/>/)
  assert.match(authPages, /白名单测试账号登录/)
  assert.match(authPages, /手机号登录或注册/)
})
