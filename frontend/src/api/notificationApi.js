import { request } from './client.js'

const ORDER_EVENTS = ['ORDER_', 'DEMAND_RESPONSE_', 'CONVERSATION_STARTED', 'DELIVERY_UPLOADED']
const REVIEW_EVENTS = ['REVIEW_']
const APPEAL_EVENTS = ['REVIEW_COMPLAINT_', 'DISPUTE']
const DYNAMIC_EVENTS = ['MOMENT_LIKED', 'FOLLOWED']

function normalizeText(value) {
  return String(value || '').trim().toUpperCase()
}

function hasChineseText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ''))
}

function parseMetadata(metadataJson) {
  if (!metadataJson) return {}
  if (typeof metadataJson === 'object') return metadataJson
  try {
    return JSON.parse(metadataJson)
  } catch {
    return {}
  }
}

function typeTokens(item) {
  return [
    normalizeText(item?.type),
    normalizeText(item?.eventType),
    normalizeText(item?.relatedType),
    normalizeText(item?.targetType),
    normalizeText(item?.sourceType)
  ]
}

function hasToken(item, tokens) {
  const values = typeTokens(item)
  return tokens.some(token => values.some(value => value.includes(token)))
}

function isAppealNotification(item) {
  return hasToken(item, APPEAL_EVENTS)
}

function isOrderNotification(item) {
  return hasToken(item, ORDER_EVENTS)
}

function isReviewNotification(item) {
  return hasToken(item, REVIEW_EVENTS) && !isAppealNotification(item)
}

function isDynamicNotification(item) {
  const values = typeTokens(item)
  return values.some(value => DYNAMIC_EVENTS.includes(value) || value.includes('MOMENT'))
}

function pickFirstText(...values) {
  return values.map(value => String(value || '').trim()).find(Boolean) || ''
}

function resolveOrderId(item, metadata) {
  return metadata.orderId ?? item?.orderId ?? item?.targetId ?? item?.relatedId ?? item?.sourceId ?? ''
}

function resolveActorName(item, metadata) {
  return pickFirstText(
    metadata.actorNickname,
    metadata.senderName,
    metadata.reviewerNickname,
    metadata.followerNickname,
    item?.actorNickname,
    item?.sourceNickname,
    item?.nickname
  )
}

function buildNotificationTitle(item, metadata) {
  const type = normalizeText(item?.type)
  const eventType = normalizeText(item?.eventType)
  const relatedType = normalizeText(item?.relatedType)

  if (isAppealNotification(item)) {
    if (type.includes('CREATED') || eventType.includes('CREATED')) return '评价申诉已收到'
    if (type.includes('RESOLVED') || eventType.includes('RESOLVED')) return '评价申诉有结果了'
    return '评价申诉有新进展'
  }

  if (type.includes('REVIEW_RECEIVED') || eventType.includes('REVIEW_RECEIVED')) return '收到新评价'
  if (type.includes('REVIEW_FOLLOW') || eventType.includes('REVIEW_FOLLOW')) return '追评有更新'
  if (isReviewNotification(item)) return '评价有新进展'

  if (type.includes('ORDER_COMPLETED') || eventType.includes('ORDER_COMPLETED')) return '订单已完成'
  if (type.includes('ORDER_STATUS_CHANGED') || eventType.includes('ORDER_STATUS_CHANGED')) return '订单状态有更新'
  if (type.includes('DELIVERY_UPLOADED') || eventType.includes('DELIVERY_UPLOADED')) return '作品已上传'
  if (isOrderNotification(item)) return '订单有新进展'

  if (type.includes('DEMAND_RESPONSE') || eventType.includes('DEMAND_RESPONSE')) return '收到新的响应'
  if (type.includes('CONVERSATION_STARTED') || eventType.includes('CONVERSATION_STARTED')) return '新的沟通已开始'
  if (type.includes('MESSAGE_RECEIVED') || eventType.includes('MESSAGE_RECEIVED')) return '收到新消息'

  if (type.includes('FOLLOWED') || eventType.includes('FOLLOWED')) return '你有新的关注'
  if (type.includes('MOMENT_LIKED') || eventType.includes('MOMENT_LIKED') || relatedType.includes('MOMENT')) return '动态收到新赞'
  if (type.includes('CREDIT') || eventType.includes('CREDIT')) return '信用分有更新'

  if (type.includes('USER') || eventType.includes('USER')) return '账户通知'
  if (isDynamicNotification(item)) return '动态有新互动'
  return '收到新通知'
}

function buildNotificationContent(item, metadata) {
  const type = normalizeText(item?.type)
  const eventType = normalizeText(item?.eventType)
  const actorName = resolveActorName(item, metadata)
  const orderId = resolveOrderId(item, metadata)

  if (isAppealNotification(item)) {
    return '你的评价申诉有了新进展，点开查看详情。'
  }

  if (type.includes('REVIEW_RECEIVED') || eventType.includes('REVIEW_RECEIVED')) {
    return actorName ? `${actorName} 给你留下了新的评价，点开查看详情。` : '你收到了新的评价，点开查看详情。'
  }

  if (type.includes('REVIEW_FOLLOW') || eventType.includes('REVIEW_FOLLOW')) {
    return '有一条评价补充了新内容，点开查看详情。'
  }

  if (type.includes('ORDER_COMPLETED') || eventType.includes('ORDER_COMPLETED')) {
    return orderId ? `订单 #${orderId} 已完成，点开查看详情。` : '有一笔订单已经完成，点开查看详情。'
  }

  if (type.includes('ORDER_STATUS_CHANGED') || eventType.includes('ORDER_STATUS_CHANGED') || isOrderNotification(item)) {
    return orderId ? `订单 #${orderId} 有了新的进展，点开查看详情。` : '你的订单有了新的进展，点开查看详情。'
  }

  if (type.includes('DELIVERY_UPLOADED') || eventType.includes('DELIVERY_UPLOADED')) {
    return orderId ? `订单 #${orderId} 的作品已经上传，点开查看详情。` : '有新的作品已经上传，点开查看详情。'
  }

  if (type.includes('DEMAND_RESPONSE') || eventType.includes('DEMAND_RESPONSE')) {
    return '你的约拍需求收到了新的响应，点开查看详情。'
  }

  if (type.includes('CONVERSATION_STARTED') || eventType.includes('CONVERSATION_STARTED') || type.includes('MESSAGE_RECEIVED') || eventType.includes('MESSAGE_RECEIVED')) {
    return actorName ? `你收到了 ${actorName} 的新消息，点开查看详情。` : '你收到了新的消息，点开查看详情。'
  }

  if (type.includes('FOLLOWED') || eventType.includes('FOLLOWED')) {
    return actorName ? `${actorName} 关注了你，点开查看对方主页。` : '有人关注了你，点开查看对方主页。'
  }

  if (type.includes('MOMENT_LIKED') || eventType.includes('MOMENT_LIKED') || isDynamicNotification(item)) {
    return '你的动态有了新的互动，点开查看详情。'
  }

  if (type.includes('CREDIT') || eventType.includes('CREDIT')) {
    return '你的信用分有了新的变化，点开查看详情。'
  }

  return '你收到了新的通知，点开查看详情。'
}

function normalizeNotification(item) {
  if (!item || typeof item !== 'object') return item
  const metadata = parseMetadata(item.metadataJson)
  const title = pickFirstText(item.title, item.subject, item.name)
  const content = pickFirstText(item.content, item.body, item.message, item.description)

  return {
    ...item,
    title: hasChineseText(title) ? title : buildNotificationTitle(item, metadata),
    content: hasChineseText(content) ? content : buildNotificationContent(item, metadata)
  }
}

function normalizeNotificationList(data) {
  if (Array.isArray(data)) return data.map(normalizeNotification)
  if (Array.isArray(data?.records)) return data.records.map(normalizeNotification)
  if (Array.isArray(data?.items)) return data.items.map(normalizeNotification)
  if (Array.isArray(data?.content)) return data.content.map(normalizeNotification)
  return []
}

function normalizeUnreadCount(data) {
  if (typeof data === 'number') return data
  if (typeof data === 'string' && data.trim() !== '') return Number(data) || 0
  return Number(data?.unreadCount ?? data?.count ?? data?.total ?? 0) || 0
}

export const notificationApi = {
  async listMine(currentUser, params = {}) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value))
      }
    })
    const suffix = query.toString() ? `?${query.toString()}` : ''
    const data = await request(`/notifications${suffix}`, {}, currentUser)
    return normalizeNotificationList(data)
  },
  async unreadCount(currentUser) {
    const data = await request('/notifications/unread-count', {}, currentUser)
    return normalizeUnreadCount(data)
  },
  async markRead(notificationId, currentUser) {
    const data = await request(`/notifications/${notificationId}/read`, { method: 'PATCH' }, currentUser)
    return normalizeNotification(data)
  },
  async markAllRead(currentUser) {
    const data = await request('/notifications/read-all', { method: 'PATCH' }, currentUser)
    return normalizeNotificationList(data)
  }
}
