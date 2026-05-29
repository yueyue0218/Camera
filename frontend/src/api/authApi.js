import { request } from './client.js'

export const authApi = {
  sendCode(email) {
    return request('/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) })
  },
  async register(body) {
    const registerPaths = ['/users/register', '/auth/register']
    const registerBody = {
      ...body,
      code: body.code || body.verifyCode
    }
    delete registerBody.verifyCode
    let fallbackError = null

    for (const path of registerPaths) {
      try {
        return await request(path, { method: 'POST', body: JSON.stringify(registerBody) })
      } catch (error) {
        fallbackError = error
        const endpointMissing = error.status === 404
          || (error.code === 50001 && /No static resource|No endpoint|not found/i.test(error.message || ''))
        const backendUnavailable = error.name === 'TypeError'
        if (!endpointMissing && !backendUnavailable) {
          throw error
        }
      }
    }

    fallbackError = fallbackError || new Error('注册接口暂不可用')
    fallbackError.canUseDemoRegister = true
    throw fallbackError
  },
  async login(body) {
    if (body.loginType === 'MOBILE') {
      try {
        return await request('/sessions', { method: 'POST', body: JSON.stringify(body) })
      } catch (error) {
        const endpointMissing = error.status === 404
          || (error.code === 50001 && /No static resource|No endpoint|not found/i.test(error.message || ''))
        const sessionsStillProtected = error.code === 40101
        if (endpointMissing || sessionsStillProtected || error.isNetworkError) {
          error.canUseDemoLogin = true
        }
        throw error
      }
    }

    const error = new Error('当前登录页仅支持手机号验证码登录')
    error.canUseDemoLogin = true
    throw error
  }
}
