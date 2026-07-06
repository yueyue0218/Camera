import { useEffect, useRef, useState } from 'react'
import { Alert, Avatar, Box, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi, deliveryApi, fileApi, orderApi, photoAuthorizationApi, quoteApi } from '../../api.js'
import { goToUserProfile } from '../../utils/orderNavigation.js'
import { getNextOrderWorkflowRefreshDelay } from '../../utils/orderWorkflowModel.js'
import { useWorkflowNavigate } from '../../hooks/useWorkflowNavigate.js'
import { useWorkflowDraft } from '../../hooks/useWorkflowDraft.js'
import { buildWorkflowCacheKey, mergeWorkflowViewState, readWorkflowViewState, writeWorkflowViewState } from '../../utils/workflowViewCache.js'
import { REWORK_REQUIREMENT_MAX_LENGTH } from '../../utils/workflowLimits.js'
import {
  navigateToDeliveryFromConversation,
  navigateToOrderFromConversation,
  rememberLastConversation
} from '../../utils/conversationNavigation.js'
import { ConversationThread } from './components/ConversationThread.jsx'
import { ConversationWorkbenchPanel } from './components/ConversationWorkbenchPanel.jsx'
import { ConversationActionDialogs } from './components/ConversationActionDialogs.jsx'
import { QuoteDraftDialog } from './components/QuoteDraftDialog.jsx'
import { MessageWorkbenchErrorBoundary } from './components/MessageWorkbenchErrorBoundary.jsx'
import { useConversationRealtime } from './hooks/useConversationRealtime.js'
import { OrderCompletionDialog, PortraActionLink, PortraStatusPill, PortraWorkbenchFrame, PortraWorkflowFrame, usePortraFeedback } from '../../components/portra/index.js'
import { usePortraAsyncAction } from '../../hooks/usePortraAsyncAction.js'
import { PORTRA_LAYOUT } from '../../theme/portraSurfaceTokens.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from './MessageVisualTokens.js'
import {
  addLocalMessage,
  buildConversationFallback,
  findConversationRecord,
  getLocalMessages,
  getOppositeUserId,
  saveConversationRecord,
  updateConversationLastMessage
} from './utils/conversationUtils.js'
import { markConversationRead } from './utils/conversationReadState.js'
import {
  loadConversationPeerProfile,
  resolveConversationParticipants
} from './utils/participantResolver.js'
import {
  buildConversationWorkbenchViewModel,
  getCurrentUserId,
  getUserRoleInConversation,
  selectConversationOrder
} from './utils/workbenchState.js'
import {
  buildQuotePayload,
  canEditQuote,
  createDefaultQuoteForm,
  createQuoteFormFromQuote,
  getCWorkbenchErrorText,
  getQuoteConfirmationErrorText,
  getQuoteEntryHint,
} from './utils/quoteUtils.js'
import { validateQuoteFormModel } from './utils/quoteFormModel.js'

const DETAIL_SHELL_HEIGHT = {
  xs: 'calc(100dvh - 212px)',
  md: 'calc(100dvh - 154px)'
}

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

function createDeliveryDraft() {
  return { files: [], remark: '' }
}

function createPhotoAuthorizationDraft() {
  return { fileIds: [], remark: '' }
}

function isDeliveryDraftDirty(value) {
  return Boolean((Array.isArray(value?.files) && value.files.length) || String(value?.remark || '').trim())
}

function isPhotoAuthorizationDraftDirty(value) {
  return Boolean((Array.isArray(value?.fileIds) && value.fileIds.length) || String(value?.remark || '').trim())
}

function hasAuthorizationRemarkDraft(value) {
  return Object.values(value || {}).some(remark => String(remark || '').trim())
}

function findConversationById(conversations = [], conversationId) {
  return conversations.find(item => sameConversationId(item, conversationId)) || null
}

export function ConversationDetailPage() {
  const { conversationId } = useParams()
  const navigate = useWorkflowNavigate()
  const rawNavigate = useNavigate()
  const { currentUser, switchRole } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [quotes, setQuotes] = useState([])
  const [currentOrder, setCurrentOrder] = useState(null)
  const [statusLogs, setStatusLogs] = useState([])
  const [deliveryRecords, setDeliveryRecords] = useState([])
  const [photoAuthorizations, setPhotoAuthorizations] = useState([])
  const [content, setContent] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState(null)
  const pendingAttachmentRef = useRef(null)
  const messagesRef = useRef([])
  const [messageSending, setMessageSending] = useState(false)
  const [quoteForm, setQuoteForm] = useState(() => createDefaultQuoteForm())
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [editingQuotationId, setEditingQuotationId] = useState(null)
  const [quoteValidationErrors, setQuoteValidationErrors] = useState([])
  const [quoteFieldErrors, setQuoteFieldErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [activeAction, setActiveAction] = useState(null)
  const [activeQuote, setActiveQuote] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('WECHAT')
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [peerProfile, setPeerProfile] = useState(null)
  const feedback = usePortraFeedback()
  const orderDraftScope = `conversation:${conversationId}:order:${currentOrder?.orderId || 'none'}`
  const deliveryDraft = useWorkflowDraft(`${orderDraftScope}:delivery`, createDeliveryDraft, isDeliveryDraftDirty)
  const reworkDraft = useWorkflowDraft(`${orderDraftScope}:rework`, () => '', value => String(value || '').trim().length > 0)
  const photoAuthorizationDraft = useWorkflowDraft(`${orderDraftScope}:photo-authorization`, createPhotoAuthorizationDraft, isPhotoAuthorizationDraftDirty)
  const authorizationRemarkDraft = useWorkflowDraft(`${orderDraftScope}:authorization-remarks`, () => ({}), hasAuthorizationRemarkDraft)
  const deliveryForm = deliveryDraft.value || createDeliveryDraft()
  const setDeliveryForm = deliveryDraft.setValue
  const reworkRequirement = reworkDraft.value || ''
  const setReworkRequirement = reworkDraft.setValue
  const photoAuthorizationForm = photoAuthorizationDraft.value || createPhotoAuthorizationDraft()
  const setPhotoAuthorizationForm = photoAuthorizationDraft.setValue

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
  const authorizationRemarks = authorizationRemarkDraft.value || {}
  const setAuthorizationRemarks = authorizationRemarkDraft.setValue
  const { run: runWorkflowAction, loading: actionLoading } = usePortraAsyncAction({
    errorMessage: getCWorkbenchErrorText
  })
  const loading = pageLoading || actionLoading
  const viewCacheKey = buildWorkflowCacheKey('message-detail', conversationId, currentUser.role)
  const cachedViewState = readWorkflowViewState(viewCacheKey) || {}

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

  const participantModel = resolveConversationParticipants(conversation, currentUser, peerProfile)

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

  async function createQuote(event) {
    event.preventDefault()
    const validation = validateQuoteFormModel(quoteForm, {
      conversation,
      currentUser,
      quotes,
      editingQuotationId
    })
    setQuoteValidationErrors(validation.errors)
    setQuoteFieldErrors(validation.fieldErrors)
    if (validation.errors.length) {
      feedback.warning(validation.errors[0])
      return
    }
    const quotePayload = buildQuotePayload(quoteForm, conversation)
    const quote = await run(async () => editingQuotationId
      ? quoteApi.update(editingQuotationId, quotePayload, currentUser)
      : quoteApi.create(quotePayload, currentUser), editingQuotationId ? '报价已更新' : '报价已发送')
    if (quote) {
      setShowQuoteForm(false)
      setEditingQuotationId(null)
      setQuoteValidationErrors([])
      setQuoteFieldErrors({})
      setQuoteForm(createDefaultQuoteForm())
      await loadConversationData()
    }
  }

  function startQuoteEditing(quote) {
    if (!quote) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return
    }
    setEditingQuotationId(quote.quotationId)
    setQuoteForm(createQuoteFormFromQuote(quote))
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setShowQuoteForm(true)
    feedback.info('正在编辑待确认报价，保存前客户仍看到原报价。')
  }

  function closeQuoteForm() {
    setShowQuoteForm(false)
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setQuoteForm(createDefaultQuoteForm())
  }

  function updateQuoteForm(nextForm) {
    setQuoteForm(nextForm)
    if (Object.keys(quoteFieldErrors).length) setQuoteFieldErrors({})
  }

  function openQuoteForm() {
    if (showQuoteForm && !editingQuotationId) {
      closeQuoteForm()
      return
    }
    setQuoteForm(createDefaultQuoteForm())
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setShowQuoteForm(true)
  }

  function resendQuote(quote) {
    if (!quote) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return
    }
    setQuoteForm(createQuoteFormFromQuote(quote))
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setShowQuoteForm(true)
    setActiveAction(null)
    setActiveQuote(null)
    feedback.info('已带入上次报价内容，请确认后重新发送给客户。')
  }

  async function confirmQuote(quote) {
    if (!quote?.quotationId) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return false
    }
    setPageLoading(true)
    setNotice(null)
    try {
      const result = await quoteApi.confirm(quote.quotationId, '客户已确认本次报价', currentUser)
      feedback.success('报价已确认，订单已生成')
      if (result?.orderId) {
        await refreshConversationData(conversation, result.orderId)
      } else {
        await refreshConversationData()
        feedback.error('报价已确认，但暂时没有拿到订单信息，请刷新后再查看。')
      }
      return true
    } catch (error) {
      try {
        await refreshConversationData()
      } catch {
        // Keep the original quote confirmation error visible.
      }
      const message = getQuoteConfirmationErrorText(error)
      feedback.error(message)
      return false
    } finally {
      setPageLoading(false)
    }
  }

  async function rejectQuote(quote) {
    if (!quote?.quotationId) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return false
    }
    const result = await run(async () => quoteApi.reject(quote.quotationId, '本次暂不采用该报价', currentUser), '报价已拒绝')
    if (result) {
      await loadConversationData()
      return true
    }
    return false
  }

  async function confirmQuoteFromDialog(quote) {
    const succeeded = await confirmQuote(quote)
    if (succeeded) {
      setActiveAction(null)
      setActiveQuote(null)
    }
  }

  async function rejectQuoteFromDialog(quote) {
    const succeeded = await rejectQuote(quote)
    if (succeeded) {
      setActiveAction(null)
      setActiveQuote(null)
    }
  }

  async function payCurrentOrder() {
    if (!currentOrder) return false
    const result = await run(async () => orderApi.mockPay(currentOrder.orderId, currentOrder.amountCent, currentUser), '支付成功，资金已进入平台担保')
    if (result) {
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function cancelCurrentOrder(cancelAction) {
    if (!currentOrder || !cancelAction) return
    const confirmed = await feedback.confirm({
      title: cancelAction.title || '确认取消订单',
      message: cancelAction.confirmText,
      confirmText: cancelAction.label || '确认取消',
      tone: 'danger'
    })
    if (!confirmed) return
    const result = await run(async () => orderApi.cancel(currentOrder.orderId, { reason: cancelAction.reason }, currentUser), '订单状态已更新')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function confirmCurrentOrder() {
    if (!currentOrder) return
    const confirmed = await feedback.confirm({
      title: '确认接收作品',
      message: '确认接收后，订单将完成，平台担保资金会结算给摄影师。是否确认？',
      confirmText: '确认接收'
    })
    if (!confirmed) return
    const result = await run(async () => orderApi.transition(currentOrder.orderId, 'COMPLETED', '客户确认接收作品', currentUser), '订单已完成')
    if (result) {
      await refreshConversationData(conversation, currentOrder.orderId)
      setCompletionDialogOpen(true)
    }
  }

  async function submitDelivery(event) {
    event?.preventDefault?.()
    const files = Array.isArray(deliveryForm.files) ? deliveryForm.files : deliveryForm.file ? [deliveryForm.file] : []
    if (!currentOrder || !files.length) return false
    const result = await run(async () => deliveryApi.upload(currentOrder.orderId, files, deliveryForm.remark.trim(), currentUser),
      currentOrder.status === 'REWORK_REQUIRED' ? '返修作品已发送给客户验收' : '交付作品已发送给客户验收')
    if (result) {
      deliveryDraft.clearDraft()
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function submitRework(event) {
    event.preventDefault()
    if (!currentOrder) return false
    const reason = reworkRequirement.trim()
    if (!reason) {
      feedback.warning('请填写返修要求')
      return false
    }
    if (reason.length > REWORK_REQUIREMENT_MAX_LENGTH) {
      feedback.warning(`返修要求不能超过 ${REWORK_REQUIREMENT_MAX_LENGTH} 字`)
      return false
    }
    const result = await run(async () => orderApi.requestRework(currentOrder.orderId, reason, currentUser), '返修请求已提交')
    if (result) {
      reworkDraft.clearDraft()
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function submitPhotoAuthorizationRequest(event) {
    event.preventDefault()
    if (!currentOrder || !photoAuthorizationForm.fileIds.length) return false
    const result = await run(async () => photoAuthorizationApi.request(currentOrder.orderId, {
      fileIds: photoAuthorizationForm.fileIds,
      remark: photoAuthorizationForm.remark.trim()
    }, currentUser), '展示授权申请已发送')
    if (result) {
      photoAuthorizationDraft.clearDraft()
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function handlePhotoAuthorizationDecision(authorization, decision, decisionRemark = '') {
    if (!currentOrder) return
    const remark = (decisionRemark || authorizationRemarks[authorization.id] || '').trim()
    if (decision === 'reject' && !remark) {
      feedback.warning('请填写拒绝原因')
      return false
    }
    const action = decision === 'approve' ? photoAuthorizationApi.approve : photoAuthorizationApi.reject
    const successText = decision === 'approve' ? '已同意展示授权' : '已拒绝展示授权'
    const result = await run(async () => action(authorization.id, { remark }, currentUser), successText)
    if (result) {
      authorizationRemarkDraft.setValue(previous => ({ ...previous, [authorization.id]: '' }))
      await refreshConversationData(conversation, currentOrder.orderId)
    }
    return Boolean(result)
  }

  function openPaymentDialog() {
    if (!currentOrder) return
    setPaymentMethod('WECHAT')
    setActiveAction('PAYMENT')
  }

  async function confirmPaymentFromDialog() {
    const succeeded = await payCurrentOrder()
    if (succeeded) setActiveAction(null)
  }

  function showUnavailableTool(name) {
    const messages = {
      图片: '图片发送正在完善中，暂未开放；交付作品请通过订单上传。',
      附件: '附件发送正在完善中，暂未开放。',
      表情: '表情功能正在完善中，暂未开放。',
      补款: '补款属于订单交易能力，后续会以追加费用流程开放。',
      平台协助: '平台协助正在完善中，暂未开放。'
    }
    feedback.info(messages[name] || '该功能正在完善中，暂未开放。')
  }

  function openQuoteDetail(quote) {
    if (!quote) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return
    }
    setActiveQuote(quote)
    setActiveAction('QUOTE_DETAIL')
  }

  function openUserProfile(userId, event) {
    event?.stopPropagation()
    goToUserProfile(rawNavigate, userId, currentUser)
  }

  function openOrderArchive(orderId = currentOrder?.orderId, options = {}) {
    const succeeded = navigateToOrderFromConversation(navigate, {
      orderId: orderId || currentOrder?.orderId,
      conversationId
    }, options)
    if (!succeeded) {
      feedback.warning('订单信息暂时不可用，请稍后刷新后再查看。')
      return false
    }
    return true
  }

  function openDeliveryGallery(delivery) {
    const succeeded = navigateToDeliveryFromConversation(navigate, {
      orderId: currentOrder?.orderId || delivery?.orderId,
      deliveryId: delivery?.deliveryId || delivery?.fileId,
      conversationId
    })
    if (!succeeded) {
      feedback.warning('作品记录暂不可查看，请刷新后重试。')
    }
    return succeeded
  }

  async function closeActionDialogs() {
    if (loading) {
      feedback.warning('操作正在提交，请稍候。')
      return
    }
    const shouldClose = await confirmActiveActionDiscard()
    if (!shouldClose) return
    setActiveAction(null)
    setActiveQuote(null)
  }

  async function confirmActiveActionDiscard() {
    if (activeAction === 'UPLOAD_DELIVERY' || activeAction === 'REUPLOAD_DELIVERY') {
      return deliveryDraft.confirmDiscard(feedback)
    }
    if (activeAction === 'REQUEST_REWORK') {
      return reworkDraft.confirmDiscard(feedback, {
        message: '当前返修要求尚未提交，关闭后将丢弃已填写内容。确定关闭吗？'
      })
    }
    if (activeAction === 'REQUEST_AUTHORIZATION') {
      return photoAuthorizationDraft.confirmDiscard(feedback, {
        message: '当前授权申请尚未提交，关闭后将丢弃已选择的作品和填写内容。确定关闭吗？'
      })
    }
    return true
  }

  const currentUserId = getCurrentUserId(currentUser)
  const counterparty = participantModel
  const viewModel = buildConversationWorkbenchViewModel({
    conversation,
    currentUser,
    activeRole: currentUser.role,
    messages,
    quotes,
    order: currentOrder,
    statusLogs,
    deliveries: deliveryRecords,
    authorizations: photoAuthorizations,
  })
  const actions = viewModel.actions
  useConversationRealtime({
    enabled: Boolean(conversation && !conversation.isLocal && !actions.roleMismatch),
    conversationId: conversation?.backendConversationId || conversation?.conversationId,
    intervalMs: 4000,
    onRefresh: () => refreshConversationMessages(conversation)
  })
  useEffect(() => {
    if (!currentUser?.token || !currentUserId) return undefined

    const backendConversationId = !isLocalConversationId(conversationId)
      ? Number(conversation?.backendConversationId || conversation?.conversationId || conversationId)
      : null
    const normalizedConversationId = Number.isFinite(backendConversationId) && backendConversationId > 0
      ? backendConversationId
      : null
    const reportPresence = active => {
      conversationApi.reportPresence(normalizedConversationId, active, currentUser, active ? {} : { keepalive: true }).catch(() => {})
    }

    reportPresence(true)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') reportPresence(true)
    }, 8000)
    const handleVisibilityChange = () => {
      reportPresence(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      reportPresence(false)
    }
  }, [conversation?.backendConversationId, conversation?.conversationId, conversationId, currentUser, currentUserId])
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
  useEffect(() => {
    if (conversation && actions.roleMismatch) {
      const correctRole = getUserRoleInConversation(conversation, currentUser)
      if (correctRole) {
        switchRole(correctRole)
      } else {
        navigate('/messages', { replace: true, state: { roleMismatch: true } })
      }
    }
  }, [actions.roleMismatch, conversation, currentUser, navigate, switchRole])
  const editingQuote = editingQuotationId
    ? quotes.find(quote => String(quote.quotationId) === String(editingQuotationId))
    : null
  const canCreateQuote = actions.canSendQuote
  const canEditSelectedQuote = editingQuote
    && canEditQuote(editingQuote, conversation, currentUser)
  const canSubmitQuoteForm = editingQuotationId ? canEditSelectedQuote : canCreateQuote
  const canSeeQuoteEntry = !currentOrder && (actions.canSendQuote || actions.canEditQuote || showQuoteForm)
  const quoteEntryHint = currentOrder ? '' : getQuoteEntryHint(conversation, currentUser, quotes)
  const activeQuoteIsPending = activeQuote?.status === 'PENDING_CONFIRM' && String(activeQuote.quotationId) === String(actions.pendingQuote?.quotationId)
  const activeQuoteCanConfirm = activeQuoteIsPending && actions.canConfirmQuote
  const activeQuoteCanReject = activeQuoteIsPending && actions.canRejectQuote
  const activeQuoteCanResend = activeQuote?.status === 'REJECTED' && actions.canSendQuote

  return (
    <MessageWorkbenchErrorBoundary resetKey={`${conversationId}-${currentUser.role}`}>
    <PortraWorkflowFrame
      data-message-detail-shell="true"
      spacing={1.2}
      maxWidth="workflow"
      height={DETAIL_SHELL_HEIGHT}
      sx={{
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          flexShrink: 0,
          px: { xs: 1.35, md: 1.8 },
          py: 1.15,
          bgcolor: PORTRA_COLORS.paper,
          borderColor: PORTRA_COLORS.borderMuted,
          borderRadius: PORTRA_RADII.panel,
          boxShadow: PORTRA_SHADOWS.subtle,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 18,
            top: 0,
            width: 54,
            height: 3,
            borderRadius: 999,
            bgcolor: PORTRA_COLORS.blue
          }
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.15} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}>
          <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: 'center' }}>
            <Tooltip title="全部沟通">
              <IconButton onClick={() => navigate('/messages')} sx={{ border: `1px solid ${PORTRA_COLORS.border}`, borderRadius: PORTRA_RADII.control, bgcolor: PORTRA_COLORS.paperSoft }}>
                <ArrowBackRoundedIcon />
              </IconButton>
            </Tooltip>
            <Avatar
              src={counterparty.peerAvatarUrl || undefined}
              onClick={event => conversation && openUserProfile(getOppositeUserId(conversation, currentUserId), event)}
              sx={{ width: 44, height: 44, bgcolor: PORTRA_COLORS.blue, color: PORTRA_COLORS.paper, cursor: counterparty.peerProfilePath ? 'pointer' : 'default', fontWeight: 900, boxShadow: `0 0 0 3px ${PORTRA_COLORS.paperSoft}, 0 0 0 4px ${PORTRA_COLORS.border}` }}
            >
              {getSafeDisplayText(counterparty.peerAvatarText, '对').slice(0, 1)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ color: PORTRA_COLORS.ink, fontSize: 17, fontWeight: 950 }} noWrap>
                {getSafeDisplayText(counterparty.peerDisplayName, 'Portra 用户')}
              </Typography>
              <Typography variant="caption" sx={{ color: PORTRA_COLORS.mutedInk, fontWeight: 850 }}>
                {counterparty.peerRoleLabel}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <PortraStatusPill label={actions.stage.title} />
            <PortraActionLink
              startIcon={<ReceiptLongRoundedIcon />}
              onClick={() => openOrderArchive(currentOrder?.orderId)}
              disabled={!currentOrder?.orderId}
            >
              查看订单
            </PortraActionLink>
          </Stack>
        </Stack>
      </Paper>

      {notice && <Alert severity={notice.type} sx={noticeSx}>{notice.text}</Alert>}

      <PortraWorkbenchFrame
        data-message-workbench-grid="true"
        rightPanelWidth={PORTRA_LAYOUT.rightPanelWidth}
        gap={{ xs: 1.25, lg: 2.5, xl: 2.5 }}
      >
        <Box sx={{ minHeight: 0, minWidth: 0, height: '100%', display: 'flex', overflow: 'hidden' }}>
          <ConversationThread
            messages={messages}
            conversation={conversation}
            currentUser={currentUser}
            participants={participantModel}
            quotes={quotes}
            order={currentOrder}
            actions={actions}
            statusLogs={statusLogs}
            deliveryRecords={deliveryRecords}
            photoAuthorizations={photoAuthorizations}
            timeline={viewModel.timeline}
            content={content}
            loading={loading || messageSending}
            imageSending={messageSending}
            canSeeQuoteEntry={canSeeQuoteEntry}
            canCreateQuote={canCreateQuote}
            showQuoteForm={showQuoteForm}
            editingQuotationId={editingQuotationId}
            quoteEntryHint={quoteEntryHint}
            quoteActionLabel={quotes.some(quote => quote.status === 'REJECTED') ? '重新发送报价' : '发送报价'}
            quoteForm={quoteForm}
            quoteValidationErrors={quoteValidationErrors}
            canSubmitQuoteForm={canSubmitQuoteForm}
            onOpenQuoteForm={openQuoteForm}
            onCloseQuoteForm={closeQuoteForm}
            onStartQuoteEditing={startQuoteEditing}
            onConfirmQuote={confirmQuote}
            onRejectQuote={rejectQuote}
            onOpenQuoteDetail={quote => {
              openQuoteDetail(quote)
            }}
            onOpenOrderArchive={openOrderArchive}
            onOpenDeliveryGallery={openDeliveryGallery}
            onQuoteFormChange={updateQuoteForm}
            onSubmitQuote={createQuote}
            onContentChange={setContent}
            onSendMessage={sendMessage}
            onRetryMessage={retryMessage}
            pendingAttachment={pendingAttachment}
            onChooseMessageImage={file => chooseMessageAttachment(file, 'IMAGE')}
            onChooseMessageFile={file => chooseMessageAttachment(file, 'FILE')}
            onRemoveAttachment={removePendingAttachment}
            onDownloadAttachment={downloadMessageAttachment}
            onMessageImageRemoteReady={releaseMessageLocalPreview}
            onPayOrder={openPaymentDialog}
            onCancelOrder={cancelCurrentOrder}
            onConfirmOrder={confirmCurrentOrder}
            onDecidePhotoAuthorization={handlePhotoAuthorizationDecision}
            onUnavailableTool={showUnavailableTool}
            onOpenAction={setActiveAction}
            initialScrollTop={cachedViewState.scrollTop}
            onScrollPositionChange={scrollTop => mergeWorkflowViewState(viewCacheKey, { scrollTop })}
          />
        </Box>

        <QuoteDraftDialog
          open={showQuoteForm && canSeeQuoteEntry}
          quoteForm={quoteForm}
          onQuoteFormChange={updateQuoteForm}
          onSubmit={createQuote}
          onClose={closeQuoteForm}
          editingQuotationId={editingQuotationId}
          quoteValidationErrors={quoteValidationErrors}
          quoteFieldErrors={quoteFieldErrors}
          loading={loading}
          canSubmitQuoteForm={canSubmitQuoteForm}
        />

        <ConversationWorkbenchPanel
          quotes={quotes}
          order={currentOrder}
          actions={actions}
          statusLogs={statusLogs}
          deliveryRecords={deliveryRecords}
          photoAuthorizations={photoAuthorizations}
          panelSummary={viewModel.panelSummary}
          loading={loading}
          onOpenOrderArchive={() => openOrderArchive(currentOrder?.orderId)}
          onOpenQuoteDetail={openQuoteDetail}
          onConfirmOrder={confirmCurrentOrder}
          onUnavailableTool={showUnavailableTool}
          onOpenAction={setActiveAction}
        />
      </PortraWorkbenchFrame>
      <ConversationActionDialogs
        activeAction={activeAction}
        loading={loading}
        quote={activeQuote}
        order={currentOrder}
        paymentMethod={paymentMethod}
        canConfirmQuote={activeQuoteCanConfirm}
        canRejectQuote={activeQuoteCanReject}
        canResendQuote={activeQuoteCanResend}
        deliveryRecords={deliveryRecords}
        deliveryForm={deliveryForm}
        reworkRequirement={reworkRequirement}
        photoAuthorizationForm={photoAuthorizationForm}
        onClose={closeActionDialogs}
        onPaymentMethodChange={setPaymentMethod}
        onConfirmQuote={confirmQuoteFromDialog}
        onRejectQuote={rejectQuoteFromDialog}
        onResendQuote={resendQuote}
        onConfirmPayment={confirmPaymentFromDialog}
        onDeliveryFilesChange={files => setDeliveryForm(previous => ({ ...previous, files }))}
        onDeliveryRemarkChange={remark => setDeliveryForm(previous => ({ ...previous, remark }))}
        onReworkRequirementChange={setReworkRequirement}
        onPhotoAuthorizationFileIdsChange={fileIds => setPhotoAuthorizationForm(previous => ({ ...previous, fileIds }))}
        onPhotoAuthorizationRemarkChange={remark => setPhotoAuthorizationForm(previous => ({ ...previous, remark }))}
        onSubmitDelivery={submitDelivery}
        onSubmitRework={submitRework}
        onSubmitPhotoAuthorization={submitPhotoAuthorizationRequest}
      />
      <OrderCompletionDialog
        open={completionDialogOpen}
        onClose={() => setCompletionDialogOpen(false)}
        onReview={() => {
          setCompletionDialogOpen(false)
          const opened = openOrderArchive(currentOrder?.orderId, { state: { openReview: true } })
          if (opened) feedback.info('评价功能入口已打开')
        }}
        reviewDisabled={!currentOrder?.orderId}
      />
    </PortraWorkflowFrame>
    </MessageWorkbenchErrorBoundary>
  )
}

function getLatestMessage(messages = []) {
  return [...(Array.isArray(messages) ? messages : [])]
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0] || null
}

function createOptimisticMessage(conversation, currentUser, content, messageType, attachment = null) {
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

function normalizeRemoteMessages(messages = []) {
  return (Array.isArray(messages) ? messages : []).filter(Boolean).map(normalizeRemoteMessage)
}

function normalizeRemoteMessage(message) {
  if (!message) return message
  return {
    ...message,
    deliveryStatus: 'sent',
    optimistic: false,
    errorMessage: ''
  }
}

function mergeConversationMessages(previous = [], incoming = []) {
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

function replaceTemporaryMessage(previous = [], tempId, sentMessage) {
  if (!sentMessage) return markTemporaryMessageFailed(previous, tempId)
  const normalized = normalizeRemoteMessage(sentMessage)
  return sortMessages(previous.map(message => {
    if (String(message.messageId) === String(tempId) || String(message.clientTempId) === String(tempId)) {
      return mergeSentMessageWithLocalPreview(normalized, message)
    }
    return message
  }))
}

function mergeSentMessageWithLocalPreview(sentMessage, localMessage) {
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

function markTemporaryMessageFailed(previous = [], tempId, error) {
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

function formatMessagePreviewText(message = {}) {
  const type = String(message.messageType || message.attachmentKind || '').toUpperCase()
  if (type === 'IMAGE') {
    const text = String(message.content || '').replace(/\s+/g, ' ').trim()
    return text ? `[图片] ${text}` : '[图片]'
  }
  if (type === 'FILE') return `[附件] ${message.fileName || message.attachment?.fileName || message.attachment?.name || ''}`.trim()
  return String(message.content || '').trim() || '还没有消息'
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

const noticeSx = {
  py: 0.25,
  borderRadius: PORTRA_RADII.control,
  border: `1px solid ${PORTRA_COLORS.borderMuted}`,
  bgcolor: PORTRA_COLORS.paper,
  '& .MuiAlert-message': { py: 0.45 }
}
