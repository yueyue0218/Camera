import { request } from './client.js'

export const messageApi = {
  list(currentUser) {
    return request('/messages', {}, currentUser)
  },
  send(body, currentUser) {
    return request('/messages', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  }
}
