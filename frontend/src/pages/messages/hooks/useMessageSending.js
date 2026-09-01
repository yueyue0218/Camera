import { useEffect, useRef, useState } from 'react'
import { conversationApi, fileApi } from '../../../api.js'
import { addLocalMessage, updateConversationLastMessage } from '../utils/conversationUtils.js'
import { getCurrentUserId } from '../utils/workbenchState.js'
import {
  createOptimisticMessage,
  formatMessagePreviewText,
  markTemporaryMessageFailed,
  normalizeRemoteMessage,
  replaceTemporaryMessage
} from '../utils/conversationMessageState.js'

export function useMessageSending({
  conversation,
  currentUser,
  messages,
  setMessages,
  feedback
}) {
  const [content, setContent] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState(null)
  const [messageSending, setMessageSending] = useState(false)
  const pendingAttachmentRef = useRef(null)
  const messagesRef = useRef([])

  useEffect(() => {
    pendingAttachmentRef.current = pendingAttachment
  }, [pendingAttachment])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => () => {
    const previewUrls = new Set([
      pendingAttachmentRef.current?.previewUrl,
      ...messagesRef.current.map(message => message?.attachment?.localPreviewUrl)
    ].filter(Boolean))
    previewUrls.forEach(url => URL.revokeObjectURL(url))
  }, [])

  function chooseMessageAttachment(file, requestedKind) {
    if (!file) return
    const image = String(file.type || '').toLowerCase().startsWith('image/')
    if (requestedKind === 'IMAGE' && !image) {
      feedback.warning('请选择图片文件')
      return
    }
    setPendingAttachment(previous => {
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl)
      return {
        file,
        name: file.name || '附件',
        size: file.size || 0,
        mimeType: file.type || 'application/octet-stream',
        kind: image ? 'IMAGE' : 'FILE',
        previewUrl: image ? URL.createObjectURL(file) : ''
      }
    })
  }

  function clearPendingAttachment({ revokePreview = true } = {}) {
    setPendingAttachment(previous => {
      if (revokePreview && previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl)
      return null
    })
  }

  function removePendingAttachment() {
    clearPendingAttachment()
  }

  async function sendMessage() {
    if (!conversation || messageSending) return
    const text = content.trim()
    const attachment = pendingAttachment
    if (!text && !attachment) return
    if (conversation.isLocal && attachment) {
      feedback.warning('本地临时会话暂不支持附件，请进入正式会话后发送。')
      return
    }
    if (conversation.isLocal) {
      const nextMessages = addLocalMessage(conversation.conversationId, {
        senderId: getCurrentUserId(currentUser),
        messageType: 'TEXT',
        content: text
      })
      updateConversationLastMessage(conversation.conversationId, text, {
        senderId: getCurrentUserId(currentUser),
        messageType: 'TEXT'
      })
      setMessages(nextMessages)
      setContent('')
      return
    }
    const optimisticMessage = createOptimisticMessage(conversation, currentUser, text, attachment ? attachment.kind : 'TEXT', attachment)
    setMessages(previous => [...previous, optimisticMessage])
    setMessageSending(true)
    updateConversationLastMessage(conversation.conversationId, formatMessagePreviewText(optimisticMessage), {
      senderId: getCurrentUserId(currentUser),
      messageType: optimisticMessage.messageType,
      latestMessage: optimisticMessage,
      createdAt: optimisticMessage.createdAt
    })
    try {
      const uploaded = attachment
        ? await fileApi.upload(attachment.file, { bizType: 'MESSAGE_ATTACHMENT', visibility: 'PRIVATE' }, currentUser)
        : null
      const sent = await conversationApi.sendMessage(conversation.backendConversationId || conversation.conversationId, {
        content: text,
        fileId: uploaded?.fileId || null,
        messageType: attachment ? attachment.kind : 'TEXT'
      }, currentUser)
      setMessages(previous => replaceTemporaryMessage(previous, optimisticMessage.messageId, sent))
      if (sent) {
        const normalizedSent = normalizeRemoteMessage(sent)
        updateConversationLastMessage(conversation.conversationId, formatMessagePreviewText(normalizedSent), {
          senderId: sent.senderId ?? optimisticMessage.senderId,
          messageType: sent.messageType || 'TEXT',
          latestMessage: normalizedSent,
          createdAt: sent.createdAt || optimisticMessage.createdAt
        })
      }
      setContent('')
      clearPendingAttachment({ revokePreview: false })
    } catch (error) {
      setMessages(previous => markTemporaryMessageFailed(previous, optimisticMessage.messageId, error))
    } finally {
      setMessageSending(false)
    }
  }

  async function retryMessage(message) {
    if (!conversation || conversation.isLocal || messageSending) return
    if (!message?.content && !message?.attachment && !message?.fileId) return
    const tempId = message.clientTempId || message.messageId
    setMessages(previous => previous.map(item => String(item.messageId) === String(tempId)
      ? { ...item, deliveryStatus: 'sending', errorMessage: '' }
      : item))
    setMessageSending(true)
    try {
      const attachment = message.attachment || null
      const uploaded = attachment?.file
        ? await fileApi.upload(attachment.file, { bizType: 'MESSAGE_ATTACHMENT', visibility: 'PRIVATE' }, currentUser)
        : null
      const sent = await conversationApi.sendMessage(conversation.backendConversationId || conversation.conversationId, {
        content: message.content || '',
        fileId: uploaded?.fileId || message.fileId || attachment?.fileId || null,
        messageType: message.messageType || attachment?.kind || 'TEXT'
      }, currentUser)
      setMessages(previous => replaceTemporaryMessage(previous, tempId, sent))
      if (sent) {
        const normalizedSent = normalizeRemoteMessage(sent)
        updateConversationLastMessage(conversation.conversationId, formatMessagePreviewText(normalizedSent), {
          senderId: sent.senderId ?? message.senderId,
          messageType: sent.messageType || 'TEXT',
          latestMessage: normalizedSent,
          createdAt: sent.createdAt || message.createdAt
        })
      }
    } catch (error) {
      setMessages(previous => markTemporaryMessageFailed(previous, tempId, error))
    } finally {
      setMessageSending(false)
    }
  }

  async function downloadMessageAttachment(message) {
    const fileId = message?.fileId || message?.attachment?.fileId
    if (!fileId) return
    try {
      const url = await fileApi.downloadObjectUrl(fileId, currentUser)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = message.fileName || message.attachment?.fileName || message.attachment?.name || `附件-${fileId}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } catch (error) {
      feedback.error(error?.message || '附件下载失败，请稍后重试。')
    }
  }

  function releaseMessageLocalPreview(message, localPreviewUrl) {
    if (!message?.messageId || !localPreviewUrl) return
    setMessages(previous => previous.map(item => {
      if (String(item.messageId) !== String(message.messageId)) return item
      if (item.attachment?.localPreviewUrl !== localPreviewUrl) return item
      return {
        ...item,
        attachment: {
          ...item.attachment,
          localPreviewUrl: ''
        }
      }
    }))
    URL.revokeObjectURL(localPreviewUrl)
  }

  return {
    content,
    setContent,
    pendingAttachment,
    messageSending,
    chooseMessageAttachment,
    removePendingAttachment,
    sendMessage,
    retryMessage,
    downloadMessageAttachment,
    releaseMessageLocalPreview
  }
}
