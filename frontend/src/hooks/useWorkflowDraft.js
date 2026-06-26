import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_CONFIRM = {
  title: '放弃未提交内容？',
  message: '当前内容尚未提交，关闭后将丢弃已选择的文件和填写内容。确定关闭吗？',
  confirmText: '确定关闭',
  cancelText: '继续编辑',
  tone: 'danger'
}

export function useWorkflowDraft(draftKey, createInitialDraft, isDirtyDraft = defaultDirtyCheck) {
  const draftsRef = useRef(new Map())
  const createInitialRef = useRef(createInitialDraft)
  const dirtyCheckRef = useRef(isDirtyDraft)

  useEffect(() => {
    createInitialRef.current = createInitialDraft
  }, [createInitialDraft])

  useEffect(() => {
    dirtyCheckRef.current = isDirtyDraft
  }, [isDirtyDraft])

  const createInitial = useCallback(() => {
    const value = typeof createInitialRef.current === 'function'
      ? createInitialRef.current()
      : createInitialRef.current
    return cloneDraftValue(value)
  }, [])

  const ensureDraft = useCallback((key = draftKey) => {
    if (!key) return createInitial()
    if (!draftsRef.current.has(key)) {
      draftsRef.current.set(key, createInitial())
    }
    return draftsRef.current.get(key)
  }, [createInitial, draftKey])

  const [value, setValueState] = useState(() => ensureDraft(draftKey))

  useEffect(() => {
    setValueState(ensureDraft(draftKey))
  }, [draftKey, ensureDraft])

  const setValue = useCallback(nextValue => {
    const previous = ensureDraft(draftKey)
    const resolved = typeof nextValue === 'function' ? nextValue(previous) : nextValue
    const cloned = cloneDraftValue(resolved)
    if (draftKey) draftsRef.current.set(draftKey, cloned)
    setValueState(cloned)
  }, [draftKey, ensureDraft])

  const updateDraft = useCallback(patch => {
    setValue(previous => ({
      ...(previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {}),
      ...(typeof patch === 'function' ? patch(previous) : patch)
    }))
  }, [setValue])

  const clearDraft = useCallback((key = draftKey) => {
    if (!key) return
    const nextInitial = createInitial()
    draftsRef.current.set(key, nextInitial)
    if (key === draftKey) setValueState(nextInitial)
  }, [createInitial, draftKey])

  const isDirty = useMemo(() => Boolean(dirtyCheckRef.current?.(value)), [value])

  const confirmDiscard = useCallback(async (feedback, options = {}) => {
    if (!isDirty) return true
    const confirmed = await feedback.confirm({
      ...DEFAULT_CONFIRM,
      ...options
    })
    if (confirmed) clearDraft()
    return Boolean(confirmed)
  }, [clearDraft, isDirty])

  return {
    value,
    setValue,
    updateDraft,
    clearDraft,
    dirty: isDirty,
    confirmDiscard
  }
}

function defaultDirtyCheck(value) {
  if (!value) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'object') {
    return Object.values(value).some(defaultDirtyCheck)
  }
  return Boolean(value)
}

function cloneDraftValue(value) {
  if (Array.isArray(value)) return [...value]
  if (value && typeof value === 'object') return { ...value }
  return value
}
