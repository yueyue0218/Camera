export const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname || 'localhost'}:8080`
export const AUTH_TIMEOUT_MESSAGE = '登录超时，请重新登录'

function jwtHasExpired(token) {
  if (!token || typeof token !== 'string' || token.startsWith('demo-token-')) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(window.atob(padded))
    return Number.isFinite(Number(payload.exp)) && Number(payload.exp) * 1000 <= Date.now()
  } catch {
    return false
  }
}

function notifyAuthenticationTimeout() {
  window.dispatchEvent(new CustomEvent('portra:authentication-timeout'))
}

function authenticationError(payload = null, status = 401) {
  const error = new Error(AUTH_TIMEOUT_MESSAGE)
  error.status = status
  error.code = payload?.code || 40101
  error.payload = payload
  error.isAuthenticationTimeout = true
  notifyAuthenticationTimeout()
  return error
}

function isAuthenticationFailure(response, payload) {
  if (response.status === 401 || Number(payload?.code) === 40101) return true
  const message = String(payload?.message || '')
  return /未登录|登录.*(?:失效|过期|超时)|token.*(?:失效|过期|超时|expired)/i.test(message)
}

export async function request(path, options = {}, currentUser) {
  if (jwtHasExpired(currentUser?.token)) {
    throw authenticationError()
  }
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers = {
    ...(!isFormDataBody ? { 'Content-Type': 'application/json' } : {}),
    ...(currentUser?.token ? {
      Authorization: `Bearer ${currentUser.token}`
    } : {}),
    ...(currentUser ? {
      'X-User-Id': String(currentUser.userId),
      'X-User-Role': currentUser.role
    } : {}),
    ...(options.headers || {})
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch (error) {
    const networkError = new Error(`无法连接后端服务（${API_BASE}）。请确认后端已启动，且前端地址已被后端 CORS 放行。`)
    networkError.cause = error
    networkError.isNetworkError = true
    throw networkError
  }
  const payload = await parsePayload(response)
  const hasResultEnvelope = payload && Object.prototype.hasOwnProperty.call(payload, 'code')
  if (!response.ok || (hasResultEnvelope && Number(payload.code) !== 200)) {
    if (isAuthenticationFailure(response, payload)) {
      throw authenticationError(payload, response.status)
    }
    const error = new Error(payload.message || '请求失败')
    error.status = response.status
    error.code = payload.code
    error.payload = payload
    throw error
  }
  return hasResultEnvelope ? payload.data : payload
}

async function parsePayload(response) {
  const text = await response.text()
  if (!text) {
    return { code: response.status, message: response.statusText, data: null }
  }
  try {
    return JSON.parse(text)
  } catch {
    return { code: response.status, message: text || response.statusText, data: null }
  }
}
