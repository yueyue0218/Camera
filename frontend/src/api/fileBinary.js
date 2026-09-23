const REPRESENTATIONS = new Set(['thumbnail', 'medium', 'original'])

export function fileBinaryPath(fileId, variant = 'download') {
  const normalized = Number(fileId)
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`Invalid fileId: ${fileId}`)
  }
  if (variant !== 'download' && !REPRESENTATIONS.has(variant)) {
    throw new Error(`Invalid image variant: ${variant}`)
  }
  return `/files/${normalized}/${variant}`
}

export async function fetchImageObjectUrl({
  apiBase,
  fileId,
  variant = 'download',
  token,
  signal,
  fetchImpl = fetch,
  createObjectUrl = URL.createObjectURL
}) {
  const response = await fetchImpl(`${apiBase}${fileBinaryPath(fileId, variant)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal
  })
  const contentType = String(response.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  const isImageRepresentation = variant !== 'download'
  const isJson = contentType === 'application/json' || contentType.endsWith('+json')
  const invalidContentType = !contentType
    || isJson
    || (isImageRepresentation && !contentType.startsWith('image/'))
  if (!response.ok || invalidContentType) {
    const error = new Error(`Binary load failed for fileId ${fileId}: ${response.status}`)
    error.status = response.status
    error.contentType = contentType
    throw error
  }
  return createObjectUrl(await response.blob())
}
