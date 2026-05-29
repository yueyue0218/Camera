import { request } from './client.js'

export const userApi = {
  me(currentUser) {
    return request('/users/me', {}, currentUser)
  },
  brief(userId, currentUser) {
    return request(`/users/${userId}/brief`, {}, currentUser)
  }
}
