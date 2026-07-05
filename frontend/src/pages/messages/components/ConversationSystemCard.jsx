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
import { getSafeDisplayText, PORTRA_COLORS, QUOTE_VISUAL } from '../MessageVisualTokens.js'
import { EventAttachmentCard } from './EventAttachmentCard.jsx'
import { QuoteMoneyText } from './QuoteMoneyText.jsx'
import { DeliverySummaryCard } from '../../deliveries/components/DeliverySummaryCard.jsx'
import { buildDeliveryBatches } from '../../deliveries/deliveryDisplay.js'
import { ConversationEventFrame, conversationEventSurfaceSx } from './ConversationEventFrame.jsx'

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

  if (event.type === 'DELIVERY' && delivery) {
    return (
      <DeliveryEventCard
        event={event}
        actor={actor || event.actor}
        direction={direction}
        actions={actionButtons}
        onOpenDeliveryGallery={onOpenDeliveryGallery}
      />
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
  const accent = self ? QUOTE_VISUAL.blue : QUOTE_VISUAL.coral
  const surfaceSx = conversationEventSurfaceSx({ self, accent })

  return (
    <ConversationEventFrame self={self} actor={actor || event.actor} accent={accent} dataKind="quote">
      <PortraTicketCard
        accent={accent}
        sx={{
          px: 2.25,
          py: 2,
          pl: 2.35,
          ...surfaceSx
        }}
      >
          <Stack spacing={1.15}>
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', minWidth: 0 }}>
              <Typography sx={{ color: QUOTE_VISUAL.ink, fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>
                {model.title}
              </Typography>
              <Typography sx={{ color: '#7B8190', fontSize: 12, fontWeight: 400, lineHeight: 1.55, whiteSpace: 'nowrap' }}>
                {model.messageCreatedAtText}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.4} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 1 }}>
              <QuoteMoneyText amountText={model.amountText} sx={{ color: '#111827', fontSize: 30, fontWeight: 800 }} />
              <QuoteStatusPill model={model} />
            </Stack>

            <Stack sx={{ borderTop: `1px solid ${QUOTE_VISUAL.divider}`, borderBottom: `1px solid ${QUOTE_VISUAL.divider}` }}>
              <QuoteInfoRow icon={<CalendarMonthRoundedIcon />} label="拍摄时间" value={model.shootTimeText} />
              <QuoteInfoRow icon={<PlaceRoundedIcon />} label="拍摄地点" value={model.shootLocationText} />
              <QuoteInfoRow icon={<DescriptionRoundedIcon />} label="服务内容" value={model.serviceContentText} multiline last />
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.25 }}>
              <PortraSecondaryAction
                startIcon={<ReceiptLongRoundedIcon />}
                onClick={() => onOpenQuoteDetail?.(quote)}
                sx={{
                  width: 'auto',
                  maxWidth: 220,
                  minWidth: 160,
                  minHeight: 34,
                  px: 2,
                  borderRadius: '12px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: QUOTE_VISUAL.blue,
                  borderColor: 'rgba(18,61,204,.36)',
                  bgcolor: self ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.72)'
                }}
              >
                查看报价详情
              </PortraSecondaryAction>
            </Box>
          </Stack>
      </PortraTicketCard>
    </ConversationEventFrame>
  )
}

function QuoteInfoRow({ icon, label, value, multiline = false, last = false }) {
  return (
    <Stack
      direction="row"
      spacing={1.35}
      sx={{
        minHeight: 32,
        py: 0.75,
        alignItems: 'flex-start',
        borderBottom: last ? 0 : `1px dashed ${QUOTE_VISUAL.divider}`,
        minWidth: 0
      }}
    >
      <Box sx={{ pt: 0.12, color: QUOTE_VISUAL.blue, '& svg': { fontSize: 18 } }}>{icon}</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '92px minmax(0, 1fr)' }, columnGap: 1.05, rowGap: 0.2, flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: QUOTE_VISUAL.muted, fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            color: QUOTE_VISUAL.ink,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.45,
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
  const waiting = model.statusTone === 'waiting'
  return (
    <Stack
      direction="row"
      spacing={0.55}
      sx={{
        alignItems: 'center',
        px: 1.25,
        height: 24,
        py: 0,
        borderRadius: 999,
        bgcolor: completed ? QUOTE_VISUAL.greenSoft : danger ? QUOTE_VISUAL.coralSoft : waiting ? QUOTE_VISUAL.waitingSoft : 'rgba(160,167,179,.14)',
        color: completed ? QUOTE_VISUAL.green : danger ? QUOTE_VISUAL.coral : waiting ? QUOTE_VISUAL.waiting : QUOTE_VISUAL.muted,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1
      }}
    >
      {completed && <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />}
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
  if (action === 'CANCEL' && cancelAction && typeof onCancelOrder === 'function') return <PortraSecondaryAction {...common} onClick={() => onCancelOrder(cancelAction)} sx={{ color: QUOTE_VISUAL.coral, borderColor: QUOTE_VISUAL.coral }}>{cancelAction?.label || '取消订单'}</PortraSecondaryAction>
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

function DeliveryEventCard({ event, actor, direction, actions, onOpenDeliveryGallery }) {
  const delivery = event?.meta?.delivery
  if (!delivery) return null
  const batch = buildDeliveryBatches([delivery], event?.meta?.order)[0]
  const self = (direction || event.side) === 'self'
  return (
    <ConversationEventFrame self={self} actor={actor || event.actor} accent={PORTRA_COLORS.blue} dataKind="event">
        <Stack spacing={0.85} sx={{ alignItems: self ? 'flex-end' : 'flex-start', minWidth: 0 }}>
          <DeliverySummaryCard
            batch={{
              ...batch,
              fileCount: event.meta?.deliveryCount || batch.fileCount
            }}
            variant="conversation"
            label="作品已上传"
            timeLabel={formatTime(event.timestamp || batch?.latestUploadTime)}
            statusLabel={batch?.statusLabel || '待客户确认'}
            onOpen={() => onOpenDeliveryGallery?.(delivery)}
            disabled={!batch?.orderId || !batch?.deliveryId}
          />
          {actions}
        </Stack>
    </ConversationEventFrame>
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
