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
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'
import { EventAttachmentCard } from './EventAttachmentCard.jsx'
import { StatusChip } from './StatusChip.jsx'

export function ConversationSystemItem({
  event,
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
  const quote = event.meta?.quote
  const authorization = event.meta?.authorization
  const renderActionButton = action => (
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
  )
  const actionButtons = !!event.actions.length && (
    <Stack direction="row" spacing={0.7} flexWrap="wrap" rowGap={0.7}>
      {event.actions.map(renderActionButton)}
    </Stack>
  )
  const quoteAction = quote && (
    <Button size="small" variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenQuoteDetail(quote)}>
      查看报价详情
    </Button>
  )

  if (event.actorRole === 'PLATFORM') {
    const order = event.meta?.order
    return (
      <Box id={event.type === 'AUTHORIZATION' ? 'conversation-authorization-action' : undefined} sx={{ display: 'flex', justifyContent: 'center', px: 2 }}>
        <Paper
          variant="outlined"
          sx={{
            width: 'min(60%, 520px)',
            minHeight: 40,
            px: 1.25,
            py: 0.7,
            display: 'flex',
            alignItems: 'center',
            bgcolor: PORTRA_COLORS.paper,
            borderColor: PORTRA_COLORS.borderMuted,
            borderLeft: `3px solid ${PORTRA_COLORS.yellow}`,
            borderRadius: PORTRA_RADII.control,
            boxShadow: 'none'
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ width: '100%', minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ minWidth: 0, color: PORTRA_COLORS.subInk, fontWeight: 800 }}>
              平台通知 · {getSafeDisplayText(event.title, '合作进展已更新')}
            </Typography>
            <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk, flexShrink: 0, fontSize: 11 }}>{formatTime(event.timestamp)}</Typography>
            {order && <Button size="small" variant="text" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive}>查看订单</Button>}
            {event.actions.includes('PAY') && renderActionButton('PAY')}
          </Stack>
        </Paper>
      </Box>
    )
  }

  return (
    <Box id={event.type === 'AUTHORIZATION' ? 'conversation-authorization-action' : undefined}>
      <EventAttachmentCard
        side={event.side}
        actorRole={event.actorRole}
        label={eventBadgeLabel(event)}
        title={getSafeDisplayText(event.title, '合作进展已更新')}
        summary={getSafeDisplayText(event.summary, '')}
        timestamp={formatTime(event.timestamp)}
        actions={quote ? quoteAction : actionButtons}
      >
        {quote && <QuoteMeta quote={quote} />}
        {event.type === 'ORDER_CREATED' && event.meta?.order && <OrderMeta order={event.meta.order} />}
        {event.type === 'DELIVERY' && <DeliveryMeta event={event} />}
        {authorization && <AuthorizationMeta authorization={authorization} />}
      </EventAttachmentCard>
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
  if (action === 'CANCEL') return <Button {...common} variant="outlined" onClick={() => onCancelOrder(cancelAction)} sx={{ color: PORTRA_COLORS.orange, borderColor: PORTRA_COLORS.orange }}>{cancelAction?.label || '取消订单'}</Button>
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
    <Stack spacing={0.6} sx={attachmentMetaSx}>
      <Typography variant="body2" sx={{ color: PORTRA_COLORS.subInk, fontWeight: 800 }}>
        {centToYuan(quote.amountCent)} · {formatTime(quote.shootStartTime)} · {getSafeDisplayText(quote.location, '拍摄地点待确认')}
      </Typography>
      <Stack direction="row" spacing={0.6} flexWrap="wrap">
        <StatusChip label={getQuoteStatusLabel(quote.status)} />
      </Stack>
    </Stack>
  )
}

function OrderMeta({ order }) {
  return <Typography variant="body2" sx={attachmentMetaSx}>{centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)}</Typography>
}

function DeliveryMeta({ event }) {
  const delivery = event.meta.delivery
  return (
    <Stack spacing={0.4} sx={attachmentMetaSx}>
      <Typography variant="body2">共 {event.meta.deliveryCount} 次交付 · 最近交付：{formatTime(delivery.uploadTime)}</Typography>
      {delivery.fileName && <Chip size="small" label={getSafeDisplayText(delivery.fileName, '已交付作品')} sx={{ ...metaChipSx, alignSelf: 'flex-start' }} />}
    </Stack>
  )
}

function AuthorizationMeta({ authorization }) {
  return (
    <Stack direction="row" spacing={0.8} flexWrap="wrap">
      <StatusChip label={PHOTO_AUTHORIZATION_STATUS_LABELS[authorization.status] || '授权状态已更新'} />
      {(authorization.files || []).map(file => <Chip key={file.id || file.fileId} size="small" label="已选交付作品" sx={metaChipSx} />)}
    </Stack>
  )
}

function eventBadgeLabel(event) {
  return `${event.actorLabel}动作 · ${actorEventLabel(event.type)}`
}

function actorEventLabel(type) {
  if (type === 'QUOTE_SENT' || type === 'QUOTE_DECISION') return '报价'
  if (type === 'DELIVERY') return '上传作品'
  if (type === 'AUTHORIZATION') return '照片授权'
  if (type === 'REWORK') return '提交返修'
  return '订单动作'
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
  px: 1,
  py: 0.8,
  color: PORTRA_COLORS.subInk,
  bgcolor: PORTRA_COLORS.paperMuted,
  borderRadius: PORTRA_RADII.control
}
