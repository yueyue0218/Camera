import { request } from './client.js'

export const quoteApi = {
  create(body, currentUser) {
    return request('/quotations', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  confirm(quotationId, confirmRemark, currentUser) {
    return request(`/quotations/${quotationId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmRemark })
    }, currentUser)
  },
  reject(quotationId, rejectReason, currentUser) {
    return request(`/quotations/${quotationId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectReason })
    }, currentUser)
  }
}
