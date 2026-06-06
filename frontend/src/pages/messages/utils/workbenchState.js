import { buildUserProfileTarget } from '../../../utils/orderNavigation.js'

const ACTIVE_ORDER_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PAID_PENDING_SHOOT',
  'SHOOTING',
  'PENDING_DELIVERY',
  'DELIVERED_PENDING_CONFIRM',
  'REWORK_REQUIRED',
  'APPEALING'
])

const STAGE_ORDER = {
  MESSAGE: 10,
  QUOTE_SENT: 20,
  QUOTE_DECISION: 30,
  ORDER_CREATED: 40,
  PAYMENT: 50,
  SHOOTING: 60,
  PENDING_DELIVERY: 70,
  DELIVERY: 80,
  REWORK: 90,
  COMPLETED: 100,
  AUTHORIZATION: 110,
  CLOSED: 120,
  DISPUTE: 130
}

const VALID_EVENT_TYPES = new Set([
  'MESSAGE',
  'QUOTE_SENT',
  'QUOTE_DECISION',
  'ORDER_CREATED',
  'STATUS',
  'DELIVERY',
  'DELIVERY_REMINDER',
  'REWORK',
  'AUTHORIZATION',
  'DISPUTE'
])

const VALID_ACTOR_ROLES = new Set(['CUSTOMER', 'PROVIDER', 'PLATFORM'])
const VALID_SIDES = new Set(['self', 'other', 'center'])

export function getCurrentUserId(currentUser) {
  const id = Number(currentUser?.id ?? currentUser?.userId)
  return Number.isFinite(id) ? id : 0
}

export function getUserRoleInOrder(order, currentUser) {
  const currentUserId = getCurrentUserId(currentUser)
  if (!order || !currentUserId) return ''
  if (Number(order.customerId) === currentUserId) return 'CUSTOMER'
  if (Number(order.providerUserId) === currentUserId) return 'PROVIDER'
  return ''
}

export function getUserRoleInConversation(conversation, currentUser) {
  const currentUserId = getCurrentUserId(currentUser)
  if (!conversation || !currentUserId) return ''
  if (Number(conversation.participantAId) === currentUserId) return 'CUSTOMER'
  if (Number(conversation.participantBId) === currentUserId) return 'PROVIDER'
  return ''
}

export function deriveConversationStage({ conversation, quotes = [], order, currentUser, activeRole = currentUser?.role }) {
  const userOrderRole = getUserRoleInOrder(order, currentUser)
  const userConversationRole = getUserRoleInConversation(conversation, currentUser)
  const actualRole = userOrderRole || userConversationRole
  const roleMismatch = Boolean(conversation && (!actualRole || actualRole !== activeRole))
  const visibleRole = roleMismatch ? '' : actualRole
  const role = visibleRole || activeRole || ''
  const pendingQuote = quotes.find(quote => quote.status === 'PENDING_CONFIRM') || null

  if (!order) {
    if (pendingQuote) {
      return {
        key: 'QUOTE_PENDING',
        title: role === 'CUSTOMER' ? '等待你确认报价' : '等待客户确认报价',
        description: role === 'CUSTOMER' ? '确认后会生成平台托管订单。' : '方案变化时可以编辑这份待确认报价。',
        role,
        visibleRole,
        roleMismatch,
        userOrderRole,
        pendingQuote,
        hasOrder: false
      }
    }
    const latestQuote = getLatestItem(quotes, quote => quote.updatedAt || quote.createdAt)
    if (latestQuote?.status === 'CONFIRMED') {
      return {
        key: 'QUOTE_CONFIRMED',
        title: '报价已确认',
        description: '订单信息同步后，可在会话中继续处理履约。',
        role,
        visibleRole,
        roleMismatch,
        userOrderRole,
        pendingQuote,
        hasOrder: false
      }
    }
    return {
      key: 'DISCUSSING',
      title: '沟通拍摄方案',
      description: role === 'PROVIDER' ? '确认时间、地点和交付范围后发送报价。' : '和摄影师确认时间、地点和交付要求。',
      role,
      visibleRole,
      roleMismatch,
      userOrderRole,
      pendingQuote,
      hasOrder: false
    }
  }

  const stages = {
    CUSTOMER: {
      PENDING_PAYMENT: ['等待你支付', '支付后资金将进入平台托管。'],
      PAID_PENDING_SHOOT: ['等待拍摄', '请按约定时间准备拍摄，拍摄前仍可申请退款。'],
      SHOOTING: ['拍摄履约中', '当前正在按约定完成拍摄。'],
      PENDING_DELIVERY: ['等待摄影师交付', '摄影师会在会话中上传作品。'],
      DELIVERED_PENDING_CONFIRM: ['等待你确认作品', '确认接收后订单完成；如需调整，可以提交返修要求。'],
      REWORK_REQUIRED: ['等待摄影师重新交付', '摄影师正在根据返修要求调整作品。'],
      APPEALING: ['争议处理中', '等待平台处理结果。'],
      COMPLETED: ['订单已完成', '可以查看作品、授权和订单档案。'],
      CANCELLED: ['订单已取消', '本次订单已经结束。'],
      REFUNDED: ['订单已退款', '本次订单已退款结束。']
    },
    PROVIDER: {
      PENDING_PAYMENT: ['等待客户付款', '客户付款后资金将进入平台托管。'],
      PAID_PENDING_SHOOT: ['等待拍摄', '请按约定时间准备拍摄。'],
      SHOOTING: ['拍摄履约中', '当前正在按约定完成拍摄。'],
      PENDING_DELIVERY: ['等待你交付', '请上传本次拍摄作品。'],
      DELIVERED_PENDING_CONFIRM: ['等待客户确认作品', '客户可以确认接收或提交返修要求。'],
      REWORK_REQUIRED: ['返修待交付', '请根据客户要求重新上传作品。'],
      APPEALING: ['争议处理中', '等待平台处理结果。'],
      COMPLETED: ['订单已完成', '可以处理照片展示授权或查看订单档案。'],
      CANCELLED: ['订单已取消', '本次订单已经结束。'],
      REFUNDED: ['订单已退款', '本次订单已退款结束。']
    }
  }
  const [title, description] = stages[role]?.[order.status] || ['合作进展已更新', '可以继续在会话中沟通。']
  return {
    key: order.status,
    title,
    description,
    role,
    visibleRole,
    roleMismatch,
    userOrderRole,
    pendingQuote,
    hasOrder: true
  }
}

export function deriveConversationActions({
  conversation,
  quotes = [],
  order,
  deliveries = [],
  authorizations = [],
  statusLogs = [],
  activeRole = currentUser?.role,
  currentUser
}) {
  const stage = deriveConversationStage({ conversation, quotes, order, currentUser, activeRole })
  const role = stage.visibleRole
  const pendingQuote = stage.pendingQuote
  const hasConfirmedQuote = quotes.some(quote => quote.status === 'CONFIRMED' || getQuoteOrderId(quote))
  const beforeShootStart = isBeforeShootStart(order)
  const canUseFormalQuote = Boolean(conversation && !conversation.isLocal && getBackendConversationId(conversation))
  const hasOrderId = Boolean(normalizeActorId(order?.orderId))
  const cancelAction = role === 'CUSTOMER' && order?.status === 'PENDING_PAYMENT'
    ? {
        label: '取消订单',
        confirmText: '确定取消这个待支付订单吗？该订单尚未支付，不涉及退款。',
        reason: '客户取消未支付订单'
      }
    : role === 'CUSTOMER' && order?.status === 'PAID_PENDING_SHOOT' && beforeShootStart
      ? {
          label: '取消并申请退款',
          confirmText: '确定取消订单并申请退款吗？平台托管资金将退回客户。',
          reason: '客户拍摄前取消，申请退回托管款'
        }
      : null

  const actions = {
    stage,
    role,
    visibleRole: stage.visibleRole,
    roleMismatch: stage.roleMismatch,
    pendingQuote,
    hasOrder: Boolean(order),
    canSendQuote: !stage.roleMismatch && !order && !hasConfirmedQuote && role === 'PROVIDER' && canUseFormalQuote && !pendingQuote,
    canEditQuote: !stage.roleMismatch && !order && role === 'PROVIDER' && Boolean(pendingQuote) && !getQuoteOrderId(pendingQuote),
    canConfirmQuote: !stage.roleMismatch && !order && role === 'CUSTOMER' && Boolean(pendingQuote),
    canRejectQuote: !stage.roleMismatch && !order && role === 'CUSTOMER' && Boolean(pendingQuote),
    canPay: !stage.roleMismatch && role === 'CUSTOMER' && order?.status === 'PENDING_PAYMENT',
    cancelAction: stage.roleMismatch ? null : cancelAction,
    canUploadDelivery: !stage.roleMismatch && role === 'PROVIDER' && order?.status === 'PENDING_DELIVERY',
    canReuploadDelivery: !stage.roleMismatch && role === 'PROVIDER' && order?.status === 'REWORK_REQUIRED',
    canConfirmDelivery: !stage.roleMismatch && role === 'CUSTOMER' && order?.status === 'DELIVERED_PENDING_CONFIRM',
    canRequestRework: !stage.roleMismatch && role === 'CUSTOMER' && order?.status === 'DELIVERED_PENDING_CONFIRM',
    canRequestPhotoAuthorization: !stage.roleMismatch
      && role === 'PROVIDER'
      && order?.status === 'COMPLETED'
      && deliveries.some(delivery => delivery?.fileId)
      && !authorizations.some(authorization => authorization?.status === 'PENDING'),
    canReviewPhotoAuthorization: !stage.roleMismatch && role === 'CUSTOMER'
      && order?.status === 'COMPLETED'
      && authorizations.some(authorization => authorization?.status === 'PENDING'),
    canViewDispute: !stage.roleMismatch && order?.status === 'APPEALING',
    canAppeal: !stage.roleMismatch && Boolean(order) && !['CANCELLED', 'REFUNDED', 'APPEALING'].includes(order.status),
    canOpenOrder: !stage.roleMismatch && hasOrderId,
    canOpenOrderArchive: !stage.roleMismatch && hasOrderId,
    deliveries,
    statusLogs
  }
  return {
    ...actions,
    primaryActions: getPrimaryActions(actions),
    toolbarActions: getToolbarActions(actions),
    systemCards: getSystemCards(actions)
  }
}

export function filterConversationsByActiveRole(conversations = [], currentUser, activeRole = currentUser?.role) {
  return conversations.filter(conversation => getUserRoleInConversation(conversation, currentUser) === activeRole)
}

export function filterOrdersByActiveRole(orders = [], currentUser, activeRole = currentUser?.role) {
  return orders.filter(order => getUserRoleInOrder(order, currentUser) === activeRole)
}

export function buildConversationWorkbenchViewModel({
  conversation,
  currentUser,
  activeRole = currentUser?.role,
  messages = [],
  quotes = [],
  order,
  statusLogs = [],
  deliveries = [],
  authorizations = []
}) {
  const currentUserId = getCurrentUserId(currentUser)
  const actions = deriveConversationActions({
    conversation,
    quotes,
    order,
    deliveries,
    authorizations,
    statusLogs,
    activeRole,
    currentUser
  })
  const relationRole = actions.visibleRole || getUserRoleInConversation(conversation, currentUser) || getUserRoleInOrder(order, currentUser)
  const timeline = buildConversationTimeline({
    messages,
    quotes,
    order,
    statusLogs,
    deliveries,
    authorizations,
    actions,
    conversation,
    currentUser
  })

  return {
    currentUserId,
    activeRole,
    relationRole,
    roleMismatch: actions.roleMismatch,
    stage: actions.stage,
    stageLabel: actions.stage.title,
    conversationTitle: getConversationTitle(conversation),
    conversationSubtitle: getConversationSubtitle(conversation),
    timeline,
    primaryActions: actions.primaryActions,
    toolbarActions: actions.toolbarActions,
    panelSummary: buildPanelSummary({ actions, quotes, order, deliveries, authorizations }),
    canOpenOrderArchive: actions.canOpenOrderArchive,
    actions
  }
}

export function buildConversationTimeline({
  messages = [],
  quotes = [],
  order,
  statusLogs = [],
  deliveries = [],
  authorizations = [],
  actions,
  conversation,
  currentUser
}) {
  const visibleRole = actions?.visibleRole || getUserRoleInConversation(conversation, currentUser)
  const items = messages.filter(Boolean).map((message, index) => {
    const actorRole = getMessageActorRole(message, conversation)
    return createTimelineItem({
      id: `message-${message.messageId ?? message.id ?? index}`,
      type: 'MESSAGE',
      actorRole,
      actorId: message.senderId,
      visibleRole,
      timestamp: message.createdAt || message.sentAt || message.updatedAt,
      stageOrder: STAGE_ORDER.MESSAGE,
      title: '',
      summary: '',
      meta: { message },
      actions: []
    })
  })

  quotes.filter(Boolean).forEach(quote => {
    items.push(createTimelineItem({
      id: `quote-sent-${quote.quotationId}`,
      type: 'QUOTE_SENT',
      actorRole: 'PROVIDER',
      actorId: quote.providerUserId,
      visibleRole,
      timestamp: quote.createdAt,
      stageOrder: STAGE_ORDER.QUOTE_SENT,
      title: '摄影师发送了报价',
      summary: quote.serviceContent || '本次拍摄报价已发送。',
      meta: { quote },
      actions: getQuoteEventActions(quote, actions)
    }))
    const decisionEvent = buildQuoteDecisionEvent(quote, order, visibleRole)
    if (decisionEvent) items.push(decisionEvent)
  })

  if (order) {
    items.push(buildOrderCreatedEvent(order, actions, visibleRole))
    statusLogs.filter(Boolean).forEach(log => {
      const event = buildStatusLogEvent(log, order, actions, visibleRole)
      if (event) items.push(event)
    })
    const validDeliveries = deliveries
      .filter(Boolean)
      .filter(delivery => isNormalTimelineDelivery(delivery, order, statusLogs))
    const latestDelivery = getLatestItem(validDeliveries, delivery => delivery.uploadTime)
    validDeliveries.forEach((delivery, index) => {
      const latest = delivery === latestDelivery
      items.push(createTimelineItem({
        id: `delivery-${delivery.deliveryId ?? delivery.fileId ?? index}`,
        type: 'DELIVERY',
        actorRole: 'PROVIDER',
        actorId: delivery.providerUserId || order.providerUserId,
        visibleRole,
        timestamp: delivery.uploadTime,
        stageOrder: STAGE_ORDER.DELIVERY,
        title: delivery.deliveryRound > 1 ? '摄影师重新上传了作品' : '摄影师上传了作品',
        summary: delivery.remark || `第 ${delivery.deliveryRound || index + 1} 次交付已上传。`,
        meta: { delivery, deliveryCount: deliveries.length, order },
        actions: latest && order.status === 'DELIVERED_PENDING_CONFIRM'
          ? [
              actions?.canConfirmDelivery && 'CONFIRM_DELIVERY',
              actions?.canRequestRework && 'REQUEST_REWORK'
            ].filter(Boolean)
          : []
      }))
    })

    if (order.status === 'REWORK_REQUIRED' && !statusLogs.some(log => log.toStatus === 'REWORK_REQUIRED')) {
      items.push(buildCurrentReworkEvent(order, actions, visibleRole))
    }
    if (order.status === 'PENDING_DELIVERY' && !statusLogs.some(log => log.toStatus === 'PENDING_DELIVERY')) {
      items.push(buildCurrentDeliveryReminder(order, actions, visibleRole))
    }
    if (order.status === 'APPEALING' && !statusLogs.some(log => log.toStatus === 'APPEALING')) {
      items.push(buildDisputeEvent(order, visibleRole))
    }
    if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status) && !statusLogs.some(log => log.toStatus === order.status)) {
      items.push(buildCurrentStatusFallback(order, actions, visibleRole))
    }

    if (order.status === 'COMPLETED') {
      authorizations.filter(Boolean).forEach((authorization, index) => {
        items.push(createTimelineItem({
          id: `authorization-${authorization.id ?? index}`,
          type: 'AUTHORIZATION',
          actorRole: 'PROVIDER',
          actorId: authorization.providerUserId || order.providerUserId,
          visibleRole,
          timestamp: authorization.authorizedAt || order.updatedAt,
          stageOrder: STAGE_ORDER.AUTHORIZATION,
          title: '摄影师申请将部分作品用于展示',
          summary: authorization.remark || '请确认是否同意展示所选作品。',
          meta: { authorization },
          actions: authorization.status === 'PENDING' && actions?.canReviewPhotoAuthorization
            ? ['APPROVE_AUTHORIZATION', 'REJECT_AUTHORIZATION']
            : []
        }))
      })
    }
  }

  return items
    .filter(Boolean)
    .map((item, index) => normalizeTimelineItem(item, index))
    .map(item => attachTimelineActor(item, conversation, currentUser, order))
    .sort((left, right) => left.timestamp - right.timestamp || left.stageOrder - right.stageOrder)
}

export function selectConversationOrder(orders = [], conversation, quotes = []) {
  const conversationId = getBackendConversationId(conversation)
  const confirmedQuoteIds = new Set(
    quotes
      .filter(quote => quote.status === 'CONFIRMED')
      .map(quote => Number(quote.quotationId))
      .filter(Boolean)
  )
  const candidates = orders.filter(order => {
    if (conversationId && Number(order.conversationId) === Number(conversationId)) return true
    return confirmedQuoteIds.has(Number(order.quoteId))
  })
  return candidates.sort((left, right) => {
    const activeDifference = Number(ACTIVE_ORDER_STATUSES.has(right.status)) - Number(ACTIVE_ORDER_STATUSES.has(left.status))
    if (activeDifference) return activeDifference
    return toTimestamp(right.updatedAt || right.createdAt) - toTimestamp(left.updatedAt || left.createdAt)
  })[0] || null
}

function isBeforeShootStart(order) {
  const start = toTimestamp(order?.shootStartTime)
  return Boolean(start) && Date.now() < start
}

function getLatestItem(items, getTime) {
  return [...items].sort((left, right) => toTimestamp(getTime(right)) - toTimestamp(getTime(left)))[0] || null
}

function isNormalTimelineDelivery(delivery, order, statusLogs = []) {
  if (!delivery || !order?.orderId) return false
  const deliveryOrderId = normalizeActorId(delivery.orderId)
  if (deliveryOrderId && deliveryOrderId !== normalizeActorId(order.orderId)) return false

  const uploadTime = toTimestamp(delivery.uploadTime || delivery.createdAt)
  if (!uploadTime) return false
  const orderCreatedTime = toTimestamp(order.createdAt)
  if (orderCreatedTime && uploadTime < orderCreatedTime) return false

  const paidTime = getOrderPaidTimestamp(statusLogs, order)
  if (paidTime && uploadTime < paidTime) return false

  // Defensive guard for inconsistent seed or stale API data: a delivery cannot be
  // shown as a normal business-flow event before the order has reached delivery.
  return ['DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED', 'APPEALING'].includes(order.status)
}

function getOrderPaidTimestamp(statusLogs = [], order) {
  const paidLog = statusLogs.find(log => ['PAID', 'PAID_PENDING_SHOOT'].includes(log?.toStatus))
  return toTimestamp(paidLog?.createdAt || order?.paidAt || order?.paymentTime)
}

function toTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getBackendConversationId(conversation) {
  const id = Number(conversation?.backendConversationId || conversation?.conversationId)
  return Number.isFinite(id) && id > 0 ? id : null
}

function getQuoteOrderId(quote) {
  return quote?.orderId || quote?.order?.orderId || quote?.confirmedOrderId || null
}

function getPrimaryActions(actions) {
  return [
    actions.canSendQuote && 'SEND_QUOTE',
    actions.canEditQuote && 'EDIT_QUOTE',
    actions.canConfirmQuote && 'CONFIRM_QUOTE',
    actions.canRejectQuote && 'REJECT_QUOTE',
    actions.canPay && 'PAY',
    actions.cancelAction && 'CANCEL',
    actions.canUploadDelivery && 'UPLOAD_DELIVERY',
    actions.canReuploadDelivery && 'REUPLOAD_DELIVERY',
    actions.canConfirmDelivery && 'CONFIRM_DELIVERY',
    actions.canRequestRework && 'REQUEST_REWORK',
    actions.canRequestPhotoAuthorization && 'REQUEST_AUTHORIZATION',
    actions.canReviewPhotoAuthorization && 'REVIEW_AUTHORIZATION',
    actions.canViewDispute && 'VIEW_DISPUTE'
  ].filter(Boolean)
}

function getToolbarActions(actions) {
  return [
    'IMAGE',
    'ATTACHMENT',
    'EMOJI',
    !actions.hasOrder && actions.role === 'PROVIDER' && 'QUOTE',
    (actions.canUploadDelivery || actions.canReuploadDelivery) && 'DELIVERY',
    actions.canRequestPhotoAuthorization && 'REQUEST_AUTHORIZATION',
    'SUPPLEMENT',
    actions.canAppeal && 'PLATFORM_ASSISTANCE',
    actions.canOpenOrderArchive && 'ORDER_ARCHIVE'
  ].filter(Boolean)
}

function getSystemCards(actions) {
  return [
    actions.stage.key === 'PENDING_PAYMENT' && 'PAYMENT_REMINDER',
    actions.canViewDispute && 'DISPUTE_PROGRESS'
  ].filter(Boolean)
}

function createTimelineItem({
  id,
  type,
  actorRole,
  actorId,
  visibleRole,
  timestamp,
  stageOrder,
  title,
  summary,
  meta = {},
  actions = []
}) {
  return normalizeTimelineItem({
    id,
    key: id,
    type,
    actorRole,
    actorId,
    actorLabel: actorRole === 'PLATFORM' ? '平台' : actorRole === 'PROVIDER' ? '摄影师' : '客户',
    side: actorRole === 'PLATFORM' ? 'center' : actorRole === visibleRole ? 'self' : 'other',
    timestamp: toTimestamp(timestamp),
    stageOrder,
    title,
    summary,
    meta,
    actions
  })
}

function normalizeTimelineItem(item, index = 0) {
  const type = VALID_EVENT_TYPES.has(item?.type) ? item.type : 'STATUS'
  const actorRole = VALID_ACTOR_ROLES.has(item?.actorRole) ? item.actorRole : 'PLATFORM'
  const visibleRole = VALID_ACTOR_ROLES.has(item?.visibleRole) ? item.visibleRole : ''
  const side = VALID_SIDES.has(item?.side)
    ? item.side
    : actorRole === 'PLATFORM' ? 'center' : actorRole === visibleRole ? 'self' : 'other'
  const timestamp = toTimestamp(item?.timestamp)
  const fallbackId = `${type.toLowerCase()}-${timestamp || 'untimed'}-${index}`
  const id = String(item?.id || item?.key || fallbackId)

  return {
    id,
    key: String(item?.key || id),
    type,
    actorRole,
    actorId: normalizeActorId(item?.actorId),
    actorLabel: item?.actorLabel || getActorLabel(actorRole),
    side,
    timestamp,
    stageOrder: Number.isFinite(Number(item?.stageOrder)) ? Number(item.stageOrder) : (STAGE_ORDER[type] || STAGE_ORDER.MESSAGE),
    title: String(item?.title || '合作进展已更新'),
    summary: String(item?.summary || ''),
    meta: item?.meta && typeof item.meta === 'object' ? item.meta : {},
    actions: Array.isArray(item?.actions) ? item.actions.filter(Boolean) : []
  }
}

function attachTimelineActor(item, conversation, currentUser, order) {
  if (!item || item.actorRole === 'PLATFORM') {
    return {
      ...item,
      actor: null
    }
  }
  const userId = item.actorId || inferActorId(item, conversation, order)
  const displayName = getTimelineActorDisplayName(userId, item.actorRole, conversation, currentUser)
  return {
    ...item,
    actorId: userId,
    actor: userId ? {
      userId,
      role: item.actorRole,
      isCurrentUser: Number(userId) === getCurrentUserId(currentUser),
      displayName,
      avatarText: getTimelineActorAvatarText(userId, displayName, currentUser),
      profilePath: buildUserProfileTarget(userId, currentUser)?.to || ''
    } : {
      userId: null,
      role: item.actorRole,
      isCurrentUser: false,
      displayName: item.actorLabel,
      avatarText: item.actorLabel.slice(0, 1),
      profilePath: ''
    }
  }
}

function inferActorId(item, conversation, order) {
  const meta = item?.meta || {}
  if (item.actorRole === 'CUSTOMER') {
    return normalizeActorId(meta.quote?.customerId)
      || normalizeActorId(meta.order?.customerId)
      || normalizeActorId(order?.customerId)
      || normalizeActorId(conversation?.participantAId)
  }
  if (item.actorRole === 'PROVIDER') {
    return normalizeActorId(meta.quote?.providerUserId)
      || normalizeActorId(meta.delivery?.providerUserId)
      || normalizeActorId(meta.authorization?.providerUserId)
      || normalizeActorId(meta.order?.providerUserId)
      || normalizeActorId(order?.providerUserId)
      || normalizeActorId(conversation?.participantBId)
  }
  return null
}

function normalizeActorId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function getTimelineActorDisplayName(userId, actorRole, conversation, currentUser) {
  if (userId && Number(userId) === getCurrentUserId(currentUser)) {
    return currentUser?.nickname || getActorLabel(actorRole)
  }
  const nickname = conversation?.counterpartyNickname
    || conversation?.otherUserNickname
    || (actorRole === 'PROVIDER' ? conversation?.providerNickname : conversation?.customerNickname)
  return nickname || getActorLabel(actorRole)
}

function getTimelineActorAvatarText(userId, displayName, currentUser) {
  if (userId && Number(userId) === getCurrentUserId(currentUser)) {
    return String(currentUser?.nickname || displayName || '我').slice(0, 1) || '我'
  }
  return String(displayName || '对').slice(0, 1) || '对'
}

function getActorLabel(actorRole) {
  if (actorRole === 'PROVIDER') return '摄影师'
  if (actorRole === 'CUSTOMER') return '客户'
  return '平台'
}

function getMessageActorRole(message, conversation) {
  if (Number(message?.senderId) === Number(conversation?.participantAId)) return 'CUSTOMER'
  if (Number(message?.senderId) === Number(conversation?.participantBId)) return 'PROVIDER'
  return 'PLATFORM'
}

function getQuoteEventActions(quote, actions) {
  if (!actions || actions.hasOrder || quote.status !== 'PENDING_CONFIRM') return []
  if (String(quote.quotationId) !== String(actions.pendingQuote?.quotationId)) return []
  return [
    actions.canEditQuote && 'EDIT_QUOTE',
    actions.canConfirmQuote && 'CONFIRM_QUOTE',
    actions.canRejectQuote && 'REJECT_QUOTE'
  ].filter(Boolean)
}

function buildQuoteDecisionEvent(quote, order, visibleRole) {
  if (!['CONFIRMED', 'REJECTED', 'EXPIRED'].includes(quote.status)) return null
  const config = {
    CONFIRMED: ['CUSTOMER', '客户确认了报价', '订单将按确认后的报价进入平台担保流程。'],
    REJECTED: ['CUSTOMER', '客户拒绝了报价', '双方可以继续沟通新的拍摄方案。'],
    EXPIRED: ['PLATFORM', '报价已过期', '如需继续合作，请摄影师重新发送报价。']
  }[quote.status]
  return createTimelineItem({
    id: `quote-decision-${quote.quotationId}-${quote.status}`,
    type: 'QUOTE_DECISION',
    actorRole: config[0],
    actorId: config[0] === 'CUSTOMER' ? quote.customerId : null,
    visibleRole,
    timestamp: quote.status === 'CONFIRMED'
      ? order?.createdAt || quote.createdAt
      : quote.status === 'EXPIRED' ? quote.expireTime || quote.createdAt : quote.createdAt,
    stageOrder: STAGE_ORDER.QUOTE_DECISION,
    title: config[1],
    summary: config[2],
    meta: { quote },
    actions: []
  })
}

function buildOrderCreatedEvent(order, actions, visibleRole) {
  const pendingPayment = order.status === 'PENDING_PAYMENT'
  return createTimelineItem({
    id: `order-created-${order.orderId}`,
    type: 'ORDER_CREATED',
    actorRole: 'PLATFORM',
    visibleRole,
    timestamp: order.createdAt,
    stageOrder: STAGE_ORDER.ORDER_CREATED,
    title: pendingPayment
      ? actions?.role === 'CUSTOMER' ? '订单已生成，等待你付款' : '订单已生成，等待客户付款'
      : '订单已生成',
    summary: pendingPayment
      ? actions?.role === 'CUSTOMER'
        ? '平台会先托管资金，拍摄和交付完成后再结算给摄影师。'
        : '客户付款后，平台会托管资金。'
      : '本次合作已经进入平台担保履约流程。',
    meta: { order },
    actions: pendingPayment
      ? [actions?.canPay && 'PAY', actions?.cancelAction && 'CANCEL'].filter(Boolean)
      : []
  })
}

function buildStatusLogEvent(log, order, actions, visibleRole) {
  if (!log?.toStatus || ['PENDING_PAYMENT', 'DELIVERED_PENDING_CONFIRM'].includes(log.toStatus)) return null
  const logActorRole = getStatusLogActorRole(log)
  const actorRole = getStatusActorRole(log.toStatus, logActorRole)
  const statusConfig = {
    PAID_PENDING_SHOOT: [actions?.role === 'CUSTOMER' ? '你完成了付款' : '客户完成了付款', '资金已进入平台托管，等待约定拍摄时间。', STAGE_ORDER.PAYMENT],
    SHOOTING: ['拍摄履约已开始', '双方正在按约定完成拍摄。', STAGE_ORDER.SHOOTING],
    PENDING_DELIVERY: ['拍摄已完成，等待作品交付', '摄影师可以上传本次拍摄作品。', STAGE_ORDER.PENDING_DELIVERY],
    REWORK_REQUIRED: [actions?.role === 'CUSTOMER' ? '你已提交返修要求' : '客户提交了返修要求', '等待摄影师根据要求重新上传作品。', STAGE_ORDER.REWORK],
    COMPLETED: [
      actorRole === 'PLATFORM' ? '订单已自动确认完成' : '客户确认接收作品',
      actorRole === 'PLATFORM' ? '客户逾期未处理，平台已按规则自动确认。' : '订单已完成，平台托管资金将结算给摄影师。',
      STAGE_ORDER.COMPLETED
    ],
    CANCELLED: ['客户取消了订单', '本次订单已经取消。', STAGE_ORDER.CLOSED],
    REFUNDED: ['平台已完成退款', '本次订单已退款结束。', STAGE_ORDER.CLOSED],
    APPEALING: ['平台正在处理争议', '可以在订单档案查看争议进展。', STAGE_ORDER.DISPUTE]
  }[log.toStatus]
  if (!statusConfig) return null
  return createTimelineItem({
    id: `status-${log.logId ?? `${log.toStatus}-${log.createdAt}`}`,
    type: 'STATUS',
    actorRole: log.toStatus === 'APPEALING' || log.toStatus === 'REFUNDED' ? 'PLATFORM' : actorRole,
    actorId: getStatusEventActorId(log.toStatus, actorRole, log, order),
    visibleRole,
    timestamp: log.createdAt,
    stageOrder: statusConfig[2],
    title: statusConfig[0],
    summary: log.toStatus === 'REWORK_REQUIRED' ? normalizeReason(log.reason) || statusConfig[1] : statusConfig[1],
    meta: { log, order },
    actions: getStatusEventActions(log.toStatus, actions)
  })
}

function getStatusLogActorRole(log) {
  const role = String(log?.operatorRole || '').toUpperCase()
  if (role === 'CUSTOMER' || role === 'PROVIDER') return role
  return 'PLATFORM'
}

function getStatusActorRole(status, logActorRole) {
  if (['PAID_PENDING_SHOOT', 'REWORK_REQUIRED', 'CANCELLED'].includes(status)) return 'CUSTOMER'
  if (['SHOOTING', 'PENDING_DELIVERY', 'REFUNDED', 'APPEALING'].includes(status)) return 'PLATFORM'
  return logActorRole
}

function getStatusEventActorId(status, actorRole, log, order) {
  if (status === 'APPEALING' || status === 'REFUNDED') return null
  const operatorId = normalizeActorId(log?.operatorId || log?.operatorUserId || log?.userId)
  if (operatorId) return operatorId
  if (actorRole === 'CUSTOMER') return normalizeActorId(order?.customerId)
  if (actorRole === 'PROVIDER') return normalizeActorId(order?.providerUserId)
  return null
}

function getStatusEventActions(status, actions) {
  if (status === 'PENDING_DELIVERY') {
    return [actions?.canUploadDelivery && 'UPLOAD_DELIVERY'].filter(Boolean)
  }
  if (status === 'REWORK_REQUIRED') {
    return [actions?.canReuploadDelivery && 'REUPLOAD_DELIVERY'].filter(Boolean)
  }
  if (status === 'COMPLETED') {
    return [actions?.canRequestPhotoAuthorization && 'REQUEST_AUTHORIZATION', actions?.canOpenOrderArchive && 'OPEN_ORDER'].filter(Boolean)
  }
  if (status === 'APPEALING') return ['VIEW_DISPUTE']
  return []
}

function buildCurrentReworkEvent(order, actions, visibleRole) {
  return createTimelineItem({
    id: `current-rework-${order.orderId}`,
    type: 'REWORK',
    actorRole: 'CUSTOMER',
    actorId: order.customerId,
    visibleRole,
    timestamp: order.updatedAt,
    stageOrder: STAGE_ORDER.REWORK,
    title: actions?.role === 'CUSTOMER' ? '你已提交返修要求' : '客户提交了返修要求',
    summary: '等待摄影师根据要求重新上传作品。',
    meta: { order },
    actions: [actions?.canReuploadDelivery && 'REUPLOAD_DELIVERY'].filter(Boolean)
  })
}

function buildCurrentDeliveryReminder(order, actions, visibleRole) {
  return createTimelineItem({
    id: `current-delivery-reminder-${order.orderId}`,
    type: 'DELIVERY_REMINDER',
    actorRole: 'PLATFORM',
    visibleRole,
    timestamp: order.updatedAt,
    stageOrder: STAGE_ORDER.PENDING_DELIVERY,
    title: actions?.role === 'PROVIDER' ? '等待你交付作品' : '等待摄影师交付作品',
    summary: actions?.role === 'PROVIDER' ? '请上传本次拍摄作品。' : '摄影师会在会话中上传作品。',
    meta: { order },
    actions: [actions?.canUploadDelivery && 'UPLOAD_DELIVERY'].filter(Boolean)
  })
}

function buildDisputeEvent(order, visibleRole) {
  return createTimelineItem({
    id: `current-dispute-${order.orderId}`,
    type: 'DISPUTE',
    actorRole: 'PLATFORM',
    visibleRole,
    timestamp: order.updatedAt,
    stageOrder: STAGE_ORDER.DISPUTE,
    title: '平台正在处理争议',
    summary: '可以在订单档案查看争议进展。',
    meta: { order },
    actions: ['VIEW_DISPUTE']
  })
}

function buildCurrentStatusFallback(order, actions, visibleRole) {
  const config = {
    COMPLETED: [
      'PLATFORM',
      '订单已完成',
      actions?.role === 'PROVIDER' ? '你可以申请照片展示授权，或查看订单档案。' : '可以查看订单档案和评价记录。',
      STAGE_ORDER.COMPLETED,
      [actions?.canRequestPhotoAuthorization && 'REQUEST_AUTHORIZATION', actions?.canOpenOrderArchive && 'OPEN_ORDER'].filter(Boolean)
    ],
    CANCELLED: ['CUSTOMER', '客户取消了订单', '本次订单已经取消。', STAGE_ORDER.CLOSED, ['OPEN_ORDER']],
    REFUNDED: ['PLATFORM', '平台已完成退款', '本次订单已退款结束。', STAGE_ORDER.CLOSED, ['OPEN_ORDER']]
  }[order.status]
  return createTimelineItem({
    id: `current-status-${order.orderId}-${order.status}`,
    type: 'STATUS',
    actorRole: config[0],
    actorId: config[0] === 'CUSTOMER' ? order.customerId : config[0] === 'PROVIDER' ? order.providerUserId : null,
    visibleRole,
    timestamp: order.updatedAt,
    stageOrder: config[3],
    title: config[1],
    summary: config[2],
    meta: { order },
    actions: config[4]
  })
}

function normalizeReason(reason) {
  return String(reason || '')
    .replaceAll('需求方', '客户')
    .replaceAll('服务方', '摄影师')
}

function getConversationTitle(conversation) {
  const scene = String(conversation?.scene || '').trim()
  if (scene && scene !== '约拍沟通' && scene !== '约拍需求沟通') return scene
  const location = String(conversation?.location || '').trim()
  if (location) return `${location}约拍`
  return '本次合作'
}

function getConversationSubtitle(conversation) {
  const sourceType = String(conversation?.sourceType || '').toUpperCase()
  if (sourceType === 'DEMAND') return '来自拍摄需求'
  if (sourceType === 'SERVICE_PACKAGE') return '来自摄影服务橱窗'
  return '校园约拍会话'
}

function buildPanelSummary({ actions, quotes = [], order, deliveries = [], authorizations = [] }) {
  const latestQuote = getLatestItem(quotes.filter(Boolean), quote => quote.updatedAt || quote.createdAt)
  return {
    progressTitle: actions.stage.title,
    nextStep: actions.stage.description,
    quote: latestQuote
      ? {
          status: latestQuote.status || '',
          amountCent: latestQuote.amountCent,
          location: latestQuote.location || '',
          photoUsageScope: latestQuote.photoUsageScope || ''
        }
      : null,
    order: order
      ? {
          orderId: order.orderId,
          amountCent: order.amountCent,
          shootStartTime: order.shootStartTime,
          status: order.status || ''
        }
      : null,
    deliveryCount: Array.isArray(deliveries) ? deliveries.filter(Boolean).length : 0,
    authorizationCount: Array.isArray(authorizations) ? authorizations.filter(Boolean).length : 0
  }
}
