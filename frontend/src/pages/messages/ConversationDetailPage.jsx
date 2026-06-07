import { useEffect, useState } from 'react'
import { Alert, Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi, quoteApi, readFileAsDataUrl } from '../../api.js'
import { ConversationSourceCard } from './components/ConversationSourceCard.jsx'
import { ConversationThread } from './components/ConversationThread.jsx'
import { QuotePanel } from './components/QuotePanel.jsx'
import {
  addLocalMessage,
  addSavedPhoto,
  buildConversationFallback,
  buildConversationSourceRows,
  findConversationRecord,
  formatTime,
  getConversationSourceHint,
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
  getBackendConversationId,
  getQuoteConfirmationErrorText,
  getQuoteEntryHint,
  hasPendingQuote,
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
  const [content, setContent] = useState('')
  const [imageSending, setImageSending] = useState(false)
  const [quoteForm, setQuoteForm] = useState(() => createDefaultQuoteForm())
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
      setNotice({ type: 'error', text: error.message })
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
      return
    }
    await run(async () => {
      await refreshConversationData(record)
    })
  }

  async function refreshConversationData(record = conversation) {
    if (!record || record.isLocal) return
    const [nextMessages, nextQuotes] = await Promise.all([
      conversationApi.messages(record.backendConversationId || record.conversationId, currentUser),
      conversationApi.quotes(record.backendConversationId || record.conversationId, currentUser)
    ])
    setMessages(nextMessages)
    setQuotes(nextQuotes)
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
      setNotice({ type: 'error', text: error.message })
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
      const result = await quoteApi.confirm(quote.quotationId, '需求方确认报价', currentUser)
      setNotice({ type: 'success', text: '报价已确认，订单已生成' })
      if (result?.orderId) {
        await refreshConversationData()
        navigate(`/orders?orderId=${result.orderId}`)
      } else {
        await refreshConversationData()
        setNotice({ type: 'success', text: '报价已确认，可在订单页查看关联订单。' })
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
  const sourceHint = getConversationSourceHint(conversation)
  const sourceRows = buildConversationSourceRows(conversation, currentUser, sourceLabel, getBackendConversationId(conversation))

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Button color="inherit" onClick={() => navigate('/messages')}>返回</Button>
            <Avatar
              onClick={() => conversation && openUserProfile(getOppositeUserId(conversation, currentUser.userId))}
              sx={{ bgcolor: conversation?.isLocal ? 'secondary.main' : 'primary.main', cursor: conversation ? 'pointer' : 'default' }}
            >
              {conversation?.scene?.slice(0, 1) || '会'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap>{conversation?.scene || `会话 ${conversationId}`}</Typography>
              <Typography color="text.secondary" noWrap>
                {conversation?.location || '具体对话'} · 对方 {conversation ? getOppositeUserId(conversation, currentUser.userId) : '-'}
              </Typography>
            </Box>
          </Stack>
          <Chip size="small" label={conversation?.isLocal ? '本地对话' : 'C会话'} />
        </Stack>
      </Paper>

      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      {conversation?.interfaceNote && <Alert severity="warning">{conversation.interfaceNote}</Alert>}

      <ConversationSourceCard
        isBackendConversation={isBackendConversation}
        currentUser={currentUser}
        sourceRows={sourceRows}
        sourceHint={sourceHint}
      />

      <QuotePanel
        quotes={quotes}
        conversation={conversation}
        currentUser={currentUser}
        canSeeQuoteEntry={canSeeQuoteEntry}
        canCreateQuote={canCreateQuote}
        showQuoteForm={showQuoteForm}
        editingQuotationId={editingQuotationId}
        quoteEntryHint={quoteEntryHint}
        quoteForm={quoteForm}
        quoteValidationErrors={quoteValidationErrors}
        loading={loading}
        canSubmitQuoteForm={canSubmitQuoteForm}
        onOpenQuoteForm={openQuoteForm}
        onCloseQuoteForm={closeQuoteForm}
        onStartQuoteEditing={startQuoteEditing}
        onConfirmQuote={confirmQuote}
        onRejectQuote={rejectQuote}
        onOpenOrder={orderId => navigate(`/orders?orderId=${orderId}`)}
        onQuoteFormChange={setQuoteForm}
        onSubmitQuote={createQuote}
      />

      <ConversationThread
        messages={messages}
        conversation={conversation}
        currentUser={currentUser}
        content={content}
        loading={loading}
        imageSending={imageSending}
        canSeeQuoteEntry={canSeeQuoteEntry}
        canCreateQuote={canCreateQuote}
        showQuoteForm={showQuoteForm}
        editingQuotationId={editingQuotationId}
        onOpenQuoteForm={openQuoteForm}
        onContentChange={setContent}
        onSendMessage={sendMessage}
        onChooseMessageImage={chooseMessageImage}
        onSaveSubmittedPhoto={saveSubmittedPhoto}
      />
    </Stack>
  )
}
