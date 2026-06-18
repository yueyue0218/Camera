import { request } from './client.js'

export const deliveryApi = {
  listByOrder(orderId, currentUser) {
    return request(`/orders/${orderId}/deliveries`, {}, currentUser)
  },
  upload(orderId, fileOrFiles, remark, currentUser) {
    const body = new FormData()
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
    const validFiles = files.filter(Boolean)
    validFiles.forEach(file => body.append('files', file))
    if (remark?.trim()) body.append('remark', remark.trim())
    return request(`/orders/${orderId}/deliveries`, { method: 'POST', body }, currentUser)
  }
}
