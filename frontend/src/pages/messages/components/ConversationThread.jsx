import { useEffect, useRef } from 'react'
import { Box, Divider, Paper, Stack, Typography } from '@mui/material'
import { ConversationComposer } from './ConversationComposer.jsx'
import { ConversationSystemItem } from './ConversationSystemCard.jsx'
import { MessageBubble } from './MessageBubble.jsx'
import { QuoteForm } from './QuoteForm.jsx'
import { MessageWorkbenchErrorBoundary } from './MessageWorkbenchErrorBoundary.jsx'
import { getCounterpartyProfile } from '../utils/conversationUtils.js'
import { getCurrentUserId } from '../utils/workbenchState.js'
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
  timeline = [],
  content,
  loading,
  imageSending,
  canSeeQuoteEntry,
  canCreateQuote,
  showQuoteForm,
  editingQuotationId,
  quoteEntryHint,
  quoteActionLabel,
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
  onOpenUserProfile,
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
  const safeTimeline = Array.isArray(timeline) ? timeline : []
  const resolveEventActor = event => {
    if (!event?.actor) return null
    const actorUserId = Number(event.actor.userId)
    const mine = actorUserId && actorUserId === currentUserId
    const other = actorUserId && Number(counterparty.userId) === actorUserId
    return {
      ...event.actor,
      avatarData: mine ? currentUser?.avatarData : other ? counterparty.avatarData : '',
      avatarText: mine
        ? String(currentUser?.nickname || '我').slice(0, 1)
        : other ? counterparty.initial : event.actor.avatarText,
      displayName: mine ? currentUser?.nickname || event.actor.displayName : other ? counterparty.nickname : event.actor.displayName
    }
  }

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [conversation?.conversationId, safeTimeline.length, safeTimeline[safeTimeline.length - 1]?.key])

  return (
    <MessageWorkbenchErrorBoundary resetKey={`${conversation?.conversationId || 'none'}-${currentUser?.role || 'role'}`}>
    <Paper
      data-message-thread="true"
      variant="outlined"
      sx={{
        height: '100%',
        width: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: PORTRA_COLORS.page,
        borderColor: PORTRA_COLORS.borderMuted,
        borderRadius: PORTRA_RADII.panel,
        overflow: 'hidden',
        boxShadow: PORTRA_SHADOWS.subtle
      }}
    >
      <Box
        data-message-scroll="true"
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          px: { xs: 1.4, md: 2.2 },
          py: { xs: 1.8, md: 2.4 },
          scrollbarColor: `${PORTRA_COLORS.border} transparent`
        }}
      >
        <Stack spacing={1.5}>
          {safeTimeline.filter(Boolean).map(item => {
            if (item.type !== 'MESSAGE') {
              return (
                <ConversationSystemItem
                  key={item.key}
                  event={item}
                  actor={resolveEventActor(item)}
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
                  onOpenUserProfile={onOpenUserProfile}
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
                key={message.messageId || item.key}
                message={message}
                mine={mine}
                avatar={mine ? currentUser?.avatarData : counterparty.avatarData}
                avatarText={mine ? (currentUser?.nickname || '我').slice(0, 1) : counterparty.initial}
                avatarUserId={mine ? currentUserId : counterparty.userId}
                canSaveSubmittedPhoto={canSaveSubmittedPhoto}
                onSaveSubmittedPhoto={() => onSaveSubmittedPhoto(message)}
                onOpenUserProfile={onOpenUserProfile}
              />
            )
          })}
          {!safeTimeline.length && (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography fontWeight={900} color={PORTRA_COLORS.subInk}>从一句问候开始本次合作</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>可以先确认拍摄时间、地点和交付要求</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Box data-message-composer="true" sx={{ flexShrink: 0, bgcolor: PORTRA_COLORS.paper }}>
        {showQuoteForm && canSeeQuoteEntry && (
          <Box sx={{ px: { xs: 1.4, md: 2 }, pt: 1.2, pb: 1.5, maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain' }}>
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

        <Divider sx={{ borderColor: PORTRA_COLORS.borderMuted }} />
        <ConversationComposer
          content={content}
          loading={loading}
          imageSending={imageSending}
          canSeeQuoteEntry={canSeeQuoteEntry}
          canCreateQuote={canCreateQuote}
          showQuoteForm={showQuoteForm}
          quoteActionLabel={quoteActionLabel}
          quoteEntryHint={quoteEntryHint && canSeeQuoteEntry && !showQuoteForm ? quoteEntryHint : ''}
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
      </Box>
    </Paper>
    </MessageWorkbenchErrorBoundary>
  )
}
