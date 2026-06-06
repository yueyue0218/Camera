import { normalizeConversationId } from './conversationNavigation.js'
import { normalizeOrderId } from './orderNavigation.js'

export function normalizeDeliveryId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function buildDeliveryGalleryTarget({ orderId, deliveryId, conversationId, returnTo: explicitReturnTo } = {}) {
  const normalizedOrderId = normalizeOrderId(orderId)
  const normalizedDeliveryId = normalizeDeliveryId(deliveryId)
  const normalizedConversationId = normalizeConversationId(conversationId)
  if (!normalizedOrderId || !normalizedDeliveryId) return null
  const returnTo = sanitizeConversationReturnPath(explicitReturnTo)
  const params = new URLSearchParams()
  if (normalizedConversationId) params.set('conversationId', String(normalizedConversationId))
  if (returnTo) params.set('returnTo', returnTo)
  const search = params.toString() ? `?${params.toString()}` : ''
  return {
    to: `/orders/${normalizedOrderId}/deliveries/${normalizedDeliveryId}${search}`,
    state: {
      orderId: normalizedOrderId,
      deliveryId: normalizedDeliveryId,
      conversationId: normalizedConversationId,
      returnTo
    }
  }
}

export function goToDeliveryGallery(navigate, params, options = {}) {
  const target = buildDeliveryGalleryTarget(params)
  if (!target || typeof navigate !== 'function') return false
  navigate(target.to, { state: target.state, ...options })
  return true
}

function sanitizeConversationReturnPath(value) {
  const text = String(value || '')
  return /^\/messages\/\d+$/.test(text) ? text : ''
}
