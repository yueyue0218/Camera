import { yuanToCent } from '../../../utils/index.js'
import { formatPhotoUsageScope, QUOTE_STATUS_LABELS } from '../../../utils/displayFormatters.js'
import { getCurrentUserId } from './workbenchState.js'
import {
  buildQuotePayload as buildQuotePayloadFromModel,
  createDefaultQuoteFormModel,
  parseQuoteToFormModel,
  validateQuoteFormModel
} from './quoteFormModel.js'

export const quoteStatusMap = {
  ...QUOTE_STATUS_LABELS
}

export function getQuoteStatusLabel(status) {
  return quoteStatusMap[status] || '报价状态已更新'
}

export function getPhotoUsageScopeLabel(scope) {
  return formatPhotoUsageScope(scope)
}

export function getQuoteNextStepText(quote, currentUser) {
  if (!quote) return '等待进一步沟通'
  const isCustomer = currentUser?.role === 'CUSTOMER'
  if (quote.status === 'PENDING_CONFIRM') {
    return isCustomer ? '确认报价后将生成托管订单' : '等待客户确认，也可以继续沟通后编辑报价'
  }
  if (quote.status === 'CONFIRMED') return '报价已确认，可以在本次会话里继续处理订单'
  if (quote.status === 'REJECTED') return '客户已拒绝，可重新沟通后再发送报价'
  if (quote.status === 'EXPIRED') return '报价已过期，需要摄影师重新发送'
  if (quote.status === 'CANCELLED') return '报价已取消，可继续沟通新的方案'
  return '继续沟通拍摄方案'
}

export function createDefaultQuoteForm() {
  return createDefaultQuoteFormModel()
}

export function buildQuotePayload(form, conversation) {
  return buildQuotePayloadFromModel(form, conversation)
}

export function createQuoteFormFromQuote(quote) {
  return parseQuoteToFormModel(quote)
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
  const currentUserId = getCurrentUserId(currentUser)
  return Boolean(quote)
    && quote.status === 'PENDING_CONFIRM'
    && !getQuoteOrderId(quote)
    && currentUser?.role === 'PROVIDER'
    && currentUserId === Number(conversation?.participantBId)
    && currentUserId === Number(quote.providerUserId)
}

export function hasPendingQuote(quotes) {
  return quotes.some(quote => quote.status === 'PENDING_CONFIRM')
}

export function getQuoteEntryHint(conversation, currentUser, quotes) {
  if (!conversation) return ''
  if (currentUser.role !== 'PROVIDER') return ''
  if (getCurrentUserId(currentUser) !== Number(conversation.participantBId)) {
    return '只有这次沟通中的摄影师可以发送正式报价。'
  }
  if (conversation.isLocal || !getBackendConversationId(conversation)) {
    return '这段沟通暂时不能生成正式报价，可以先继续聊天确认需求。'
  }
  if (hasPendingQuote(quotes)) {
    return '已有待确认报价，需客户确认或拒绝后再发新报价。'
  }
  return '可以基于本次沟通发送正式报价，客户确认后会生成订单。'
}

export function validateQuoteForm(form, conversation, currentUser, quotes, options = {}) {
  return validateQuoteFormModel(form, {
    conversation,
    currentUser,
    quotes,
    editingQuotationId: options.editingQuotationId
  }).errors
}

export function getQuoteConfirmationErrorText(error) {
  return getCWorkbenchErrorText(error)
}

export function getCWorkbenchErrorText(error, fallback = '操作没有成功，请稍后重试。') {
  const message = error?.message || ''
  if (message.includes('Quote has expired')) {
    return '该报价已过期，请摄影师重新发送报价。'
  }
  if (message.includes('Provider already has an active order in this shoot time range')) {
    return '该摄影师在所选拍摄时间已有安排，请重新协商拍摄时间。'
  }
  if (message.includes('Network Error') || message.includes('Failed to fetch') || error?.isNetworkError) {
    return '网络连接异常，请稍后重试。'
  }
  return fallback
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
