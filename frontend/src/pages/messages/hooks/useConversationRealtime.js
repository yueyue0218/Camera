import { useEffect, useRef } from 'react'

export function useConversationRealtime({
  enabled,
  conversationId,
  intervalMs = 4000,
  onRefresh
}) {
  const refreshRef = useRef(onRefresh)

  useEffect(() => {
    refreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled || !conversationId || typeof window === 'undefined') return undefined
    let alive = true
    let running = false

    const refreshIfVisible = async () => {
      if (!alive || running || document.visibilityState !== 'visible') return
      running = true
      try {
        await refreshRef.current?.()
      } catch (error) {
        console.debug('[messages] realtime refresh skipped', {
          conversationId,
          message: error?.message
        })
      } finally {
        running = false
      }
    }

    const intervalId = window.setInterval(refreshIfVisible, intervalMs)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshIfVisible()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      alive = false
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, conversationId, intervalMs])
}
