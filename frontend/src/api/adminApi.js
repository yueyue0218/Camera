import { request } from './client.js'

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return query.toString() ? `?${query.toString()}` : ''
}

export const adminApi = {
  listHallItems(params = {}, currentUser) {
    return request(`/admin/hall-items${buildQuery(params)}`, {}, currentUser)
  },
  takeDownHallItem(type, id, body, currentUser) {
    return request(`/admin/hall-items/${type}/${id}/take-down`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, currentUser)
  },
  restoreHallItem(type, id, body, currentUser) {
    return request(`/admin/hall-items/${type}/${id}/restore`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listMoments(params = {}, currentUser) {
    return request(`/admin/moments${buildQuery(params)}`, {}, currentUser)
  },
  takeDownMoment(momentId, body, currentUser) {
    return request(`/admin/moments/${momentId}/take-down`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, currentUser)
  },
  restoreMoment(momentId, body, currentUser) {
    return request(`/admin/moments/${momentId}/restore`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listUsers(params = {}, currentUser) {
    return request(`/admin/users${buildQuery(params)}`, {}, currentUser)
  },
  getUserAdminProfile(userId, currentUser) {
    return request(`/admin/users/${userId}`, {}, currentUser)
  },
  updateUserStatus(userId, body, currentUser) {
    return request(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listReports(params = {}, currentUser) {
    return request(`/admin/reports${buildQuery(params)}`, {}, currentUser)
  },
  getReport(reportId, currentUser) {
    return request(`/admin/reports/${reportId}`, {}, currentUser)
  },
  resolveReport(reportId, body, currentUser) {
    return request(`/admin/reports/${reportId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, currentUser)
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
