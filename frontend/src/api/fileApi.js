import { API_BASE, request } from './client.js'

export function extractFileId(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value).trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return Number(text)
  const match = text.match(/\/files\/(\d+)\/download(?:\b|[?#])/)
  return match ? Number(match[1]) : null
}

export function fileIdsFromValues(...values) {
  const ids = []
  const visit = value => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const fileId = extractFileId(value)
    if (fileId && !ids.includes(fileId)) ids.push(fileId)
  }
  values.forEach(visit)
  return ids
}

export function isProtectedFileUrl(value) {
  return extractFileId(value) !== null && String(value || '').includes('/files/')
}

export const fileApi = {
  upload(file, { bizType = 'PUBLISH_IMAGE', visibility = 'PUBLIC' } = {}, currentUser) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bizType', bizType)
    formData.append('visibility', visibility)
    return request('/files/upload', { method: 'POST', body: formData }, currentUser)
  },
  uploadImagesBatch(files, { bizType = 'PUBLISH_IMAGE', visibility = 'PUBLIC' } = {}, currentUser) {
    const formData = new FormData()
    Array.from(files || []).forEach(file => formData.append('files', file))
    formData.append('bizType', bizType)
    formData.append('visibility', visibility)
    return request('/files/images/batch', { method: 'POST', body: formData }, currentUser)
  },
  async downloadObjectUrl(fileId, currentUser, options = {}) {
    const normalizedFileId = extractFileId(fileId)
    if (!normalizedFileId) throw new Error(`Invalid fileId: ${fileId}`)
    const headers = {
      ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {})
    }
    const response = await fetch(`${API_BASE}/files/${normalizedFileId}/download`, {
      headers,
      signal: options.signal
    })
    if (!response.ok) throw new Error(`Image load failed for fileId ${normalizedFileId}: ${response.status}`)
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }
}
