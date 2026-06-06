import { request } from './client.js'

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return query.toString() ? `?${query.toString()}` : ''
}

export const adminApi = {
  dashboard(currentUser) {
    return request('/admin/dashboard', {}, currentUser)
  },
  listCertifications(params = {}, currentUser) {
    return request(`/admin/certifications${buildQuery(params)}`, {}, currentUser)
  },
  reviewCertification(type, certificationId, body, currentUser) {
    return request(`/admin/certifications/${type}/${certificationId}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listReviewComplaints(params = {}, currentUser) {
    return request(`/admin/review-complaints${buildQuery(params)}`, {}, currentUser)
  },
  arbitrateReviewComplaint(complaintId, body, currentUser) {
    return request(`/admin/review-complaints/${complaintId}/arbitration`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, currentUser)
  }
}
