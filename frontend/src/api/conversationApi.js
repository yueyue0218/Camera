import { request } from './client.js'

export const conversationApi = {
  list(currentUser) {
    return request('/conversations', {}, currentUser)
  },
  createFromResponse(snapshot, currentUser) {
    return request('/conversations/from-response', {
      method: 'POST',
      body: JSON.stringify({
        responseId: snapshot.responseId,
        demandId: snapshot.demandId,
        customerId: snapshot.customerId,
        providerUserId: snapshot.providerUserId || snapshot.providerId,
        status: snapshot.status || snapshot.responseStatus || 'ACCEPTED'
      })
    }, currentUser)
  },
  messages(conversationId, currentUser) {
    return request(`/conversations/${conversationId}/messages`, {}, currentUser)
  },
  sendMessage(conversationId, content, currentUser, messageType = 'TEXT') {
    return request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ messageType, content })
    }, currentUser)
  },
  quotes(conversationId, currentUser, status) {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : ''
    return request(`/conversations/${conversationId}/quotations${suffix}`, {}, currentUser)
  }
}
