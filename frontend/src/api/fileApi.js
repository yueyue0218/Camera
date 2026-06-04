import { API_BASE, request } from './client.js'

export const fileApi = {
  upload(file, { bizType = 'PUBLISH_IMAGE', visibility = 'PUBLIC' } = {}, currentUser) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bizType', bizType)
    formData.append('visibility', visibility)
    return request('/files/upload', { method: 'POST', body: formData }, currentUser)
  },
  async downloadObjectUrl(fileId, currentUser) {
    const headers = {
      ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
      ...(currentUser ? {
        'X-User-Id': String(currentUser.userId),
        'X-User-Role': currentUser.role
      } : {})
    }
    const response = await fetch(`${API_BASE}/files/${fileId}/download`, { headers })
    if (!response.ok) throw new Error('图片加载失败')
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }
}
