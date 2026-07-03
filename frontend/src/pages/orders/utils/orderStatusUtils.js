import { centToYuan } from '../../../utils/index.js'
import {
  ESCROW_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  SETTLEMENT_STATUS_LABELS,
  formatChineseDateTime,
  formatEscrowStatus as formatDisplayEscrowStatus,
  formatOrderStatus as formatDisplayOrderStatus,
  formatOrderTitle as formatDisplayOrderTitle,
  formatSettlementStatus as formatDisplaySettlementStatus,
  sanitizeSeedText as sanitizeDisplaySeedText
} from '../../../utils/displayFormatters.js'

const LOCAL_REVIEW_STORAGE_KEY = 'camera-p4-local-reviews'
const ARBITRATION_STORAGE_KEY = 'camera-p4-arbitrations'
const ORDER_SNAPSHOT_STORAGE_KEY = 'camera-p4-order-snapshots'

export const orderStatusMap = {
  ...ORDER_STATUS_LABELS
}

export const escrowStatusMap = {
  ...ESCROW_STATUS_LABELS
}

export const settlementStatusMap = {
  ...SETTLEMENT_STATUS_LABELS
}

export const refundStatusMap = {
  NONE: '暂无退款',
  REQUESTED: '退款处理中',
  REFUNDED: '已退款'
}

export const complaintStatusMap = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  RESOLVED: '已处理',
  REJECTED: '已驳回'
}

export function formatOrderStatus(status, fallback = '状态已更新') {
  return formatDisplayOrderStatus(status, fallback)
}

export function formatEscrowStatus(status, fallback = '托管状态待同步') {
  return formatDisplayEscrowStatus(status, fallback)
}

export function formatSettlementStatus(status, fallback = '未结算') {
  return formatDisplaySettlementStatus(status, fallback)
}

export function formatRefundStatus(status, fallback = '暂无退款') {
  return refundStatusMap[status] || fallback
}

export function sanitizeSeedText(value, fallback = '校园约拍服务') {
  return sanitizeDisplaySeedText(value, fallback)
}

export function formatOrderTitle(order, quoteSnapshot) {
  return formatDisplayOrderTitle(order, quoteSnapshot)
}

export function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function isApiUnavailable(error) {
  return Boolean(error?.isNetworkError)
    || error?.status === 404
    || (error?.code === 50001 && /No static resource|No endpoint|not found/i.test(error.message || ''))
}

export function readLocalReviews() {
  return readJsonStorage(LOCAL_REVIEW_STORAGE_KEY, [])
}

export function saveLocalReview(review) {
  const reviews = readLocalReviews()
  const nextReview = {
    ...review,
    reviewId: review.reviewId || `local-review-${review.orderId}-${review.reviewerId}-${Date.now()}`,
    rating: Number(review.rating),
    createdAt: review.createdAt || new Date().toISOString(),
    isVisible: review.isVisible ?? true,
    isLocal: true
  }
  const nextReviews = [
    nextReview,
    ...reviews.filter(item => String(item.reviewId) !== String(nextReview.reviewId))
  ]
  writeJsonStorage(LOCAL_REVIEW_STORAGE_KEY, nextReviews)
  return nextReview
}

function readLocalArbitrations() {
  return readJsonStorage(ARBITRATION_STORAGE_KEY, [])
}

export function saveLocalArbitration(record) {
  const records = readLocalArbitrations()
  const nextRecord = {
    ...record,
    arbitrationId: record.arbitrationId || `arb-${record.orderId}-${record.applicantId}-${Date.now()}`,
    status: record.status || 'PENDING',
    createdAt: record.createdAt || new Date().toISOString()
  }
  writeJsonStorage(ARBITRATION_STORAGE_KEY, [nextRecord, ...records])
  return nextRecord
}

function normalizeComplaint(record) {
  if (!record) return null
  return {
    arbitrationId: record.arbitrationId || record.complaintId,
    complaintId: record.complaintId,
    reviewId: record.reviewId,
    orderId: Number(record.orderId),
    applicantId: Number(record.applicantId ?? record.complainantId),
    complainantNickname: record.complainantNickname || '',
    respondentId: Number(record.respondentId),
    respondentNickname: record.respondentNickname || '',
    reason: record.reason || '评价争议',
    description: record.description || record.arbitrationComment || record.evidenceFileIds || '',
    status: record.status || 'PENDING',
    arbitrationResult: record.arbitrationResult,
    arbitrationComment: record.arbitrationComment || '',
    handledByNickname: record.handledByNickname || '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    handledAt: record.handledAt
  }
}

export function mergeComplaints(...lists) {
  const map = new Map()
  lists.flat().filter(Boolean).map(normalizeComplaint).filter(Boolean).forEach(record => {
    const key = record.complaintId || record.arbitrationId || `${record.reviewId}-${record.applicantId}-${record.createdAt}`
    map.set(String(key), record)
  })
  return Array.from(map.values()).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

export function readOrderSnapshots() {
  return readJsonStorage(ORDER_SNAPSHOT_STORAGE_KEY, {})
}

export function saveOrderSnapshots(orders) {
  if (!Array.isArray(orders) || !orders.length) return
  const store = readOrderSnapshots()
  orders.forEach(order => {
    if (order?.orderId) {
      store[String(order.orderId)] = {
        ...store[String(order.orderId)],
        ...order,
        cachedAt: new Date().toISOString()
      }
    }
  })
  writeJsonStorage(ORDER_SNAPSHOT_STORAGE_KEY, store)
}

export function isOrderParticipant(order, userId) {
  return Number(order?.customerId) === Number(userId) || Number(order?.providerUserId) === Number(userId)
}

export function getOrderReviewDirection(order, userId) {
  if (Number(order?.customerId) === Number(userId)) return 'CUSTOMER_TO_PROVIDER'
  if (Number(order?.providerUserId) === Number(userId)) return 'PROVIDER_TO_CUSTOMER'
  return ''
}

export function getReviewTargetUserId(order, reviewerId) {
  return Number(order?.customerId) === Number(reviewerId)
    ? Number(order.providerUserId)
    : Number(order?.customerId)
}

function normalizeReview(review) {
  if (!review) return null
  return {
    reviewId: review.reviewId || review.id,
    orderId: Number(review.orderId),
    reviewerId: Number(review.reviewerId),
    reviewerNickname: review.reviewerNickname || '',
    targetUserId: Number(review.targetUserId),
    targetUserNickname: review.targetUserNickname || '',
    direction: review.direction,
    rating: Number(review.rating || 0),
    content: review.content || '',
    isVisible: review.isVisible ?? true,
    createdAt: review.createdAt,
    replyContent: review.replyContent || '',
    replyTime: review.replyTime || null,
    complaintStatus: review.complaintStatus || ''
  }
}

export function mergeReviewLists(...lists) {
  const map = new Map()
  lists.flat().filter(Boolean).map(normalizeReview).filter(Boolean).forEach(review => {
    const key = review.reviewId || `${review.orderId}-${review.direction}-${review.reviewerId}`
    map.set(String(key), review)
  })
  return Array.from(map.values()).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

export function getLocalReviewsByOrder(orderId) {
  return readLocalReviews().filter(review => Number(review.orderId) === Number(orderId))
}

export function getArbitrationsByOrder(orderId) {
  return mergeComplaints(readLocalArbitrations().filter(record => Number(record.orderId) === Number(orderId)))
}

export function directionLabel(direction) {
  if (direction === 'CUSTOMER_TO_PROVIDER') return '客户评价摄影师'
  if (direction === 'PROVIDER_TO_CUSTOMER') return '摄影师评价客户'
  return '订单评价'
}

export function formatTime(value) {
  return formatChineseDateTime(value, '刚刚')
}

export function parseQuoteSnapshot(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function getLatestDeliveryUploadTime(records) {
  const latestTimestamp = records
    .map(record => new Date(record.uploadTime).getTime())
    .filter(timestamp => Number.isFinite(timestamp))
    .reduce((latest, timestamp) => Math.max(latest, timestamp), 0)
  return latestTimestamp ? new Date(latestTimestamp) : null
}

export function getOrderFulfillmentNotice(order, statusLogs, deliveryRecords, latestDeliveryUploadTime, estimatedAutoConfirmTime) {
  const status = order.status
  const baseRows = [
    ['托管状态', formatEscrowStatus(order.escrowStatus)],
    ['结算状态', formatSettlementStatus(order.settlementStatus)]
  ]
  const latestReworkLog = getLatestStatusLog(statusLogs, 'REWORK_REQUIRED')
  const latestCompletedLog = getLatestStatusLog(statusLogs, 'COMPLETED')

  if (status === 'PENDING_PAYMENT') {
    return {
      title: '等待客户支付',
      description: '客户支付后，资金进入平台担保，订单再进入待拍摄履约阶段。',
      color: 'warning',
      severity: 'info',
      rows: [
        ['订单金额', centToYuan(order.amountCent)],
        ...baseRows
      ],
      note: '支付完成前不应进入拍摄或上传作品。'
    }
  }

  if (status === 'PAID_PENDING_SHOOT') {
    return {
      title: '已支付，等待拍摄',
      description: '平台担保资金已建立，双方应按报价约定的拍摄时间履约。',
      color: 'info',
      severity: 'warning',
      rows: [
        ['拍摄开始', formatTimeOrMissing(order.shootStartTime)],
        ['拍摄结束', formatTimeOrMissing(order.shootEndTime)],
        ...baseRows
      ],
      note: '系统会根据约定拍摄开始/结束时间自动推进订单状态；页面刷新后可查看最新状态。'
    }
  }

  if (status === 'SHOOTING') {
    return {
      title: '拍摄中',
      description: '订单处于拍摄履约阶段，拍摄完成后才进入待上传作品。',
      color: 'info',
      severity: 'warning',
      rows: [
        ['拍摄开始', formatTimeOrMissing(order.shootStartTime)],
        ['拍摄结束', formatTimeOrMissing(order.shootEndTime)],
        ...baseRows
      ],
      note: '系统会根据约定拍摄开始/结束时间自动推进订单状态；页面刷新后可查看最新状态。'
    }
  }

  if (status === 'PENDING_DELIVERY') {
    return {
      title: '等待摄影师上传作品',
      description: '摄影师需通过作品入口上传作品，上传成功后订单进入待客户确认。',
      color: 'secondary',
      severity: 'info',
      rows: [
        ['成片截止时间', formatTimeOrMissing(order.deliveryDeadline)],
        ['已有作品记录', `${deliveryRecords.length} 条`],
        ...baseRows
      ],
      note: '若超过成片截止时间且摄影师未上传任何作品，系统将自动退款并结束订单。'
    }
  }

  if (status === 'DELIVERED_PENDING_CONFIRM') {
    return {
      title: '作品已上传，等待客户确认',
      description: '客户需确认接收作品，或提交返修要求；未处理时由后端自动确认任务处理。',
      color: 'primary',
      severity: latestDeliveryUploadTime ? 'info' : 'warning',
      rows: [
        ['最新上传时间', formatTimeOrMissing(latestDeliveryUploadTime)],
        ['预计自动确认时间', estimatedAutoConfirmTime ? formatTime(estimatedAutoConfirmTime) : '等待上传时间同步'],
        ['作品记录', `${deliveryRecords.length} 条`],
        ...baseRows
      ],
      note: '摄影师已上传作品。客户需在上传后 7 天内确认接收或提交返修要求；若 7 天内未处理，系统将自动确认订单完成并释放平台担保资金。前端仅展示规则，不模拟自动确认。'
    }
  }

  if (status === 'REWORK_REQUIRED') {
    return {
      title: '返修中',
      description: '客户已提交返修要求，等待摄影师重新上传作品。',
      color: 'warning',
      severity: 'warning',
      rows: [
        ['最近返修要求', latestReworkLog?.reason || latestReworkLog?.remark || '等待返修说明同步'],
        ['返修状态时间', formatTimeOrMissing(latestReworkLog?.createdAt)],
        ['已有作品记录', `${deliveryRecords.length} 条`],
        ...baseRows
      ],
      note: '摄影师必须通过作品入口重新上传作品；页面不会提供绕过上传的返修完成按钮。'
    }
  }

  if (status === 'COMPLETED') {
    return {
      title: '订单已完成',
      description: '订单完成后，托管资金应释放给摄影师，并进入结算完成状态。',
      color: 'success',
      severity: 'success',
      rows: [
        ['完成记录时间', formatTimeOrMissing(latestCompletedLog?.createdAt || order.completeTime)],
        ['自动确认时间', formatTimeOrMissing(order.autoConfirmTime)],
        ...baseRows
      ],
      note: '完成后的评价入口和照片授权入口在下方展示；若订单由 7 天规则自动确认，可通过状态日志查看系统完成记录。'
    }
  }

  if (status === 'APPEALING') {
    return {
      title: '订单申诉中',
      description: '订单处于争议处理阶段，正常履约动作应暂停。',
      color: 'error',
      severity: 'warning',
      rows: baseRows,
      note: '申诉/仲裁结果、退款或结算裁定仍待后端正式接口接入，本轮不假实现。'
    }
  }

  if (status === 'REFUNDED' || status === 'CANCELLED') {
    return {
      title: status === 'REFUNDED' ? '订单已退款' : '订单已取消',
      description: '订单已结束，不再展示正常履约动作。',
      color: 'default',
      severity: 'info',
      rows: [
        ['退款状态', formatRefundStatus(order.refundStatus)],
        ...baseRows
      ],
      note: '退款/取消后的后续处理以状态日志和后端返回为准。'
    }
  }

  return {
    title: '订单履约状态',
    description: '当前状态暂无专门提示。',
    color: 'default',
    severity: 'info',
    rows: baseRows,
    note: ''
  }
}

function getLatestStatusLog(statusLogs, targetStatus) {
  return statusLogs
    .filter(log => (log.toStatus || log.targetStatus || log.status) === targetStatus)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
}

function formatTimeOrMissing(value) {
  return value ? formatTime(value) : '待同步'
}

export function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}
