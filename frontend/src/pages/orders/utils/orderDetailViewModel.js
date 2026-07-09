import { getWorkflowStatusDotColor } from '../orderWorkflowTokens.js'
import {
  addDays,
  formatEscrowStatus,
  formatOrderStatus,
  formatOrderTitle,
  formatRefundStatus,
  formatSettlementStatus,
  formatTime,
  getLatestDeliveryUploadTime,
  parseQuoteSnapshot,
  sanitizeSeedText
} from './orderStatusUtils.js'
import {
  formatDateOnly,
  formatPhotoUsageScope
} from '../../../utils/displayFormatters.js'

export function parseInputDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getOrderPerspective(order, currentUser) {
  if (!order || !currentUser) return ''
  if (Number(order.customerId) === Number(currentUser.userId)) return '客户'
  if (Number(order.providerUserId) === Number(currentUser.userId)) return '摄影师'
  return '协作方'
}

export function getCounterpartyLabel(order, currentUser) {
  if (!order || !currentUser) return '对方未确认'
  if (Number(order.customerId) === Number(currentUser.userId)) return '摄影师'
  if (Number(order.providerUserId) === Number(currentUser.userId)) return '客户'
  return '订单参与方'
}

export function getSettlementRefundLabel(order) {
  return `${formatSettlementStatus(order?.settlementStatus)} / ${formatRefundStatus(order?.refundStatus)}`
}

export function formatOrderTimeRange(order) {
  return `${formatTime(order?.shootStartTime)} 至 ${formatTime(order?.shootEndTime)}`
}

export function formatOrderIndexDate(order) {
  const label = formatDateOnly(order?.shootStartTime || order?.createdAt, '')
  return label ? label.slice(5).replace('-', '/') : '待定'
}

export function getOrderStatusDotColor(status) {
  return getWorkflowStatusDotColor(status)
}

export function formatQuoteCount(quoteSnapshot) {
  const originalCount = quoteSnapshot?.originalCount
  const refinedCount = quoteSnapshot?.refinedCount
  if (originalCount === undefined && refinedCount === undefined) return '未填写'
  return `${originalCount ?? 0} / ${refinedCount ?? 0}`
}

export function buildOrderMetaText(order, counterpartyLabel, locationLabel) {
  const timeText = formatOrderTimeRange(order)
  return [counterpartyLabel, timeText, locationLabel].filter(Boolean).join(' · ')
}

export function buildOrderSummaryRows({ order, quoteSnapshot, deliveryText, estimatedAutoConfirmTime }) {
  if (estimatedAutoConfirmTime) {
    return [
      { label: '交付内容', value: deliveryText || '按约定交付' },
      { label: '照片用途', value: formatPhotoUsageScope(quoteSnapshot?.photoUsageScope) },
      { label: '结算状态', value: formatEscrowStatus(order?.escrowStatus) },
      { label: '自动确认', value: formatShortDateTime(estimatedAutoConfirmTime) }
    ]
  }

  return [
    {
      label: '成片截止',
      value: formatTime(order?.deliveryDeadline),
      tone: isDeadlineClose(order?.deliveryDeadline) ? 'warning' : undefined
    },
    { label: '交付内容', value: deliveryText || '按约定交付' },
    { label: '结算状态', value: formatEscrowStatus(order?.escrowStatus) },
    { label: '照片用途', value: formatPhotoUsageScope(quoteSnapshot?.photoUsageScope) }
  ]
}

export function formatDeliveryBatchContent(batch) {
  if (!batch) return '等待上传'
  const imageCount = Number(batch.imageCount || 0)
  const zipCount = Number(batch.zipCount || 0)
  const parts = []
  if (imageCount) parts.push(`${imageCount} 张图片`)
  if (zipCount) parts.push(`${zipCount} 个压缩包`)
  return parts.length ? parts.join(' · ') : '已上传作品'
}

export function getLatestDeliveryBatch(batches = []) {
  return [...batches].sort((left, right) => {
    const leftTime = left?.latestUploadTime ? new Date(left.latestUploadTime).getTime() : 0
    const rightTime = right?.latestUploadTime ? new Date(right.latestUploadTime).getTime() : 0
    return rightTime - leftTime
  })[0] || null
}

export function formatDeadlineDistance(value) {
  const deadline = parseInputDate(value)
  if (!deadline) return '未设置截止时间'
  const diff = deadline.getTime() - Date.now()
  if (diff <= 0) return '已到截止时间'
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  if (days > 0) return `${days} 天 ${remainHours} 小时`
  if (hours > 0) return `${hours} 小时`
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)))
  return `${minutes} 分钟`
}

export function formatShortDateTime(value) {
  const date = parseInputDate(value)
  if (!date) return '待同步'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

export function isDeadlineClose(value) {
  const deadline = parseInputDate(value)
  if (!deadline) return false
  return deadline.getTime() - Date.now() < 24 * 60 * 60 * 1000
}

export function formatAuthorizationSummary(records = []) {
  if (!records.length) return '暂无申请'
  const latest = records[0]
  const status = String(latest.status || latest.authorizationStatus || '').toUpperCase()
  if (status === 'APPROVED' || status === 'GRANTED') return '已同意'
  if (status === 'REJECTED') return '已拒绝'
  return '待客户确认'
}

export function getAuthorizationFollowupTone(records = []) {
  const label = formatAuthorizationSummary(records)
  if (label === '已同意') return 'success'
  if (label === '待客户确认') return 'warning'
  return 'default'
}

export function formatReviewFollowupStatus({ canReview, myReview, reviewToComplain, orderReviews = [], arbitrations = [] }) {
  if (reviewToComplain) return '可发起申诉'
  if (arbitrations.length) return '有申诉记录'
  if (myReview) return '已评价'
  if (canReview) return '可评价'
  if (orderReviews.length) return '已有评价'
  return '暂未开放'
}

export function getReviewFollowupTone(context) {
  const status = formatReviewFollowupStatus(context)
  if (status === '可评价' || status === '可发起申诉') return 'warning'
  if (status === '已评价' || status === '已有评价') return 'success'
  return 'default'
}

export function hasComplaintResult(item) {
  const result = String(item?.arbitrationResult || '').trim().toUpperCase()
  const status = String(item?.status || '').trim().toUpperCase()
  return Boolean(
    result
    || item?.handledAt
    || status === 'APPROVED'
    || status === 'REJECTED'
    || status === 'RESOLVED'
  )
}

export function buildOrderProgressItems({ order, statusLogs = [], deliveryRecords = [], currentUser }) {
  const status = order?.status || ''
  const hasDelivery = deliveryRecords.length > 0 || ['DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED'].includes(status)
  const isCustomer = Number(order?.customerId) === Number(currentUser?.userId)
  const completedStatuses = new Set(['COMPLETED'])
  const refundedOrCancelled = ['CANCELLED', 'REFUNDED'].includes(status)
  const steps = [
    {
      id: 'payment',
      title: '支付成功',
      complete: status !== 'PENDING_PAYMENT',
      time: findStatusTime(statusLogs, ['PAID_PENDING_SHOOT', 'SHOOTING', 'PENDING_DELIVERY', 'DELIVERED_PENDING_CONFIRM', 'COMPLETED'])
    },
    {
      id: 'shoot-start',
      title: '拍摄开始',
      complete: ['SHOOTING', 'PENDING_DELIVERY', 'DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED'].includes(status),
      current: status === 'SHOOTING',
      time: formatShortDateTime(order?.shootStartTime)
    },
    {
      id: 'shoot-end',
      title: '拍摄结束',
      complete: ['PENDING_DELIVERY', 'DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED'].includes(status),
      current: status === 'PENDING_DELIVERY',
      time: formatShortDateTime(order?.shootEndTime)
    },
    {
      id: 'delivery',
      title: hasDelivery ? '摄影师上传作品' : '待上传作品',
      complete: hasDelivery,
      current: status === 'PENDING_DELIVERY',
      time: hasDelivery ? findStatusTime(statusLogs, ['DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED']) : ''
    },
    {
      id: 'confirm',
      title: isCustomer ? '待你确认' : '待客户确认',
      complete: completedStatuses.has(status),
      current: status === 'DELIVERED_PENDING_CONFIRM',
      time: completedStatuses.has(status) ? findStatusTime(statusLogs, ['COMPLETED']) : ''
    },
    {
      id: 'complete',
      title: refundedOrCancelled ? formatOrderStatus(status) : '订单完成',
      complete: completedStatuses.has(status) || refundedOrCancelled,
      current: completedStatuses.has(status) || refundedOrCancelled,
      time: completedStatuses.has(status) || refundedOrCancelled ? findStatusTime(statusLogs, [status]) : ''
    }
  ]

  return steps.map(step => ({
    ...step,
    state: step.current ? 'current' : step.complete ? 'complete' : 'upcoming'
  }))
}

export function findStatusTime(statusLogs = [], statuses = []) {
  const match = statusLogs.find(log => statuses.includes(log.toStatus))
  return match?.createdAt ? formatTime(match.createdAt) : ''
}

export function buildOrderDetailViewModel({
  selectedOrder,
  currentUser,
  quoteSnapshot = parseQuoteSnapshot(selectedOrder?.quoteSnapshotJson),
  deliveryRecords = [],
  deliveryBatches = [],
  statusLogs = [],
  photoAuthorizations = [],
  reviewContext = {}
}) {
  const latestDeliveryBatch = getLatestDeliveryBatch(deliveryBatches)
  const latestDeliveryUploadTime = getLatestDeliveryUploadTime(deliveryRecords)
  const estimatedAutoConfirmTime = latestDeliveryUploadTime ? addDays(latestDeliveryUploadTime, 7) : null
  const counterpartyLabel = getCounterpartyLabel(selectedOrder, currentUser)
  const location = quoteSnapshot?.location || selectedOrder?.shootLocation || '未填写'
  const deliveryText = quoteSnapshot ? formatQuoteCount(quoteSnapshot) : formatDeliveryBatchContent(latestDeliveryBatch)
  const reviewStatusContext = {
    canReview: reviewContext.canReview,
    myReview: reviewContext.myReview,
    reviewToComplain: reviewContext.reviewToComplain,
    orderReviews: reviewContext.orderReviews,
    arbitrations: reviewContext.arbitrations
  }

  return {
    quoteSnapshot,
    latestDeliveryBatch,
    latestDeliveryUploadTime,
    estimatedAutoConfirmTime,
    perspective: selectedOrder ? getOrderPerspective(selectedOrder, currentUser) : '',
    counterpartyLabel,
    location,
    serviceContent: sanitizeSeedText(quoteSnapshot?.serviceContent || selectedOrder?.serviceContent, '校园约拍服务'),
    title: selectedOrder ? formatOrderTitle(selectedOrder, quoteSnapshot) : '',
    metaText: selectedOrder ? buildOrderMetaText(selectedOrder, counterpartyLabel, location) : '',
    deliveryText,
    summaryRows: selectedOrder ? buildOrderSummaryRows({
      order: selectedOrder,
      quoteSnapshot,
      deliveryText,
      estimatedAutoConfirmTime
    }) : [],
    timelineItems: selectedOrder ? buildOrderProgressItems({
      order: selectedOrder,
      statusLogs,
      deliveryRecords,
      currentUser
    }) : [],
    authorizationSummary: formatAuthorizationSummary(photoAuthorizations),
    authorizationTone: getAuthorizationFollowupTone(photoAuthorizations),
    reviewStatus: formatReviewFollowupStatus(reviewStatusContext),
    reviewTone: getReviewFollowupTone(reviewStatusContext)
  }
}
