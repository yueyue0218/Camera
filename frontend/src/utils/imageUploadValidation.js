export const MAX_IMAGE_COUNT = 9
export const MAX_IMAGE_SIZE_MB = 10
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

function fileExtension(file) {
  const name = String(file?.name || '').toLowerCase()
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(dotIndex) : ''
}

function imageValidationError(file, index) {
  if (!file || file.size === 0) {
    return `第 ${index} 张图片不能为空`
  }
  if (!ALLOWED_IMAGE_TYPES.includes(String(file.type || '').toLowerCase())) {
    return `第 ${index} 张不是支持的图片格式`
  }
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(fileExtension(file))) {
    return `第 ${index} 张不是支持的图片格式`
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `第 ${index} 张图片过大，单张不能超过 ${MAX_IMAGE_SIZE_MB}MB`
  }
  return null
}

export function prepareImageFilesForUpload(files, currentCount = 0) {
  const selectedFiles = Array.from(files || []).filter(Boolean)
  if (!selectedFiles.length) {
    return { filesToUpload: [], error: null, warning: null }
  }

  const remaining = MAX_IMAGE_COUNT - currentCount
  if (remaining <= 0) {
    return {
      filesToUpload: [],
      error: `最多只能上传 ${MAX_IMAGE_COUNT} 张图片`,
      warning: null
    }
  }

  const filesToUpload = selectedFiles.slice(0, remaining)
  const warning = selectedFiles.length > remaining
    ? `最多只能上传 ${MAX_IMAGE_COUNT} 张图片，已保留前 ${remaining} 张`
    : null

  for (let index = 0; index < filesToUpload.length; index += 1) {
    const error = imageValidationError(filesToUpload[index], index + 1)
    if (error) {
      return { filesToUpload: [], error, warning: null }
    }
  }

  return { filesToUpload, error: null, warning }
}
