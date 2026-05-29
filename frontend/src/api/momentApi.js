import { request } from './client.js'

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return query.toString() ? `?${query.toString()}` : ''
}

export const momentApi = {
  list(params = {}, currentUser) {
    return request(`/moments${buildQuery(params)}`, {}, currentUser)
  },
  create(body, currentUser) {
    return request('/moments', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  detail(momentId, currentUser) {
    return request(`/moments/${momentId}`, {}, currentUser)
  },
  like(momentId, currentUser) {
    return request(`/moments/${momentId}/like`, { method: 'POST' }, currentUser)
  },
  favorite(momentId, currentUser) {
    return request(`/moments/${momentId}/favorite`, { method: 'POST' }, currentUser)
  },
  delete(momentId, currentUser) {
    return request(`/moments/${momentId}`, { method: 'DELETE' }, currentUser)
  }
}
