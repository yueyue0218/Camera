export const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: '待支付',
  PAID_PENDING_SHOOT: '已支付待拍摄',
  SHOOTING: '拍摄中',
  PENDING_DELIVERY: '待交付',
  DELIVERED_PENDING_CONFIRM: '已交付待确认',
  REWORK_REQUIRED: '返修中',
  APPEALING: '申诉中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款'
}

export const ESCROW_STATUS_LABELS = {
  NOT_PAID: '未支付',
  HELD: '平台托管中',
  RELEASED: '已结算给服务方',
  REFUNDED: '已退款'
}

export const SETTLEMENT_STATUS_LABELS = {
  NOT_SETTLED: '未结算',
  SETTLED: '已结算'
}

export const PHOTO_AUTHORIZATION_STATUS_LABELS = {
  PENDING: '待客户确认',
  GRANTED: '已授权展示',
  REJECTED: '已拒绝展示'
}

const NORMAL_ACTION_BLOCKED_STATUSES = new Set(['APPEALING', 'CANCELLED', 'REFUNDED'])

function userIdOf(currentUser) {
  return Number(currentUser?.userId)
}

function isCustomer(order, currentUser) {
  return Boolean(order) && Number(order.customerId) === userIdOf(currentUser)
}

function isProvider(order, currentUser) {
  return Boolean(order) && Number(order.providerUserId) === userIdOf(currentUser)
}

export function canCustomerPay(order, currentUser) {
  return isCustomer(order, currentUser) && order.status === 'PENDING_PAYMENT'
}

export function canCustomerConfirm(order, currentUser) {
  return isCustomer(order, currentUser) && order.status === 'DELIVERED_PENDING_CONFIRM'
}

export function canCustomerRequestRework(order, currentUser) {
  return isCustomer(order, currentUser) && order.status === 'DELIVERED_PENDING_CONFIRM'
}

export function canProviderUploadDelivery(order, currentUser) {
  return isProvider(order, currentUser)
    && (order.status === 'PENDING_DELIVERY' || order.status === 'REWORK_REQUIRED')
}

export function canProviderRequestPhotoAuthorization(order, currentUser) {
  return isProvider(order, currentUser) && order.status === 'COMPLETED'
}

export function canCustomerReviewPhotoAuthorization(order, currentUser, authorization) {
  return isCustomer(order, currentUser)
    && order.status === 'COMPLETED'
    && authorization?.status === 'PENDING'
}

export function canShowOrderNormalActions(order) {
  return Boolean(order?.status) && !NORMAL_ACTION_BLOCKED_STATUSES.has(order.status)
}
