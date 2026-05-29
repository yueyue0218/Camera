export const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname || 'localhost'}:8080`

export async function request(path, options = {}, currentUser) {
  const headers = {
    'Content-Type': 'application/json',
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
