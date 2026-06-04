import { Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { centToYuan } from '../../../utils/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'

function getLatestQuote(quotes) {
  return [...quotes].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0] || null
}

export function ConversationWorkbenchPanel({
  quotes,
  order,
  actions,
  statusLogs,
  deliveryRecords,
  photoAuthorizations,
  onOpenOrderArchive,
  onConfirmOrder,
  onUnavailableTool,
  onOpenAction
}) {
  const latestQuote = getLatestQuote(quotes)
  const latestLog = statusLogs[statusLogs.length - 1]
  const uploadLabel = actions.canReuploadDelivery ? '重新上传作品' : '上传作品'
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, md: 1.8 },
        bgcolor: '#f8f3eb',
        borderColor: '#d4ccc2',
        position: { lg: 'sticky' },
        top: { lg: 16 },
        alignSelf: 'start'
      }}
    >
      <Stack spacing={1.6}>
        <Box>
          <Typography variant="overline" color="text.secondary">本次合作</Typography>
          <Typography variant="h6" fontWeight={900}>{actions.stage.title}</Typography>
          <Typography color="text.secondary" variant="body2">{actions.stage.description}</Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 1.2, bgcolor: '#ebe6dd', borderColor: '#d4ccc2', borderLeft: '4px solid #0d2fb2' }}>
          <Stack spacing={0.8}>
            <Typography fontWeight={800}>下一步动作</Typography>
            {actions.canConfirmDelivery ? (
              <Stack direction="row" spacing={0.8} flexWrap="wrap">
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
                主要操作已经放在聊天流和底部快捷入口中，可以边沟通边处理。
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
        </Paper>

        {latestQuote && (
          <Stack spacing={0.8}>
            <Typography fontWeight={800}>当前报价</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={getQuoteStatusLabel(latestQuote.status)} />
              <Chip size="small" label={centToYuan(latestQuote.amountCent)} />
            </Stack>
            <Typography color="text.secondary" variant="body2">
              {latestQuote.location || '拍摄地点待确认'} · {getPhotoUsageScopeLabel(latestQuote.photoUsageScope)}
            </Typography>
          </Stack>
        )}

        {order && (
          <Stack spacing={0.8}>
            <Typography fontWeight={800}>订单摘要</Typography>
            <Typography color="text.secondary" variant="body2">
              {centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)}
            </Typography>
            <Button variant="outlined" color="inherit" size="small" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive}>
              查看订单档案
            </Button>
          </Stack>
        )}

        <Divider />

        <Stack spacing={1}>
          <Typography fontWeight={800}>交付与授权</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" icon={<TaskAltRoundedIcon />} label={`交付 ${deliveryRecords.length}`} />
            <Chip size="small" icon={<ImageRoundedIcon />} label={`授权 ${photoAuthorizations.length}`} />
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <Typography fontWeight={800}>订单动态</Typography>
          {latestLog ? (
            <Typography color="text.secondary" variant="body2">
              {normalizeReason(latestLog.reason) || '合作进展已更新'} · {formatTime(latestLog.createdAt)}
            </Typography>
          ) : (
            <Typography color="text.secondary" variant="body2">报价确认后会持续同步订单进展。</Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  )
}

function normalizeReason(reason) {
  return String(reason || '')
    .replaceAll('需求方', '客户')
    .replaceAll('服务方', '摄影师')
}
