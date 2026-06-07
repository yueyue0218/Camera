import { normalizeProductCopy } from './productCopy.js'

const UNKNOWN_STATUS_LABEL = '状态待确认'

export const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: '待付款',
  PAID: '已付款',
  PAID_PENDING_SHOOT: '待拍摄',
  SCHEDULED: '待拍摄',
  SHOOTING: '拍摄中',
  PENDING_DELIVERY: '待上传作品',
  DELIVERED_PENDING_CONFIRM: '待确认作品',
  REWORK_REQUIRED: '返修中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
  APPEALING: '申诉中'
}

export const PAYMENT_STATUS_LABELS = {
  NOT_PAID: '未付款',
  PAID: '已付款',
  REFUNDED: '已退款'
}

export const ESCROW_STATUS_LABELS = {
  NONE: '暂无',
  NOT_PAID: '未付款',
  HOLD: '平台担保中',
  HELD: '平台担保中',
  RELEASED: '已释放',
  REFUNDED: '已退款'
}

export const SETTLEMENT_STATUS_LABELS = {
  NONE: '暂无',
  NOT_SETTLED: '未结算',
  SETTLED: '已结算'
}

export const USER_ROLE_LABELS = {
  CUSTOMER: '客户',
  PROVIDER: '摄影师',
  ADMIN: '平台'
}

export const QUOTE_STATUS_LABELS = {
  PENDING_CONFIRM: '待确认',
  CONFIRMED: '已确认',
  REJECTED: '已拒绝',
  EXPIRED: '已过期',
  CANCELLED: '已取消'
}

export const PHOTO_USAGE_SCOPE_LABELS = {
  PERSONAL_ONLY: '仅限个人留念',
  PERSONAL_USE: '仅限个人留念',
  PRIVATE_USE: '仅限个人留念',
  PORTFOLIO_ALLOWED: '可申请展示授权',
  PUBLIC_DISPLAY: '可公开展示',
  PORTFOLIO_USE: '可公开展示',
  COMMERCIAL_ALLOWED: '商业使用',
  COMMERCIAL_USE: '商业使用'
}

const RAW_WORKFLOW_ENUM_PATTERN = /\b(?:PENDING_PAYMENT|PAID_PENDING_SHOOT|PAID|SCHEDULED|DELIVERED_PENDING_CONFIRM|REWORK_REQUIRED|NOT_SETTLED|SETTLED|NONE|HOLD|HELD|RELEASED|PERSONAL_ONLY|PERSONAL_USE|PRIVATE_USE|PORTFOLIO_ALLOWED|PUBLIC_DISPLAY|PORTFOLIO_USE|COMMERCIAL_ALLOWED|COMMERCIAL_USE)\b/g

function warnUnknown(kind, status) {
  if (status) {
    console.warn(`[display] unknown ${kind} status`, status)
  }
}

function normalizeDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function asArray(value) {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined) return []
  return [value]
}

export function formatEmpty(value, fallback = '暂无') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text ? text : fallback
}

export function formatMoney(value, fallback = '未填写') {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return `¥${(number / 100).toFixed(2)}`
}

export function formatDateTime(value, fallback = '待确认') {
  const date = normalizeDate(value)
  if (!date) return fallback
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export function formatDateOnly(value, fallback = '待确认') {
  const date = normalizeDate(value)
  if (!date) return fallback
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export function formatShortDate(value, fallback = '') {
  const date = normalizeDate(value)
  if (!date) return fallback
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function formatTimeRange(start, end, fallback = '待确认') {
  if (!start && !end) return fallback
  return `${formatDateTime(start, fallback)} 至 ${formatDateTime(end, fallback)}`
}

export function formatOrderStatus(status, fallback = UNKNOWN_STATUS_LABEL) {
  if (ORDER_STATUS_LABELS[status]) return ORDER_STATUS_LABELS[status]
  warnUnknown('order', status)
  return fallback
}

export function formatPaymentStatus(status, fallback = UNKNOWN_STATUS_LABEL) {
  if (PAYMENT_STATUS_LABELS[status]) return PAYMENT_STATUS_LABELS[status]
  warnUnknown('payment', status)
  return fallback
}

export function formatEscrowStatus(status, fallback = UNKNOWN_STATUS_LABEL) {
  if (ESCROW_STATUS_LABELS[status]) return ESCROW_STATUS_LABELS[status]
  warnUnknown('escrow', status)
  return fallback
}

export function formatSettlementStatus(status, fallback = '未结算') {
  if (SETTLEMENT_STATUS_LABELS[status]) return SETTLEMENT_STATUS_LABELS[status]
  warnUnknown('settlement', status)
  return fallback
}

export function formatUserRole(role, fallback = '用户') {
  return USER_ROLE_LABELS[role] || fallback
}

export function formatUserLabel({ role, userId, profile } = {}) {
  const name = profile?.nickname || profile?.displayName || profile?.username || ''
  if (name) return name
  const roleLabel = formatUserRole(role, '用户')
  return userId ? `${roleLabel} ${userId}` : roleLabel
}

export function sanitizeSeedText(value, fallback = '校园约拍服务') {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  if (/^UIO/i.test(raw)) return fallback
  let text = raw
    .replace(/^UI_REVIEW_SEED\s*/i, '')
    .replace(/^Demo\s+\d+\s+pending\s+payment\s*/i, '')
    .replace(/^我接的拍摄\s*[^｜|]*[｜|]\s*/i, '')
    .replace(RAW_WORKFLOW_ENUM_PATTERN, '')
    .trim()

  if (/[｜|]/.test(text)) {
    text = text.split(/[｜|]/).map(item => item.trim()).filter(Boolean).pop() || text
  }

  text = text
    .replace(/\s{2,}/g, ' ')
    .replace(/待客户付款/gi, '')
    .trim()
  text = normalizeProductCopy(text, '')

  if (!text || /^UI_REVIEW_SEED/i.test(text) || /^UIO/i.test(text) || /^Demo\s+\d+/i.test(text)) {
    return fallback
  }
  return text
}

export function formatOrderTitle(order, quote, fallback = '校园约拍订单') {
  const serviceTitle = sanitizeSeedText(
    quote?.serviceContent || order?.serviceContent || order?.scene || order?.title || '',
    ''
  )
  if (serviceTitle) return serviceTitle

  const location = sanitizeSeedText(quote?.location || order?.shootLocation || order?.location || '', '')
  if (location) return `${location}校园约拍`
  return fallback
}

export function formatOrderSubtitle(order, quote) {
  const location = sanitizeSeedText(quote?.location || order?.shootLocation || order?.location || '', '')
  const time = formatTimeRange(order?.shootStartTime || quote?.shootStartTime, order?.shootEndTime || quote?.shootEndTime, '')
  return [location, time].filter(Boolean).join(' · ') || '订单已创建，等待双方继续履约'
}

export function formatFileDisplayName(fileOrName, fallback = '作品') {
  const rawName = typeof fileOrName === 'object'
    ? fileOrName?.fileName || fileOrName?.name || fileOrName?.originalName
    : fileOrName
  const raw = String(rawName || '').trim()
  if (!raw) return fallback

  const cleaned = raw
    .replace(/^UI_REVIEW_SEED[_\s-]*/i, '')
    .replace(/^Demo\s+\d+[_\s-]*/i, '')
    .replace(RAW_WORKFLOW_ENUM_PATTERN, '')
    .replace(/^[_\s-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!cleaned || /^UI_REVIEW_SEED/i.test(cleaned) || /^UIO/i.test(cleaned)) return fallback
  return normalizeProductCopy(cleaned, fallback)
}

export function formatDeliveryTitle(delivery, index = 0) {
  const fileName = formatFileDisplayName(delivery, '')
  if (fileName) return fileName
  const round = Number(delivery?.deliveryRound || index + 1)
  return `作品 ${round}`
}

export function formatDeliveryDescription(delivery, fallback = '摄影师已上传作品，等待客户确认。') {
  return sanitizeSeedText(delivery?.remark || delivery?.description || delivery?.note, fallback)
}

export function formatAuthorizationTitle(authorization, index = 0) {
  const id = authorization?.id || authorization?.authorizationId
  return id ? `展示授权 ${id}` : `展示授权 ${index + 1}`
}

export function formatAuthorizationDescription(authorization, fallback = '摄影师申请展示本次作品。') {
  return sanitizeSeedText(authorization?.remark || authorization?.description || authorization?.reason, fallback)
}

export function formatQuoteServiceContent(quoteOrText, fallback = '校园约拍服务') {
  const value = typeof quoteOrText === 'object'
    ? quoteOrText?.serviceContent || quoteOrText?.title || quoteOrText?.scene
    : quoteOrText
  return sanitizeSeedText(value, fallback)
}

export function formatQuoteRemark(quoteOrText, fallback = '无额外备注') {
  const value = typeof quoteOrText === 'object'
    ? quoteOrText?.remark || quoteOrText?.note || quoteOrText?.description
    : quoteOrText
  return sanitizeSeedText(value, fallback)
}

export function formatPhotoUsageScope(scope) {
  const normalized = String(scope || '').trim().toUpperCase()
  if (PHOTO_USAGE_SCOPE_LABELS[normalized]) return PHOTO_USAGE_SCOPE_LABELS[normalized]
  return normalized ? sanitizeSeedText(scope, '按双方约定使用') : '未填写'
}

export function formatStatusLogText(log) {
  const status = log?.toStatus || log?.targetStatus || log?.status
  const naturalByStatus = {
    PENDING_PAYMENT: '订单已创建，等待客户付款。',
    PAID: '客户已完成付款，资金进入平台担保。',
    PAID_PENDING_SHOOT: '客户已完成付款，资金进入平台担保。',
    SCHEDULED: '拍摄时间已确认，等待按约定执行。',
    SHOOTING: '拍摄已开始。',
    PENDING_DELIVERY: '拍摄已完成，等待摄影师上传作品。',
    DELIVERED_PENDING_CONFIRM: '摄影师已上传作品，等待客户确认。',
    REWORK_REQUIRED: '客户提出返修要求。',
    COMPLETED: '订单已完成。',
    CANCELLED: '订单已取消。',
    REFUNDED: '订单已退款。',
    APPEALING: '订单进入申诉处理。'
  }
  const rawReason = sanitizeSeedText(log?.reason || log?.remark || log?.description, '')
  if (rawReason) return rawReason
  if (naturalByStatus[status]) return naturalByStatus[status]
  if (status) warnUnknown('status log', status)
  return '状态已更新。'
}
