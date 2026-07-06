import { formatOrderStatus, QUOTE_STATUS_LABELS } from '../../../utils/displayFormatters.js'

const MESSAGE_TYPE_PREVIEWS = {
  IMAGE: '[图片]',
  FILE: '[附件]',
  QUOTE: '[报价] 摄影师发送了一份报价',
  QUOTE_SENT: '[报价] 摄影师发送了一份报价',
  QUOTE_CONFIRMED: '客户确认了报价',
  QUOTE_REJECTED: '客户拒绝了报价',
  PAYMENT: '客户完成了付款',
  DELIVERY: '摄影师上传了作品',
  REWORK: '客户提交了返修说明',
  AUTHORIZATION_REQUEST: '摄影师申请作品展示授权',
  AUTHORIZATION_APPROVED: '客户同意授权',
  AUTHORIZATION_REJECTED: '客户拒绝授权'
}

const ORDER_STATUS_PREVIEWS = {
  PENDING_PAYMENT: '报价已确认，订单待支付',
  PAID_PENDING_SHOOT: '客户完成了付款',
  SHOOTING: '拍摄已开始',
  PENDING_DELIVERY: '拍摄已结束，等待摄影师上传作品',
  DELIVERED_PENDING_CONFIRM: '摄影师上传了作品',
  REWORK_REQUIRED: '客户提交了返修说明',
  COMPLETED: '订单已完成',
  CANCELLED: '订单已取消',
  REFUNDED: '订单已退款',
  APPEALING: '订单进入平台处理中'
}

const QUOTE_STATUS_PREVIEWS = {
  PENDING_CONFIRM: '[报价] 摄影师发送了一份报价',
  CONFIRMED: '客户确认了报价',
  REJECTED: '客户拒绝了报价',
  EXPIRED: '报价已过期',
  CANCELLED: '报价已取消'
}

export function buildConversationPreview(conversation = {}) {
  const latestMessage = conversation.latestMessage || conversation.lastMessageObject || null
  const latestQuote = latestItem(conversation.latestQuotes || conversation.quotesPreview || [], quote => quote.updatedAt || quote.createdAt || quote.expireTime)
  const activeOrder = conversation.activeOrder || null
  const candidates = [
    latestMessage && {
      text: formatMessagePreview(latestMessage),
      at: latestMessage.createdAt || latestMessage.updatedAt,
      senderId: latestMessage.senderId
    },
    latestQuote && {
      text: formatQuotePreview(latestQuote),
      at: latestQuote.updatedAt || latestQuote.createdAt || latestQuote.expireTime,
      senderId: latestQuote.providerUserId || latestQuote.providerId
    },
    activeOrder && {
      text: formatOrderPreview(activeOrder),
      at: activeOrder.updatedAt || activeOrder.createdAt,
      senderId: inferOrderPreviewSender(activeOrder)
    },
    conversation.lastMessage && {
      text: normalizeStoredPreview(conversation.lastMessage),
      at: conversation.updatedAt || conversation.lastMessageTime || conversation.createdAt,
      senderId: conversation.lastMessageSenderId
    }
  ].filter(item => item && item.text)

  const latest = latestItem(candidates, item => item.at) || null
  return {
    text: latest?.text || '还没有消息',
    at: latest?.at || conversation.lastMessageTime || conversation.updatedAt || conversation.createdAt || '',
    senderId: latest?.senderId ?? null
  }
}

export function formatMessagePreview(message = {}) {
  const type = String(message.messageType || message.type || 'TEXT').toUpperCase()
  if (type === 'TEXT') {
    const text = String(message.content || '').replace(/\s+/g, ' ').trim()
    return text || '还没有消息'
  }
  if (type === 'FILE') {
    const name = String(message.fileName || message.attachment?.fileName || message.attachment?.name || '').trim()
    return name ? `[附件] ${name}` : '[附件]'
  }
  if (MESSAGE_TYPE_PREVIEWS[type]) return MESSAGE_TYPE_PREVIEWS[type]
  return '[消息]'
}

export function formatQuotePreview(quote = {}) {
  const status = String(quote.status || '').toUpperCase()
  return QUOTE_STATUS_PREVIEWS[status] || `[报价] ${QUOTE_STATUS_LABELS[status] || '报价状态已更新'}`
}

export function formatOrderPreview(order = {}) {
  const status = String(order.status || '').toUpperCase()
  return ORDER_STATUS_PREVIEWS[status] || `订单状态更新为${formatOrderStatus(status)}`
}

export function getConversationActivityTime(conversation = {}) {
  return buildConversationPreview(conversation).at || conversation.updatedAt || conversation.lastMessageTime || conversation.createdAt || ''
}

function inferOrderPreviewSender(order) {
  const status = String(order?.status || '').toUpperCase()
  if (['PAID_PENDING_SHOOT', 'REWORK_REQUIRED', 'COMPLETED', 'CANCELLED'].includes(status)) {
    return order.customerId
  }
  if (status === 'DELIVERED_PENDING_CONFIRM') {
    return order.providerUserId || order.providerId
  }
  return null
}

function normalizeStoredPreview(value) {
  const text = String(value || '').trim()
  if (!text || ['最近有新消息', '点击进入对话', '校园约拍 · 摄影服务橱窗'].includes(text)) return ''
  return text
}

function latestItem(items = [], getTime) {
  return [...items].filter(Boolean).sort((left, right) => toTime(getTime(right)) - toTime(getTime(left)))[0] || null
}

function toTime(value) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}
