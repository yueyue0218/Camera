import { request } from './client.js'

export const photoAuthorizationApi = {
  request(orderId, body, currentUser) {
    return request(`/orders/${orderId}/photo-authorizations/requests`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, currentUser)
  },
  approve(authorizationId, body = {}, currentUser) {
    return request(`/photo-authorizations/${authorizationId}/approve`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, currentUser)
  },
  reject(authorizationId, body = {}, currentUser) {
    return request(`/photo-authorizations/${authorizationId}/reject`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listByOrder(orderId, currentUser) {
    return request(`/orders/${orderId}/photo-authorizations`, {}, currentUser)
  },
  listGrantedForProvider(currentUser) {
    return request('/photo-authorizations/provider', {}, currentUser)
  }
}
