import { request } from './client.js'

export const creditApi = {
  summary(userId, currentUser) {
    return request(`/users/${userId}/credit`, {}, currentUser)
  },
  records(userId, currentUser) {
    return request(`/users/${userId}/credit-records`, {}, currentUser)
  }
}
