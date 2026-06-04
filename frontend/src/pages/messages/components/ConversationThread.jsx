import { Alert, Box, Divider, Paper, Stack, Typography } from '@mui/material'
import { canEditQuote } from '../utils/quoteUtils.js'
import { canCustomerConfirm, canCustomerPay, canCustomerRequestRework, canCustomerReviewPhotoAuthorization, canProviderRequestPhotoAuthorization, canProviderUploadDelivery } from '../../orders/orderActions.js'
import { ConversationComposer } from './ConversationComposer.jsx'
import { ConversationSystemCards } from './ConversationSystemCard.jsx'
import { MessageBubble } from './MessageBubble.jsx'
import { QuoteForm } from './QuoteForm.jsx'

function isBeforeShootStart(order) {
  const shootStartTime = order?.shootStartTime ? new Date(order.shootStartTime) : null
  return Boolean(shootStartTime) && !Number.isNaN(shootStartTime.getTime()) && new Date() < shootStartTime
}

function getCancelAction(order, currentUser) {
  if (!order || Number(order.customerId) !== Number(currentUser?.userId)) return null
  if (order.status === 'PENDING_PAYMENT') {
    return {
      label: '取消订单',
      confirmText: '确定取消这个待支付订单吗？该订单尚未支付，不涉及退款。',
      reason: '客户取消未支付订单'
    }
  }
  if (order.status === 'PAID_PENDING_SHOOT' && isBeforeShootStart(order)) {
    return {
      label: '取消并申请退款',
      confirmText: '确定取消订单并申请退款吗？平台托管资金将退回客户。',
      reason: '客户拍摄前取消，申请退回托管款'
    }
  }
  return null
}

function getPendingQuote(quotes) {
  return quotes.find(quote => quote.status === 'PENDING_CONFIRM')
}

export function ConversationThread({
  messages,
  conversation,
  currentUser,
  quotes,
  order,
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
  deliveryForm,
  reworkRequirement,
  photoAuthorizationForm,
  authorizationRemarks,
  onOpenQuoteForm,
  onCloseQuoteForm,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onOpenOrder,
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
  onSubmitRework,
  onReworkRequirementChange,
  onDeliveryFileChange,
  onDeliveryRemarkChange,
  onSubmitDelivery,
  onPhotoAuthorizationFileIdsChange,
  onPhotoAuthorizationRemarkChange,
  onSubmitPhotoAuthorization,
  onAuthorizationRemarkChange,
  onDecidePhotoAuthorization
}) {
  const pendingQuote = getPendingQuote(quotes)
  const cancelAction = getCancelAction(order, currentUser)
  const quickActions = {
    pendingQuote,
    canEditPendingQuote: pendingQuote && canEditQuote(pendingQuote, conversation, currentUser),
    canConfirmPendingQuote: pendingQuote
      && pendingQuote.status === 'PENDING_CONFIRM'
      && Number(currentUser.userId) === Number(conversation?.participantAId),
    canPay: order && canCustomerPay(order, currentUser),
    canCancel: Boolean(cancelAction),
    cancelAction,
    canUploadDelivery: order && canProviderUploadDelivery(order, currentUser),
    canRequestRework: order && canCustomerRequestRework(order, currentUser),
    canConfirmOrder: order && canCustomerConfirm(order, currentUser),
    canRequestPhotoAuthorization: order && canProviderRequestPhotoAuthorization(order, currentUser),
    hasPendingAuthorization: photoAuthorizations.some(authorization => canCustomerReviewPhotoAuthorization(order, currentUser, authorization)),
    canOpenOrder: Boolean(order)
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        minHeight: { xs: 'auto', lg: 'calc(100vh - 170px)' },
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#f8f3eb',
        borderColor: '#d4ccc2',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.4, md: 2 }, py: { xs: 1.4, md: 2 } }}>
        <Stack spacing={1.2}>
          {messages.map(message => {
            const mine = message.senderId === currentUser.userId
            const isImage = message.messageType === 'IMAGE'
            const canSaveSubmittedPhoto = isImage && Number(message.senderId) === Number(conversation?.participantBId)
            return (
              <MessageBubble
                key={message.messageId}
                message={message}
                mine={mine}
                canSaveSubmittedPhoto={canSaveSubmittedPhoto}
                onSaveSubmittedPhoto={() => onSaveSubmittedPhoto(message)}
              />
            )
          })}
          {!messages.length && <Typography color="text.secondary">还没有消息，可以先和对方确认拍摄时间、地点和交付要求。</Typography>}

          <ConversationSystemCards
            conversation={conversation}
            currentUser={currentUser}
            quotes={quotes}
            order={order}
            statusLogs={statusLogs}
            deliveryRecords={deliveryRecords}
            photoAuthorizations={photoAuthorizations}
            deliveryForm={deliveryForm}
            reworkRequirement={reworkRequirement}
            photoAuthorizationForm={photoAuthorizationForm}
            authorizationRemarks={authorizationRemarks}
            loading={loading}
            cancelAction={cancelAction}
            onStartQuoteEditing={onStartQuoteEditing}
            onConfirmQuote={onConfirmQuote}
            onRejectQuote={onRejectQuote}
            onOpenOrder={onOpenOrder}
            onPayOrder={onPayOrder}
            onCancelOrder={onCancelOrder}
            onConfirmOrder={onConfirmOrder}
            onSubmitRework={onSubmitRework}
            onReworkRequirementChange={onReworkRequirementChange}
            onDeliveryFileChange={onDeliveryFileChange}
            onDeliveryRemarkChange={onDeliveryRemarkChange}
            onSubmitDelivery={onSubmitDelivery}
            onPhotoAuthorizationFileIdsChange={onPhotoAuthorizationFileIdsChange}
            onPhotoAuthorizationRemarkChange={onPhotoAuthorizationRemarkChange}
            onSubmitPhotoAuthorization={onSubmitPhotoAuthorization}
            onAuthorizationRemarkChange={onAuthorizationRemarkChange}
            onDecidePhotoAuthorization={onDecidePhotoAuthorization}
          />
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

      <Divider />
      <ConversationComposer
        content={content}
        loading={loading}
        imageSending={imageSending}
        canSeeQuoteEntry={canSeeQuoteEntry}
        canCreateQuote={canCreateQuote}
        showQuoteForm={showQuoteForm}
        quickActions={quickActions}
        onOpenQuoteForm={onOpenQuoteForm}
        onStartQuoteEditing={onStartQuoteEditing}
        onConfirmQuote={onConfirmQuote}
        onRejectQuote={onRejectQuote}
        onPayOrder={onPayOrder}
        onCancelOrder={onCancelOrder}
        onConfirmOrder={onConfirmOrder}
        onOpenOrderArchive={onOpenOrderArchive}
        onContentChange={onContentChange}
        onSendMessage={onSendMessage}
        onChooseMessageImage={onChooseMessageImage}
      />
    </Paper>
  )
}
