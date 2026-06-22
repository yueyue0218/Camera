import { useEffect, useMemo, useState } from 'react'
import { extractFileId, fileApi, fileIdsFromValues, isProtectedFileUrl } from '../../../api/fileApi.js'

function flattenValues(values) {
  return values.flatMap(value => Array.isArray(value) ? flattenValues(value) : [value])
}

export function publicImageUrls(...values) {
  return flattenValues(values)
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(value => value && !isProtectedFileUrl(value) && !extractFileId(value))
}

export function useFileObjectUrls(values, currentUser, context = 'image') {
  const fileIds = useMemo(() => fileIdsFromValues(values), [values])
  const fileIdsKey = fileIds.join(',')
  const [urls, setUrls] = useState([])

  useEffect(() => {
    let cancelled = false
    let objectUrls = []

    async function loadUrls() {
      if (!fileIds.length) {
        setUrls([])
        return
      }

      const downloaded = await Promise.all(fileIds.map(async fileId => {
        try {
          return await fileApi.downloadObjectUrl(fileId, currentUser)
        } catch (error) {
          console.warn(`${context} image load failed`, { fileId, error })
          return ''
        }
      }))

      objectUrls = downloaded.filter(Boolean)
      if (!cancelled) setUrls(objectUrls)
    }

    loadUrls()

    return () => {
      cancelled = true
      objectUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [currentUser?.role, currentUser?.token, currentUser?.userId, fileIdsKey, context])

  return urls
}

export function useFileObjectUrl(values, currentUser, context = 'image') {
  return useFileObjectUrls(values, currentUser, context)[0] || ''
}

export function useFileObjectUrlState(value, currentUser, context = 'image') {
  const fileId = useMemo(() => fileIdsFromValues(value)[0] || null, [value])
  const [state, setState] = useState({ url: '', loading: Boolean(fileId), error: false })

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''

    if (!fileId) {
      setState({ url: '', loading: false, error: false })
      return undefined
    }

    setState({ url: '', loading: true, error: false })
    fileApi.downloadObjectUrl(fileId, currentUser)
      .then(url => {
        objectUrl = url
        if (!cancelled) setState({ url, loading: false, error: false })
      })
      .catch(error => {
        console.warn(`${context} image load failed`, { fileId, error })
        if (!cancelled) setState({ url: '', loading: false, error: true })
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [currentUser?.role, currentUser?.token, currentUser?.userId, fileId, context])

  return state
}
