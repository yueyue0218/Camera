import { useEffect } from 'react'
import { Alert, Avatar, Box, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { conversationApi } from '../../api.js'
import { useWorkflowNavigate } from '../../hooks/useWorkflowNavigate.js'
import { mergeWorkflowViewState } from '../../utils/workflowViewCache.js'
import { ConversationThread } from './components/ConversationThread.jsx'
import { ConversationWorkbenchPanel } from './components/ConversationWorkbenchPanel.jsx'
import { ConversationActionDialogs } from './components/ConversationActionDialogs.jsx'
import { QuoteDraftDialog } from './components/QuoteDraftDialog.jsx'
import { MessageWorkbenchErrorBoundary } from './components/MessageWorkbenchErrorBoundary.jsx'
import { useConversationRealtime } from './hooks/useConversationRealtime.js'
import { useConversationData } from './hooks/useConversationData.js'
import { useMessageSending } from './hooks/useMessageSending.js'
import { useConversationDrafts } from './hooks/useConversationDrafts.js'
import { useConversationActions } from './hooks/useConversationActions.js'
import { OrderCompletionDialog, PortraActionLink, PortraStatusPill, PortraWorkbenchFrame, PortraWorkflowFrame, usePortraFeedback } from '../../components/portra/index.js'
import { PORTRA_LAYOUT } from '../../theme/portraSurfaceTokens.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from './MessageVisualTokens.js'
import { getOppositeUserId } from './utils/conversationUtils.js'
import {
  getCurrentUserId,
  getUserRoleInConversation
} from './utils/workbenchState.js'
import { buildConversationDetailViewModel } from './utils/conversationViewModel.js'

const DETAIL_SHELL_HEIGHT = {
  xs: 'calc(100dvh - 212px)',
  md: 'calc(100dvh - 154px)'
}

export function ConversationDetailPage() {
  const { conversationId } = useParams()
  const navigate = useWorkflowNavigate()
  const rawNavigate = useNavigate()
  const { currentUser, switchRole } = useAuth()
  const feedback = usePortraFeedback()
  const {
    conversation,
    messages,
    setMessages,
    quotes,
    currentOrder,
    statusLogs,
    deliveryRecords,
    photoAuthorizations,
    notice,
    setNotice,
    setPageLoading,
    loading,
    viewCacheKey,
    cachedViewState,
    participantModel,
    run,
    loadConversationData,
    refreshConversationData,
    refreshConversationMessages
  } = useConversationData({ conversationId, currentUser })
  const {
    content,
    setContent,
    pendingAttachment,
    messageSending,
    chooseMessageAttachment,
    removePendingAttachment,
    sendMessage,
    retryMessage,
    downloadMessageAttachment,
    releaseMessageLocalPreview
  } = useMessageSending({
    conversation,
    currentUser,
    messages,
    setMessages,
    feedback
  })
  const {
    deliveryDraft,
    reworkDraft,
    photoAuthorizationDraft,
    authorizationRemarkDraft,
    deliveryForm,
    setDeliveryForm,
    reworkRequirement,
    setReworkRequirement,
    photoAuthorizationForm,
    setPhotoAuthorizationForm,
    authorizationRemarks,
    setAuthorizationRemarks
  } = useConversationDrafts({
    conversationId,
    orderId: currentOrder?.orderId
  })
  const {
    quoteForm,
    showQuoteForm,
    editingQuotationId,
    quoteValidationErrors,
    quoteFieldErrors,
    activeAction,
    setActiveAction,
    activeQuote,
    paymentMethod,
    setPaymentMethod,
    completionDialogOpen,
    setCompletionDialogOpen,
    createQuote,
    startQuoteEditing,
    closeQuoteForm,
    updateQuoteForm,
    openQuoteForm,
    resendQuote,
    confirmQuote,
    rejectQuote,
    confirmQuoteFromDialog,
    rejectQuoteFromDialog,
    cancelCurrentOrder,
    confirmCurrentOrder,
    submitDelivery,
    submitRework,
    submitPhotoAuthorizationRequest,
    handlePhotoAuthorizationDecision,
    openPaymentDialog,
    confirmPaymentFromDialog,
    showUnavailableTool,
    openQuoteDetail,
    openUserProfile,
    openOrderArchive,
    openDeliveryGallery,
    closeActionDialogs
  } = useConversationActions({
    conversationId,
    conversation,
    currentUser,
    currentOrder,
    quotes,
    deliveryForm,
    reworkRequirement,
    photoAuthorizationForm,
    authorizationRemarks,
    deliveryDraft,
    reworkDraft,
    photoAuthorizationDraft,
    authorizationRemarkDraft,
    feedback,
    run,
    loadConversationData,
    refreshConversationData,
    setNotice,
    setPageLoading,
    navigate,
    rawNavigate,
    loading
  })

  const currentUserId = getCurrentUserId(currentUser)
  const counterparty = participantModel
  const viewModel = buildConversationDetailViewModel({
    conversation,
    currentUser,
    messages,
    quotes,
    currentOrder,
    statusLogs,
    deliveryRecords,
    photoAuthorizations,
    activeQuote,
    editingQuotationId,
    showQuoteForm
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

    const backendConversationId = !String(conversationId || '').startsWith('local-')
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
    if (conversation && actions.roleMismatch) {
      const correctRole = getUserRoleInConversation(conversation, currentUser)
      if (correctRole) {
        switchRole(correctRole)
      } else {
        navigate('/messages', { replace: true, state: { roleMismatch: true } })
      }
    }
  }, [actions.roleMismatch, conversation, currentUser, navigate, switchRole])
  const {
    canCreateQuote,
    canSubmitQuoteForm,
    canSeeQuoteEntry,
    quoteEntryHint,
    activeQuoteCanConfirm,
    activeQuoteCanReject,
    activeQuoteCanResend
  } = viewModel

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

const noticeSx = {
  py: 0.25,
  borderRadius: PORTRA_RADII.control,
  border: `1px solid ${PORTRA_COLORS.borderMuted}`,
  bgcolor: PORTRA_COLORS.paper,
  '& .MuiAlert-message': { py: 0.45 }
}
