import { useCallback, useMemo, useState } from 'react'
import { buildWorkflowCacheKey, mergeWorkflowViewState, readWorkflowViewState, writeWorkflowViewState } from '../utils/workflowViewCache.js'

export function useWorkflowViewState(scope, parts = [], initialValue = {}) {
  const key = useMemo(() => buildWorkflowCacheKey(scope, ...parts), [scope, parts])
  const [state, setState] = useState(() => readWorkflowViewState(key) || initialValue)

  const save = useCallback(nextValue => {
    setState(previous => {
      const value = typeof nextValue === 'function' ? nextValue(previous) : nextValue
      writeWorkflowViewState(key, value)
      return value
    })
  }, [key])

  const merge = useCallback(partial => {
    setState(previous => {
      const value = { ...previous, ...partial }
      mergeWorkflowViewState(key, partial)
      return value
    })
  }, [key])

  return { key, state, save, merge }
}
