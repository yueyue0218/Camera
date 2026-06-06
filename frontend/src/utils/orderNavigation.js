export function normalizeOrderId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function buildOrderNavigationTarget(value) {
  const orderId = normalizeOrderId(value)
  if (!orderId) return null
  return {
    to: `/orders?orderId=${orderId}`,
    state: { orderId }
  }
}

export function goToOrder(navigate, value, options = {}) {
  const target = buildOrderNavigationTarget(value)
  if (!target || typeof navigate !== 'function') return false
  navigate(target.to, { state: target.state, ...options })
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
