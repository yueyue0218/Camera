import { deriveOrderWorkflowState } from './orderWorkflowModel.js'

const BLOCKED_STATUSES = new Set(['APPEALING', 'CANCELLED', 'REFUNDED'])

export function getOrderActionVisibility(order, currentUser, options = {}) {
  const role = getUserOrderRole(order, currentUser)
  const workflow = options.workflowState || deriveOrderWorkflowState(order, {
    currentUserRole: role,
    deliveries: options.deliveries
  })
  const status = order?.status || ''
  const hasDeliveryRecord = Array.isArray(options.deliveries) && options.deliveries.length > 0
  const hasPendingAuthorization = Array.isArray(options.authorizations)
    && options.authorizations.some(authorization => authorization?.status === 'PENDING')

  return {
    role,
    workflow,
    canPay: role === 'CUSTOMER' && status === 'PENDING_PAYMENT',
    canUploadDelivery: role === 'PROVIDER' && workflow.phase === 'WAITING_DELIVERY' && !BLOCKED_STATUSES.has(status),
    canReuploadDelivery: role === 'PROVIDER' && workflow.phase === 'REWORKING',
    canConfirmDelivery: role === 'CUSTOMER' && status === 'DELIVERED_PENDING_CONFIRM' && (hasDeliveryRecord || options.allowUnknownDeliveries === true),
    canRequestRework: role === 'CUSTOMER' && status === 'DELIVERED_PENDING_CONFIRM' && (hasDeliveryRecord || options.allowUnknownDeliveries === true),
    canRequestPhotoAuthorization: role === 'PROVIDER' && status === 'COMPLETED' && hasDeliveryRecord && !hasPendingAuthorization,
    canReviewPhotoAuthorization: role === 'CUSTOMER' && status === 'COMPLETED' && hasPendingAuthorization,
    canShowNormalActions: Boolean(status) && !BLOCKED_STATUSES.has(status)
  }
}

export function getUserOrderRole(order, currentUser) {
  const userId = Number(currentUser?.userId ?? currentUser?.id)
  if (!order || !userId) return ''
  if (Number(order.customerId) === userId) return 'CUSTOMER'
  if (Number(order.providerUserId) === userId) return 'PROVIDER'
  return ''
}
