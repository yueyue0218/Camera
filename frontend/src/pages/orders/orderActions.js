import {
  ESCROW_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  SETTLEMENT_STATUS_LABELS
} from '../../utils/displayFormatters.js'

export { ESCROW_STATUS_LABELS, ORDER_STATUS_LABELS, SETTLEMENT_STATUS_LABELS }

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
