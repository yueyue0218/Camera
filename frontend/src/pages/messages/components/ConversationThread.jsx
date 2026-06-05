import { useEffect, useMemo, useRef } from 'react'
import { Alert, Box, Divider, Paper, Stack, Typography } from '@mui/material'
import { ConversationComposer } from './ConversationComposer.jsx'
import { ConversationSystemItem } from './ConversationSystemCard.jsx'
import { MessageBubble } from './MessageBubble.jsx'
import { QuoteForm } from './QuoteForm.jsx'
import { MessageWorkbenchErrorBoundary } from './MessageWorkbenchErrorBoundary.jsx'
import { getCounterpartyProfile } from '../utils/conversationUtils.js'
import { buildConversationTimeline, getCurrentUserId } from '../utils/workbenchState.js'
import { PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'

export function ConversationThread({
  messages,
  conversation,
  currentUser,
  quotes,
  order,
  actions,
  statusLogs,
  deliveryRecords,
  photoAuthorizations,
  content,
  loading,
  imageSending,
  canSeeQuoteEntry,
  canCreateQuote,
  showQuoteForm,
  editingQuotationId,
  quoteEntryHint,
  quoteForm,
  quoteValidationErrors,
  canSubmitQuoteForm,
  onOpenQuoteForm,
  onCloseQuoteForm,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onOpenQuoteDetail,
  onOpenOrderArchive,
  onQuoteFormChange,
  onSubmitQuote,
  onContentChange,
  onSendMessage,
  onChooseMessageImage,
  onSaveSubmittedPhoto,
  onPayOrder,
  onCancelOrder,
  onConfirmOrder,
  onDecidePhotoAuthorization,
  onUnavailableTool,
  onOpenAction
}) {
  const scrollRef = useRef(null)
  const currentUserId = getCurrentUserId(currentUser)
  const counterparty = getCounterpartyProfile(conversation, currentUser)
  const timeline = useMemo(() => buildConversationTimeline({
    messages,
    quotes,
    order,
    statusLogs,
    deliveries: deliveryRecords,
    authorizations: photoAuthorizations,
    actions,
    conversation,
    currentUser
  }), [messages, quotes, order, statusLogs, deliveryRecords, photoAuthorizations, actions, conversation, currentUser])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [conversation?.conversationId, timeline.length, timeline[timeline.length - 1]?.key])

  return (
    <MessageWorkbenchErrorBoundary resetKey={`${conversation?.conversationId || 'none'}-${currentUser?.role || 'role'}`}>
    <Paper
      variant="outlined"
      sx={{
        height: { xs: 'calc(100vh - 150px)', lg: 'calc(100vh - 148px)' },
        minHeight: 560,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: PORTRA_COLORS.page,
        borderColor: PORTRA_COLORS.borderMuted,
        borderRadius: PORTRA_RADII.panel,
        overflow: 'hidden',
        boxShadow: PORTRA_SHADOWS.subtle
      }}
    >
      <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 1.4, md: 2.2 }, py: { xs: 1.8, md: 2.4 }, scrollbarColor: `${PORTRA_COLORS.border} transparent` }}>
        <Stack spacing={1.5}>
          {(Array.isArray(timeline) ? timeline : []).filter(Boolean).map(item => {
            if (item.type !== 'MESSAGE') {
              return (
                <ConversationSystemItem
                  key={item.key}
                  event={item}
                  actions={actions}
                  loading={loading}
                  onStartQuoteEditing={onStartQuoteEditing}
                  onConfirmQuote={onConfirmQuote}
                  onRejectQuote={onRejectQuote}
                  onOpenQuoteDetail={onOpenQuoteDetail}
                  onPayOrder={onPayOrder}
                  onCancelOrder={onCancelOrder}
                  onConfirmOrder={onConfirmOrder}
                  onDecidePhotoAuthorization={onDecidePhotoAuthorization}
                  onUnavailableTool={onUnavailableTool}
                  onOpenAction={onOpenAction}
                  onOpenOrderArchive={onOpenOrderArchive}
                />
              )
            }
            const message = item.meta?.message
            if (!message) return null
            const mine = Number(message.senderId) === currentUserId
            const isImage = message.messageType === 'IMAGE'
            const canSaveSubmittedPhoto = isImage && Number(message.senderId) === Number(conversation?.participantBId)
            return (
              <MessageBubble
                key={message.messageId}
                message={message}
                mine={mine}
                avatar={mine ? currentUser?.avatarData : counterparty.avatarData}
                avatarText={mine ? (currentUser?.nickname || '我').slice(0, 1) : counterparty.initial}
                canSaveSubmittedPhoto={canSaveSubmittedPhoto}
                onSaveSubmittedPhoto={() => onSaveSubmittedPhoto(message)}
              />
            )
          })}
          {!timeline.length && (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography fontWeight={900} color={PORTRA_COLORS.subInk}>从一句问候开始本次合作</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>可以先确认拍摄时间、地点和交付要求</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {showQuoteForm && canSeeQuoteEntry && (
        <Box sx={{ px: { xs: 1.4, md: 2 }, pb: 1.5 }}>
          <QuoteForm
            quoteForm={quoteForm}
            onQuoteFormChange={onQuoteFormChange}
            onSubmit={onSubmitQuote}
            onClose={onCloseQuoteForm}
            editingQuotationId={editingQuotationId}
            quoteValidationErrors={quoteValidationErrors}
            loading={loading}
            canSubmitQuoteForm={canSubmitQuoteForm}
          />
        </Box>
      )}

      {quoteEntryHint && canSeeQuoteEntry && !showQuoteForm && (
        <Box sx={{ px: { xs: 1.4, md: 2 }, pb: 1 }}>
          <Alert severity={canCreateQuote ? 'info' : 'warning'}>{quoteEntryHint}</Alert>
        </Box>
      )}

      <Divider sx={{ borderColor: PORTRA_COLORS.borderMuted }} />
      <ConversationComposer
        content={content}
        loading={loading}
        imageSending={imageSending}
        canSeeQuoteEntry={canSeeQuoteEntry}
        canCreateQuote={canCreateQuote}
        showQuoteForm={showQuoteForm}
        actions={actions}
        onOpenQuoteForm={onOpenQuoteForm}
        onStartQuoteEditing={onStartQuoteEditing}
        onConfirmQuote={onConfirmQuote}
        onRejectQuote={onRejectQuote}
        onOpenQuoteDetail={onOpenQuoteDetail}
        onPayOrder={onPayOrder}
        onCancelOrder={onCancelOrder}
        onConfirmOrder={onConfirmOrder}
        onOpenOrderArchive={onOpenOrderArchive}
        onContentChange={onContentChange}
        onSendMessage={onSendMessage}
        onChooseMessageImage={onChooseMessageImage}
        onUnavailableTool={onUnavailableTool}
        onOpenAction={onOpenAction}
      />
    </Paper>
    </MessageWorkbenchErrorBoundary>
  )
}
