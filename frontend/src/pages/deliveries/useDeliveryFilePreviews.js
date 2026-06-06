import { useEffect, useMemo, useState } from 'react'
import { fileApi } from '../../api.js'
import { getDeliveryFileId, isImageDeliveryFile } from './deliveryDisplay.js'

export function useDeliveryFilePreviews(files = [], currentUser, { enabled = true } = {}) {
  const [previewUrls, setPreviewUrls] = useState({})
  const [loadingIds, setLoadingIds] = useState(() => new Set())
  const previewKey = useMemo(() => files.map(file => `${file.id || ''}:${getDeliveryFileId(file) || ''}`).join('|'), [files])

  useEffect(() => {
    if (!enabled) {
      setPreviewUrls({})
      setLoadingIds(new Set())
      return undefined
    }

    let cancelled = false
    const urls = {}
    const imageFiles = files.filter(file => getDeliveryFileId(file) && isImageDeliveryFile(file))
    setPreviewUrls({})
    setLoadingIds(new Set(imageFiles.map(file => getPreviewKey(file))))

    async function loadPreviews() {
      await Promise.all(imageFiles.map(async file => {
        const fileId = getDeliveryFileId(file)
        try {
          const url = await fileApi.downloadObjectUrl(fileId, currentUser)
          if (!cancelled) urls[getPreviewKey(file)] = url
        } catch {
          // Thumbnail previews are optional. The file entry remains accessible when preview loading fails.
        } finally {
          if (!cancelled) {
            setLoadingIds(previous => {
              const next = new Set(previous)
              next.delete(getPreviewKey(file))
              return next
            })
          }
        }
      }))
      if (!cancelled) setPreviewUrls(urls)
    }

    loadPreviews()

    return () => {
      cancelled = true
      Object.values(urls).forEach(url => URL.revokeObjectURL(url))
    }
  }, [previewKey, currentUser, enabled])

  return { previewUrls, loadingIds }
}

export function getPreviewKey(file) {
  return String(file?.id || getDeliveryFileId(file) || '')
}
