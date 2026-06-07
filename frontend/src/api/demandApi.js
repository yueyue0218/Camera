import { request } from './client.js'

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  return query.toString() ? `?${query.toString()}` : ''
}

export const demandApi = {
  list(params = {}, currentUser) {
    return request(`/demands${buildQuery(params)}`, {}, currentUser)
  },
  create(body, currentUser) {
    return request('/demands', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  update(demandId, body, currentUser) {
    return request(`/demands/${demandId}`, { method: 'PUT', body: JSON.stringify(body) }, currentUser)
  },
  detail(demandId, currentUser) {
    return request(`/demands/${demandId}`, {}, currentUser)
  },
  close(demandId, currentUser) {
    return request(`/demands/${demandId}/close`, { method: 'PATCH' }, currentUser)
  },
  delete(demandId, currentUser) {
    return request(`/demands/${demandId}`, { method: 'DELETE' }, currentUser)
  },
  respond(demandId, body, currentUser) {
    return request(`/demands/${demandId}/responses`, { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  createDemandResponse(demandId, body, currentUser) {
    return request(`/demands/${demandId}/responses`, { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  responses(demandId, currentUser) {
    return request(`/demands/${demandId}/responses`, {}, currentUser)
  },
  myResponses(currentUser) {
    return request('/demands/responses/me', {}, currentUser)
  },
  responsesReceived(currentUser) {
    return request('/demands/responses/received', {}, currentUser)
  },
  reject(demandId, responseId, currentUser) {
    return request(`/demands/${demandId}/responses/${responseId}/reject`, { method: 'POST' }, currentUser)
  },
  accept(demandId, responseId, currentUser) {
    return request(`/demands/${demandId}/responses/${responseId}/accept`, { method: 'POST' }, currentUser)
  },
  invite(demandId, body, currentUser) {
    return request(`/demands/${demandId}/invitations`, { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  invitations(currentUser) {
    return request('/demands/invitations/received', {}, currentUser)
  },
  sentInvitations(currentUser) {
    return request('/demands/invitations/sent', {}, currentUser)
  },
  acceptInvitation(invitationId, currentUser) {
    return request(`/demands/invitations/${invitationId}/accept`, { method: 'POST' }, currentUser)
  },
  rejectInvitation(invitationId, currentUser) {
    return request(`/demands/invitations/${invitationId}/reject`, { method: 'POST' }, currentUser)
  }
}
