import { request } from './client.js'
import { SMS_PURPOSE } from '../auth/phoneAuth.js'

function studentNoFromEmail(email) {
  return email.trim().split('@')[0]
}

export const authApi = {
  sendSmsCode({ phone, deviceId }) {
    return request('/auth/sms/send', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose: SMS_PURPOSE, deviceId })
    })
  },
  verifySmsCode({ phone, code, deviceId, deviceName }) {
    return request('/auth/sms/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose: SMS_PURPOSE, code, deviceId, deviceName })
    })
  },
  refresh() {
    return request('/auth/refresh', {
      method: 'POST',
      suppressAuthTimeout: true
    })
  },
  session(currentUser) {
    return request('/auth/session', {}, currentUser)
  },
  logout(currentUser) {
    return request('/auth/logout', {
      method: 'POST',
      suppressAuthTimeout: true,
      skipTokenExpiryCheck: true
    }, currentUser)
  },
  adminLogin({ email, password }) {
    return request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ studentNo: studentNoFromEmail(email), password })
    })
  }
}
