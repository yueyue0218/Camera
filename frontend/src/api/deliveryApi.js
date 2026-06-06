import { request } from './client.js'

export const deliveryApi = {
  listByOrder(orderId, currentUser) {
    return request(`/orders/${orderId}/deliveries`, {}, currentUser)
  },
  upload(orderId, file, remark, currentUser) {
    const body = new FormData()
    body.append('file', file)
    if (remark?.trim()) body.append('remark', remark.trim())
    return request(`/orders/${orderId}/deliveries`, { method: 'POST', body }, currentUser)
  }
}
