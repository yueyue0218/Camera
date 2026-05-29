import { request } from './client.js'

export const reviewApi = {
  listByOrder(orderId, currentUser) {
    return request(`/orders/${orderId}/reviews`, {}, currentUser)
  },
  create(orderId, body, currentUser) {
    return request(`/orders/${orderId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listByUser(userId, currentUser) {
    return request(`/users/${userId}/reviews`, {}, currentUser)
  }
}

export const reviewComplaintApi = {
  create(reviewId, body, currentUser) {
    return request(`/reviews/${reviewId}/complaints`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listMine(currentUser) {
    return request('/reviews/complaints/my', {}, currentUser)
  },
  listByReview(reviewId, currentUser) {
    return request(`/reviews/${reviewId}/complaints`, {}, currentUser)
  },
  cancel(complaintId, currentUser) {
    return request(`/reviews/complaints/${complaintId}/cancel`, { method: 'POST' }, currentUser)
  }
}
