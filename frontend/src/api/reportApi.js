import { request } from './client.js'

export const reportApi = {
  create(body, currentUser) {
    // Let the dialog retain the user's draft when the session expires.
    return request('/reports', {
      method: 'POST',
      body: JSON.stringify(body),
      suppressAuthTimeout: true,
      skipTokenExpiryCheck: true
    }, currentUser)
  }
}
