import { request } from './client.js'

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return query.toString() ? `?${query.toString()}` : ''
}

export const servicePackageApi = {
  list(params = {}, currentUser) {
    return request(`/service-packages${buildQuery(params)}`, {}, currentUser)
  },
  create(body, currentUser) {
    return request('/service-packages', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  detail(serviceId, currentUser) {
    return request(`/service-packages/${serviceId}`, {}, currentUser)
  },
  update(serviceId, body, currentUser) {
    return request(`/service-packages/${serviceId}`, { method: 'PUT', body: JSON.stringify(body) }, currentUser)
  },
  offline(serviceId, currentUser) {
    return request(`/service-packages/${serviceId}/offline`, { method: 'PATCH' }, currentUser)
  },
  hide(serviceId, currentUser) {
    return request(`/service-packages/${serviceId}`, { method: 'DELETE' }, currentUser)
  },
  reserve(serviceId, body, currentUser) {
    return request(`/service-packages/${serviceId}/reserve`, { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  addInterest(serviceId, currentUser) {
    return request(`/service-packages/${serviceId}/interest`, { method: 'POST' }, currentUser)
  },
  cancelInterest(serviceId, currentUser) {
    return request(`/service-packages/${serviceId}/interest`, { method: 'DELETE' }, currentUser)
  },
  startChat(serviceId, body = {}, currentUser) {
    return request(`/service-packages/${serviceId}/start-chat`, { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  myInterests(params = {}, currentUser) {
    return request(`/me/service-package-interests${buildQuery(params)}`, {}, currentUser)
  },
  myHistory(currentUser) {
    return request('/service-packages/me/history', {}, currentUser)
  }
}
