import { useEffect, useState } from 'react'
import { Alert, Avatar, Box, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi, deliveryApi, orderApi, photoAuthorizationApi, quoteApi } from '../../api.js'
import { goToUserProfile } from '../../utils/orderNavigation.js'
import { getNextOrderWorkflowRefreshDelay } from '../../utils/orderWorkflowModel.js'
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
  addSavedPhoto,
  buildConversationFallback,
  findConversationRecord,
  getLocalMessages,
  getOppositeUserId,
  updateConversationLastMessage
} from './utils/conversationUtils.js'
import {
  loadConversationPeerProfile,
  resolveConversationParticipants
} from './utils/participantResolver.js'
import {
  buildConversationWorkbenchViewModel,
  getCurrentUserId,
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

export function ConversationDetailPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [quotes, setQuotes] = useState([])
  const [currentOrder, setCurrentOrder] = useState(null)
  const [statusLogs, setStatusLogs] = useState([])
  const [deliveryRecords, setDeliveryRecords] = useState([])
  const [photoAuthorizations, setPhotoAuthorizations] = useState([])
  const [content, setContent] = useState('')
  const [quoteForm, setQuoteForm] = useState(() => createDefaultQuoteForm())
  const [deliveryForm, setDeliveryForm] = useState({ file: null, remark: '' })
  const [reworkRequirement, setReworkRequirement] = useState('')
  const [photoAuthorizationForm, setPhotoAuthorizationForm] = useState({ fileIds: [], remark: '' })
  const [authorizationRemarks, setAuthorizationRemarks] = useState({})
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
  const { run: runWorkflowAction, loading: actionLoading } = usePortraAsyncAction({
    errorMessage: getCWorkbenchErrorText
  })
  const loading = pageLoading || actionLoading

  useEffect(() => {
    rememberLastConversation(conversationId, {
      orderId: currentOrder?.orderId,
      role: currentUser.role
    })
  }, [conversationId, currentOrder?.orderId, currentUser.role])

  useEffect(() => {
    const stored = findConversationRecord(conversationId)
    const fallback = stored || buildConversationFallback(conversationId)
    setConversation(fallback)
    loadConversationData(fallback)
  }, [conversationId, getCurrentUserId(currentUser), currentUser.role])

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
      successMessage: successText,
      onSuccess: () => {
        if (successText) setNotice({ type: 'success', text: successText })
      },
      onError: (_error, message) => setNotice({ type: 'error', text: message })
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
    setMessages(nextMessages)
    setQuotes(nextQuotes)
    const selectedOrder = preferredOrderId
      ? { orderId: preferredOrderId }
      : selectConversationOrder(nextOrders || [], record, nextQuotes || [])
    if (selectedOrder?.orderId) {
      await loadOrderWorkbench(selectedOrder.orderId)
    } else {
      clearOrderWorkbench()
    }
  }

  function clearOrderWorkbench() {
    setCurrentOrder(null)
    setStatusLogs([])
    setDeliveryRecords([])
    setPhotoAuthorizations([])
    setDeliveryForm({ file: null, remark: '' })
    setReworkRequirement('')
    setPhotoAuthorizationForm({ fileIds: [], remark: '' })
    setAuthorizationRemarks({})
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
    setDeliveryForm({ file: null, remark: '' })
    setReworkRequirement('')
    setPhotoAuthorizationForm({ fileIds: [], remark: '' })
    setAuthorizationRemarks({})
  }

  async function sendMessage() {
    if (!conversation || !content.trim()) return
    const text = content.trim()
    if (conversation.isLocal) {
      const nextMessages = addLocalMessage(conversation.conversationId, {
        senderId: getCurrentUserId(currentUser),
        messageType: 'TEXT',
        content: text
      })
      updateConversationLastMessage(conversation.conversationId, text)
      setMessages(nextMessages)
      setContent('')
      return
    }
    const optimisticMessage = createOptimisticMessage(conversation, currentUser, text, 'TEXT')
    setMessages(previous => [...previous, optimisticMessage])
    setContent('')
    updateConversationLastMessage(conversation.conversationId, text)
    const sent = await run(async () => conversationApi.sendMessage(conversation.backendConversationId || conversation.conversationId, text, currentUser, 'TEXT'))
    if (sent) {
      await refreshConversationData(conversation, currentOrder?.orderId)
      return
    }
    setMessages(previous => previous.filter(message => message.messageId !== optimisticMessage.messageId))
    setContent(text)
  }

  function saveSubmittedPhoto(message) {
    if (!message?.content || !conversation) return
    addSavedPhoto({
      photoId: `message-${message.messageId}`,
      source: 'conversation-submission',
      title: `${conversation.scene || '沟通'} 提交照片`,
      imageData: message.content,
      authorId: message.senderId,
      createdAt: message.createdAt
    })
    setNotice({ type: 'success', text: '照片已保存到我的照片' })
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
      setNotice({ type: 'warning', text: validation.errors[0] })
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
      setNotice({ type: 'error', text: '报价详情暂时无法打开，请刷新后重试。' })
      return
    }
    setEditingQuotationId(quote.quotationId)
    setQuoteForm(createQuoteFormFromQuote(quote))
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setShowQuoteForm(true)
    setNotice({ type: 'info', text: '正在编辑待确认报价，保存前客户仍看到原报价。' })
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
      setNotice({ type: 'error', text: '报价详情暂时无法打开，请刷新后重试。' })
      return
    }
    setQuoteForm(createQuoteFormFromQuote(quote))
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setShowQuoteForm(true)
    setActiveAction(null)
    setActiveQuote(null)
    setNotice({ type: 'info', text: '已带入上次报价内容，请确认后重新发送给客户。' })
  }

  async function confirmQuote(quote) {
    if (!quote?.quotationId) {
      setNotice({ type: 'error', text: '报价详情暂时无法打开，请刷新后重试。' })
      return false
    }
    setPageLoading(true)
    setNotice(null)
    try {
      const result = await quoteApi.confirm(quote.quotationId, '客户已确认本次报价', currentUser)
      setNotice({ type: 'success', text: '报价已确认，订单已生成' })
      feedback.success('报价已确认，订单已生成')
      if (result?.orderId) {
        await refreshConversationData(conversation, result.orderId)
      } else {
        await refreshConversationData()
        setNotice({ type: 'error', text: '报价已确认，但暂时没有拿到订单信息，请刷新后再查看。' })
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
      setNotice({ type: 'error', text: message })
      feedback.error(message)
      return false
    } finally {
      setPageLoading(false)
    }
  }

  async function rejectQuote(quote) {
    if (!quote?.quotationId) {
      setNotice({ type: 'error', text: '报价详情暂时无法打开，请刷新后重试。' })
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
    event.preventDefault()
    if (!currentOrder || !deliveryForm.file) return false
    const result = await run(async () => deliveryApi.upload(currentOrder.orderId, deliveryForm.file, deliveryForm.remark.trim(), currentUser),
      currentOrder.status === 'REWORK_REQUIRED' ? '返修作品已上传' : '作品已上传')
    if (result) {
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
      setNotice({ type: 'warning', text: '请填写返修要求' })
      return false
    }
    const result = await run(async () => orderApi.requestRework(currentOrder.orderId, reason, currentUser), '返修请求已提交')
    if (result) {
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
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function handlePhotoAuthorizationDecision(authorization, decision, decisionRemark = '') {
    if (!currentOrder) return
    const remark = (decisionRemark || authorizationRemarks[authorization.id] || '').trim()
    if (decision === 'reject' && !remark) {
      setNotice({ type: 'warning', text: '请填写拒绝原因' })
      return false
    }
    const action = decision === 'approve' ? photoAuthorizationApi.approve : photoAuthorizationApi.reject
    const successText = decision === 'approve' ? '已同意展示授权' : '已拒绝展示授权'
    const result = await run(async () => action(authorization.id, { remark }, currentUser), successText)
    if (result) {
      setAuthorizationRemarks({ ...authorizationRemarks, [authorization.id]: '' })
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
      图片: '当前接口暂不支持发送图片，作品请通过订单上传。',
      附件: '附件发送能力暂未接入，作品请通过订单上传，普通资料可先用文字说明。',
      表情: '表情工具暂未接入，可以继续使用文字沟通。',
      补款: '补款能力暂未接入，双方可先在沟通中协商金额。',
      平台协助: '平台协助功能由仲裁模块处理，当前演示可在订单中查看争议状态。'
    }
    setNotice({ type: 'info', text: messages[name] || '该能力暂未接入。' })
    feedback.info(messages[name] || '该能力暂未接入。')
  }

  function openUserProfile(userId, event) {
    event?.stopPropagation()
    goToUserProfile(navigate, userId, currentUser)
  }

  function openOrderArchive(orderId = currentOrder?.orderId, options = {}) {
    const succeeded = navigateToOrderFromConversation(navigate, {
      orderId: orderId || currentOrder?.orderId,
      conversationId
    }, options)
    if (!succeeded) {
      setNotice({ type: 'warning', text: '订单信息暂时不可用，请稍后刷新后再查看。' })
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
      setNotice({ type: 'warning', text: '作品记录暂不可查看，请刷新后重试。' })
      feedback.warning('作品记录暂不可查看，请刷新后重试。')
    }
    return succeeded
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
    onRefresh: () => refreshConversationData(conversation, currentOrder?.orderId)
  })
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
      navigate('/messages', { replace: true, state: { roleMismatch: true } })
    }
  }, [actions.roleMismatch, conversation, currentUser.role, navigate])
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
                {getSafeDisplayText(counterparty.peerDisplayName, counterparty.peerUserId ? `用户 ${counterparty.peerUserId}` : '用户')}
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
            loading={loading}
            imageSending={false}
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
              if (!quote) {
                setNotice({ type: 'error', text: '报价详情暂时无法打开，请刷新后重试。' })
                return
              }
              setActiveQuote(quote)
              setActiveAction('QUOTE_DETAIL')
            }}
            onOpenOrderArchive={openOrderArchive}
            onOpenDeliveryGallery={openDeliveryGallery}
            onQuoteFormChange={updateQuoteForm}
            onSubmitQuote={createQuote}
            onContentChange={setContent}
            onSendMessage={sendMessage}
            onChooseMessageImage={() => showUnavailableTool('图片')}
            onSaveSubmittedPhoto={saveSubmittedPhoto}
            onPayOrder={openPaymentDialog}
            onCancelOrder={cancelCurrentOrder}
            onConfirmOrder={confirmCurrentOrder}
            onDecidePhotoAuthorization={handlePhotoAuthorizationDecision}
            onUnavailableTool={showUnavailableTool}
            onOpenAction={setActiveAction}
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
          onOpenOrderArchive={() => openOrderArchive(currentOrder?.orderId)}
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
        onClose={() => {
          setActiveAction(null)
          setActiveQuote(null)
        }}
        onPaymentMethodChange={setPaymentMethod}
        onConfirmQuote={confirmQuoteFromDialog}
        onRejectQuote={rejectQuoteFromDialog}
        onResendQuote={resendQuote}
        onConfirmPayment={confirmPaymentFromDialog}
        onDeliveryFileChange={file => setDeliveryForm({ ...deliveryForm, file })}
        onDeliveryRemarkChange={remark => setDeliveryForm({ ...deliveryForm, remark })}
        onReworkRequirementChange={setReworkRequirement}
        onPhotoAuthorizationFileIdsChange={fileIds => setPhotoAuthorizationForm({ ...photoAuthorizationForm, fileIds })}
        onPhotoAuthorizationRemarkChange={remark => setPhotoAuthorizationForm({ ...photoAuthorizationForm, remark })}
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

function createOptimisticMessage(conversation, currentUser, content, messageType) {
  const conversationId = conversation?.backendConversationId || conversation?.conversationId
  return {
    messageId: `optimistic-${conversationId}-${Date.now()}`,
    conversationId,
    senderId: getCurrentUserId(currentUser),
    messageType,
    content,
    createdAt: new Date().toISOString(),
    optimistic: true
  }
}

const noticeSx = {
  py: 0.25,
  borderRadius: PORTRA_RADII.control,
  border: `1px solid ${PORTRA_COLORS.borderMuted}`,
  bgcolor: PORTRA_COLORS.paper,
  '& .MuiAlert-message': { py: 0.45 }
}
