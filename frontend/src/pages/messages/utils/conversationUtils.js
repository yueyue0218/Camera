import { USERS } from '../../../AuthContext.jsx'

const CONVERSATION_STORAGE_KEY = 'camera-p4-conversations'
const LOCAL_MESSAGE_STORAGE_KEY = 'camera-p4-local-messages'
const SAVED_PHOTO_STORAGE_KEY = 'camera-p4-saved-photos'

export const roleMap = {
  CUSTOMER: '需求方',
  PROVIDER: '服务方'
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

export function formatShortTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function formatTime(value) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function readConversationRecords() {
  return readJsonStorage(CONVERSATION_STORAGE_KEY, [])
}

export function saveConversationRecord(conversation, meta = {}) {
  const records = readConversationRecords()
  const conversationId = String(conversation.conversationId)
  const previous = records.find(record => String(record.conversationId) === conversationId)
  const now = new Date().toISOString()
  const record = {
    ...previous,
    conversationId,
    backendConversationId: conversation.isLocal ? null : Number(conversation.conversationId),
    isLocal: Boolean(conversation.isLocal),
    participantAId: Number(conversation.participantAId ?? meta.customerId ?? USERS.customer.userId),
    participantBId: Number(conversation.participantBId ?? meta.providerUserId ?? meta.providerId ?? USERS.provider.userId),
    sourceType: conversation.sourceType || previous?.sourceType || 'DEMAND_RESPONSE',
    sourceId: conversation.sourceId ?? previous?.sourceId ?? meta.demandId,
    demandId: meta.demandId ?? previous?.demandId ?? conversation.sourceId,
    scene: meta.scene || previous?.scene || `需求 ${meta.demandId || conversation.sourceId || ''}`,
    location: meta.location || previous?.location || '',
    lastMessage: meta.lastMessage || previous?.lastMessage || '点击进入对话',
    interfaceNote: meta.interfaceNote || previous?.interfaceNote || '',
    updatedAt: conversation.lastMessageTime || conversation.updatedAt || conversation.createdAt || now
  }
  const nextRecords = records.filter(item => String(item.conversationId) !== conversationId)
  nextRecords.unshift(record)
  writeJsonStorage(CONVERSATION_STORAGE_KEY, nextRecords)
  return record
}

export function findConversationRecord(conversationId) {
  return readConversationRecords().find(record => String(record.conversationId) === String(conversationId)) || null
}

export function getConversationRecordsForUser(currentUser) {
  return readConversationRecords()
    .filter(record => Number(record.participantAId) === currentUser.userId || Number(record.participantBId) === currentUser.userId)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
}

export function mergeConversationRecords(remoteConversations, currentUser) {
  const localRecords = getConversationRecordsForUser(currentUser)
  const merged = new Map(localRecords.map(record => [String(record.conversationId), record]))

  remoteConversations.forEach(conversation => {
    const conversationId = String(conversation.conversationId)
    const previous = merged.get(conversationId)
    const record = saveConversationRecord(conversation, {
      demandId: previous?.demandId,
      scene: previous?.scene || `会话 ${conversationId}`,
      location: previous?.location || '',
      lastMessage: previous?.lastMessage || (conversation.lastMessageTime ? '最近有新消息' : '点击进入对话')
    })
    merged.set(conversationId, record)
  })

  return Array.from(merged.values())
    .filter(record => Number(record.participantAId) === currentUser.userId || Number(record.participantBId) === currentUser.userId)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
}

export function updateConversationLastMessage(conversationId, content) {
  const record = findConversationRecord(conversationId)
  if (!record) return
  saveConversationRecord(record, { lastMessage: content })
}

export function buildConversationFallback(conversationId) {
  const isLocal = String(conversationId).startsWith('local-')
  return {
    conversationId: String(conversationId),
    backendConversationId: isLocal ? null : Number(conversationId),
    isLocal,
    participantAId: USERS.customer.userId,
    participantBId: USERS.provider.userId,
    sourceType: isLocal ? 'DEMAND_CONTACT' : 'DEMAND_RESPONSE',
    sourceId: null,
    scene: `会话 ${conversationId}`,
    lastMessage: ''
  }
}

export function getOppositeUserId(conversation, currentUserId) {
  return Number(conversation.participantAId) === currentUserId
    ? conversation.participantBId
    : conversation.participantAId
}

function getLocalMessageStore() {
  return readJsonStorage(LOCAL_MESSAGE_STORAGE_KEY, {})
}

export function getLocalMessages(conversationId) {
  const store = getLocalMessageStore()
  return store[String(conversationId)] || []
}

export function addLocalMessage(conversationId, message) {
  const id = String(conversationId)
  const store = getLocalMessageStore()
  const nextMessage = {
    messageId: `${id}-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    conversationId: id,
    senderId: Number(message.senderId),
    messageType: message.messageType || 'TEXT',
    content: message.content,
    createdAt: new Date().toISOString()
  }
  const nextMessages = [...(store[id] || []), nextMessage]
  store[id] = nextMessages
  writeJsonStorage(LOCAL_MESSAGE_STORAGE_KEY, store)
  return nextMessages
}

function readSavedPhotos() {
  return readJsonStorage(SAVED_PHOTO_STORAGE_KEY, [])
    .filter(photo => photo && (
      photo.source === 'conversation-submission' ||
      String(photo.photoId || '').startsWith('message-')
    ))
}

export function addSavedPhoto(photo) {
  const photos = readSavedPhotos()
  const nextPhoto = {
    ...photo,
    photoId: String(photo.photoId),
    savedAt: new Date().toISOString()
  }
  const nextPhotos = [
    nextPhoto,
    ...photos.filter(item => String(item.photoId) !== nextPhoto.photoId)
  ].slice(0, 80)
  writeJsonStorage(SAVED_PHOTO_STORAGE_KEY, nextPhotos)
  return nextPhotos
}

export function getConversationSourceLabel(conversation) {
  const sourceType = conversation?.sourceType
  if (!sourceType) return '当前接口未返回该字段'
  if (sourceType === 'DEMAND_RESPONSE') return '需求大厅沟通'
  if (sourceType === 'SERVICE_PACKAGE') return '服务橱窗预订沟通'
  if (sourceType.includes('SCHEDULE')) return '档期预约沟通'
  return sourceType
}

export function buildConversationSourceRows(conversation, currentUser, sourceLabel, backendConversationId) {
  const rows = [
    ['会话 ID', conversation?.conversationId || '未加载'],
    ['后端 conversationId', backendConversationId || '当前接口未返回该字段'],
    ['对方用户 ID', conversation ? getOppositeUserId(conversation, currentUser.userId) : '未加载'],
    ['来源类型', conversation?.sourceType || '当前接口未返回该字段'],
    ['业务来源', sourceLabel]
  ]

  if (conversation?.sourceType === 'DEMAND_RESPONSE') {
    rows.push(['响应 ID', conversation.sourceId || '当前接口未返回该字段'])
    rows.push(['需求 ID', conversation.demandId || '当前接口未返回'])
    return rows
  }

  if (conversation?.sourceType === 'SERVICE_PACKAGE') {
    rows.push(['服务橱窗 ID', conversation.sourceId || '当前接口未返回该字段'])
    rows.push(['档期 ID', conversation.scheduleId || '当前接口未返回'])
    return rows
  }

  rows.push(['来源 ID', conversation?.sourceId || '当前接口未返回该字段'])
  rows.push(['需求 ID', conversation?.demandId || '当前接口未返回该字段'])
  rows.push(['服务橱窗 ID', conversation?.servicePackageId || '当前接口未返回该字段'])
  rows.push(['档期 ID', conversation?.scheduleId || '当前接口未返回该字段'])
  return rows
}

export function getConversationSourceHint(conversation) {
  if (!conversation) return '会话仍在加载。'
  if (conversation.isLocal) {
    return '当前是本地 fallback 会话，只能聊天演示，不能创建真实报价或订单。'
  }
  if (conversation.sourceType === 'DEMAND_RESPONSE') {
    return '该会话来自需求大厅响应接受，后续应在这里沟通、报价并生成托管订单。'
  }
  if (conversation.sourceType === 'SERVICE_PACKAGE') {
    return '该会话来自服务橱窗咨询或预约意向；当前前端只展示来源，不实现橱窗预订、锁档期或付款。'
  }
  return '当前来源类型不属于已明确的需求大厅或服务橱窗流程，本轮只做展示，不新增业务动作。'
}
