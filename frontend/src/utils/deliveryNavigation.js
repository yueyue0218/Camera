import { normalizeConversationId } from './conversationNavigation.js'
import { normalizeOrderId } from './orderNavigation.js'
import { WORKFLOW_SOURCES, normalizeWorkflowSource } from './workflowNavigation.js'

export function normalizeDeliveryId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function buildDeliveryGalleryTarget({ orderId, deliveryId, conversationId, returnTo: explicitReturnTo, source } = {}) {
  const normalizedOrderId = normalizeOrderId(orderId)
  const normalizedDeliveryId = normalizeDeliveryId(deliveryId)
  const normalizedConversationId = normalizeConversationId(conversationId)
  if (!normalizedOrderId || !normalizedDeliveryId) return null
  const returnTo = sanitizeConversationReturnPath(explicitReturnTo)
  const workflowSource = normalizeWorkflowSource(source) || (returnTo ? WORKFLOW_SOURCES.conversation : WORKFLOW_SOURCES.order)
  const params = new URLSearchParams()
  if (normalizedConversationId) params.set('conversationId', String(normalizedConversationId))
  if (returnTo) params.set('returnTo', returnTo)
  params.set('source', workflowSource)
  const search = params.toString() ? `?${params.toString()}` : ''
  return {
    to: `/orders/${normalizedOrderId}/deliveries/${normalizedDeliveryId}${search}`,
    state: {
      workflowSource,
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
  navigate(target.to, { ...options, state: { ...target.state, ...(options.state || {}) } })
  return true
}

function sanitizeConversationReturnPath(value) {
  const text = String(value || '')
  return /^\/messages\/\d+$/.test(text) ? text : ''
}
