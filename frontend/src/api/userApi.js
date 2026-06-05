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
  }
}
