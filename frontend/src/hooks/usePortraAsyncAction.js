import { useCallback, useState } from 'react'
import { usePortraFeedback } from '../components/portra/PortraFeedbackProvider.jsx'

export function usePortraAsyncAction(defaultOptions = {}) {
  const feedback = usePortraFeedback()
  const [loading, setLoading] = useState(false)

  const run = useCallback(async (action, options = {}) => {
    const config = { ...defaultOptions, ...options }
    setLoading(true)
    config.onStart?.()
    try {
      const result = await action()
      const successMessage = resolveMessage(config.successMessage, result)
      if (successMessage) feedback.success(successMessage)
      config.onSuccess?.(result)
      return result
    } catch (error) {
      const message = resolveErrorMessage(error, config.errorMessage)
      if (config.showError !== false) feedback.error(message)
      config.onError?.(error, message)
      if (config.throwOnError) throw error
      return null
    } finally {
      setLoading(false)
      config.onFinally?.()
    }
  }, [defaultOptions, feedback])

  return { run, loading }
}

function resolveMessage(message, result) {
  if (typeof message === 'function') return message(result)
  return message
}

function resolveErrorMessage(error, fallback) {
  if (typeof fallback === 'function') return fallback(error)
  if (fallback) return fallback
  if (error?.isNetworkError) return error.message
  if (error?.status === 404) return '当前接口暂不支持或资源不存在。'
  return error?.message || '操作失败，请稍后重试。'
}
