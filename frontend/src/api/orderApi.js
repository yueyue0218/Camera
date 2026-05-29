import { request } from './client.js'

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return query.toString() ? `?${query.toString()}` : ''
}

export const orderApi = {
  list(params = {}, currentUser) {
    return request(`/orders${buildQuery(params)}`, {}, currentUser)
  },
  detail(orderId, currentUser) {
    return request(`/orders/${orderId}`, {}, currentUser)
  },
  statusLogs(orderId, currentUser) {
    return request(`/orders/${orderId}/status-logs`, {}, currentUser)
  },
  mockPay(orderId, amountCent, currentUser) {
    return request(`/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ payMethod: 'MOCK_PAY', amountCent })
    }, currentUser)
  },
  transition(orderId, targetStatus, reason, currentUser) {
    return request(`/orders/${orderId}/status-transitions`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus, reason })
    }, currentUser)
  }
}
