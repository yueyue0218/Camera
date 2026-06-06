import { useEffect, useRef } from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import { ConversationComposer } from './ConversationComposer.jsx'
import { ConversationSystemItem } from './ConversationSystemCard.jsx'
import { MessageBubble } from './MessageBubble.jsx'
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
  quoteEntryHint,
  quoteActionLabel,
  onOpenQuoteForm,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onOpenQuoteDetail,
  onOpenOrderArchive,
  onOpenDeliveryGallery,
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
  const resolveActorDisplay = actor => {
    if (!actor) return null
    const actorUserId = Number(actor.userId)
    const mine = actorUserId && actorUserId === currentUserId
    const other = actorUserId && Number(counterparty.userId) === actorUserId
    return {
      ...actor,
      avatarData: mine ? currentUser?.avatarData : other ? counterparty.avatarData : '',
      avatarText: mine
        ? String(currentUser?.nickname || '我').slice(0, 1)
        : other ? counterparty.initial : actor.avatarText,
      displayName: mine ? currentUser?.nickname || actor.displayName : other ? counterparty.nickname : actor.displayName
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
        bgcolor: PORTRA_COLORS.paperSoft,
        borderColor: PORTRA_COLORS.borderMuted,
        borderRadius: PORTRA_RADII.panel,
        overflow: 'hidden',
        boxShadow: PORTRA_SHADOWS.subtle,
        backgroundImage: `linear-gradient(180deg, ${PORTRA_COLORS.paperSoft} 0%, ${PORTRA_COLORS.page} 100%)`
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
          px: { xs: 1.45, md: 2.35 },
          py: { xs: 1.8, md: 2.35 },
          scrollbarColor: `${PORTRA_COLORS.border} transparent`
        }}
      >
        <Stack spacing={1.55}>
          {safeTimeline.filter(Boolean).map(item => {
            if (item.type !== 'MESSAGE') {
              return (
                <ConversationSystemItem
                  key={item.key}
                  event={item}
                  actor={resolveActorDisplay(item.actor)}
                  actions={actions}
                  loading={loading}
                  onStartQuoteEditing={onStartQuoteEditing}
                  onConfirmQuote={onConfirmQuote}
                  onRejectQuote={onRejectQuote}
                  onOpenQuoteDetail={onOpenQuoteDetail}
                  onPayOrder={onPayOrder}
                  onCancelOrder={onCancelOrder}
                  onConfirmOrder={onConfirmOrder}
                  onOpenDeliveryGallery={onOpenDeliveryGallery}
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
                key={message.messageId || item.key}
                message={message}
                mine={mine}
                actor={resolveActorDisplay(item.actor)}
                canSaveSubmittedPhoto={canSaveSubmittedPhoto}
                onSaveSubmittedPhoto={() => onSaveSubmittedPhoto(message)}
              />
            )
          })}
          {!safeTimeline.length && (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography fontWeight={900} color={PORTRA_COLORS.subInk}>从一句问候开始本次合作</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>可以先确认拍摄时间、地点和成片要求</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Box data-message-composer="true" sx={{ flexShrink: 0, bgcolor: PORTRA_COLORS.paper }}>
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
          orderId={order?.orderId}
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
