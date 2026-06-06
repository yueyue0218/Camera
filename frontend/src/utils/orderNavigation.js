import { buildConversationPath, normalizeConversationId } from './conversationNavigation.js'

export function normalizeOrderId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function buildOrderNavigationTarget(value, options = {}) {
  const orderId = normalizeOrderId(value)
  if (!orderId) return null
  const conversationId = normalizeConversationId(options.conversationId)
  const returnTo = sanitizeOrderReturnPath(options.returnTo) || buildConversationPath(conversationId)
  const search = new URLSearchParams({ orderId: String(orderId) })
  if (conversationId) search.set('conversationId', String(conversationId))
  if (returnTo) search.set('returnTo', returnTo)
  return {
    to: `/orders?${search.toString()}`,
    state: { orderId, conversationId, returnTo }
  }
}

export function goToOrder(navigate, value, options = {}) {
  const target = buildOrderNavigationTarget(value, options)
  if (!target || typeof navigate !== 'function') return false
  navigate(target.to, { ...options, state: { ...target.state, ...(options.state || {}) } })
  return true
}

export function buildOrderAction(orderOrId, options = {}) {
  const orderId = normalizeOrderId(
    typeof orderOrId === 'object' ? orderOrId?.orderId : orderOrId
  )
  if (!orderId) return null
  return {
    label: options.label || '查看订单',
    orderId,
    target: buildOrderNavigationTarget(orderId),
    disabled: false
  }
}

export function buildQuoteAction(quote, options = {}) {
  const orderId = normalizeOrderId(
    quote?.orderId || quote?.order?.orderId || quote?.confirmedOrderId
  )
  if (!orderId) return null
  return buildOrderAction(orderId, {
    label: options.label || '查看订单'
  })
}

export function buildUserProfileTarget(actorOrUserId, currentUser) {
  const userId = normalizeUserId(
    typeof actorOrUserId === 'object' ? actorOrUserId?.userId : actorOrUserId
  )
  if (!userId) return null
  const currentUserId = normalizeUserId(currentUser?.userId)
  return {
    to: currentUserId && userId === currentUserId ? '/profile' : `/users/${userId}`,
    userId
  }
}

export function goToUserProfile(navigate, actorOrUserId, currentUser, options = {}) {
  const target = buildUserProfileTarget(actorOrUserId, currentUser)
  if (!target || typeof navigate !== 'function') return false
  navigate(target.to, options)
  return true
}

function normalizeUserId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function sanitizeOrderReturnPath(value) {
  const text = String(value || '')
  return /^\/messages\/\d+$/.test(text) ? text : ''
}
