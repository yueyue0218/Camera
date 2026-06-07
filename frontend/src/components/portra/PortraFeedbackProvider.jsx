import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { PortraConfirmDialog } from './PortraConfirmDialog.jsx'
import { PortraToast } from './PortraToast.jsx'

const PortraFeedbackContext = createContext(null)

export function PortraFeedbackProvider({ children }) {
  const confirmResolverRef = useRef(null)
  const [toast, setToast] = useState(null)
  const [confirmState, setConfirmState] = useState(null)

  const closeToast = useCallback(() => {
    setToast(previous => previous ? { ...previous, open: false } : null)
  }, [])

  const showToast = useCallback((message, severity = 'info', options = {}) => {
    const text = String(message || '').trim()
    if (!text) return
    setToast({
      open: true,
      message: text,
      severity,
      autoHideDuration: options.autoHideDuration
    })
  }, [])

  const confirm = useCallback(options => new Promise(resolve => {
    confirmResolverRef.current = resolve
    setConfirmState({
      open: true,
      title: options?.title,
      message: options?.message,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      tone: options?.tone
    })
  }), [])

  const resolveConfirm = useCallback(value => {
    setConfirmState(null)
    const resolver = confirmResolverRef.current
    confirmResolverRef.current = null
    resolver?.(value)
  }, [])

  const value = useMemo(() => ({
    showToast,
    success: (message, options) => showToast(message, 'success', options),
    error: (message, options) => showToast(message, 'error', options),
    info: (message, options) => showToast(message, 'info', options),
    warning: (message, options) => showToast(message, 'warning', options),
    confirm
  }), [confirm, showToast])

  return (
    <PortraFeedbackContext.Provider value={value}>
      {children}
      <PortraToast toast={toast} onClose={closeToast} />
      <PortraConfirmDialog confirmState={confirmState} onResolve={resolveConfirm} />
    </PortraFeedbackContext.Provider>
  )
}

export function usePortraFeedback() {
  const context = useContext(PortraFeedbackContext)
  if (!context) {
    throw new Error('usePortraFeedback must be used within PortraFeedbackProvider')
  }
  return context
}
