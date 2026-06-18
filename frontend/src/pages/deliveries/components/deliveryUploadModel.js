export const DELIVERY_UPLOAD_LIMITS = {
  maxFiles: 20,
  imageMaxBytes: 20 * 1024 * 1024,
  zipMaxBytes: 200 * 1024 * 1024
}

export const DELIVERY_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
])

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i
const ZIP_EXTENSIONS = /\.zip$/i

export function getDeliveryUploadFileType(file) {
  const type = String(file?.type || '').toLowerCase()
  const name = String(file?.name || '').toLowerCase()
  if (DELIVERY_IMAGE_MIME_TYPES.has(type) || IMAGE_EXTENSIONS.test(name)) return 'IMAGE'
  if (type === 'application/zip' || type === 'application/x-zip-compressed' || ZIP_EXTENSIONS.test(name)) return 'ZIP'
  return 'UNSUPPORTED'
}

export function validateDeliveryUploadFiles(nextFiles = []) {
  const files = Array.from(nextFiles || []).filter(Boolean)
  const errors = []
  if (files.length > DELIVERY_UPLOAD_LIMITS.maxFiles) {
    errors.push(`一次最多上传 ${DELIVERY_UPLOAD_LIMITS.maxFiles} 个文件，请分批交付。`)
  }
  files.forEach(file => {
    const fileType = getDeliveryUploadFileType(file)
    if (fileType === 'UNSUPPORTED') {
      errors.push(`${file.name || '未知文件'} 格式不支持，请上传 JPG、PNG、WEBP 图片或 ZIP 压缩包。`)
      return
    }
    if (fileType === 'IMAGE' && file.size > DELIVERY_UPLOAD_LIMITS.imageMaxBytes) {
      errors.push(`${file.name} 超过图片 20MB 限制。`)
    }
    if (fileType === 'ZIP' && file.size > DELIVERY_UPLOAD_LIMITS.zipMaxBytes) {
      errors.push(`${file.name} 超过 ZIP 200MB 限制。`)
    }
  })
  return errors
}

export function formatUploadFileSize(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 KB'
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
  return `${Math.max(1, Math.round(value / 1024))} KB`
}

export function createUploadItems(files = []) {
  return Array.from(files || []).filter(Boolean).map((file, index) => ({
    id: `${file.name}-${file.size}-${file.lastModified || index}-${index}`,
    file,
    fileType: getDeliveryUploadFileType(file),
    status: 'PENDING'
  }))
}
