import { request } from './client.js'

function qs(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, v)
  })
  return q.toString() ? `?${q.toString()}` : ''
}

export const userApi = {
  me(currentUser) {
    return request('/users/me', {}, currentUser)
  },
  brief(userId, currentUser, role) {
    return request(`/users/${userId}/brief${qs({ role })}`, {}, currentUser)
  },
  publicProfile(userId, currentUser, role) {
    return request(`/users/${userId}/public-profile${qs({ role })}`, {}, currentUser)
  },
  follow(userId, currentUser, targetRole) {
    return request(`/users/${userId}/follow${qs({ targetRole })}`, { method: 'PUT' }, currentUser)
  },
  unfollow(userId, currentUser, targetRole) {
    return request(`/users/${userId}/follow${qs({ targetRole })}`, { method: 'DELETE' }, currentUser)
  },
  followers(userId, currentUser, role) {
    return request(`/users/${userId}/followers${qs({ role })}`, {}, currentUser)
  },
  following(userId, currentUser, role) {
    return request(`/users/${userId}/following${qs({ role })}`, {}, currentUser)
  },
  updateMe(data, currentUser) {
    return request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }, currentUser)
  },
  switchRole(role, currentUser) {
    return request('/users/me/role', { method: 'POST', body: JSON.stringify({ role }) }, currentUser)
  }
}
