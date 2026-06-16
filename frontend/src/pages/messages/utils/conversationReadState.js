import { getConversationActivityTime } from './messagePreviewFormatter.js'
import { getCurrentUserId } from './workbenchState.js'

const READ_STATE_KEY = 'camera-p4-conversation-read-state'

export function markConversationRead(conversation, currentUser, readAt = null) {
  const userId = getCurrentUserId(currentUser)
  const conversationId = normalizeConversationId(conversation)
  if (!userId || !conversationId || typeof window === 'undefined') return
  const store = readReadState()
  store[readKey(userId, conversationId)] = readAt || getConversationActivityTime(conversation) || new Date().toISOString()
  writeReadState(store)
}

export function isConversationUnread(conversation, currentUser, options = {}) {
  const userId = getCurrentUserId(currentUser)
  const conversationId = normalizeConversationId(conversation)
  if (!userId || !conversationId) return false
  if (String(options.activeConversationId || '') === String(conversationId)) return false

  const latestSenderId = Number(conversation?.latestMessageSenderId ?? conversation?.lastMessageSenderId ?? options.latestSenderId)
  if (Number.isFinite(latestSenderId) && latestSenderId === Number(userId)) return false

  const activityTime = toTime(getConversationActivityTime(conversation))
  if (!activityTime) return false
  const readTime = toTime(readReadState()[readKey(userId, conversationId)])
  return activityTime > readTime
}

function normalizeConversationId(conversation) {
  const id = conversation?.backendConversationId || conversation?.conversationId || conversation
  return id === null || id === undefined ? '' : String(id)
}

function readKey(userId, conversationId) {
  return `${userId}:${conversationId}`
}

function readReadState() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(READ_STATE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeReadState(value) {
  try {
    window.localStorage.setItem(READ_STATE_KEY, JSON.stringify(value))
  } catch {
    // Read markers are presentation-only; failing to persist should not block chat.
  }
}

function toTime(value) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}
