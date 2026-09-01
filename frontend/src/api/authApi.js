import { request } from './client.js'

function studentNoFromEmail(email) {
  return email.trim().split('@')[0]
}

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

    throw fallbackError || new Error('注册接口暂不可用')
  },
  async login({ email, password }) {
    const studentNo = studentNoFromEmail(email)
    return request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ studentNo, password, role: 'CUSTOMER' })
    })
  },
  adminLogin({ email, password }) {
    return request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ studentNo: studentNoFromEmail(email), password })
    })
  }
}
