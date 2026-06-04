import { request } from './client.js'

export const fileApi = {
  upload(file, { bizType = 'PUBLISH_IMAGE', visibility = 'PUBLIC' } = {}, currentUser) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bizType', bizType)
    formData.append('visibility', visibility)
    return request('/files/upload', { method: 'POST', body: formData }, currentUser)
  }
}
