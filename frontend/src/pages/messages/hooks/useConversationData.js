import { useEffect, useState } from 'react'
import { conversationApi, deliveryApi, orderApi, photoAuthorizationApi } from '../../../api.js'
import { getNextOrderWorkflowRefreshDelay } from '../../../utils/orderWorkflowModel.js'
import { buildWorkflowCacheKey, readWorkflowViewState, writeWorkflowViewState } from '../../../utils/workflowViewCache.js'
import { rememberLastConversation } from '../../../utils/conversationNavigation.js'
import { usePortraAsyncAction } from '../../../hooks/usePortraAsyncAction.js'
import {
  buildConversationFallback,
  findConversationRecord,
  getLocalMessages,
  saveConversationRecord
} from '../utils/conversationUtils.js'
import { markConversationRead } from '../utils/conversationReadState.js'
import { loadConversationPeerProfile, resolveConversationParticipants } from '../utils/participantResolver.js'
import { getCWorkbenchErrorText } from '../utils/quoteUtils.js'
import { getCurrentUserId, getUserRoleInConversation, selectConversationOrder } from '../utils/workbenchState.js'
import { getLatestMessage, mergeConversationMessages } from '../utils/conversationMessageState.js'

function isLocalConversationId(value) {
  return String(value || '').startsWith('local-')
}

function sameConversationId(conversation, conversationId) {
  return String(conversation?.conversationId || '') === String(conversationId || '')
}

function canUseConversationRecord(conversation, currentUser, conversationId) {
  if (!conversation || !sameConversationId(conversation, conversationId)) return false
  if (conversation.isLocal) return true
  return Boolean(getUserRoleInConversation(conversation, currentUser))
}

function findConversationById(conversations = [], conversationId) {
  return conversations.find(item => sameConversationId(item, conversationId)) || null
}

export function useConversationData({ conversationId, currentUser }) {
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [quotes, setQuotes] = useState([])
  const [currentOrder, setCurrentOrder] = useState(null)
  const [statusLogs, setStatusLogs] = useState([])
  const [deliveryRecords, setDeliveryRecords] = useState([])
  const [photoAuthorizations, setPhotoAuthorizations] = useState([])
  const [notice, setNotice] = useState(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [peerProfile, setPeerProfile] = useState(null)
  const { run: runWorkflowAction, loading: actionLoading } = usePortraAsyncAction({
    errorMessage: getCWorkbenchErrorText
  })
  const loading = pageLoading || actionLoading
  const viewCacheKey = buildWorkflowCacheKey('message-detail', conversationId, currentUser.role)
  const cachedViewState = readWorkflowViewState(viewCacheKey) || {}
  const participantModel = resolveConversationParticipants(conversation, currentUser, peerProfile)

  useEffect(() => {
    rememberLastConversation(conversationId, {
      orderId: currentOrder?.orderId,
      role: currentUser.role
    })
  }, [conversationId, currentOrder?.orderId, currentUser.role])

  useEffect(() => {
    let cancelled = false

    async function initializeConversation() {
      const stored = findConversationRecord(conversationId)
      const cached = readWorkflowViewState(viewCacheKey)
      const cachedConversation = canUseConversationRecord(cached?.conversation, currentUser, conversationId)
        ? cached.conversation
        : null
      const storedConversation = canUseConversationRecord(stored, currentUser, conversationId)
        ? stored
        : null
      const localFallback = !cachedConversation && !storedConversation && isLocalConversationId(conversationId)
        ? buildConversationFallback(conversationId)
        : null
      const initialConversation = cachedConversation || storedConversation || localFallback

      if (initialConversation) {
        if (cancelled) return
        setConversation(initialConversation)
        if (cachedConversation) {
          setMessages(Array.isArray(cached?.messages) ? cached.messages : [])
          setQuotes(Array.isArray(cached?.quotes) ? cached.quotes : [])
          if (cached?.currentOrder) {
            setCurrentOrder(cached.currentOrder)
            setStatusLogs(Array.isArray(cached?.statusLogs) ? cached.statusLogs : [])
            setDeliveryRecords(Array.isArray(cached?.deliveryRecords) ? cached.deliveryRecords : [])
            setPhotoAuthorizations(Array.isArray(cached?.photoAuthorizations) ? cached.photoAuthorizations : [])
          } else {
            clearOrderWorkbench()
          }
        } else {
          setMessages([])
          setQuotes([])
          clearOrderWorkbench()
        }
        if (initialConversation.isLocal) {
          loadConversationData(initialConversation)
          return
        }
      }

      setPageLoading(true)
      setNotice(null)
      setMessages([])
      setQuotes([])
      clearOrderWorkbench()
      try {
        const remoteConversations = await conversationApi.list(currentUser)
        const remoteConversation = findConversationById(remoteConversations || [], conversationId)
        if (!remoteConversation) {
          throw new Error('会话不存在或当前身份无权查看')
        }
        const hydratedConversation = saveConversationRecord(remoteConversation)
        if (cancelled) return
        setConversation(hydratedConversation)
        await loadConversationData(hydratedConversation)
      } catch (error) {
        if (cancelled) return
        setConversation(null)
        setNotice({
          type: 'error',
          text: getCWorkbenchErrorText(error, '会话不存在或当前身份无权查看')
        })
      } finally {
        if (!cancelled) setPageLoading(false)
      }
    }

    initializeConversation()
    return () => {
      cancelled = true
    }
  }, [conversationId, getCurrentUserId(currentUser), currentUser.role, currentUser.token])

  useEffect(() => {
    if (!conversation) return
    writeWorkflowViewState(viewCacheKey, {
      ...(readWorkflowViewState(viewCacheKey) || {}),
      conversation,
      messages,
      quotes,
      currentOrder,
      statusLogs,
      deliveryRecords,
      photoAuthorizations
    })
  }, [viewCacheKey, conversation, messages, quotes, currentOrder, statusLogs, deliveryRecords, photoAuthorizations])

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setPeerProfile(null)
    if (!participantModel.peerUserId) return undefined
    loadConversationPeerProfile(participantModel.peerUserId, participantModel.peerRole, currentUser)
      .then(profile => {
        if (cancelled || !profile) return
        objectUrl = profile.avatarObjectUrl || ''
        setPeerProfile(profile)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [participantModel.peerUserId, participantModel.peerRole, currentUser.token])

  useEffect(() => {
    if (!conversation) return
    const latestMessage = getLatestMessage(messages)
    markConversationRead({
      ...conversation,
      latestMessage,
      latestMessageSenderId: latestMessage?.senderId ?? conversation.latestMessageSenderId,
      updatedAt: latestMessage?.createdAt || conversation.updatedAt
    }, currentUser)
  }, [conversation?.conversationId, currentUser?.userId, currentUser?.id, messages.length])

  useEffect(() => {
    if (!conversation || conversation.isLocal || !currentOrder?.orderId) return undefined
    const refreshCurrentOrder = () => refreshConversationData(conversation, currentOrder.orderId)
    const intervalId = window.setInterval(refreshCurrentOrder, 30000)
    const refreshDelay = getNextOrderWorkflowRefreshDelay(currentOrder)
    const timeoutId = refreshDelay ? window.setTimeout(refreshCurrentOrder, refreshDelay) : null
    return () => {
      window.clearInterval(intervalId)
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [
    conversation?.conversationId,
    conversation?.isLocal,
    currentOrder?.orderId,
    currentOrder?.status,
    currentOrder?.shootStartTime,
    currentOrder?.shootEndTime,
    currentOrder?.startTime,
    currentOrder?.endTime
  ])

  async function run(action, successText) {
    setNotice(null)
    return runWorkflowAction(action, {
      successMessage: successText
    })
  }

  async function loadConversationData(record = conversation) {
    if (!record) return
    if (record.isLocal) {
      setMessages(getLocalMessages(record.conversationId))
      setQuotes([])
      clearOrderWorkbench()
      return
    }
    await run(async () => {
      await refreshConversationData(record)
    })
  }

  async function refreshConversationData(record = conversation, preferredOrderId = null) {
    if (!record || record.isLocal) return
    const [nextMessages, nextQuotes, nextOrders] = await Promise.all([
      conversationApi.messages(record.backendConversationId || record.conversationId, currentUser),
      conversationApi.quotes(record.backendConversationId || record.conversationId, currentUser),
      orderApi.list({}, currentUser)
    ])
    setMessages(previous => mergeConversationMessages(previous, nextMessages))
    setQuotes(nextQuotes)
    const latestMessage = getLatestMessage(nextMessages)
    saveConversationRecord(record, {
      latestMessage,
      lastMessageObject: latestMessage,
      latestMessageSenderId: latestMessage?.senderId ?? null,
      latestQuotes: nextQuotes || [],
      updatedAt: latestMessage?.createdAt || record.updatedAt
    })
    const selectedOrder = preferredOrderId
      ? { orderId: preferredOrderId }
      : selectConversationOrder(nextOrders || [], record, nextQuotes || [])
    if (selectedOrder?.orderId) {
      await loadOrderWorkbench(selectedOrder.orderId)
    } else {
      clearOrderWorkbench()
    }
  }

  async function refreshConversationMessages(record = conversation) {
    if (!record || record.isLocal) return
    const nextMessages = await conversationApi.messages(record.backendConversationId || record.conversationId, currentUser)
    setMessages(previous => mergeConversationMessages(previous, nextMessages))
    const latestMessage = getLatestMessage(nextMessages)
    if (latestMessage) {
      saveConversationRecord(record, {
        latestMessage,
        lastMessageObject: latestMessage,
        latestMessageSenderId: latestMessage.senderId ?? null,
        updatedAt: latestMessage.createdAt || record.updatedAt
      })
    }
  }

  function clearOrderWorkbench() {
    setCurrentOrder(null)
    setStatusLogs([])
    setDeliveryRecords([])
    setPhotoAuthorizations([])
  }

  async function loadOrderWorkbench(orderId) {
    const [detail, logs, deliveries, authorizations] = await Promise.all([
      orderApi.detail(orderId, currentUser),
      orderApi.statusLogs(orderId, currentUser),
      deliveryApi.listByOrder(orderId, currentUser),
      photoAuthorizationApi.listByOrder(orderId, currentUser)
    ])
    setCurrentOrder(detail)
    setStatusLogs(logs || [])
    setDeliveryRecords(deliveries || [])
    setPhotoAuthorizations(authorizations || [])
  }

  return {
    conversation,
    setConversation,
    messages,
    setMessages,
    quotes,
    setQuotes,
    currentOrder,
    setCurrentOrder,
    statusLogs,
    setStatusLogs,
    deliveryRecords,
    setDeliveryRecords,
    photoAuthorizations,
    setPhotoAuthorizations,
    notice,
    setNotice,
    pageLoading,
    setPageLoading,
    actionLoading,
    loading,
    viewCacheKey,
    cachedViewState,
    participantModel,
    run,
    loadConversationData,
    refreshConversationData,
    refreshConversationMessages,
    loadOrderWorkbench
  }
}
