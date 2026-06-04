import { USERS } from '../../../AuthContext.jsx'

const CONVERSATION_STORAGE_KEY = 'camera-p4-conversations'
const LOCAL_MESSAGE_STORAGE_KEY = 'camera-p4-local-messages'
const SAVED_PHOTO_STORAGE_KEY = 'camera-p4-saved-photos'

export const roleMap = {
  CUSTOMER: '客户',
  PROVIDER: '摄影师'
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
    scene: meta.scene || previous?.scene || '约拍需求沟通',
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
      scene: previous?.scene || '约拍沟通',
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
    scene: '约拍沟通',
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
  if (!sourceType) return '约拍沟通'
  if (sourceType === 'DEMAND_RESPONSE') return '需求大厅沟通'
  if (sourceType === 'SERVICE_PACKAGE') return '摄影服务橱窗'
  if (sourceType.includes('SCHEDULE')) return '拍摄时间沟通'
  return '约拍沟通'
}

export function buildConversationSourceRows(conversation, currentUser, sourceLabel, backendConversationId) {
  const canQuote = currentUser.role === 'PROVIDER'
  const rows = [
    ['沟通来源', sourceLabel],
    ['对方', getCounterpartyLabel(conversation, currentUser)],
    ['下一步', backendConversationId
      ? canQuote ? '根据沟通结果向客户发送正式报价' : '查看摄影师报价并决定是否确认'
      : '可以继续聊天，生成订单前需要进入正式沟通']
  ]

  if (conversation?.sourceType === 'DEMAND_RESPONSE') {
    rows.push(['说明', '这次沟通来自一个约拍需求。'])
    return rows
  }

  if (conversation?.sourceType === 'SERVICE_PACKAGE') {
    rows.push(['说明', '这次沟通来自一个摄影服务橱窗。'])
    return rows
  }

  rows.push(['说明', '这次沟通用于确认拍摄方案、报价和后续订单。'])
  return rows
}

export function getConversationSourceHint(conversation) {
  if (!conversation) return '会话仍在加载。'
  if (conversation.isLocal) {
    return '这段沟通还没有进入正式成单流程，可以先继续沟通。'
  }
  if (conversation.sourceType === 'DEMAND_RESPONSE') {
    return '这次沟通来自客户发布的约拍需求，确认方案后可由摄影师发送报价。'
  }
  if (conversation.sourceType === 'SERVICE_PACKAGE') {
    return '这次沟通来自摄影服务橱窗，确认拍摄时间和内容后再进入报价。'
  }
  return '可以在这里继续沟通拍摄内容、时间和交付要求。'
}

export function getCounterpartyLabel(conversation, currentUser) {
  if (!conversation || !currentUser) return '对方'
  if (currentUser.role === 'PROVIDER') return '这位客户'
  if (currentUser.role === 'CUSTOMER') return '摄影师'
  return '对方'
}
