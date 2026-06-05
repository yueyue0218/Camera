import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { centToYuan } from '../../../utils/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'
import { StatusChip } from './StatusChip.jsx'
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
  return (
    <Paper
      data-message-panel="true"
      variant="outlined"
      sx={{
        p: { xs: 1.25, md: 1.4 },
        bgcolor: PORTRA_COLORS.paperMuted,
        borderColor: PORTRA_COLORS.borderMuted,
        borderRadius: PORTRA_RADII.panel,
        boxShadow: 'none',
        display: { xs: 'none', lg: 'block' },
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        alignSelf: 'stretch'
      }}
    >
      <Stack spacing={1.25}>
        <Box>
          <Typography variant="overline" sx={{ color: PORTRA_COLORS.faintInk, fontWeight: 900 }}>当前进展</Typography>
          <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 17, fontWeight: 900 }}>{summary.progressTitle || actions.stage.title}</Typography>
          <Typography variant="body2" sx={{ mt: 0.35, color: PORTRA_COLORS.mutedInk, lineHeight: 1.55 }}>{summary.nextStep || actions.stage.description}</Typography>
        </Box>

        <WorkbenchSection title="下一步">
          <Box sx={{ p: 1, bgcolor: PORTRA_COLORS.paper, borderRadius: PORTRA_RADII.control, borderLeft: `3px solid ${PORTRA_COLORS.blue}` }}>
            <Stack spacing={0.8}>
            {actions.canConfirmDelivery ? (
              <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary" sx={{ width: '100%' }}>请查看交付作品，确认接收或说明返修要求。</Typography>
                <Button size="small" variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder}>确认接收</Button>
                <Button size="small" variant="outlined" onClick={() => onOpenAction('REQUEST_REWORK')}>提交返修</Button>
              </Stack>
            ) : actions.canUploadDelivery || actions.canReuploadDelivery ? (
              <Stack spacing={0.8}>
                <Typography variant="body2" color="text.secondary">
                  {actions.canReuploadDelivery ? '客户提出返修，请根据要求重新上传作品。' : '请上传本次拍摄作品。'}
                </Typography>
                <Button size="small" variant="contained" startIcon={<AddPhotoAlternateRoundedIcon />} onClick={() => onOpenAction(actions.canReuploadDelivery ? 'REUPLOAD_DELIVERY' : 'UPLOAD_DELIVERY')} sx={{ alignSelf: 'flex-start' }}>
                  {uploadLabel}
                </Button>
              </Stack>
            ) : actions.canRequestPhotoAuthorization ? (
              <Stack spacing={0.8}>
                <Typography variant="body2" color="text.secondary">订单已完成，可以选择已交付作品申请展示授权。</Typography>
                <Button size="small" variant="outlined" startIcon={<ImageRoundedIcon />} onClick={() => onOpenAction('REQUEST_AUTHORIZATION')} sx={{ alignSelf: 'flex-start' }}>
                  申请照片授权
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {summary.nextStep || actions.stage.description || '等待对方处理后，合作进展会在会话中同步。'}
              </Typography>
            )}
            {actions.canAppeal && (
              <Button size="small" variant="text" color="inherit" onClick={() => onUnavailableTool('平台协助')} sx={{ alignSelf: 'flex-start' }}>
                申请平台协助
              </Button>
            )}
            {actions.canViewDispute && (
              <Button size="small" variant="outlined" color="inherit" onClick={onOpenOrderArchive} sx={{ alignSelf: 'flex-start' }}>
                查看争议进展
              </Button>
            )}
            </Stack>
          </Box>
        </WorkbenchSection>

        {latestQuote && (
          <WorkbenchSection title="当前报价">
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <StatusChip label={getQuoteStatusLabel(latestQuote.status)} />
              <Typography sx={{ color: PORTRA_COLORS.blue, fontSize: 18, fontWeight: 900 }}>{centToYuan(latestQuote.amountCent)}</Typography>
            </Stack>
            <Typography color="text.secondary" variant="body2">
              {getSafeDisplayText(latestQuote.location, '拍摄地点待确认')} · {getPhotoUsageScopeLabel(latestQuote.photoUsageScope)}
            </Typography>
          </WorkbenchSection>
        )}

        {order && (
          <WorkbenchSection title="订单档案">
            <Typography color="text.secondary" variant="body2">
              {centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)}
            </Typography>
            <Button variant="text" color="inherit" size="small" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive} sx={{ alignSelf: 'flex-start', px: 0 }}>
              查看订单档案
            </Button>
          </WorkbenchSection>
        )}

        <WorkbenchSection title="交付与授权">
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <TaskAltRoundedIcon sx={{ fontSize: 17, color: PORTRA_COLORS.blue }} />
              <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk }}>交付 {summary.deliveryCount ?? deliveryRecords.length}</Typography>
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
