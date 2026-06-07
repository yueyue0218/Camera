import { request } from './client.js'

export const notificationApi = {
  listMine(currentUser) {
    return request('/notifications', {}, currentUser)
  },
  markRead(notificationId, currentUser) {
    return request(`/notifications/${notificationId}/read`, { method: 'PATCH' }, currentUser)
  },
  markAllRead(currentUser) {
    return request('/notifications/read-all', { method: 'PATCH' }, currentUser)
  }
}
