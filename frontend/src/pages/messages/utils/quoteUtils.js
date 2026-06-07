import { yuanToCent } from '../../../utils/index.js'

export const quoteStatusMap = {
  PENDING_CONFIRM: '待确认',
  CONFIRMED: '已确认',
  REJECTED: '已拒绝',
  EXPIRED: '已过期'
}

export function createDefaultQuoteForm() {
  const start = new Date()
  start.setDate(start.getDate() + 3)
  start.setHours(14, 0, 0, 0)
  const end = new Date(start)
  end.setHours(16, 0, 0, 0)
  const delivery = new Date(start)
  delivery.setDate(delivery.getDate() + 7)
  delivery.setHours(20, 0, 0, 0)

  return {
    amountYuan: 399,
    shootStartTime: toDateTimeInput(start),
    shootEndTime: toDateTimeInput(end),
    deliveryDeadline: toDateTimeInput(delivery),
    location: '南京大学鼓楼校区',
    serviceContent: '2 小时校园约拍，包含沟通、拍摄、基础调色和精修交付。',
    originalCount: 60,
    refinedCount: 12,
    photoUsageScope: 'PERSONAL_ONLY',
    terms: 'P4 演示报价',
    contractTerms: '确认报价后生成订单，模拟支付后资金进入平台托管。',
    remark: '可根据天气微调拍摄时间。'
  }
}

export function buildQuotePayload(form, conversation) {
  return {
    conversationId: conversation.backendConversationId || Number(conversation.conversationId),
    amountCent: yuanToCent(form.amountYuan),
    shootStartTime: form.shootStartTime,
    shootEndTime: form.shootEndTime,
    location: form.location,
    serviceContent: form.serviceContent,
    originalCount: Number(form.originalCount || 0),
    refinedCount: Number(form.refinedCount || 0),
    deliveryDeadline: form.deliveryDeadline,
    photoUsageScope: form.photoUsageScope,
    terms: form.terms,
    contractTerms: form.contractTerms,
    safetyNoticeVersion: 'P4-DEMO',
    remark: form.remark
  }
}

export function createQuoteFormFromQuote(quote) {
  return {
    amountYuan: quote.amountCent ? Number(quote.amountCent) / 100 : '',
    shootStartTime: toDateTimeInputValue(quote.shootStartTime),
    shootEndTime: toDateTimeInputValue(quote.shootEndTime),
    deliveryDeadline: toDateTimeInputValue(quote.deliveryDeadline),
    location: quote.location || '',
    serviceContent: quote.serviceContent || '',
    originalCount: quote.originalCount ?? 0,
    refinedCount: quote.refinedCount ?? 0,
    photoUsageScope: quote.photoUsageScope || 'PERSONAL_ONLY',
    terms: quote.terms || '',
    contractTerms: quote.contractTerms || '',
    remark: quote.remark || ''
  }
}

function toDateTimeInput(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toDateTimeInputValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 16)
  return toDateTimeInput(new Date(value))
}

export function getBackendConversationId(conversation) {
  const value = conversation?.backendConversationId || conversation?.conversationId
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function getQuoteOrderId(quote) {
  return quote?.orderId || quote?.order?.orderId || quote?.confirmedOrderId || null
}

export function canEditQuote(quote, conversation, currentUser) {
  return Boolean(quote)
    && quote.status === 'PENDING_CONFIRM'
    && !getQuoteOrderId(quote)
    && currentUser?.role === 'PROVIDER'
    && Number(currentUser.userId) === Number(conversation?.participantBId)
    && Number(currentUser.userId) === Number(quote.providerUserId)
}

export function hasPendingQuote(quotes) {
  return quotes.some(quote => quote.status === 'PENDING_CONFIRM')
}

export function getQuoteEntryHint(conversation, currentUser, quotes) {
  if (!conversation) return ''
  if (currentUser.role !== 'PROVIDER') return ''
  if (currentUser.userId !== Number(conversation.participantBId)) {
    return '只有该会话的服务方可以发起正式报价。'
  }
  if (conversation.isLocal || !getBackendConversationId(conversation)) {
    return '当前不是后端真实会话，不能生成报价。'
  }
  if (hasPendingQuote(quotes)) {
    return '已有待确认报价，需客户确认或拒绝后再发新报价。'
  }
  return '可以基于本次沟通发起正式报价，顾客确认后会生成订单。'
}

export function validateQuoteForm(form, conversation, currentUser, quotes, options = {}) {
  const errors = []
  const editingQuotationId = options.editingQuotationId
  if (!conversation || conversation.isLocal || !getBackendConversationId(conversation)) {
    errors.push('当前会话必须是真实后端会话，才能发起报价。')
  }
  if (currentUser.role !== 'PROVIDER' || currentUser.userId !== Number(conversation?.participantBId)) {
    errors.push('只有该会话的服务方可以发起报价。')
  }
  const hasOtherPendingQuote = quotes.some(quote =>
    quote.status === 'PENDING_CONFIRM'
    && (!editingQuotationId || String(quote.quotationId) !== String(editingQuotationId))
  )
  if (hasOtherPendingQuote) {
    errors.push('已有待确认报价，需客户确认或拒绝后再发新报价。')
  }

  const amountCent = yuanToCent(form.amountYuan)
  if (!hasAtMostTwoDecimalPlaces(form.amountYuan)) {
    errors.push('金额最多保留两位小数。')
  }
  if (!Number.isInteger(amountCent) || amountCent <= 0) {
    errors.push('报价金额必须大于 0，且转换成分后必须是有效整数。')
  }

  const shootStart = parseInputDate(form.shootStartTime)
  const shootEnd = parseInputDate(form.shootEndTime)
  const deliveryDeadline = parseInputDate(form.deliveryDeadline)
  const now = new Date()
  if (!shootStart) errors.push('拍摄开始时间必填。')
  if (!shootEnd) errors.push('拍摄结束时间必填。')
  if (!deliveryDeadline) errors.push('最晚交付时间必填。')
  if (shootStart && shootStart <= now) {
    errors.push('拍摄开始时间必须晚于当前时间。')
  }
  if (shootStart && shootEnd && shootEnd <= shootStart) {
    errors.push('拍摄结束时间必须晚于拍摄开始时间。')
  }
  if (shootEnd && deliveryDeadline && deliveryDeadline <= shootEnd) {
    errors.push('最晚交付时间必须晚于拍摄结束时间。')
  }

  if (!String(form.location || '').trim()) {
    errors.push('拍摄地点不能为空。')
  }
  if (!String(form.serviceContent || '').trim()) {
    errors.push('服务内容不能为空。')
  }
  if (!isNonNegativeInteger(form.originalCount)) {
    errors.push('原片数量必须是非负整数。')
  }
  if (!isNonNegativeInteger(form.refinedCount)) {
    errors.push('精修数量必须是非负整数。')
  }

  if (conversation?.scheduleStartTime && conversation?.scheduleEndTime && shootStart && shootEnd) {
    const scheduleStart = parseInputDate(conversation.scheduleStartTime)
    const scheduleEnd = parseInputDate(conversation.scheduleEndTime)
    if (scheduleStart && scheduleEnd && (shootStart < scheduleStart || shootEnd > scheduleEnd)) {
      errors.push('拍摄时间必须落在该会话明确返回的档期范围内。')
    }
  }
  return errors
}

export function getQuoteConfirmationErrorText(error) {
  const message = error?.message || ''
  if (message.includes('Quote has expired')) {
    return '该报价已过期，请摄影师重新发起报价。'
  }
  if (message.includes('Provider already has an active order in this shoot time range')) {
    return '该摄影师在所选拍摄时间已有订单，请重新协商时间。'
  }
  return message || '报价确认失败'
}

function hasAtMostTwoDecimalPlaces(value) {
  const text = String(value ?? '').trim()
  return /^\d+(\.\d{1,2})?$/.test(text)
}

function parseInputDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isNonNegativeInteger(value) {
  if (value === '' || value === null || value === undefined) return true
  const number = Number(value)
  return Number.isInteger(number) && number >= 0
}
