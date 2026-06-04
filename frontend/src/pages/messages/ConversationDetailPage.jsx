import { useEffect, useState } from 'react'
import { Alert, Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi, deliveryApi, orderApi, photoAuthorizationApi, quoteApi, readFileAsDataUrl } from '../../api.js'
import { ConversationThread } from './components/ConversationThread.jsx'
import { ConversationWorkbenchPanel } from './components/ConversationWorkbenchPanel.jsx'
import { ConversationActionDialogs } from './components/ConversationActionDialogs.jsx'
import {
  addLocalMessage,
  addSavedPhoto,
  buildConversationFallback,
  findConversationRecord,
  getCounterpartyProfile,
  getConversationSourceLabel,
  getLocalMessages,
  getOppositeUserId,
  updateConversationLastMessage
} from './utils/conversationUtils.js'
import {
  deriveConversationActions,
  getCurrentUserId,
  selectConversationOrder
} from './utils/workbenchState.js'
import {
  buildQuotePayload,
  canEditQuote,
  createDefaultQuoteForm,
  createQuoteFormFromQuote,
  getCWorkbenchErrorText,
  getBackendConversationId,
  getQuoteConfirmationErrorText,
  getQuoteEntryHint,
  validateQuoteForm
} from './utils/quoteUtils.js'

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
  const [activeAction, setActiveAction] = useState(null)

  useEffect(() => {
    const stored = findConversationRecord(conversationId)
    const fallback = stored || buildConversationFallback(conversationId)
    setConversation(fallback)
    loadConversationData(fallback)
  }, [conversationId, getCurrentUserId(currentUser), currentUser.role])

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
        senderId: getCurrentUserId(currentUser),
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
          senderId: getCurrentUserId(currentUser),
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
    if (!window.confirm('确认接收后，订单将完成，平台托管资金会结算给摄影师。是否确认？')) return
    const result = await run(async () => orderApi.transition(currentOrder.orderId, 'COMPLETED', '客户确认接收作品', currentUser), '订单已完成')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function submitDelivery(event) {
    event.preventDefault()
    if (!currentOrder || !deliveryForm.file) return false
    const result = await run(async () => deliveryApi.upload(currentOrder.orderId, deliveryForm.file, deliveryForm.remark.trim(), currentUser),
      currentOrder.status === 'REWORK_REQUIRED' ? '返修作品已上传' : '交付作品已上传')
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
    }, currentUser), '照片展示授权申请已发送')
    if (result) {
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function handlePhotoAuthorizationDecision(authorization, decision) {
    if (!currentOrder) return
    const remark = (authorizationRemarks[authorization.id] || '').trim()
    const action = decision === 'approve' ? photoAuthorizationApi.approve : photoAuthorizationApi.reject
    const successText = decision === 'approve' ? '已同意照片展示授权' : '已拒绝照片展示授权'
    const result = await run(async () => action(authorization.id, { remark }, currentUser), successText)
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  function showUnavailableTool(name) {
    const messages = {
      附件: '附件发送能力暂未接入，可以先发送图片或在会话中说明文件内容。',
      表情: '表情工具暂未接入，可以继续使用文字沟通。',
      补款: '补款能力暂未接入，双方可先在会话中协商金额。',
      平台协助: '平台协助功能由仲裁模块处理，当前演示可在订单档案中查看争议状态。'
    }
    setNotice({ type: 'info', text: messages[name] || '该能力暂未接入。' })
  }

  const currentUserId = getCurrentUserId(currentUser)
  const counterparty = getCounterpartyProfile(conversation, currentUser)
  const actions = deriveConversationActions({
    conversation,
    quotes,
    order: currentOrder,
    deliveries: deliveryRecords,
    authorizations: photoAuthorizations,
    statusLogs,
    activeRole: currentUser.role,
    currentUser
  })
  useEffect(() => {
    if (conversation && actions.roleMismatch) {
      navigate('/messages', { replace: true, state: { roleMismatch: true } })
    }
  }, [actions.roleMismatch, conversation, currentUser.role, navigate])
  const isBackendConversation = Boolean(conversation && !conversation.isLocal && getBackendConversationId(conversation))
  const editingQuote = editingQuotationId
    ? quotes.find(quote => String(quote.quotationId) === String(editingQuotationId))
    : null
  const canCreateQuote = actions.canSendQuote
  const canEditSelectedQuote = editingQuote
    && canEditQuote(editingQuote, conversation, currentUser)
  const canSubmitQuoteForm = editingQuotationId ? canEditSelectedQuote : canCreateQuote
  const canSeeQuoteEntry = !currentOrder && (actions.canSendQuote || actions.canEditQuote || showQuoteForm)
  const quoteEntryHint = currentOrder ? '' : getQuoteEntryHint(conversation, currentUser, quotes)
  const sourceLabel = getConversationSourceLabel(conversation)
  const topic = getConversationTopic(conversation, sourceLabel)

  return (
    <Stack spacing={1.5}>
      <Paper variant="outlined" sx={{ p: { xs: 1.4, md: 1.8 }, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Button color="inherit" onClick={() => navigate('/messages')}>返回</Button>
            <Avatar
              src={counterparty.avatarData || undefined}
              onClick={() => conversation && openUserProfile(getOppositeUserId(conversation, currentUserId))}
              sx={{ bgcolor: '#0d2fb2', cursor: conversation ? 'pointer' : 'default' }}
            >
              {counterparty.initial}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap>{counterparty.nickname}</Typography>
              <Typography color="text.secondary" noWrap>
                本次合作：{topic}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
            <Chip size="small" label={actions.role === 'PROVIDER' ? '你是摄影师' : '你是客户'} />
            <Chip size="small" label={`来自：${sourceLabel}`} />
            <Chip size="small" color={isBackendConversation ? 'primary' : 'default'} label={`当前：${actions.stage.title}`} />
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
            actions={actions}
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
            onOpenQuoteForm={openQuoteForm}
            onCloseQuoteForm={closeQuoteForm}
            onStartQuoteEditing={startQuoteEditing}
            onConfirmQuote={confirmQuote}
            onRejectQuote={rejectQuote}
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
            onDecidePhotoAuthorization={handlePhotoAuthorizationDecision}
            onUnavailableTool={showUnavailableTool}
            onOpenAction={setActiveAction}
          />
        </Stack>

        <ConversationWorkbenchPanel
          quotes={quotes}
          order={currentOrder}
          actions={actions}
          statusLogs={statusLogs}
          deliveryRecords={deliveryRecords}
          photoAuthorizations={photoAuthorizations}
          onOpenOrderArchive={() => currentOrder && navigate(`/orders?orderId=${currentOrder.orderId}`)}
          onConfirmOrder={confirmCurrentOrder}
          onUnavailableTool={showUnavailableTool}
          onOpenAction={setActiveAction}
        />
      </Box>
      <ConversationActionDialogs
        activeAction={activeAction}
        loading={loading}
        deliveryRecords={deliveryRecords}
        deliveryForm={deliveryForm}
        reworkRequirement={reworkRequirement}
        photoAuthorizationForm={photoAuthorizationForm}
        onClose={() => setActiveAction(null)}
        onDeliveryFileChange={file => setDeliveryForm({ ...deliveryForm, file })}
        onDeliveryRemarkChange={remark => setDeliveryForm({ ...deliveryForm, remark })}
        onReworkRequirementChange={setReworkRequirement}
        onPhotoAuthorizationFileIdsChange={fileIds => setPhotoAuthorizationForm({ ...photoAuthorizationForm, fileIds })}
        onPhotoAuthorizationRemarkChange={remark => setPhotoAuthorizationForm({ ...photoAuthorizationForm, remark })}
        onSubmitDelivery={submitDelivery}
        onSubmitRework={submitRework}
        onSubmitPhotoAuthorization={submitPhotoAuthorizationRequest}
      />
    </Stack>
  )
}

function getConversationTopic(conversation, sourceLabel) {
  const scene = String(conversation?.scene || '').trim()
  if (scene && scene !== '约拍沟通' && scene !== '约拍需求沟通') return scene
  if (conversation?.location) return `${conversation.location}约拍`
  return sourceLabel || '校园约拍'
}
