import {
  ESCROW_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  SETTLEMENT_STATUS_LABELS
} from '../../utils/displayFormatters.js'
import { getOrderActionVisibility } from '../../utils/orderActionVisibility.js'

export { ESCROW_STATUS_LABELS, ORDER_STATUS_LABELS, SETTLEMENT_STATUS_LABELS }

export const PHOTO_AUTHORIZATION_STATUS_LABELS = {
  PENDING: '待客户确认',
  GRANTED: '已授权展示',
  REJECTED: '已拒绝展示'
}

export function canCustomerPay(order, currentUser) {
  return getOrderActionVisibility(order, currentUser).canPay
}

export function canCustomerConfirm(order, currentUser, options = {}) {
  return getOrderActionVisibility(order, currentUser, options).canConfirmDelivery
}

export function canCustomerRequestRework(order, currentUser, options = {}) {
  return getOrderActionVisibility(order, currentUser, options).canRequestRework
}

export function canProviderUploadDelivery(order, currentUser, options = {}) {
  const visibility = getOrderActionVisibility(order, currentUser, options)
  return visibility.canUploadDelivery || visibility.canReuploadDelivery
}

export function canProviderRequestPhotoAuthorization(order, currentUser, options = {}) {
  return getOrderActionVisibility(order, currentUser, options).canRequestPhotoAuthorization
}

export function canCustomerReviewPhotoAuthorization(order, currentUser, authorization) {
  return getOrderActionVisibility(order, currentUser, {
    authorizations: authorization ? [authorization] : []
  }).canReviewPhotoAuthorization
}

export function canShowOrderNormalActions(order) {
  return getOrderActionVisibility(order, null).canShowNormalActions
}
