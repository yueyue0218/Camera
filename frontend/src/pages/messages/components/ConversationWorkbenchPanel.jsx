import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { centToYuan } from '../../../utils/index.js'
import { buildOrderAction } from '../../../utils/orderNavigation.js'
import { PortraActionButton, PortraStatusBadge, PortraTicketCard } from '../../../components/portra/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'
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
  onUnavailableTool,
  onOpenAction
}) {
  const latestQuote = getLatestQuote(quotes)
  const summary = panelSummary || {}
  const uploadLabel = actions.canReuploadDelivery ? '重新上传作品' : '上传作品'
  const orderAction = buildOrderAction(order, { label: '查看订单' })
  return (
    <Paper
      data-message-panel="true"
      variant="outlined"
      sx={{
        p: { xs: 1.3, md: 1.5 },
        bgcolor: PORTRA_COLORS.paperMuted,
        borderColor: PORTRA_COLORS.borderMuted,
        borderRadius: PORTRA_RADII.panel,
        boxShadow: PORTRA_SHADOWS.subtle,
        borderTop: `3px solid ${PORTRA_COLORS.blue}`,
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
          <Typography variant="overline" sx={{ color: PORTRA_COLORS.faintInk, fontWeight: 900 }}>当前进展</Typography>
          <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 17, fontWeight: 900 }}>{summary.progressTitle || actions.stage.title}</Typography>
          <Typography variant="body2" sx={{ mt: 0.35, color: PORTRA_COLORS.mutedInk, lineHeight: 1.55 }}>{summary.nextStep || actions.stage.description}</Typography>
        </Box>

        <WorkbenchSection title="下一步">
          <Box sx={{ p: 0, bgcolor: 'transparent', borderRadius: 0, borderLeft: 0, boxShadow: 'none' }}>
            <Stack spacing={0.8}>
            {actions.canConfirmDelivery ? (
              <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ width: '100%', color: PORTRA_COLORS.mutedInk, lineHeight: 1.7 }}>请查看作品，确认接收或说明返修要求。</Typography>
                <Button size="small" variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder}>确认接收</Button>
                <Button size="small" variant="outlined" onClick={() => onOpenAction('REQUEST_REWORK')}>提交返修</Button>
              </Stack>
            ) : actions.canUploadDelivery || actions.canReuploadDelivery ? (
              <Stack spacing={0.8}>
                <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk, lineHeight: 1.7 }}>
                  {actions.canReuploadDelivery ? '客户提出返修，请根据要求重新上传作品。' : '请上传本次拍摄作品。'}
                </Typography>
                <Button size="small" variant="contained" startIcon={<AddPhotoAlternateRoundedIcon />} onClick={() => onOpenAction(actions.canReuploadDelivery ? 'REUPLOAD_DELIVERY' : 'UPLOAD_DELIVERY')} sx={{ alignSelf: 'flex-start' }}>
                  {uploadLabel}
                </Button>
              </Stack>
            ) : actions.canRequestPhotoAuthorization ? (
              <Stack spacing={0.8}>
                <Typography variant="body2" color="text.secondary">订单已完成，可以选择作品申请展示授权。</Typography>
                <Button size="small" variant="outlined" startIcon={<ImageRoundedIcon />} onClick={() => onOpenAction('REQUEST_AUTHORIZATION')} sx={{ alignSelf: 'flex-start' }}>
                  申请展示授权
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk, lineHeight: 1.7 }}>
                {summary.nextStep || actions.stage.description || '等待对方处理后，合作进展会在沟通中同步。'}
              </Typography>
            )}
            {actions.canAppeal && (
              <Button size="small" variant="text" color="inherit" onClick={() => onUnavailableTool('平台协助')} sx={{ alignSelf: 'flex-start' }}>
                申请平台协助
              </Button>
            )}
            {actions.canViewDispute && orderAction && (
              <Button size="small" variant="outlined" color="inherit" onClick={() => onOpenOrderArchive(orderAction.orderId)} sx={{ alignSelf: 'flex-start' }}>
                查看争议进展
              </Button>
            )}
            </Stack>
          </Box>
        </WorkbenchSection>

        {latestQuote && (
          <WorkbenchSection title="当前报价">
            <PortraTicketCard sx={{ p: 1.3, pl: 2.1, boxShadow: 'none' }}>
              <Stack spacing={0.65}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 20, fontWeight: 950 }}>{centToYuan(latestQuote.amountCent)}</Typography>
                  <PortraStatusBadge label={getQuoteStatusLabel(latestQuote.status)} />
                </Stack>
                <Typography sx={{ color: PORTRA_COLORS.mutedInk }} variant="body2">
                  {getSafeDisplayText(latestQuote.location, '拍摄地点待确认')} · {getPhotoUsageScopeLabel(latestQuote.photoUsageScope)}
                </Typography>
              </Stack>
            </PortraTicketCard>
          </WorkbenchSection>
        )}

        {order && (
          <WorkbenchSection title="订单">
            <Typography sx={{ color: PORTRA_COLORS.mutedInk }} variant="body2">
              {centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)}
            </Typography>
            {orderAction && (
              <PortraActionButton tone="secondary" startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenOrderArchive(orderAction.orderId)} sx={{ alignSelf: 'flex-start', px: 1 }}>
                {orderAction.label}
              </PortraActionButton>
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
    </Paper>
  )
}
