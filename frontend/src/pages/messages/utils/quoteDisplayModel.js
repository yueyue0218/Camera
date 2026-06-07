import {
  formatDateOnly,
  formatDateTime,
  formatMoney,
  formatPhotoUsageScope,
  formatQuoteRemark,
  formatQuoteServiceContent,
  sanitizeSeedText
} from '../../../utils/displayFormatters.js'

const STATUS_TONE = {
  PENDING_CONFIRM: 'waiting',
  CONFIRMED: 'completed',
  REJECTED: 'danger',
  EXPIRED: 'cancelled',
  CANCELLED: 'cancelled'
}

const STATUS_LABEL = {
  PENDING_CONFIRM: '待确认',
  CONFIRMED: '已确认',
  REJECTED: '已拒绝',
  EXPIRED: '已过期',
  CANCELLED: '已取消'
}

export function buildQuoteDisplayModel(quote, event = {}) {
  const status = String(quote?.status || '').toUpperCase()
  const photoUsage = formatPhotoUsageScope(quote?.photoUsageScope)

  return {
    title: resolveQuoteTitle(quote, event),
    amountText: formatMoney(resolveAmountCent(quote), '报价待确认'),
    statusLabel: STATUS_LABEL[status] || '报价状态已更新',
    statusTone: STATUS_TONE[status] || 'neutral',
    messageCreatedAtText: formatDateTime(event?.timestamp || quote?.createdAt, '刚刚'),
    shootStartTimeText: formatDateTime(quote?.shootStartTime, '拍摄开始时间待确认'),
    shootEndTimeText: formatDateTime(quote?.shootEndTime, '未提供'),
    shootTimeText: formatDateTime(quote?.shootStartTime, '拍摄时间待确认'),
    shootPeriodText: resolveShootPeriodText(quote),
    shootLocationText: sanitizeSeedText(quote?.location || quote?.shootLocation, '拍摄地点待确认'),
    serviceContentText: formatQuoteServiceContent(quote, '按双方沟通内容执行'),
    photoUsageLabel: photoUsage && photoUsage !== '未填写' ? photoUsage : '按双方约定使用',
    originalRefinedText: `${normalizeCount(quote?.originalCount)} / ${normalizeCount(quote?.refinedCount)}`,
    deliveryDeadlineText: formatDateOnly(quote?.deliveryDeadline, '交付时间待确认'),
    remarkText: formatQuoteRemark(quote, '无额外备注'),
    orderNoticeText: resolveOrderNotice(status)
  }
}

function resolveAmountCent(quote) {
  const value = quote?.amountCent ?? quote?.amountCents
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function resolveQuoteTitle(quote, event = {}) {
  const status = String(quote?.status || '').toUpperCase()
  const eventTitle = String(event?.title || '').trim()
  if (/确认/.test(eventTitle)) return '客户确认了报价'
  if (/拒绝/.test(eventTitle)) return '客户拒绝了报价'
  if (status === 'REJECTED' && event?.type === 'QUOTE_DECISION') return '客户拒绝了报价'
  if (status === 'CONFIRMED' && event?.type === 'QUOTE_DECISION') return '客户确认了报价'
  return '摄影师发送了报价'
}

function resolveOrderNotice(status) {
  if (status === 'CONFIRMED') return '已进入平台担保履约流程'
  if (status === 'PENDING_CONFIRM') return '客户确认后将进入平台担保履约流程'
  if (status === 'REJECTED') return '报价已拒绝，可继续沟通新的拍摄方案'
  return '合作进展已更新'
}

function normalizeCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? `${count}` : '0'
}

function resolveShootPeriodText(quote) {
  const start = formatDateTime(quote?.shootStartTime, '拍摄开始时间待确认')
  const end = formatDateTime(quote?.shootEndTime, '未提供')
  return `${start} - ${end}`
}
