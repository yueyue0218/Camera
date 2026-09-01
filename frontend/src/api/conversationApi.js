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
  reportPresence(conversationId, active = true, currentUser, options = {}) {
    return request('/conversations/presence', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: Number.isFinite(Number(conversationId)) && Number(conversationId) > 0 ? Number(conversationId) : null,
        active: active !== false
      }),
      ...options
    }, currentUser)
  },
  sendMessage(conversationId, content, currentUser, messageType = 'TEXT') {
    const body = typeof content === 'object' && content !== null
      ? {
          messageType: content.messageType || messageType,
          content: content.content || '',
          fileId: content.fileId || null
        }
      : { messageType, content }
    return request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, currentUser)
  },
  quotes(conversationId, currentUser, status) {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : ''
    return request(`/conversations/${conversationId}/quotations${suffix}`, {}, currentUser)
  }
}
