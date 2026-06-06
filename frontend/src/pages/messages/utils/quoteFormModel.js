import { yuanToCent } from '../../../utils/index.js'
import { getCurrentUserId } from './workbenchState.js'

const MINUTE_OPTIONS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']
const DEFAULT_SCOPE = 'PERSONAL_ONLY'

export function createDefaultQuoteFormModel() {
  const start = new Date()
  start.setDate(start.getDate() + 3)
  start.setHours(14, 0, 0, 0)
  const end = new Date(start)
  end.setHours(16, 0, 0, 0)
  const delivery = new Date(start)
  delivery.setDate(delivery.getDate() + 7)

  return {
    amountYuan: '399',
    shootStartDate: toDateValue(start),
    shootStartHour: '14',
    shootStartMinute: '00',
    shootEndDate: toDateValue(end),
    shootEndHour: '16',
    shootEndMinute: '00',
    deliveryDeadlineDate: toDateValue(delivery),
    location: '南京大学鼓楼校区',
    serviceContent: '2 小时校园约拍，包含沟通、拍摄、基础调色和精修交付。',
    originalCount: '60',
    refinedCount: '12',
    photoUsageScope: DEFAULT_SCOPE,
    terms: '包含本次沟通确认的拍摄内容、时间和交付范围。',
    contractTerms: '客户确认报价后生成订单，支付后资金进入平台担保。',
    remark: '可根据天气微调拍摄时间。'
  }
}

export function parseQuoteToFormModel(quote = {}) {
  const start = parseDateTimeValue(quote.shootStartTime)
  const end = parseDateTimeValue(quote.shootEndTime)
  const deadline = parseDateTimeValue(quote.deliveryDeadline)

  return {
    amountYuan: quote.amountCent ? String(Number(quote.amountCent) / 100) : '',
    shootStartDate: start.date,
    shootStartHour: start.hour,
    shootStartMinute: start.minute,
    shootEndDate: end.date,
    shootEndHour: end.hour,
    shootEndMinute: end.minute,
    deliveryDeadlineDate: deadline.date,
    location: quote.location || '',
    serviceContent: quote.serviceContent || '',
    originalCount: String(quote.originalCount ?? 0),
    refinedCount: String(quote.refinedCount ?? 0),
    photoUsageScope: quote.photoUsageScope || DEFAULT_SCOPE,
    terms: quote.terms || '',
    contractTerms: quote.contractTerms || '',
    remark: quote.remark || ''
  }
}

export function buildQuotePayload(form, conversation) {
  return {
    conversationId: conversation.backendConversationId || Number(conversation.conversationId),
    amountCent: yuanToCent(form.amountYuan),
    shootStartTime: composeDateTime(form.shootStartDate, form.shootStartHour, form.shootStartMinute),
    shootEndTime: composeDateTime(form.shootEndDate, form.shootEndHour, form.shootEndMinute),
    location: String(form.location || '').trim(),
    serviceContent: String(form.serviceContent || '').trim(),
    originalCount: Number(form.originalCount || 0),
    refinedCount: Number(form.refinedCount || 0),
    deliveryDeadline: composeDateTime(form.deliveryDeadlineDate, '23', '59'),
    photoUsageScope: form.photoUsageScope || DEFAULT_SCOPE,
    terms: String(form.terms || '').trim(),
    contractTerms: String(form.contractTerms || '').trim(),
    safetyNoticeVersion: 'P4-DEMO',
    remark: String(form.remark || '').trim()
  }
}

export function validateQuoteFormModel(form, { conversation, currentUser, quotes = [], editingQuotationId } = {}) {
  const errors = []
  const fieldErrors = {}

  const push = (field, message) => {
    errors.push(message)
    if (field && !fieldErrors[field]) fieldErrors[field] = message
  }

  if (!conversation || conversation.isLocal || !getBackendConversationId(conversation)) {
    push('form', '这段沟通暂时不能生成正式报价，请先进入正式沟通。')
  }
  if (currentUser?.role !== 'PROVIDER' || getCurrentUserId(currentUser) !== Number(conversation?.participantBId)) {
    push('form', '只有这次沟通中的摄影师可以发送报价。')
  }
  const hasOtherPendingQuote = quotes.some(quote =>
    quote.status === 'PENDING_CONFIRM'
    && (!editingQuotationId || String(quote.quotationId) !== String(editingQuotationId))
  )
  if (hasOtherPendingQuote) {
    push('form', '已有待确认报价，需客户确认或拒绝后再发新报价。')
  }

  const amountCent = yuanToCent(form.amountYuan)
  if (!hasAtMostTwoDecimalPlaces(form.amountYuan)) {
    push('amountYuan', '金额最多保留两位小数。')
  } else if (!Number.isInteger(amountCent) || amountCent <= 0) {
    push('amountYuan', '报价金额必须大于 0。')
  }

  const shootStart = parseModelDateTime(form.shootStartDate, form.shootStartHour, form.shootStartMinute)
  const shootEnd = parseModelDateTime(form.shootEndDate, form.shootEndHour, form.shootEndMinute)
  const deliveryDate = parseDateOnly(form.deliveryDeadlineDate)
  const now = new Date()
  if (!shootStart) push('shootStartTime', '拍摄开始时间必填。')
  if (!shootEnd) push('shootEndTime', '拍摄结束时间必填。')
  if (!deliveryDate) push('deliveryDeadlineDate', '最晚交付日期必填。')
  if (shootStart && shootStart <= now) {
    push('shootStartTime', '拍摄开始时间必须晚于当前时间。')
  }
  if (shootStart && shootEnd && shootEnd <= shootStart) {
    push('shootEndTime', '拍摄结束时间必须晚于拍摄开始时间。')
  }
  if (shootEnd && deliveryDate && endOfDate(deliveryDate) < shootEnd) {
    push('deliveryDeadlineDate', '最晚交付日期不能早于拍摄结束日期。')
  }

  if (!String(form.location || '').trim()) {
    push('location', '拍摄地点不能为空。')
  }
  if (!String(form.serviceContent || '').trim()) {
    push('serviceContent', '服务内容不能为空。')
  }
  if (!String(form.contractTerms || '').trim()) {
    push('contractTerms', '订单条款不能为空。')
  }
  if (!isNonNegativeInteger(form.originalCount)) {
    push('originalCount', '原片数量必须是非负整数。')
  }
  if (!isNonNegativeInteger(form.refinedCount)) {
    push('refinedCount', '精修数量必须是非负整数。')
  }

  if (conversation?.scheduleStartTime && conversation?.scheduleEndTime && shootStart && shootEnd) {
    const scheduleStart = parseInputDate(conversation.scheduleStartTime)
    const scheduleEnd = parseInputDate(conversation.scheduleEndTime)
    if (scheduleStart && scheduleEnd && (shootStart < scheduleStart || shootEnd > scheduleEnd)) {
      push('shootStartTime', '拍摄时间必须落在该沟通明确返回的档期范围内。')
    }
  }

  return { errors, fieldErrors }
}

export function getQuoteDateYearRange(today = new Date()) {
  const year = today.getFullYear()
  return { minYear: year - 1, maxYear: year + 3 }
}

export function getQuoteMinuteOptions() {
  return MINUTE_OPTIONS
}

function getBackendConversationId(conversation) {
  const value = conversation?.backendConversationId || conversation?.conversationId
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function parseDateTimeValue(value) {
  const date = parseInputDate(value)
  if (!date) return { date: '', hour: '14', minute: '00' }
  return {
    date: toDateValue(date),
    hour: pad(date.getHours()),
    minute: normalizeMinute(date.getMinutes())
  }
}

function parseInputDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseModelDateTime(dateValue, hour, minute) {
  if (!isValidDateValue(dateValue)) return null
  if (!isValidHour(hour) || !MINUTE_OPTIONS.includes(String(minute).padStart(2, '0'))) return null
  return new Date(`${dateValue}T${pad(hour)}:${pad(minute)}:00`)
}

function parseDateOnly(dateValue) {
  if (!isValidDateValue(dateValue)) return null
  return new Date(`${dateValue}T00:00:00`)
}

function composeDateTime(dateValue, hour, minute) {
  if (!dateValue) return ''
  return `${dateValue}T${pad(hour)}:${pad(minute)}:00`
}

function endOfDate(date) {
  const next = new Date(date)
  next.setHours(23, 59, 0, 0)
  return next
}

function toDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function normalizeMinute(value) {
  const number = Number(value)
  const rounded = Math.round(number / 5) * 5
  return pad(Math.min(55, Math.max(0, rounded)))
}

function isValidDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const [year, month, day] = String(value).split('-').map(Number)
  const { minYear, maxYear } = getQuoteDateYearRange()
  if (year < minYear || year > maxYear) return false
  const date = new Date(`${value}T00:00:00`)
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day
}

function isValidHour(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 23
}

function hasAtMostTwoDecimalPlaces(value) {
  const text = String(value ?? '').trim()
  return /^\d+(\.\d{1,2})?$/.test(text)
}

function isNonNegativeInteger(value) {
  if (value === '' || value === null || value === undefined) return true
  const number = Number(value)
  return Number.isInteger(number) && number >= 0
}

function pad(value) {
  return String(value).padStart(2, '0')
}
