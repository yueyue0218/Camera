import { request } from './client.js'

export const userApi = {
  me(currentUser) {
    return request('/users/me', {}, currentUser)
  },
  brief(userId, currentUser) {
    return request(`/users/${userId}/brief`, {}, currentUser)
  },
  publicProfile(userId, currentUser) {
    return request(`/users/${userId}/public-profile`, {}, currentUser)
  },
  follow(userId, currentUser) {
    return request(`/users/${userId}/follow`, { method: 'PUT' }, currentUser)
  },
  unfollow(userId, currentUser) {
    return request(`/users/${userId}/follow`, { method: 'DELETE' }, currentUser)
  },
  followers(userId, currentUser) {
    return request(`/users/${userId}/followers`, {}, currentUser)
  },
  following(userId, currentUser) {
    return request(`/users/${userId}/following`, {}, currentUser)
  },
  updateMe(data, currentUser) {
    return request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }, currentUser)
  }
}
