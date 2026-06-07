import { request } from './client.js'

function normalizeNotificationList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.records)) return data.records
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.content)) return data.content
  return []
}

function normalizeUnreadCount(data) {
  if (typeof data === 'number') return data
  if (typeof data === 'string' && data.trim() !== '') return Number(data) || 0
  return Number(data?.unreadCount ?? data?.count ?? data?.total ?? 0) || 0
}

export const notificationApi = {
  async listMine(currentUser, params = {}) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value))
      }
    })
    const suffix = query.toString() ? `?${query.toString()}` : ''
    const data = await request(`/notifications${suffix}`, {}, currentUser)
    return normalizeNotificationList(data)
  },
  async unreadCount(currentUser) {
    const data = await request('/notifications/unread-count', {}, currentUser)
    return normalizeUnreadCount(data)
  },
  markRead(notificationId, currentUser) {
    return request(`/notifications/${notificationId}/read`, { method: 'PATCH' }, currentUser)
  },
  async markAllRead(currentUser) {
    const data = await request('/notifications/read-all', { method: 'PATCH' }, currentUser)
    return normalizeNotificationList(data)
  }
}
