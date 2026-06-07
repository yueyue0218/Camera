import { useEffect, useRef, useState } from 'react'
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { ConversationComposer } from './ConversationComposer.jsx'
import { ConversationSystemItem } from './ConversationSystemCard.jsx'
import { MessageBubble } from './MessageBubble.jsx'
import { MessageWorkbenchErrorBoundary } from './MessageWorkbenchErrorBoundary.jsx'
import { getCurrentUserId } from '../utils/workbenchState.js'
import { getMessageDirection } from '../utils/messageDirection.js'
import { mergeActorDisplay } from '../utils/participantResolver.js'
import { PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'

export function ConversationThread({
  messages,
  conversation,
  currentUser,
  participants,
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
  onOpenAction,
  initialScrollTop,
  onScrollPositionChange
}) {
  const scrollRef = useRef(null)
  const stickToBottomRef = useRef(true)
  const lastTimelineKeyRef = useRef('')
  const lastConversationIdRef = useRef('')
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const currentUserId = getCurrentUserId(currentUser)
  const safeTimeline = Array.isArray(timeline) ? timeline : []
  const resolveActorDisplay = actor => {
    if (!actor) return null
    const actorUserId = Number(actor.userId)
    const merged = mergeActorDisplay(actor, participants)
    if (merged) return merged
    return actorUserId === currentUserId
      ? { ...actor, avatarData: currentUser?.avatarData || '', avatarText: String(currentUser?.nickname || '我').slice(0, 1), displayName: currentUser?.nickname || actor.displayName }
      : actor
  }

  const lastTimelineKey = safeTimeline[safeTimeline.length - 1]?.key || ''

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    if (Number.isFinite(initialScrollTop) && lastConversationIdRef.current === '') {
      node.scrollTop = initialScrollTop
      stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120
      lastConversationIdRef.current = String(conversation?.conversationId || 'none')
      return
    }
    const previousKey = lastTimelineKeyRef.current
    const currentConversationKey = String(conversation?.conversationId || 'none')
    const changedConversation = lastConversationIdRef.current !== currentConversationKey
    if (stickToBottomRef.current || changedConversation) {
      node.scrollTop = node.scrollHeight
      setHasNewMessages(false)
    } else if (lastTimelineKey && previousKey && lastTimelineKey !== previousKey) {
      setHasNewMessages(true)
    }
    lastConversationIdRef.current = currentConversationKey
    lastTimelineKeyRef.current = lastTimelineKey
  }, [conversation?.conversationId, safeTimeline.length, lastTimelineKey])

  useEffect(() => {
    stickToBottomRef.current = true
  }, [conversation?.conversationId])

  const updateStickToBottom = () => {
    const node = scrollRef.current
    if (!node) return
    stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120
    if (stickToBottomRef.current) setHasNewMessages(false)
    onScrollPositionChange?.(node.scrollTop)
  }

  const scrollToLatest = () => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    stickToBottomRef.current = true
    setHasNewMessages(false)
  }

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
        position: 'relative',
        backgroundImage: `linear-gradient(180deg, ${PORTRA_COLORS.paperSoft} 0%, ${PORTRA_COLORS.page} 100%)`
      }}
    >
      <Box
        data-message-scroll="true"
        ref={scrollRef}
        onScroll={updateStickToBottom}
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
          {loading && !safeTimeline.length && <MessageThreadSkeleton />}
          {safeTimeline.filter(Boolean).map(item => {
            const direction = getMessageDirection(item, currentUser)
            if (item.type !== 'MESSAGE') {
              return (
                <ConversationSystemItem
                  key={item.key}
                  event={item}
                  actor={resolveActorDisplay(item.actor)}
                  direction={direction}
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
            const mine = direction === 'self'
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
          {!loading && !safeTimeline.length && (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography fontWeight={900} color={PORTRA_COLORS.subInk}>从一句问候开始约拍沟通</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>可以先确认拍摄时间、地点和成片要求</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {hasNewMessages && (
        <Button
          size="small"
          variant="contained"
          onClick={scrollToLatest}
          sx={newMessagesButtonSx}
        >
          有新消息
        </Button>
      )}

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

function MessageThreadSkeleton() {
  return (
    <Stack spacing={1.35} aria-label="消息加载中">
      {[0, 1, 2, 3].map(index => {
        const mine = index % 2 === 1
        return (
          <Stack key={index} direction="row" spacing={1} sx={{ justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
            {!mine && <Skeleton variant="circular" width={34} height={34} />}
            <Skeleton
              variant="rounded"
              width={mine ? '42%' : '54%'}
              height={index === 2 ? 76 : 42}
              sx={{ borderRadius: PORTRA_RADII.control, bgcolor: 'rgba(21,19,24,.08)' }}
            />
            {mine && <Skeleton variant="circular" width={34} height={34} />}
          </Stack>
        )
      })}
    </Stack>
  )
}

const newMessagesButtonSx = {
  position: 'absolute',
  left: '50%',
  bottom: 92,
  transform: 'translateX(-50%)',
  zIndex: 3,
  minHeight: 30,
  px: 1.45,
  borderRadius: 999,
  bgcolor: PORTRA_COLORS.blue,
  color: PORTRA_COLORS.paper,
  boxShadow: '0 10px 22px rgba(13, 47, 178, 0.18)',
  '&:hover': { bgcolor: PORTRA_COLORS.blueDark }
}
