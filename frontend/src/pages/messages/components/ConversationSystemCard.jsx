import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import UploadRoundedIcon from '@mui/icons-material/UploadRounded'
import { centToYuan } from '../../../utils/index.js'
import { buildOrderAction } from '../../../utils/orderNavigation.js'
import { PortraStatusBadge } from '../../../components/portra/index.js'
import { PHOTO_AUTHORIZATION_STATUS_LABELS } from '../../orders/orderActions.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'
import { EventAttachmentCard } from './EventAttachmentCard.jsx'

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
    <Button size="small" variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenQuoteDetail(quote)}>
      查看报价详情
    </Button>
  )

  if (event.actorRole === 'PLATFORM') {
    const noticeText = getSafeDisplayText(event.summary || event.title, '合作进展已更新')
    return (
      <Box id={event.type === 'AUTHORIZATION' ? 'conversation-authorization-action' : undefined} sx={{ display: 'flex', justifyContent: 'center', px: 2 }}>
        <Box
          data-message-system-strip="true"
          sx={{
            maxWidth: 'min(78%, 680px)',
            minHeight: 32,
            px: 1.25,
            py: 0.35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255, 253, 249, 0.72)',
            borderColor: PORTRA_COLORS.borderMuted,
            border: `1px solid ${PORTRA_COLORS.borderMuted}`,
            borderRadius: 999,
            boxShadow: '0 1px 0 rgba(255, 255, 255, 0.68) inset'
          }}
        >
          <Stack direction="row" spacing={0.9} sx={{ minWidth: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" noWrap sx={{ minWidth: 0, color: PORTRA_COLORS.mutedInk, fontSize: 12.5, fontWeight: 800 }}>
              {noticeText}
            </Typography>
            <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk, flexShrink: 0, fontSize: 11 }}>{formatTime(event.timestamp)}</Typography>
            {orderAction && (
              <Button size="small" variant="text" color="inherit" onClick={() => onOpenOrderArchive(orderAction.orderId)} sx={stripActionSx}>
                {orderAction.label}
              </Button>
            )}
            {eventActions.includes('PAY') && (
              <Button size="small" variant="text" color="inherit" onClick={onPayOrder} disabled={loading} sx={stripActionSx}>
                去支付
              </Button>
            )}
          </Stack>
        </Box>
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
        {event.type === 'DELIVERY' && eventMeta.delivery && <DeliveryMeta event={event} />}
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
  if (action === 'EDIT_QUOTE' && quote && typeof onStartQuoteEditing === 'function') return <Button {...common} variant="outlined" startIcon={<LocalOfferRoundedIcon />} onClick={() => onStartQuoteEditing(quote)}>编辑报价</Button>
  if (action === 'CONFIRM_QUOTE' && quote && typeof onConfirmQuote === 'function') return <Button {...common} variant="contained" onClick={() => onConfirmQuote(quote)}>确认报价</Button>
  if (action === 'REJECT_QUOTE' && quote && typeof onRejectQuote === 'function') return <Button {...common} variant="outlined" color="inherit" onClick={() => onRejectQuote(quote)}>拒绝报价</Button>
  if (action === 'PAY' && typeof onPayOrder === 'function') return <Button {...common} variant="contained" startIcon={<PaidRoundedIcon />} onClick={onPayOrder}>去支付</Button>
  if (action === 'CANCEL' && cancelAction && typeof onCancelOrder === 'function') return <Button {...common} variant="outlined" onClick={() => onCancelOrder(cancelAction)} sx={{ color: PORTRA_COLORS.orange, borderColor: PORTRA_COLORS.orange }}>{cancelAction?.label || '取消订单'}</Button>
  if (action === 'CONFIRM_DELIVERY' && typeof onConfirmOrder === 'function') return <Button {...common} variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder}>确认接收</Button>
  if (action === 'REQUEST_REWORK' && typeof onOpenAction === 'function') return <Button {...common} variant="outlined" color="inherit" startIcon={<RefreshRoundedIcon />} onClick={() => onOpenAction('REQUEST_REWORK')}>提交返修</Button>
  if (action === 'UPLOAD_DELIVERY' || action === 'REUPLOAD_DELIVERY') {
    if (typeof onOpenAction !== 'function') return null
    return <Button {...common} variant="contained" startIcon={<UploadRoundedIcon />} onClick={() => onOpenAction(action)}>{action === 'REUPLOAD_DELIVERY' ? '重新上传作品' : '上传作品'}</Button>
  }
  if (action === 'REQUEST_AUTHORIZATION' && typeof onOpenAction === 'function') return <Button {...common} variant="outlined" onClick={() => onOpenAction('REQUEST_AUTHORIZATION')}>申请照片授权</Button>
  if (action === 'APPROVE_AUTHORIZATION' && authorization && typeof onDecidePhotoAuthorization === 'function') return <Button {...common} variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'approve')}>同意展示</Button>
  if (action === 'REJECT_AUTHORIZATION' && authorization && typeof onDecidePhotoAuthorization === 'function') return <Button {...common} variant="outlined" color="inherit" startIcon={<CloseRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'reject')}>拒绝展示</Button>
  if (action === 'PLATFORM_ASSISTANCE' && typeof onUnavailableTool === 'function') return <Button {...common} variant="text" color="inherit" onClick={() => onUnavailableTool('平台协助')}>申请平台协助</Button>
  const orderAction = buildOrderAction(order, { label: '查看订单档案' })
  if (action === 'VIEW_DISPUTE' && orderAction && typeof onOpenOrderArchive === 'function') return <Button {...common} variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenOrderArchive(orderAction.orderId)}>{orderAction.label}</Button>
  if (action === 'OPEN_ORDER' && orderAction && typeof onOpenOrderArchive === 'function') return <Button {...common} variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenOrderArchive(orderAction.orderId)}>{orderAction.label}</Button>
  return null
}

function QuoteMeta({ quote }) {
  return (
    <Stack spacing={0.6} sx={attachmentMetaSx}>
      <Typography variant="body2" sx={{ color: PORTRA_COLORS.subInk, fontWeight: 800 }}>
        {centToYuan(quote.amountCent)} · {formatTime(quote.shootStartTime)} · {getSafeDisplayText(quote.location, '拍摄地点待确认')}
      </Typography>
      <Stack direction="row" spacing={0.6} sx={{ flexWrap: 'wrap' }}>
        <PortraStatusBadge label={getQuoteStatusLabel(quote.status)} />
      </Stack>
    </Stack>
  )
}

function OrderMeta({ order }) {
  return <Typography variant="body2" sx={attachmentMetaSx}>{centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)}</Typography>
}

function DeliveryMeta({ event }) {
  const delivery = event?.meta?.delivery
  if (!delivery) return null
  return (
    <Stack spacing={0.4} sx={attachmentMetaSx}>
      <Typography variant="body2">共 {event.meta?.deliveryCount || 1} 次交付 · 最近交付：{formatTime(delivery.uploadTime)}</Typography>
      {delivery.fileName && <Chip size="small" label={getSafeDisplayText(delivery.fileName, '已交付作品')} sx={{ ...metaChipSx, alignSelf: 'flex-start' }} />}
    </Stack>
  )
}

function AuthorizationMeta({ authorization }) {
  if (!authorization) return null
  return (
    <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
      <PortraStatusBadge label={PHOTO_AUTHORIZATION_STATUS_LABELS[authorization.status] || '授权状态已更新'} />
      {(authorization.files || []).map(file => <Chip key={file.id || file.fileId} size="small" label="已选交付作品" sx={metaChipSx} />)}
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
  px: 1.05,
  py: 0.85,
  color: PORTRA_COLORS.subInk,
  bgcolor: PORTRA_COLORS.paperSoft,
  border: `1px solid ${PORTRA_COLORS.borderMuted}`,
  borderRadius: PORTRA_RADII.control
}

const stripActionSx = {
  minWidth: 0,
  px: 0.35,
  py: 0,
  fontSize: 12,
  fontWeight: 900,
  color: PORTRA_COLORS.blue
}
