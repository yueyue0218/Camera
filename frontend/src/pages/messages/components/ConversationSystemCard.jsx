import { Box, Chip, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import UploadRoundedIcon from '@mui/icons-material/UploadRounded'
import { centToYuan } from '../../../utils/index.js'
import { formatFileDisplayName, formatQuoteServiceContent } from '../../../utils/displayFormatters.js'
import { buildOrderAction } from '../../../utils/orderNavigation.js'
import { PortraActionLink, PortraPrimaryAction, PortraSecondaryAction, PortraStatusPill, PortraSystemNotice } from '../../../components/portra/index.js'
import { PHOTO_AUTHORIZATION_STATUS_LABELS } from '../../orders/orderActions.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'
import { EventAttachmentCard } from './EventAttachmentCard.jsx'
import { DeliveryBatchCard } from '../../deliveries/components/DeliveryBatchCard.jsx'
import { buildDeliveryBatches } from '../../deliveries/deliveryDisplay.js'

export function ConversationSystemItem({
  event,
  actor,
  loading,
  actions,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onOpenQuoteDetail,
  onOpenOrderArchive,
  onPayOrder,
  onCancelOrder,
  onConfirmOrder,
  onOpenDeliveryGallery,
  onOpenAction,
  onDecidePhotoAuthorization,
  onUnavailableTool
}) {
  if (!event) return null
  const actionState = actions || {}
  const eventActions = Array.isArray(event.actions) ? event.actions : []
  const eventMeta = event.meta || {}
  const quote = eventMeta.quote
  const order = eventMeta.order
  const authorization = eventMeta.authorization
  const delivery = eventMeta.delivery
  const orderAction = buildOrderAction(order)
  const renderActionButton = action => (
    <EventActionButton
      key={action}
      action={action}
      quote={quote}
      order={order}
      authorization={authorization}
      cancelAction={actionState.cancelAction}
      loading={loading}
      onStartQuoteEditing={onStartQuoteEditing}
      onConfirmQuote={onConfirmQuote}
      onRejectQuote={onRejectQuote}
      onOpenOrderArchive={onOpenOrderArchive}
      onPayOrder={onPayOrder}
      onCancelOrder={onCancelOrder}
      onConfirmOrder={onConfirmOrder}
      onOpenAction={onOpenAction}
      onDecidePhotoAuthorization={onDecidePhotoAuthorization}
      onUnavailableTool={onUnavailableTool}
    />
  )
  const actionButtons = !!eventActions.length && (
    <Stack direction="row" spacing={0.7} sx={{ flexWrap: 'wrap', rowGap: 0.7 }}>
      {eventActions.map(renderActionButton)}
    </Stack>
  )
  const quoteAction = quote && (
    <PortraActionLink startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenQuoteDetail(quote)}>
      查看报价详情
    </PortraActionLink>
  )

  if (event.actorRole === 'PLATFORM') {
    const noticeText = getSafeDisplayText(event.summary || event.title, '合作进展已更新')
    return (
      <Box id={event.type === 'AUTHORIZATION' ? 'conversation-authorization-action' : undefined}>
        <PortraSystemNotice
          time={formatTime(event.timestamp)}
          action={(
            <>
              {orderAction && (
                <PortraActionLink onClick={() => onOpenOrderArchive(orderAction.orderId)} sx={stripActionSx}>
                  {orderAction.label}
                </PortraActionLink>
              )}
              {eventActions.includes('PAY') && (
                <PortraActionLink onClick={onPayOrder} disabled={loading} sx={stripActionSx}>
                  去支付
                </PortraActionLink>
              )}
            </>
          )}
        >
          {noticeText}
        </PortraSystemNotice>
      </Box>
    )
  }

  return (
    <Box id={event.type === 'AUTHORIZATION' ? 'conversation-authorization-action' : undefined}>
      <EventAttachmentCard
        side={event.side}
        actor={actor || event.actor}
        title={getSafeDisplayText(event.title, '合作进展已更新')}
        summary={getSafeDisplayText(event.summary, '')}
        timestamp={formatTime(event.timestamp)}
        actions={quote ? quoteAction : actionButtons}
      >
        {quote && <QuoteMeta quote={quote} />}
        {event.type === 'ORDER_CREATED' && eventMeta.order && <OrderMeta order={eventMeta.order} />}
        {event.type === 'DELIVERY' && delivery && (
          <DeliveryMeta
            event={event}
            onOpenDeliveryGallery={onOpenDeliveryGallery}
          />
        )}
        {authorization && <AuthorizationMeta authorization={authorization} />}
      </EventAttachmentCard>
    </Box>
  )
}

function EventActionButton({
  action,
  quote,
  order,
  authorization,
  cancelAction,
  loading,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onOpenOrderArchive,
  onPayOrder,
  onCancelOrder,
  onConfirmOrder,
  onOpenAction,
  onDecidePhotoAuthorization,
  onUnavailableTool
}) {
  const common = { size: 'small', disabled: loading }
  if (action === 'EDIT_QUOTE' && quote && typeof onStartQuoteEditing === 'function') return <PortraSecondaryAction {...common} startIcon={<LocalOfferRoundedIcon />} onClick={() => onStartQuoteEditing(quote)}>编辑报价</PortraSecondaryAction>
  if (action === 'CONFIRM_QUOTE' && quote && typeof onConfirmQuote === 'function') return <PortraPrimaryAction {...common} onClick={() => onConfirmQuote(quote)}>确认报价</PortraPrimaryAction>
  if (action === 'REJECT_QUOTE' && quote && typeof onRejectQuote === 'function') return <PortraSecondaryAction {...common} onClick={() => onRejectQuote(quote)}>拒绝报价</PortraSecondaryAction>
  if (action === 'PAY' && typeof onPayOrder === 'function') return <PortraPrimaryAction {...common} startIcon={<PaidRoundedIcon />} onClick={onPayOrder}>去支付</PortraPrimaryAction>
  if (action === 'CANCEL' && cancelAction && typeof onCancelOrder === 'function') return <PortraSecondaryAction {...common} onClick={() => onCancelOrder(cancelAction)} sx={{ color: PORTRA_COLORS.orange, borderColor: PORTRA_COLORS.orange }}>{cancelAction?.label || '取消订单'}</PortraSecondaryAction>
  if (action === 'CONFIRM_DELIVERY' && typeof onConfirmOrder === 'function') return <PortraPrimaryAction {...common} startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder}>确认接收</PortraPrimaryAction>
  if (action === 'REQUEST_REWORK' && typeof onOpenAction === 'function') return <PortraSecondaryAction {...common} startIcon={<RefreshRoundedIcon />} onClick={() => onOpenAction('REQUEST_REWORK')}>提交返修</PortraSecondaryAction>
  if (action === 'UPLOAD_DELIVERY' || action === 'REUPLOAD_DELIVERY') {
    if (typeof onOpenAction !== 'function') return null
    return <PortraPrimaryAction {...common} startIcon={<UploadRoundedIcon />} onClick={() => onOpenAction(action)}>{action === 'REUPLOAD_DELIVERY' ? '重新上传作品' : '上传作品'}</PortraPrimaryAction>
  }
  if (action === 'REQUEST_AUTHORIZATION' && typeof onOpenAction === 'function') return <PortraSecondaryAction {...common} onClick={() => onOpenAction('REQUEST_AUTHORIZATION')}>申请展示授权</PortraSecondaryAction>
  if (action === 'APPROVE_AUTHORIZATION' && authorization && typeof onDecidePhotoAuthorization === 'function') return <PortraPrimaryAction {...common} startIcon={<CheckCircleRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'approve')}>同意展示</PortraPrimaryAction>
  if (action === 'REJECT_AUTHORIZATION' && authorization && typeof onDecidePhotoAuthorization === 'function') return <PortraSecondaryAction {...common} startIcon={<CloseRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'reject')}>拒绝展示</PortraSecondaryAction>
  if (action === 'PLATFORM_ASSISTANCE' && typeof onUnavailableTool === 'function') return <PortraActionLink {...common} onClick={() => onUnavailableTool('平台协助')}>申请平台协助</PortraActionLink>
  const orderAction = buildOrderAction(order, { label: '查看订单' })
  if (action === 'VIEW_DISPUTE' && orderAction && typeof onOpenOrderArchive === 'function') return <PortraActionLink {...common} startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenOrderArchive(orderAction.orderId)}>{orderAction.label}</PortraActionLink>
  if (action === 'OPEN_ORDER' && orderAction && typeof onOpenOrderArchive === 'function') return <PortraActionLink {...common} startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenOrderArchive(orderAction.orderId)}>{orderAction.label}</PortraActionLink>
  return null
}

function QuoteMeta({ quote }) {
  return (
    <Stack spacing={0.6} sx={attachmentMetaSx}>
      <Typography variant="body2" sx={{ color: PORTRA_COLORS.subInk, fontWeight: 800 }}>
        {centToYuan(quote.amountCent)} · {formatTime(quote.shootStartTime)} · {getSafeDisplayText(quote.location, '拍摄地点待确认')}
      </Typography>
      <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk }}>
        {formatQuoteServiceContent(quote, '按双方沟通内容执行')}
      </Typography>
      <Stack direction="row" spacing={0.6} sx={{ flexWrap: 'wrap' }}>
        <PortraStatusPill label={getQuoteStatusLabel(quote.status)} />
      </Stack>
    </Stack>
  )
}

function OrderMeta({ order }) {
  return <Typography variant="body2" sx={attachmentMetaSx}>{centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)}</Typography>
}

function DeliveryMeta({ event, onOpenDeliveryGallery }) {
  const delivery = event?.meta?.delivery
  if (!delivery) return null
  const batch = buildDeliveryBatches([delivery], event?.meta?.order)[0]
  return (
    <Stack spacing={0.4} sx={attachmentMetaSx}>
      <DeliveryBatchCard
        batch={{
          ...batch,
          fileCount: event.meta?.deliveryCount || batch.fileCount
        }}
        variant="message"
        chrome="none"
        onOpen={() => onOpenDeliveryGallery?.(delivery)}
        disabled={!batch?.orderId || !batch?.deliveryId}
      />
    </Stack>
  )
}

function AuthorizationMeta({ authorization }) {
  if (!authorization) return null
  return (
    <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
      <PortraStatusPill label={PHOTO_AUTHORIZATION_STATUS_LABELS[authorization.status] || '授权状态已更新'} />
      {(authorization.files || []).map(file => <Chip key={file.id || file.fileId} size="small" label={formatFileDisplayName(file, '已选作品文件')} sx={metaChipSx} />)}
    </Stack>
  )
}

const metaChipSx = {
  height: 24,
  borderRadius: PORTRA_RADII.compact,
  bgcolor: PORTRA_COLORS.paperMuted,
  border: `1px solid ${PORTRA_COLORS.borderMuted}`,
  color: PORTRA_COLORS.mutedInk,
  fontWeight: 700
}

const attachmentMetaSx = {
  px: 0,
  py: 0.15,
  color: PORTRA_COLORS.subInk,
  bgcolor: 'transparent',
  border: 0,
  borderRadius: 0
}

const stripActionSx = {
  minWidth: 0,
  px: 0.35,
  py: 0,
  fontSize: 12,
  fontWeight: 900,
  color: PORTRA_COLORS.blue
}
