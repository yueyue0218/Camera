import { useEffect, useState } from 'react'
import { Alert, Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi, deliveryApi, orderApi, photoAuthorizationApi, quoteApi, readFileAsDataUrl } from '../../api.js'
import { ConversationThread } from './components/ConversationThread.jsx'
import { ConversationWorkbenchPanel } from './components/ConversationWorkbenchPanel.jsx'
import {
  addLocalMessage,
  addSavedPhoto,
  buildConversationFallback,
  findConversationRecord,
  getCounterpartyLabel,
  getConversationSourceLabel,
  getLocalMessages,
  getOppositeUserId,
  updateConversationLastMessage
} from './utils/conversationUtils.js'
import {
  buildQuotePayload,
  canEditQuote,
  createDefaultQuoteForm,
  createQuoteFormFromQuote,
  getCWorkbenchErrorText,
  getBackendConversationId,
  getQuoteConfirmationErrorText,
  getQuoteEntryHint,
  hasPendingQuote,
  validateQuoteForm
} from './utils/quoteUtils.js'

const ACTIVE_ORDER_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PAID_PENDING_SHOOT',
  'SHOOTING',
  'PENDING_DELIVERY',
  'DELIVERED_PENDING_CONFIRM',
  'REWORK_REQUIRED',
  'APPEALING'
])

function openUserProfile(userId) {
  const id = Number(userId)
  if (!id) return
  window.open(new URL(`/users/${id}`, window.location.origin).toString(), '_blank', 'noopener,noreferrer')
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
  const [imageSending, setImageSending] = useState(false)
  const [quoteForm, setQuoteForm] = useState(() => createDefaultQuoteForm())
  const [deliveryForm, setDeliveryForm] = useState({ file: null, remark: '' })
  const [reworkRequirement, setReworkRequirement] = useState('')
  const [photoAuthorizationForm, setPhotoAuthorizationForm] = useState({ fileIds: [], remark: '' })
  const [authorizationRemarks, setAuthorizationRemarks] = useState({})
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [editingQuotationId, setEditingQuotationId] = useState(null)
  const [quoteValidationErrors, setQuoteValidationErrors] = useState([])
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = findConversationRecord(conversationId)
    const fallback = stored || buildConversationFallback(conversationId)
    setConversation(fallback)
    loadConversationData(fallback)
  }, [conversationId, currentUser.userId])

  async function run(action, successText) {
    setLoading(true)
    setNotice(null)
    try {
      const result = await action()
      if (successText) setNotice({ type: 'success', text: successText })
      return result
    } catch (error) {
      setNotice({ type: 'error', text: getCWorkbenchErrorText(error) })
      return null
    } finally {
      setLoading(false)
    }
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
        senderId: currentUser.userId,
        messageType: 'TEXT',
        content: text
      })
      updateConversationLastMessage(conversation.conversationId, text)
      setMessages(nextMessages)
      setContent('')
      return
    }
    const sent = await run(async () => conversationApi.sendMessage(conversation.backendConversationId || conversation.conversationId, text, currentUser, 'TEXT'))
    if (sent) {
      updateConversationLastMessage(conversation.conversationId, text)
      setContent('')
      await loadConversationData()
    }
  }

  async function chooseMessageImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !conversation) return
    setImageSending(true)
    try {
      const image = await readFileAsDataUrl(file)
      if (conversation.isLocal) {
        const nextMessages = addLocalMessage(conversation.conversationId, {
          senderId: currentUser.userId,
          messageType: 'IMAGE',
          content: image
        })
        updateConversationLastMessage(conversation.conversationId, '[图片]')
        setMessages(nextMessages)
        return
      }
      const sent = await run(async () => conversationApi.sendMessage(
        conversation.backendConversationId || conversation.conversationId,
        image,
        currentUser,
        'IMAGE'
      ), '图片已发送')
      if (sent) {
        updateConversationLastMessage(conversation.conversationId, '[图片]')
        await loadConversationData()
      }
    } catch (error) {
      setNotice({ type: 'error', text: getCWorkbenchErrorText(error) })
    } finally {
      setImageSending(false)
    }
  }

  function saveSubmittedPhoto(message) {
    if (!message?.content || !conversation) return
    addSavedPhoto({
      photoId: `message-${message.messageId}`,
      source: 'conversation-submission',
      title: `${conversation.scene || '会话'} 提交照片`,
      imageData: message.content,
      authorId: message.senderId,
      createdAt: message.createdAt
    })
    setNotice({ type: 'success', text: '照片已保存到我的照片' })
  }

  async function createQuote(event) {
    event.preventDefault()
    const validationErrors = validateQuoteForm(quoteForm, conversation, currentUser, quotes, { editingQuotationId })
    setQuoteValidationErrors(validationErrors)
    if (validationErrors.length) {
      setNotice({ type: 'warning', text: validationErrors[0] })
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
      setQuoteForm(createDefaultQuoteForm())
      await loadConversationData()
    }
  }

  function startQuoteEditing(quote) {
    setEditingQuotationId(quote.quotationId)
    setQuoteForm(createQuoteFormFromQuote(quote))
    setQuoteValidationErrors([])
    setShowQuoteForm(true)
    setNotice({ type: 'info', text: '正在编辑待确认报价，保存前客户仍看到原报价。' })
  }

  function closeQuoteForm() {
    setShowQuoteForm(false)
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteForm(createDefaultQuoteForm())
  }

  function openQuoteForm() {
    if (showQuoteForm && !editingQuotationId) {
      closeQuoteForm()
      return
    }
    setQuoteForm(createDefaultQuoteForm())
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setShowQuoteForm(true)
  }

  async function confirmQuote(quote) {
    setLoading(true)
    setNotice(null)
    try {
      const result = await quoteApi.confirm(quote.quotationId, '客户已确认本次报价', currentUser)
      setNotice({ type: 'success', text: '报价已确认，订单已生成' })
      if (result?.orderId) {
        await refreshConversationData(conversation, result.orderId)
      } else {
        await refreshConversationData()
        setNotice({ type: 'error', text: '报价已确认，但暂时没有拿到订单信息，请刷新后再查看。' })
      }
    } catch (error) {
      try {
        await refreshConversationData()
      } catch {
        // Keep the original quote confirmation error visible.
      }
      setNotice({ type: 'error', text: getQuoteConfirmationErrorText(error) })
    } finally {
      setLoading(false)
    }
  }

  async function rejectQuote(quote) {
    const result = await run(async () => quoteApi.reject(quote.quotationId, '本次暂不采用该报价', currentUser), '报价已拒绝')
    if (result) await loadConversationData()
  }

  async function payCurrentOrder() {
    if (!currentOrder) return
    const result = await run(async () => orderApi.mockPay(currentOrder.orderId, currentOrder.amountCent, currentUser), '支付成功，资金已进入平台托管')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function cancelCurrentOrder(cancelAction) {
    if (!currentOrder || !cancelAction) return
    if (!window.confirm(cancelAction.confirmText)) return
    const result = await run(async () => orderApi.cancel(currentOrder.orderId, { reason: cancelAction.reason }, currentUser), '订单状态已更新')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function confirmCurrentOrder() {
    if (!currentOrder) return
    const result = await run(async () => orderApi.transition(currentOrder.orderId, 'COMPLETED', '客户确认接收作品', currentUser), '订单已完成')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function submitDelivery(event) {
    event.preventDefault()
    if (!currentOrder || !deliveryForm.file) return
    const result = await run(async () => deliveryApi.upload(currentOrder.orderId, deliveryForm.file, deliveryForm.remark.trim(), currentUser),
      currentOrder.status === 'REWORK_REQUIRED' ? '返修作品已上传' : '交付作品已上传')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function submitRework(event) {
    event.preventDefault()
    if (!currentOrder) return
    const reason = reworkRequirement.trim()
    if (!reason) {
      setNotice({ type: 'warning', text: '请填写返修要求' })
      return
    }
    const result = await run(async () => orderApi.requestRework(currentOrder.orderId, reason, currentUser), '返修请求已提交')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function submitPhotoAuthorizationRequest(event) {
    event.preventDefault()
    if (!currentOrder || !photoAuthorizationForm.fileIds.length) return
    const result = await run(async () => photoAuthorizationApi.request(currentOrder.orderId, {
      fileIds: photoAuthorizationForm.fileIds,
      remark: photoAuthorizationForm.remark.trim()
    }, currentUser), '照片展示授权申请已发送')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function handlePhotoAuthorizationDecision(authorization, decision) {
    if (!currentOrder) return
    const remark = (authorizationRemarks[authorization.id] || '').trim()
    const action = decision === 'approve' ? photoAuthorizationApi.approve : photoAuthorizationApi.reject
    const successText = decision === 'approve' ? '已同意照片展示授权' : '已拒绝照片展示授权'
    const result = await run(async () => action(authorization.id, { remark }, currentUser), successText)
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  const isBackendConversation = Boolean(conversation && !conversation.isLocal && getBackendConversationId(conversation))
  const isConversationProvider = conversation && currentUser.userId === Number(conversation.participantBId)
  const isConversationCustomer = conversation && currentUser.userId === Number(conversation.participantAId)
  const pendingQuote = hasPendingQuote(quotes)
  const editingQuote = editingQuotationId
    ? quotes.find(quote => String(quote.quotationId) === String(editingQuotationId))
    : null
  const canCreateQuote = conversation
    && currentUser.role === 'PROVIDER'
    && isConversationProvider
    && isBackendConversation
    && !pendingQuote
  const canEditSelectedQuote = editingQuote
    && canEditQuote(editingQuote, conversation, currentUser)
  const canSubmitQuoteForm = editingQuotationId ? canEditSelectedQuote : canCreateQuote
  const canSeeQuoteEntry = conversation && currentUser.role === 'PROVIDER' && isConversationProvider
  const quoteEntryHint = getQuoteEntryHint(conversation, currentUser, quotes)
  const sourceLabel = getConversationSourceLabel(conversation)
  const progressLabel = getConversationProgressLabel(currentOrder, quotes, currentUser)

  return (
    <Stack spacing={1.5}>
      <Paper variant="outlined" sx={{ p: { xs: 1.4, md: 1.8 }, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Button color="inherit" onClick={() => navigate('/messages')}>返回</Button>
            <Avatar
              onClick={() => conversation && openUserProfile(getOppositeUserId(conversation, currentUser.userId))}
              sx={{ bgcolor: '#0d2fb2', cursor: conversation ? 'pointer' : 'default' }}
            >
              {conversation?.scene?.slice(0, 1) || '会'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap>{conversation?.scene || '约拍沟通'}</Typography>
              <Typography color="text.secondary" noWrap>
                {conversation?.location || '具体对话'} · {getCounterpartyLabel(conversation, currentUser)}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
            <Chip size="small" label={currentUser.role === 'PROVIDER' ? '你是摄影师' : '你是客户'} />
            <Chip size="small" label={`来自：${sourceLabel}`} />
            <Chip size="small" color={isBackendConversation ? 'primary' : 'default'} label={`当前：${progressLabel}`} />
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<ReceiptLongRoundedIcon />}
              onClick={() => currentOrder && navigate(`/orders?orderId=${currentOrder.orderId}`)}
              disabled={!currentOrder}
            >
              订单档案
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2.2fr) minmax(300px, 0.95fr)' }, gap: 2, alignItems: 'start' }}>
        <Stack spacing={2}>
          <ConversationThread
            messages={messages}
            conversation={conversation}
            currentUser={currentUser}
            quotes={quotes}
            order={currentOrder}
            statusLogs={statusLogs}
            deliveryRecords={deliveryRecords}
            photoAuthorizations={photoAuthorizations}
            content={content}
            loading={loading}
            imageSending={imageSending}
            canSeeQuoteEntry={canSeeQuoteEntry}
            canCreateQuote={canCreateQuote}
            showQuoteForm={showQuoteForm}
            editingQuotationId={editingQuotationId}
            quoteEntryHint={quoteEntryHint}
            quoteForm={quoteForm}
            quoteValidationErrors={quoteValidationErrors}
            canSubmitQuoteForm={canSubmitQuoteForm}
            deliveryForm={deliveryForm}
            reworkRequirement={reworkRequirement}
            photoAuthorizationForm={photoAuthorizationForm}
            authorizationRemarks={authorizationRemarks}
            onOpenQuoteForm={openQuoteForm}
            onCloseQuoteForm={closeQuoteForm}
            onStartQuoteEditing={startQuoteEditing}
            onConfirmQuote={confirmQuote}
            onRejectQuote={rejectQuote}
            onOpenOrder={orderId => navigate(`/orders?orderId=${orderId}`)}
            onOpenOrderArchive={() => currentOrder && navigate(`/orders?orderId=${currentOrder.orderId}`)}
            onQuoteFormChange={setQuoteForm}
            onSubmitQuote={createQuote}
            onContentChange={setContent}
            onSendMessage={sendMessage}
            onChooseMessageImage={chooseMessageImage}
            onSaveSubmittedPhoto={saveSubmittedPhoto}
            onPayOrder={payCurrentOrder}
            onCancelOrder={cancelCurrentOrder}
            onConfirmOrder={confirmCurrentOrder}
            onSubmitRework={submitRework}
            onReworkRequirementChange={setReworkRequirement}
            onDeliveryFileChange={file => setDeliveryForm({ ...deliveryForm, file })}
            onDeliveryRemarkChange={remark => setDeliveryForm({ ...deliveryForm, remark })}
            onSubmitDelivery={submitDelivery}
            onPhotoAuthorizationFileIdsChange={fileIds => setPhotoAuthorizationForm({ ...photoAuthorizationForm, fileIds })}
            onPhotoAuthorizationRemarkChange={remark => setPhotoAuthorizationForm({ ...photoAuthorizationForm, remark })}
            onSubmitPhotoAuthorization={submitPhotoAuthorizationRequest}
            onAuthorizationRemarkChange={(authorizationId, remark) => setAuthorizationRemarks({ ...authorizationRemarks, [authorizationId]: remark })}
            onDecidePhotoAuthorization={handlePhotoAuthorizationDecision}
          />
        </Stack>

        <ConversationWorkbenchPanel
          conversation={conversation}
          currentUser={currentUser}
          quotes={quotes}
          order={currentOrder}
          statusLogs={statusLogs}
          deliveryRecords={deliveryRecords}
          photoAuthorizations={photoAuthorizations}
          deliveryForm={deliveryForm}
          reworkRequirement={reworkRequirement}
          photoAuthorizationForm={photoAuthorizationForm}
          authorizationRemarks={authorizationRemarks}
          loading={loading}
          onOpenQuoteForm={openQuoteForm}
          onOpenOrderArchive={() => currentOrder && navigate(`/orders?orderId=${currentOrder.orderId}`)}
          onPayOrder={payCurrentOrder}
          onCancelOrder={cancelCurrentOrder}
          onConfirmOrder={confirmCurrentOrder}
          onSubmitRework={submitRework}
          onReworkRequirementChange={setReworkRequirement}
          onDeliveryFileChange={file => setDeliveryForm({ ...deliveryForm, file })}
          onDeliveryRemarkChange={remark => setDeliveryForm({ ...deliveryForm, remark })}
          onSubmitDelivery={submitDelivery}
          onPhotoAuthorizationFileIdsChange={fileIds => setPhotoAuthorizationForm({ ...photoAuthorizationForm, fileIds })}
          onPhotoAuthorizationRemarkChange={remark => setPhotoAuthorizationForm({ ...photoAuthorizationForm, remark })}
          onSubmitPhotoAuthorization={submitPhotoAuthorizationRequest}
          onAuthorizationRemarkChange={(authorizationId, remark) => setAuthorizationRemarks({ ...authorizationRemarks, [authorizationId]: remark })}
          onDecidePhotoAuthorization={handlePhotoAuthorizationDecision}
        />
      </Box>
    </Stack>
  )
}

function getConversationProgressLabel(order, quotes, currentUser) {
  if (order) {
    const statusLabel = {
      PENDING_PAYMENT: currentUser.role === 'CUSTOMER' ? '等待你支付' : '等待客户付款',
      PAID_PENDING_SHOOT: '等待拍摄',
      SHOOTING: '拍摄履约中',
      PENDING_DELIVERY: currentUser.role === 'PROVIDER' ? '等待你交付' : '等待摄影师交付',
      DELIVERED_PENDING_CONFIRM: currentUser.role === 'CUSTOMER' ? '等待你确认作品' : '等待客户确认作品',
      REWORK_REQUIRED: currentUser.role === 'PROVIDER' ? '返修待交付' : '返修中',
      APPEALING: '争议处理中',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
      REFUNDED: '已退款'
    }
    return statusLabel[order.status] || '订单进展已更新'
  }
  const pendingQuote = quotes.find(quote => quote.status === 'PENDING_CONFIRM')
  if (pendingQuote) return currentUser.role === 'CUSTOMER' ? '等待你确认报价' : '等待客户确认报价'
  const latestQuote = [...quotes].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0]
  if (latestQuote?.status === 'REJECTED') return '报价已拒绝'
  if (latestQuote?.status === 'EXPIRED') return '报价已过期'
  if (latestQuote?.status === 'CONFIRMED') return '报价已确认'
  return '沟通拍摄细节'
}

function selectConversationOrder(orders, conversation, quotes) {
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
  if (!candidates.length) return null
  return candidates.sort((left, right) => {
    const leftActive = ACTIVE_ORDER_STATUSES.has(left.status) ? 1 : 0
    const rightActive = ACTIVE_ORDER_STATUSES.has(right.status) ? 1 : 0
    if (leftActive !== rightActive) return rightActive - leftActive
    return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
  })[0]
}
