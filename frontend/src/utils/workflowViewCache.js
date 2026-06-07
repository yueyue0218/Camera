const WORKFLOW_VIEW_CACHE_KEY = 'portra:workflowViewCache'
const DEFAULT_TTL = 5 * 60 * 1000

export function readWorkflowViewState(key, ttl = DEFAULT_TTL) {
  if (!key || typeof window === 'undefined') return null
  try {
    const store = JSON.parse(window.sessionStorage.getItem(WORKFLOW_VIEW_CACHE_KEY) || '{}')
    const entry = store[key]
    if (!entry) return null
    if (Date.now() - Number(entry.updatedAt || 0) > ttl) {
      delete store[key]
      window.sessionStorage.setItem(WORKFLOW_VIEW_CACHE_KEY, JSON.stringify(store))
      return null
    }
    return entry.value || null
  } catch {
    return null
  }
}

export function writeWorkflowViewState(key, value) {
  if (!key || typeof window === 'undefined') return false
  try {
    const store = JSON.parse(window.sessionStorage.getItem(WORKFLOW_VIEW_CACHE_KEY) || '{}')
    store[key] = {
      value,
      updatedAt: Date.now()
    }
    window.sessionStorage.setItem(WORKFLOW_VIEW_CACHE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export function mergeWorkflowViewState(key, partial) {
  const previous = readWorkflowViewState(key) || {}
  return writeWorkflowViewState(key, { ...previous, ...partial })
}

export function buildWorkflowCacheKey(scope, ...parts) {
  return [scope, ...parts]
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join(':')
}
