import { Box, Stack, Typography } from '@mui/material'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import UploadRoundedIcon from '@mui/icons-material/UploadRounded'
import { centToYuan } from '../../../utils/index.js'
import { buildOrderAction } from '../../../utils/orderNavigation.js'
import { AuthorizationRequestCard, PortraActionLink, PortraPrimaryAction, PortraSecondaryAction, PortraSystemNotice, PortraTicketCard } from '../../../components/portra/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import { buildQuoteDisplayModel } from '../utils/quoteDisplayModel.js'
import { getSafeDisplayText, PORTRA_COLORS } from '../MessageVisualTokens.js'
import { EventAttachmentCard } from './EventAttachmentCard.jsx'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'
import { DeliveryBatchCard } from '../../deliveries/components/DeliveryBatchCard.jsx'
import { buildDeliveryBatches } from '../../deliveries/deliveryDisplay.js'

export function ConversationSystemItem({
  event,
  actor,
  direction,
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

  if (quote) {
    return (
      <Box id={event.type === 'AUTHORIZATION' ? 'conversation-authorization-action' : undefined}>
        <QuoteAttachmentCard
          event={event}
          actor={actor || event.actor}
          direction={direction}
          quote={quote}
          onOpenQuoteDetail={onOpenQuoteDetail}
        />
      </Box>
    )
  }

  return (
    <Box id={event.type === 'AUTHORIZATION' ? 'conversation-authorization-action' : undefined}>
      <EventAttachmentCard
        side={event.side}
        direction={direction}
        actor={actor || event.actor}
        title={getSafeDisplayText(event.title, '合作进展已更新')}
        summary={getSafeDisplayText(event.summary, '')}
        timestamp={formatTime(event.timestamp)}
        actions={actionButtons}
      >
        {event.type === 'ORDER_CREATED' && eventMeta.order && <OrderMeta order={eventMeta.order} />}
        {event.type === 'DELIVERY' && delivery && (
          <DeliveryMeta
            event={event}
            onOpenDeliveryGallery={onOpenDeliveryGallery}
          />
        )}
        {authorization && (
          <AuthorizationRequestCard
            authorization={authorization}
            order={eventMeta.order}
            variant="message"
            chrome="none"
            canReview={eventActions.includes('APPROVE_AUTHORIZATION') || eventActions.includes('REJECT_AUTHORIZATION')}
            loading={loading}
            onDecision={onDecidePhotoAuthorization}
            onOpenDelivery={onOpenDeliveryGallery}
          />
        )}
      </EventAttachmentCard>
    </Box>
  )
}

function QuoteAttachmentCard({ event, actor, direction, quote, onOpenQuoteDetail }) {
  const self = (direction || event.side) === 'self'
  const model = buildQuoteDisplayModel(quote, event)

  return (
    <Box sx={{ display: 'flex', justifyContent: self ? 'flex-end' : 'flex-start' }}>
      <Stack
        direction="row"
        spacing={1.1}
        sx={{
          alignItems: 'flex-start',
          width: { xs: '100%', md: '62%' },
          minWidth: { xs: 0, md: 470 },
          maxWidth: { xs: '100%', md: 620 },
          flexDirection: self ? 'row-reverse' : 'row'
        }}
      >
        <MessageActorAvatar
          actor={actor || event.actor}
          dataKind="quote"
          accent={PORTRA_COLORS.blue}
          fallbackText={self ? '我' : '对'}
          sx={{ mt: 0.25, fontWeight: 950 }}
        />
        <PortraTicketCard
          accent={PORTRA_COLORS.blue}
          sx={{
            flex: 1,
            width: '100%',
            minWidth: { xs: 0, md: 420 },
            maxWidth: 560,
            px: { xs: 2, md: 2.75 },
            py: { xs: 1.85, md: 2.5 },
            pl: { xs: 2.1, md: 2.9 },
            bgcolor: PORTRA_COLORS.paper,
            borderColor: 'rgba(15,23,42,.12)',
            borderRadius: '18px',
            boxShadow: '0 6px 18px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.05)',
            '&::before': {
              inset: '0 auto 0 0',
              width: 4,
              bgcolor: PORTRA_COLORS.blue
            },
            '&::after': { display: 'none' },
            '&:hover': {
              transform: 'none',
              boxShadow: '0 8px 22px rgba(15,23,42,.075), 0 1px 2px rgba(15,23,42,.05)',
              borderColor: 'rgba(15,23,42,.16)'
            }
          }}
        >
          <Stack spacing={1.65}>
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', minWidth: 0 }}>
              <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>
                {model.title}
              </Typography>
              <Typography sx={{ color: PORTRA_COLORS.faintInk, fontSize: 13, lineHeight: 1.55, whiteSpace: 'nowrap' }}>
                {model.messageCreatedAtText}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.4} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 1 }}>
              <Typography sx={{ color: '#0f172a', fontSize: { xs: 34, md: 36 }, fontWeight: 900, lineHeight: 1, letterSpacing: 0 }}>
                {model.amountText}
              </Typography>
              <QuoteStatusPill model={model} />
            </Stack>

            <Stack sx={{ borderTop: '1px solid rgba(15,23,42,.10)', borderBottom: '1px solid rgba(15,23,42,.08)' }}>
              <QuoteInfoRow icon={<CalendarMonthRoundedIcon />} label="拍摄时间" value={model.shootTimeText} />
              <QuoteInfoRow icon={<PlaceRoundedIcon />} label="拍摄地点" value={model.shootLocationText} />
              <QuoteInfoRow icon={<DescriptionRoundedIcon />} label="服务内容" value={model.serviceContentText} multiline last />
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.25 }}>
              <PortraSecondaryAction
                startIcon={<ReceiptLongRoundedIcon />}
                onClick={() => onOpenQuoteDetail?.(quote)}
                sx={{
                  width: { xs: '100%', sm: 232 },
                  minHeight: 38,
                  borderRadius: '8px',
                  fontSize: 14.5,
                  fontWeight: 900,
                  color: PORTRA_COLORS.blue,
                  borderColor: 'rgba(13,47,178,.48)',
                  bgcolor: PORTRA_COLORS.paper
                }}
              >
                查看报价详情
              </PortraSecondaryAction>
            </Box>
          </Stack>
        </PortraTicketCard>
      </Stack>
    </Box>
  )
}

function QuoteInfoRow({ icon, label, value, multiline = false, last = false }) {
  return (
    <Stack
      direction="row"
      spacing={1.35}
      sx={{
        py: 0.85,
        alignItems: 'flex-start',
        borderBottom: last ? 0 : '1px dashed rgba(15,23,42,.12)',
        minWidth: 0
      }}
    >
      <Box sx={{ pt: 0.12, color: PORTRA_COLORS.blue, '& svg': { fontSize: 20 } }}>{icon}</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '128px minmax(0, 1fr)' }, columnGap: 1.2, rowGap: 0.25, flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: PORTRA_COLORS.mutedInk, fontSize: 14, fontWeight: 700, lineHeight: 1.55 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            color: PORTRA_COLORS.ink,
            fontSize: 15,
            fontWeight: 650,
            lineHeight: 1.55,
            minWidth: 0,
            overflowWrap: 'anywhere',
            ...(multiline
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }
              : {})
          }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  )
}

function QuoteStatusPill({ model }) {
  const completed = model.statusTone === 'completed'
  const danger = model.statusTone === 'danger'
  return (
    <Stack
      direction="row"
      spacing={0.55}
      sx={{
        alignItems: 'center',
        px: 1.15,
        height: 28,
        py: 0,
        borderRadius: 999,
        bgcolor: completed ? 'rgba(30,119,88,.11)' : danger ? 'rgba(248,81,4,.10)' : 'rgba(93,97,103,.10)',
        color: completed ? '#14704f' : danger ? PORTRA_COLORS.orange : PORTRA_COLORS.mutedInk,
        fontSize: 15,
        fontWeight: 900,
        lineHeight: 1
      }}
    >
      {completed && <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />}
      <Box component="span">{model.statusLabel}</Box>
    </Stack>
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
