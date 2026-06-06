import { Box, Stack, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { centToYuan } from '../../../utils/index.js'
import { buildOrderAction } from '../../../utils/orderNavigation.js'
import { PortraActionLink, PortraPrimaryAction, PortraSecondaryAction, PortraStatusPill, PortraWorkflowPanel } from '../../../components/portra/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'
import { getSafeDisplayText, PORTRA_COLORS } from '../MessageVisualTokens.js'
import { WorkbenchSection } from './WorkbenchSection.jsx'

function getLatestQuote(quotes) {
  return [...quotes].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0] || null
}
export function ConversationWorkbenchPanel({
  quotes,
  order,
  actions,
  panelSummary,
  statusLogs,
  deliveryRecords,
  photoAuthorizations,
  onOpenOrderArchive,
  onConfirmOrder,
  onOpenAction
}) {
  const latestQuote = getLatestQuote(quotes)
  const summary = panelSummary || {}
  const uploadLabel = actions.canReuploadDelivery ? '重新上传作品' : '上传作品'
  const orderAction = buildOrderAction(order, { label: '查看订单' })
  const hasActionBlock = actions.canConfirmDelivery
    || actions.canUploadDelivery
    || actions.canReuploadDelivery
    || actions.canRequestPhotoAuthorization
    || actions.canViewDispute
  return (
    <PortraWorkflowPanel
      data-message-panel="true"
      sx={{
        display: { xs: 'none', lg: 'block' },
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        alignSelf: 'stretch'
      }}
    >
      <Stack spacing={1.35}>
        <Box sx={{ pb: 0.1 }}>
          <Typography variant="overline" sx={{ color: PORTRA_COLORS.faintInk, fontWeight: 850, letterSpacing: 0 }}>当前进展</Typography>
          <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 17, fontWeight: 900 }}>{summary.progressTitle || actions.stage.title}</Typography>
          <Typography variant="body2" sx={{ mt: 0.35, color: PORTRA_COLORS.mutedInk, lineHeight: 1.55 }}>{summary.nextStep || actions.stage.description}</Typography>
        </Box>

        {hasActionBlock && (
        <WorkbenchSection title="下一步">
          <Box sx={{ p: 0, bgcolor: 'transparent', borderRadius: 0, borderLeft: 0, boxShadow: 'none' }}>
            <Stack spacing={0.8}>
            {actions.canConfirmDelivery ? (
              <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
                <PortraPrimaryAction startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder}>确认接收</PortraPrimaryAction>
                <PortraSecondaryAction onClick={() => onOpenAction('REQUEST_REWORK')}>提交返修</PortraSecondaryAction>
              </Stack>
            ) : actions.canUploadDelivery || actions.canReuploadDelivery ? (
              <Stack spacing={0.8}>
                <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk, lineHeight: 1.7 }}>
                  {actions.canReuploadDelivery ? '客户提出返修，请根据要求重新上传作品。' : '请上传本次拍摄作品。'}
                </Typography>
                <PortraPrimaryAction startIcon={<AddPhotoAlternateRoundedIcon />} onClick={() => onOpenAction(actions.canReuploadDelivery ? 'REUPLOAD_DELIVERY' : 'UPLOAD_DELIVERY')} sx={{ alignSelf: 'flex-start' }}>
                  {uploadLabel}
                </PortraPrimaryAction>
              </Stack>
            ) : actions.canRequestPhotoAuthorization ? (
              <Stack spacing={0.8}>
                <Typography variant="body2" color="text.secondary">订单已完成，可以选择作品申请展示授权。</Typography>
                <PortraSecondaryAction startIcon={<ImageRoundedIcon />} onClick={() => onOpenAction('REQUEST_AUTHORIZATION')} sx={{ alignSelf: 'flex-start' }}>
                  申请展示授权
                </PortraSecondaryAction>
              </Stack>
            ) : (
              null
            )}
            {actions.canViewDispute && orderAction && (
              <PortraActionLink onClick={() => onOpenOrderArchive(orderAction.orderId)} sx={{ alignSelf: 'flex-start' }}>
                查看争议进展
              </PortraActionLink>
            )}
            </Stack>
          </Box>
        </WorkbenchSection>
        )}

        {latestQuote && (
          <WorkbenchSection title="当前报价">
            <Box sx={{ pl: 1.1, borderLeft: `3px solid ${PORTRA_COLORS.blue}`, minWidth: 0 }}>
              <Stack spacing={0.55}>
                <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 21, fontWeight: 950, lineHeight: 1 }}>{centToYuan(latestQuote.amountCent)}</Typography>
                <Typography sx={{ color: PORTRA_COLORS.mutedInk, fontSize: 13.5, lineHeight: 1.45 }} variant="body2">
                  {getSafeDisplayText(latestQuote.location, '拍摄地点待确认')}
                </Typography>
                <Typography sx={{ color: PORTRA_COLORS.mutedInk, fontSize: 13.5 }}>{getPhotoUsageScopeLabel(latestQuote.photoUsageScope)}</Typography>
                <PortraStatusPill label={getQuoteStatusLabel(latestQuote.status)} sx={{ alignSelf: 'flex-start' }} />
              </Stack>
            </Box>
          </WorkbenchSection>
        )}

        {order && (
          <WorkbenchSection title="订单">
            <Typography sx={{ color: PORTRA_COLORS.mutedInk }} variant="body2">
              {centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)}
            </Typography>
            {orderAction && (
              <PortraActionLink startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenOrderArchive(orderAction.orderId)} sx={{ alignSelf: 'flex-start' }}>
                {orderAction.label}
              </PortraActionLink>
            )}
          </WorkbenchSection>
        )}

        <WorkbenchSection title="作品与授权">
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <TaskAltRoundedIcon sx={{ fontSize: 17, color: PORTRA_COLORS.blue }} />
              <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk }}>作品 {summary.deliveryCount ?? deliveryRecords.length}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <ImageRoundedIcon sx={{ fontSize: 17, color: PORTRA_COLORS.orange }} />
              <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk }}>授权 {summary.authorizationCount ?? photoAuthorizations.length}</Typography>
            </Stack>
          </Stack>
        </WorkbenchSection>
      </Stack>
    </PortraWorkflowPanel>
  )
}
