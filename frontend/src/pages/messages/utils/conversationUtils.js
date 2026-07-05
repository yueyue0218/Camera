import { USERS } from '../../../AuthContext.jsx'
import {
  USER_ROLE_LABELS,
  formatDateOnly,
  formatDateTime,
  formatShortDate
} from '../../../utils/displayFormatters.js'
import { filterConversationsByActiveRole, getCurrentUserId } from './workbenchState.js'

const CONVERSATION_STORAGE_KEY = 'camera-p4-conversations'
const LOCAL_MESSAGE_STORAGE_KEY = 'camera-p4-local-messages'
const SAVED_PHOTO_STORAGE_KEY = 'camera-p4-saved-photos'
const USER_PROFILE_STORAGE_KEY = 'camera-p4-user-profiles'
const CONVERSATION_CACHE_VERSION = 2
const LOCAL_MESSAGE_CACHE_VERSION = 1
const CONVERSATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const LOCAL_MESSAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const roleMap = {
  CUSTOMER: USER_ROLE_LABELS.CUSTOMER,
  PROVIDER: USER_ROLE_LABELS.PROVIDER
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
  return formatShortDate(value)
}

export function formatTime(value) {
  return formatDateTime(value, '刚刚')
}

export function formatDate(value) {
  return formatDateOnly(value)
}

export function readConversationRecords() {
  const records = readJsonStorage(CONVERSATION_STORAGE_KEY, [])
  const recordList = Array.isArray(records) ? records : []
  const filtered = recordList.filter(isValidCachedConversation)
  if (filtered.length !== recordList.length || !Array.isArray(records)) {
    writeJsonStorage(CONVERSATION_STORAGE_KEY, filtered)
  }
  return filtered
}

export function saveConversationRecord(conversation, meta = {}) {
  const records = readConversationRecords()
  const conversationId = String(conversation.conversationId)
  const previous = records.find(record => String(record.conversationId) === conversationId)
  const now = new Date().toISOString()
  const record = {
    ...previous,
    cacheVersion: CONVERSATION_CACHE_VERSION,
    cachedAt: now,
    expiresAt: new Date(Date.now() + CONVERSATION_CACHE_TTL_MS).toISOString(),
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
    lastMessage: meta.lastMessage || conversation.lastMessage || previous?.lastMessage || '点击进入对话',
    latestMessage: meta.latestMessage || conversation.latestMessage || previous?.latestMessage || null,
    latestMessageSenderId: meta.latestMessageSenderId ?? conversation.latestMessageSenderId ?? previous?.latestMessageSenderId ?? null,
    latestQuotes: meta.latestQuotes || conversation.latestQuotes || previous?.latestQuotes || [],
    lastMessageObject: meta.lastMessageObject || conversation.lastMessageObject || previous?.lastMessageObject || null,
    interfaceNote: meta.interfaceNote || previous?.interfaceNote || '',
    updatedAt: meta.updatedAt || conversation.lastMessageTime || conversation.updatedAt || conversation.createdAt || now
  }
  const nextRecords = records.filter(item => String(item.conversationId) !== conversationId)
  nextRecords.unshift(record)
  writeJsonStorage(CONVERSATION_STORAGE_KEY, nextRecords)
  return record
}

export function findConversationRecord(conversationId) {
  return readConversationRecords().find(record => String(record.conversationId) === String(conversationId)) || null
}

export function getConversationRecordsForUser(currentUser, activeRole = currentUser?.role) {
  const currentUserId = getCurrentUserId(currentUser)
  return filterConversationsByActiveRole(readConversationRecords()
    .filter(record => Number(record.participantAId) === currentUserId || Number(record.participantBId) === currentUserId)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)), currentUser, activeRole)
}

export function mergeConversationRecords(remoteConversations, currentUser, activeRole = currentUser?.role) {
  const localFallbackRecords = getConversationRecordsForUser(currentUser, activeRole).filter(record => record.isLocal)
  const merged = new Map(localFallbackRecords.map(record => [String(record.conversationId), record]))
  const remoteList = Array.isArray(remoteConversations) ? remoteConversations : []

  remoteList.forEach(conversation => {
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

  return filterConversationsByActiveRole(Array.from(merged.values())
    .filter(record => Number(record.participantAId) === getCurrentUserId(currentUser) || Number(record.participantBId) === getCurrentUserId(currentUser))
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)), currentUser, activeRole)
}

export function updateConversationLastMessage(conversationId, content, meta = {}) {
  const record = findConversationRecord(conversationId)
  if (!record) return
  const now = meta.createdAt || new Date().toISOString()
  const latestMessage = meta.latestMessage || {
    messageId: meta.messageId || `local-preview-${conversationId}-${Date.now()}`,
    conversationId,
    senderId: meta.senderId ?? record.latestMessageSenderId ?? null,
    messageType: meta.messageType || 'TEXT',
    content,
    createdAt: now
  }
  saveConversationRecord(record, {
    lastMessage: content,
    latestMessage,
    lastMessageObject: latestMessage,
    latestMessageSenderId: latestMessage.senderId,
    updatedAt: now
  })
}

export function buildConversationFallback(conversationId) {
  const isLocal = String(conversationId).startsWith('local-')
  const now = new Date().toISOString()
  return {
    cacheVersion: CONVERSATION_CACHE_VERSION,
    cachedAt: now,
    expiresAt: new Date(Date.now() + CONVERSATION_CACHE_TTL_MS).toISOString(),
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

export function hasMojibakeText(value) {
  const text = String(value || '')
  if (!text) return false
  return /[\uFFFD]/.test(text)
    || /(?:闯€|â|Ã|Â|¤|€¦|€\?|å|ç|æ)/.test(text)
}

export function sanitizeConversationDisplayText(value, fallback = 'Portra 用户') {
  const text = String(value || '').trim()
  if (!text || hasMojibakeText(text)) return fallback
  return text
}

function isLocalMojibakeConversation(record = {}) {
  const localOnly = record.isLocal || !record.backendConversationId
  if (!localOnly) return false
  return [
    record.scene,
    record.title,
    record.sourceTitle,
    record.lastMessage,
    record.counterpartyNickname,
    record.otherUserNickname
  ].some(hasMojibakeText)
}

function isFreshCacheRecord(record = {}, ttlMs = CONVERSATION_CACHE_TTL_MS) {
  const cachedAt = new Date(record.cachedAt || record.updatedAt || record.createdAt || 0).getTime()
  const expiresAt = new Date(record.expiresAt || 0).getTime()
  const now = Date.now()
  if (Number.isFinite(expiresAt) && expiresAt > 0) return expiresAt > now
  return Number.isFinite(cachedAt) && cachedAt > 0 && now - cachedAt <= ttlMs
}

function isValidCachedConversation(record = {}) {
  if (!record || record.cacheVersion !== CONVERSATION_CACHE_VERSION || !isFreshCacheRecord(record)) return false
  if (isLocalMojibakeConversation(record)) return false
  const conversationId = String(record.conversationId || '').trim()
  if (!conversationId || hasMojibakeText(conversationId)) return false
  const isLocal = Boolean(record.isLocal) || conversationId.startsWith('local-')
  const backendConversationId = Number(record.backendConversationId ?? conversationId)
  if (!isLocal && (!Number.isFinite(backendConversationId) || backendConversationId <= 0)) return false
  const participantAId = Number(record.participantAId)
  const participantBId = Number(record.participantBId)
  if (!Number.isFinite(participantAId) || participantAId <= 0) return false
  if (!Number.isFinite(participantBId) || participantBId <= 0) return false
  return ![
    record.scene,
    record.title,
    record.sourceTitle,
    record.lastMessage,
    record.counterpartyNickname,
    record.otherUserNickname
  ].some(hasMojibakeText)
}

export function getOppositeUserId(conversation, currentUserId) {
  if (!conversation) return null
  return Number(conversation.participantAId) === Number(currentUserId)
    ? conversation.participantBId
    : conversation.participantAId
}

export function getCounterpartyProfile(conversation, currentUser) {
  if (!conversation) return { userId: null, nickname: '用户', avatarData: '', initial: '用' }
  const oppositeId = Number(getOppositeUserId(conversation, getCurrentUserId(currentUser)))
  const isCustomer = Number(conversation.participantAId) === oppositeId
  const profiles = readJsonStorage(USER_PROFILE_STORAGE_KEY, {})
  const storedProfile = profiles[String(oppositeId)] || {}
  const demoProfile = Object.values(USERS).find(user => Number(user.userId) === oppositeId) || {}
  const nickname =
    conversation.counterpartyNickname ||
    conversation.otherUserNickname ||
    (isCustomer ? conversation.customerNickname : conversation.providerNickname) ||
    (isCustomer ? conversation.customerName : conversation.providerName) ||
    (isCustomer ? conversation.customerDisplayName : conversation.providerDisplayName) ||
    storedProfile.nickname ||
    storedProfile.displayName ||
    demoProfile.nickname ||
    demoProfile.displayName ||
    'Portra 用户'
  return {
    userId: oppositeId || null,
    nickname,
    avatarData: storedProfile.avatarData || demoProfile.avatarData || '',
    initial: String(nickname).slice(0, 1) || '对'
  }
}

export function getConversationPeer(conversation, currentUser) {
  return getCounterpartyProfile(conversation, currentUser)
}

function getLocalMessageStore() {
  const raw = readJsonStorage(LOCAL_MESSAGE_STORAGE_KEY, {})
  const conversations = raw?.cacheVersion === LOCAL_MESSAGE_CACHE_VERSION && raw?.conversations
    ? raw.conversations
    : raw
  const nextStore = {}
  Object.entries(conversations || {}).forEach(([conversationId, messages]) => {
    if (!String(conversationId).startsWith('local-')) return
    const validMessages = (Array.isArray(messages) ? messages : []).filter(message =>
      isValidLocalMessage(message, conversationId)
    )
    if (validMessages.length) nextStore[conversationId] = validMessages
  })
  if (JSON.stringify(conversations || {}) !== JSON.stringify(nextStore) || raw?.cacheVersion !== LOCAL_MESSAGE_CACHE_VERSION) {
    writeLocalMessageStore(nextStore)
  }
  return nextStore
}

function writeLocalMessageStore(conversations) {
  writeJsonStorage(LOCAL_MESSAGE_STORAGE_KEY, {
    cacheVersion: LOCAL_MESSAGE_CACHE_VERSION,
    cachedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + LOCAL_MESSAGE_CACHE_TTL_MS).toISOString(),
    conversations
  })
}

function isValidLocalMessage(message = {}, conversationId) {
  if (!message || String(message.conversationId) !== String(conversationId)) return false
  if (!String(message.messageId || '').trim()) return false
  if (!Number.isFinite(Number(message.senderId))) return false
  if (hasMojibakeText(message.content)) return false
  return isFreshCacheRecord(message, LOCAL_MESSAGE_CACHE_TTL_MS)
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
    cacheVersion: LOCAL_MESSAGE_CACHE_VERSION,
    cachedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + LOCAL_MESSAGE_CACHE_TTL_MS).toISOString(),
    createdAt: new Date().toISOString()
  }
  const nextMessages = [...(store[id] || []), nextMessage]
  store[id] = nextMessages
  writeLocalMessageStore(store)
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
  if (!conversation) return '沟通仍在加载。'
  if (conversation.isLocal) {
    return '这段沟通还没有进入正式成单流程，可以先继续沟通。'
  }
  if (conversation.sourceType === 'DEMAND_RESPONSE') {
    return '这次沟通来自客户发布的约拍需求，确认方案后可由摄影师发送报价。'
  }
  if (conversation.sourceType === 'SERVICE_PACKAGE') {
    return '这次沟通来自摄影服务橱窗，确认拍摄时间和内容后再进入报价。'
  }
  return '可以在这里继续沟通拍摄内容、时间和成片要求。'
}

export function getCounterpartyLabel(conversation, currentUser) {
  if (!conversation || !currentUser) return '对方'
  if (currentUser.role === 'PROVIDER') return '这位客户'
  if (currentUser.role === 'CUSTOMER') return '摄影师'
  return '对方'
}
