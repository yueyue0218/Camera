import { normalizeOrderId } from './orderNavigation.js'

export function normalizeDeliveryId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function buildDeliveryGalleryTarget({ orderId, deliveryId, conversationId } = {}) {
  const normalizedOrderId = normalizeOrderId(orderId)
  const normalizedDeliveryId = normalizeDeliveryId(deliveryId)
  if (!normalizedOrderId || !normalizedDeliveryId) return null
  const search = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ''
  return {
    to: `/orders/${normalizedOrderId}/deliveries/${normalizedDeliveryId}${search}`,
    state: {
      orderId: normalizedOrderId,
      deliveryId: normalizedDeliveryId,
      conversationId
    }
  }
}

export function goToDeliveryGallery(navigate, params, options = {}) {
  const target = buildDeliveryGalleryTarget(params)
  if (!target || typeof navigate !== 'function') return false
  navigate(target.to, { state: target.state, ...options })
  return true
}
