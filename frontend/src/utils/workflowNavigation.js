import { buildConversationPath, normalizeConversationId } from './conversationNavigation.js'
import { normalizeOrderId } from './orderNavigation.js'

export const WORKFLOW_SOURCES = Object.freeze({
  conversation: 'conversation',
  order: 'order',
  orderList: 'order-list',
  direct: 'direct'
})

export const ORDER_SURFACES = Object.freeze({
  list: 'list',
  detail: 'detail'
})

export function normalizeWorkflowSource(value) {
  const source = String(value || '').trim()
  return Object.values(WORKFLOW_SOURCES).includes(source) ? source : ''
}

export function normalizeOrderSurface(value) {
  const surface = String(value || '').trim()
  return Object.values(ORDER_SURFACES).includes(surface) ? surface : ''
}

export function getWorkflowSource(location) {
  const stateSource = normalizeWorkflowSource(location?.state?.workflowSource)
  if (stateSource) return stateSource
  const search = new URLSearchParams(location?.search || '')
  return normalizeWorkflowSource(search.get('source'))
}

export function getOrderSurface(location) {
  const stateSurface = normalizeOrderSurface(location?.state?.orderSurface)
  if (stateSurface) return stateSurface
  const search = new URLSearchParams(location?.search || '')
  return normalizeOrderSurface(search.get('surface'))
}

export function isOrderListSurface(location) {
  return getOrderSurface(location) === ORDER_SURFACES.list
    || getWorkflowSource(location) === WORKFLOW_SOURCES.orderList
}

export function buildWorkflowState({
  source,
  orderSurface,
  orderId,
  deliveryId,
  conversationId,
  returnTo
} = {}) {
  const normalizedSource = normalizeWorkflowSource(source)
  const normalizedSurface = normalizeOrderSurface(orderSurface)
  const normalizedOrderId = normalizeOrderId(orderId)
  const normalizedConversationId = normalizeConversationId(conversationId)
  const conversationReturnTo = sanitizeConversationReturnPath(returnTo)
  return {
    ...(normalizedSource ? { workflowSource: normalizedSource } : {}),
    ...(normalizedSurface ? { orderSurface: normalizedSurface } : {}),
    ...(normalizedOrderId ? { orderId: normalizedOrderId } : {}),
    ...(deliveryId ? { deliveryId } : {}),
    ...(normalizedConversationId ? { conversationId: normalizedConversationId } : {}),
    ...(conversationReturnTo ? { returnTo: conversationReturnTo } : {})
  }
}

export function buildOrderListTarget() {
  const params = new URLSearchParams({
    surface: ORDER_SURFACES.list,
    source: WORKFLOW_SOURCES.orderList
  })
  return {
    to: `/orders?${params.toString()}`,
    state: buildWorkflowState({
      source: WORKFLOW_SOURCES.orderList,
      orderSurface: ORDER_SURFACES.list
    })
  }
}

export function getConversationReturnPath(location, fallbackConversationId) {
  const state = location?.state || {}
  const search = new URLSearchParams(location?.search || '')
  return sanitizeConversationReturnPath(state.returnTo || search.get('returnTo'))
    || buildConversationPath(state.conversationId || search.get('conversationId') || fallbackConversationId)
}

function sanitizeConversationReturnPath(value) {
  const text = String(value || '')
  return /^\/messages\/\d+$/.test(text) ? text : ''
}
