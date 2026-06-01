import { request } from './client.js'

export const deliveryApi = {
  upload(orderId, file, remark, currentUser) {
    const body = new FormData()
    body.append('file', file)
    if (remark !== undefined && remark !== null && remark !== '') {
      body.append('remark', remark)
    }
    return request(`/orders/${orderId}/deliveries`, {
      method: 'POST',
      body
    }, currentUser)
  },
  listByOrder(orderId, currentUser) {
    return request(`/orders/${orderId}/deliveries`, {}, currentUser)
  }
}
