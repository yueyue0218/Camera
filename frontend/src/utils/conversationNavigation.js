const LAST_CONVERSATION_KEY = 'portra:lastConversationId'
const MESSAGE_SURFACE_KEY = 'portra:messageSurface'

export function normalizeConversationId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function buildConversationPath(conversationId) {
  const id = normalizeConversationId(conversationId)
  return id ? `/messages/${id}` : ''
}

export function rememberLastConversation(conversationId, meta = {}) {
  const path = buildConversationPath(conversationId)
  if (!path || typeof window === 'undefined') return false
  try {
    window.sessionStorage.setItem(LAST_CONVERSATION_KEY, String(normalizeConversationId(conversationId)))
    setLastMessageSurface('detail')
    if (meta && Object.keys(meta).length) {
      window.sessionStorage.setItem(`${LAST_CONVERSATION_KEY}:meta`, JSON.stringify({
        ...meta,
        conversationId: normalizeConversationId(conversationId),
        updatedAt: new Date().toISOString()
      }))
    }
    return true
  } catch {
    return false
  }
}

export function setLastMessageSurface(surface) {
  if (typeof window === 'undefined') return false
  const normalized = surface === 'detail' ? 'detail' : 'list'
  try {
    window.sessionStorage.setItem(MESSAGE_SURFACE_KEY, normalized)
    return true
  } catch {
    return false
  }
}

export function getMessageNavTarget(currentPath = '') {
  const path = String(currentPath || '')
  if (/^\/messages\/\d+$/.test(path)) return path
  if (typeof window === 'undefined') return '/messages'
  try {
    const surface = window.sessionStorage.getItem(MESSAGE_SURFACE_KEY)
    const lastConversationPath = getLastConversationPath()
    if (surface === 'detail' && lastConversationPath) return lastConversationPath
  } catch {
    return '/messages'
  }
  return '/messages'
}

export function getLastConversationId() {
  if (typeof window === 'undefined') return null
  try {
    return normalizeConversationId(window.sessionStorage.getItem(LAST_CONVERSATION_KEY))
  } catch {
    return null
  }
}

export function getLastConversationPath() {
  return buildConversationPath(getLastConversationId())
}

export function buildReturnToConversation(conversationId) {
  return buildConversationPath(conversationId)
}

export function getReturnToConversation(location, fallbackConversationId) {
  const explicit = getExplicitReturnToConversation(location)
  if (explicit) return explicit
  return buildConversationPath(fallbackConversationId || getLastConversationId())
}

export function getExplicitReturnToConversation(location) {
  const state = location?.state || {}
  const search = new URLSearchParams(location?.search || '')
  const explicitReturnTo = sanitizeConversationReturnPath(state.returnTo || search.get('returnTo'))
  if (explicitReturnTo) return explicitReturnTo
  return buildConversationPath(
    state.conversationId
    || search.get('conversationId')
  )
}

export function navigateToConversation(navigate, conversationId, options = {}) {
  const path = buildConversationPath(conversationId)
  if (!path || typeof navigate !== 'function') return false
  rememberLastConversation(conversationId, options.meta)
  navigate(path, options)
  return true
}

export function navigateBackToConversation(navigate, location, fallbackConversationId, options = {}) {
  const path = getReturnToConversation(location, fallbackConversationId)
  if (!path || typeof navigate !== 'function') return false
  navigate(path, options)
  return true
}

export function buildOrderPathWithReturn(orderId, conversationId) {
  const normalizedOrderId = normalizePositiveId(orderId)
  if (!normalizedOrderId) return null
  const returnTo = buildReturnToConversation(conversationId)
  const search = new URLSearchParams({ orderId: String(normalizedOrderId) })
  if (returnTo) {
    search.set('conversationId', String(normalizeConversationId(conversationId)))
    search.set('returnTo', returnTo)
    search.set('source', 'conversation')
  }
  return {
    to: `/orders?${search.toString()}`,
    state: {
      workflowSource: returnTo ? 'conversation' : undefined,
      orderId: normalizedOrderId,
      conversationId: normalizeConversationId(conversationId),
      returnTo
    }
  }
}

export function buildDeliveryPathWithReturn(orderId, deliveryId, conversationId) {
  const normalizedOrderId = normalizePositiveId(orderId)
  const normalizedDeliveryId = normalizePositiveId(deliveryId)
  if (!normalizedOrderId || !normalizedDeliveryId) return null
  const returnTo = buildReturnToConversation(conversationId)
  const search = new URLSearchParams()
  if (returnTo) {
    search.set('conversationId', String(normalizeConversationId(conversationId)))
    search.set('returnTo', returnTo)
    search.set('source', 'conversation')
  }
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return {
    to: `/orders/${normalizedOrderId}/deliveries/${normalizedDeliveryId}${suffix}`,
    state: {
      workflowSource: returnTo ? 'conversation' : undefined,
      orderId: normalizedOrderId,
      deliveryId: normalizedDeliveryId,
      conversationId: normalizeConversationId(conversationId),
      returnTo
    }
  }
}

export function navigateToOrderFromConversation(navigate, { orderId, conversationId } = {}, options = {}) {
  const target = buildOrderPathWithReturn(orderId, conversationId)
  if (!target || typeof navigate !== 'function') return false
  if (conversationId) rememberLastConversation(conversationId)
  navigate(target.to, { state: target.state, ...options })
  return true
}

export function navigateToDeliveryFromConversation(navigate, { orderId, deliveryId, conversationId } = {}, options = {}) {
  const target = buildDeliveryPathWithReturn(orderId, deliveryId, conversationId)
  if (!target || typeof navigate !== 'function') return false
  if (conversationId) rememberLastConversation(conversationId)
  navigate(target.to, { state: target.state, ...options })
  return true
}

function sanitizeConversationReturnPath(value) {
  const text = String(value || '')
  return /^\/messages\/\d+$/.test(text) ? text : ''
}

function normalizePositiveId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}
