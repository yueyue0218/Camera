import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import UploadRoundedIcon from '@mui/icons-material/UploadRounded'
import { centToYuan } from '../../../utils/index.js'
import { PHOTO_AUTHORIZATION_STATUS_LABELS } from '../../orders/orderActions.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'

export function ConversationSystemItem({
  event,
  loading,
  actions,
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
  if (!event) return null
  const quote = event.meta?.quote
  const authorization = event.meta?.authorization
  return (
    <Box id={event.type === 'AUTHORIZATION' ? 'conversation-authorization-action' : undefined} sx={{ display: 'flex', justifyContent: sideJustify(event.side), px: event.side === 'center' ? 2 : 0 }}>
      <Paper variant="outlined" sx={eventCardSx(event.side, event.actorRole)}>
        <Stack spacing={0.9}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Chip size="small" label={event.actorRole === 'PLATFORM' ? '平台通知' : `${event.actorLabel}发起`} sx={{ fontWeight: 800 }} />
            <Typography variant="caption" color="text.secondary">{formatTime(event.timestamp)}</Typography>
          </Stack>
          <Typography fontWeight={900}>{event.title}</Typography>
          {event.summary && <Typography variant="body2" color="text.secondary">{event.summary}</Typography>}
          {quote && <QuoteMeta quote={quote} />}
          {event.type === 'ORDER_CREATED' && event.meta?.order && <OrderMeta order={event.meta.order} />}
          {event.type === 'DELIVERY' && <DeliveryMeta event={event} />}
          {authorization && <AuthorizationMeta authorization={authorization} />}
          {!!event.actions.length && (
            <Stack direction="row" spacing={0.8} flexWrap="wrap" rowGap={0.8}>
              {event.actions.map(action => (
                <EventActionButton
                  key={action}
                  action={action}
                  quote={quote}
                  authorization={authorization}
                  cancelAction={actions.cancelAction}
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
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}

function EventActionButton({
  action,
  quote,
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
  if (action === 'EDIT_QUOTE') return <Button {...common} variant="outlined" startIcon={<LocalOfferRoundedIcon />} onClick={() => onStartQuoteEditing(quote)}>编辑报价</Button>
  if (action === 'CONFIRM_QUOTE') return <Button {...common} variant="contained" onClick={() => onConfirmQuote(quote)}>确认报价</Button>
  if (action === 'REJECT_QUOTE') return <Button {...common} variant="outlined" color="inherit" onClick={() => onRejectQuote(quote)}>拒绝报价</Button>
  if (action === 'PAY') return <Button {...common} variant="contained" startIcon={<PaidRoundedIcon />} onClick={onPayOrder}>去支付</Button>
  if (action === 'CANCEL') return <Button {...common} variant="outlined" color="inherit" onClick={() => onCancelOrder(cancelAction)}>{cancelAction?.label || '取消订单'}</Button>
  if (action === 'CONFIRM_DELIVERY') return <Button {...common} variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder}>确认接收</Button>
  if (action === 'REQUEST_REWORK') return <Button {...common} variant="outlined" color="inherit" startIcon={<RefreshRoundedIcon />} onClick={() => onOpenAction('REQUEST_REWORK')}>提交返修</Button>
  if (action === 'UPLOAD_DELIVERY' || action === 'REUPLOAD_DELIVERY') {
    return <Button {...common} variant="contained" startIcon={<UploadRoundedIcon />} onClick={() => onOpenAction(action)}>{action === 'REUPLOAD_DELIVERY' ? '重新上传作品' : '上传作品'}</Button>
  }
  if (action === 'REQUEST_AUTHORIZATION') return <Button {...common} variant="outlined" onClick={() => onOpenAction('REQUEST_AUTHORIZATION')}>申请照片授权</Button>
  if (action === 'APPROVE_AUTHORIZATION') return <Button {...common} variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'approve')}>同意展示</Button>
  if (action === 'REJECT_AUTHORIZATION') return <Button {...common} variant="outlined" color="inherit" startIcon={<CloseRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'reject')}>拒绝展示</Button>
  if (action === 'PLATFORM_ASSISTANCE') return <Button {...common} variant="text" color="inherit" onClick={() => onUnavailableTool('平台协助')}>申请平台协助</Button>
  if (action === 'VIEW_DISPUTE') return <Button {...common} variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive}>查看订单档案</Button>
  if (action === 'OPEN_ORDER') return <Button {...common} variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive}>查看订单档案</Button>
  return null
}

function QuoteMeta({ quote }) {
  return (
    <Stack spacing={0.6}>
      <Typography variant="body2">{centToYuan(quote.amountCent)} · {formatTime(quote.shootStartTime)} · {quote.location || '拍摄地点待确认'}</Typography>
      <Stack direction="row" spacing={0.8} flexWrap="wrap">
        <Chip size="small" label={getQuoteStatusLabel(quote.status)} />
        <Chip size="small" label={getPhotoUsageScopeLabel(quote.photoUsageScope)} />
      </Stack>
    </Stack>
  )
}

function OrderMeta({ order }) {
  return <Typography variant="body2">{centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)}</Typography>
}

function DeliveryMeta({ event }) {
  const delivery = event.meta.delivery
  return (
    <Stack spacing={0.4}>
      <Typography variant="body2">共 {event.meta.deliveryCount} 次交付 · 最近交付：{formatTime(delivery.uploadTime)}</Typography>
      {delivery.fileName && <Chip size="small" label={delivery.fileName} sx={{ alignSelf: 'flex-start' }} />}
    </Stack>
  )
}

function AuthorizationMeta({ authorization }) {
  return (
    <Stack direction="row" spacing={0.8} flexWrap="wrap">
      <Chip size="small" label={PHOTO_AUTHORIZATION_STATUS_LABELS[authorization.status] || '授权状态已更新'} />
      {(authorization.files || []).map(file => <Chip key={file.id || file.fileId} size="small" label="已选交付作品" />)}
    </Stack>
  )
}

function sideJustify(side) {
  if (side === 'self') return 'flex-end'
  if (side === 'counterparty') return 'flex-start'
  return 'center'
}

function eventCardSx(side, actorRole) {
  const platform = actorRole === 'PLATFORM'
  return {
    width: platform ? 'min(92%, 500px)' : 'min(78%, 480px)',
    p: 1.2,
    bgcolor: platform ? '#ebe6dd' : side === 'self' ? 'rgba(13, 47, 178, 0.07)' : '#f8f3eb',
    borderColor: platform ? '#c8c0b7' : side === 'self' ? 'rgba(13, 47, 178, 0.3)' : '#d4ccc2',
    borderLeft: platform ? '3px solid #f7ce3a' : side === 'self' ? '3px solid #0d2fb2' : '3px solid #151318',
    boxShadow: 'none'
  }
}
