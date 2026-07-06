import { getCurrentUserId } from './workbenchState.js'

export function getLatestMessage(messages = []) {
  return [...(Array.isArray(messages) ? messages : [])]
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0] || null
}

export function createOptimisticMessage(conversation, currentUser, content, messageType, attachment = null) {
  const conversationId = conversation?.backendConversationId || conversation?.conversationId
  const tempId = `temp-${Date.now()}-${Math.round(Math.random() * 100000)}`
  const normalizedAttachment = attachment ? {
    file: attachment.file,
    fileName: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    kind: attachment.kind,
    localPreviewUrl: attachment.previewUrl
  } : null
  return {
    messageId: tempId,
    clientTempId: tempId,
    conversationId,
    senderId: getCurrentUserId(currentUser),
    messageType,
    content,
    fileId: null,
    fileName: normalizedAttachment?.fileName || null,
    mimeType: normalizedAttachment?.mimeType || null,
    size: normalizedAttachment?.size || null,
    fileType: normalizedAttachment?.kind || null,
    attachmentKind: normalizedAttachment?.kind || null,
    attachment: normalizedAttachment,
    createdAt: new Date().toISOString(),
    optimistic: true,
    deliveryStatus: 'sending'
  }
}

export function normalizeRemoteMessages(messages = []) {
  return (Array.isArray(messages) ? messages : []).filter(Boolean).map(normalizeRemoteMessage)
}

export function normalizeRemoteMessage(message) {
  if (!message) return message
  return {
    ...message,
    deliveryStatus: 'sent',
    optimistic: false,
    errorMessage: ''
  }
}

export function mergeConversationMessages(previous = [], incoming = []) {
  const next = [...(Array.isArray(previous) ? previous : [])]
  normalizeRemoteMessages(incoming).forEach(remoteMessage => {
    const remoteIndex = next.findIndex(item => isSamePersistedMessage(item, remoteMessage))
    if (remoteIndex >= 0) {
      next[remoteIndex] = mergeSentMessageWithLocalPreview(
        { ...next[remoteIndex], ...remoteMessage, deliveryStatus: 'sent', optimistic: false },
        next[remoteIndex]
      )
      return
    }
    const localIndex = next.findIndex(item => isMatchingTemporaryMessage(item, remoteMessage))
    if (localIndex >= 0) {
      next[localIndex] = mergeSentMessageWithLocalPreview(remoteMessage, next[localIndex])
      return
    }
    next.push(remoteMessage)
  })
  return sortMessages(next)
}

export function replaceTemporaryMessage(previous = [], tempId, sentMessage) {
  if (!sentMessage) return markTemporaryMessageFailed(previous, tempId)
  const normalized = normalizeRemoteMessage(sentMessage)
  return sortMessages(previous.map(message => {
    if (String(message.messageId) === String(tempId) || String(message.clientTempId) === String(tempId)) {
      return mergeSentMessageWithLocalPreview(normalized, message)
    }
    return message
  }))
}

export function mergeSentMessageWithLocalPreview(sentMessage, localMessage) {
  const normalized = normalizeRemoteMessage(sentMessage)
  const localPreviewUrl = localMessage?.attachment?.localPreviewUrl || ''
  if (!localPreviewUrl) return normalized
  return {
    ...normalized,
    fileName: normalized.fileName || localMessage.fileName || localMessage.attachment?.fileName || null,
    mimeType: normalized.mimeType || localMessage.mimeType || localMessage.attachment?.mimeType || null,
    size: normalized.size || localMessage.size || localMessage.attachment?.size || null,
    fileType: normalized.fileType || localMessage.fileType || localMessage.attachment?.kind || null,
    attachmentKind: normalized.attachmentKind || localMessage.attachmentKind || localMessage.attachment?.kind || null,
    attachment: {
      ...(localMessage.attachment || {}),
      file: null,
      fileId: normalized.fileId || localMessage.fileId || localMessage.attachment?.fileId || null,
      fileName: normalized.fileName || localMessage.fileName || localMessage.attachment?.fileName || '',
      mimeType: normalized.mimeType || localMessage.mimeType || localMessage.attachment?.mimeType || '',
      size: normalized.size || localMessage.size || localMessage.attachment?.size || 0,
      kind: normalized.attachmentKind || normalized.fileType || localMessage.attachment?.kind || localMessage.messageType,
      localPreviewUrl
    }
  }
}

export function markTemporaryMessageFailed(previous = [], tempId, error) {
  const message = getSendErrorMessage(error)
  return previous.map(item => {
    if (String(item.messageId) === String(tempId) || String(item.clientTempId) === String(tempId)) {
      return {
        ...item,
        deliveryStatus: 'failed',
        optimistic: true,
        errorMessage: message
      }
    }
    return item
  })
}

export function formatMessagePreviewText(message = {}) {
  const type = String(message.messageType || message.attachmentKind || '').toUpperCase()
  if (type === 'IMAGE') {
    const text = String(message.content || '').replace(/\s+/g, ' ').trim()
    return text ? `[图片] ${text}` : '[图片]'
  }
  if (type === 'FILE') return `[附件] ${message.fileName || message.attachment?.fileName || message.attachment?.name || ''}`.trim()
  return String(message.content || '').trim() || '还没有消息'
}

function isSamePersistedMessage(left, right) {
  if (!left?.messageId || !right?.messageId) return false
  if (isTemporaryMessageId(left.messageId) || isTemporaryMessageId(right.messageId)) return false
  return String(left.messageId) === String(right.messageId)
}

function isMatchingTemporaryMessage(localMessage, remoteMessage) {
  if (!localMessage || !remoteMessage || !isTemporaryMessageId(localMessage.messageId)) return false
  if (Number(localMessage.senderId) !== Number(remoteMessage.senderId)) return false
  if (String(localMessage.messageType || 'TEXT') !== String(remoteMessage.messageType || 'TEXT')) return false
  if (String(localMessage.content || '') !== String(remoteMessage.content || '')) return false
  if (localMessage.fileName && remoteMessage.fileName && String(localMessage.fileName) !== String(remoteMessage.fileName)) return false
  const localTime = new Date(localMessage.createdAt || 0).getTime()
  const remoteTime = new Date(remoteMessage.createdAt || 0).getTime()
  if (!Number.isFinite(localTime) || !Number.isFinite(remoteTime)) return true
  return Math.abs(remoteTime - localTime) < 2 * 60 * 1000
}

function isTemporaryMessageId(value) {
  return String(value || '').startsWith('temp-')
}

function sortMessages(messages = []) {
  return [...messages].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime()
    const rightTime = new Date(right?.createdAt || 0).getTime()
    return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0)
  })
}

function getSendErrorMessage(error) {
  if (error?.isNetworkError) return '网络连接异常，点击重试。'
  if (error?.status === 401 || error?.status === 403) return '登录状态或权限异常，请刷新后重试。'
  return error?.message || '发送失败，点击重试。'
}
