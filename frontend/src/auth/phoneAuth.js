export const SMS_PURPOSE = 'LOGIN'
export const DEVICE_ID_STORAGE_KEY = 'portra-device-id'
const LEGACY_AUTH_STORAGE_KEY = ['camera', 'p4', 'auth'].join('-')

export function clearLegacyStoredAuthentication(storage = window.localStorage) {
  try {
    storage.removeItem(LEGACY_AUTH_STORAGE_KEY)
  } catch {
    // Authentication still stays memory-only when browser storage is unavailable.
  }
}

export function isSupportedPhone(value) {
  const compact = String(value || '').replace(/[\s-]/g, '')
  return /^(?:\+?86)?1[3-9]\d{9}$/.test(compact)
}

export function sanitizeVerificationCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6)
}

export function authSessionFromResponse(data) {
  if (!data?.token) return null
  return {
    token: data.token,
    user: {
      userId: data.userId,
      nickname: data.nickname,
      role: data.role,
      adminCapable: Boolean(data.adminCapable),
      newUser: Boolean(data.newUser)
    }
  }
}

export function getOrCreateDeviceId(storage = window.localStorage, cryptoApi = window.crypto) {
  let existing = ''
  try {
    existing = storage.getItem(DEVICE_ID_STORAGE_KEY) || ''
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  if (existing) return existing

  const generated = typeof cryptoApi?.randomUUID === 'function'
    ? cryptoApi.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    storage.setItem(DEVICE_ID_STORAGE_KEY, generated)
  } catch {
    // The in-memory identifier still keeps this authentication attempt coherent.
  }
  return generated
}

export function getDeviceName(navigatorApi = window.navigator) {
  const platform = navigatorApi.userAgentData?.platform || navigatorApi.platform || 'Web'
  const userAgent = navigatorApi.userAgent || ''
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser'
  return `${browser} on ${platform}`.slice(0, 128)
}

export function verificationErrorMessage(error) {
  if (error?.isNetworkError) return error.message
  return '验证码无效或已过期，请重新获取'
}
