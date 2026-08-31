import { request } from './client.js'

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return query.toString() ? `?${query.toString()}` : ''
}

function endpointPending(path) {
  throw new Error(`后端接口待接入：${path}`)
}

export const adminApi = {
  listHallItems(params = {}, currentUser) {
    void params
    void currentUser
    return endpointPending('/admin/hall-items')
  },
  takeDownHallItem(type, id, body, currentUser) {
    void body
    void currentUser
    return endpointPending(`/admin/hall-items/${type}/${id}/take-down`)
  },
  restoreHallItem(type, id, body, currentUser) {
    void body
    void currentUser
    return endpointPending(`/admin/hall-items/${type}/${id}/restore`)
  },
  listMoments(params = {}, currentUser) {
    void params
    void currentUser
    return endpointPending('/admin/moments')
  },
  takeDownMoment(momentId, body, currentUser) {
    void body
    void currentUser
    return endpointPending(`/admin/moments/${momentId}/take-down`)
  },
  restoreMoment(momentId, body, currentUser) {
    void body
    void currentUser
    return endpointPending(`/admin/moments/${momentId}/restore`)
  },
  listUsers(params = {}, currentUser) {
    void params
    void currentUser
    return endpointPending('/admin/users')
  },
  getUserAdminProfile(userId, currentUser) {
    void currentUser
    return endpointPending(`/admin/users/${userId}`)
  },
  listReports(params = {}, currentUser) {
    void params
    void currentUser
    return endpointPending('/admin/reports')
  },
  resolveReport(reportId, body, currentUser) {
    void body
    void currentUser
    return endpointPending(`/admin/reports/${reportId}/resolve`)
  },
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
