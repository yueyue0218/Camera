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
