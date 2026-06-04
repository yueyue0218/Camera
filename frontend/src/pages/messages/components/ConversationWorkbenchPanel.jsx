import { Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { centToYuan } from '../../../utils/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'

function getLatestQuote(quotes) {
  return [...quotes].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0] || null
}

function getUserOrderRole(order, currentUser) {
  if (!order || !currentUser) return ''
  if (Number(order.customerId) === Number(currentUser.userId)) return 'CUSTOMER'
  if (Number(order.providerUserId) === Number(currentUser.userId)) return 'PROVIDER'
  return ''
}

function isBeforeShootStart(order) {
  const shootStartTime = order?.shootStartTime ? new Date(order.shootStartTime) : null
  return Boolean(shootStartTime) && !Number.isNaN(shootStartTime.getTime()) && new Date() < shootStartTime
}

function getOrderStage(order, currentUser) {
  const role = getUserOrderRole(order, currentUser)
  if (role === 'CUSTOMER') {
    if (order.status === 'PENDING_PAYMENT') return ['等待你支付', '支付后资金进入平台托管。']
    if (order.status === 'PAID_PENDING_SHOOT') return ['等待拍摄', isBeforeShootStart(order) ? '按约定时间准备拍摄，拍摄前仍可申请退款。' : '拍摄时间已开始，请继续在会话里沟通。']
    if (order.status === 'PENDING_DELIVERY') return ['等待摄影师交付', '拍摄完成后，摄影师会在这里上传作品。']
    if (order.status === 'DELIVERED_PENDING_CONFIRM') return ['等待你确认作品', '可以在聊天流里确认接收或提交返修。']
    if (order.status === 'REWORK_REQUIRED') return ['返修中', '等待摄影师重新交付作品。']
  }
  if (role === 'PROVIDER') {
    if (order.status === 'PENDING_PAYMENT') return ['等待客户付款', '客户付款后资金进入平台托管。']
    if (order.status === 'PAID_PENDING_SHOOT') return ['等待拍摄', '请按约定时间准备拍摄。']
    if (order.status === 'PENDING_DELIVERY') return ['等待你交付', '请在聊天流中上传作品给客户。']
    if (order.status === 'DELIVERED_PENDING_CONFIRM') return ['等待客户确认', '客户会确认接收或提交返修要求。']
    if (order.status === 'REWORK_REQUIRED') return ['返修待交付', '请根据客户要求重新上传作品。']
  }
  if (order.status === 'SHOOTING') return ['拍摄履约中', '双方正在按约定完成拍摄。']
  if (order.status === 'APPEALING') return ['争议处理中', '等待平台处理结果。']
  if (order.status === 'COMPLETED') return ['订单已完成', '可以查看作品、授权和订单档案。']
  if (order.status === 'CANCELLED') return ['订单已取消', '本次订单已经结束。']
  if (order.status === 'REFUNDED') return ['订单已退款', '本次订单已退款结束。']
  return ['合作进展', '可以继续在会话中沟通拍摄细节。']
}

function getQuoteStage(latestQuote, currentUser, conversation) {
  if (latestQuote?.status === 'PENDING_CONFIRM') {
    return currentUser.role === 'CUSTOMER'
      ? ['等待你确认报价', '确认后会生成平台托管订单。']
      : ['等待客户确认报价', '如果方案有变化，可以继续编辑报价。']
  }
  if (latestQuote?.status === 'REJECTED') return ['报价已拒绝', '可以继续沟通新的方案。']
  if (latestQuote?.status === 'EXPIRED') return ['报价已过期', '需要摄影师重新发送报价。']
  if (latestQuote?.status === 'CONFIRMED') return ['报价已确认', '订单信息会在会话里继续同步。']
  return currentUser.role === 'PROVIDER' && conversation && Number(currentUser.userId) === Number(conversation.participantBId)
    ? ['沟通拍摄需求', '确认方案后可以发送报价。']
    : ['沟通拍摄需求', '可以先确认时间、地点和交付要求。']
}

export function ConversationWorkbenchPanel({
  conversation,
  currentUser,
  quotes,
  order,
  statusLogs,
  deliveryRecords,
  photoAuthorizations,
  onOpenOrderArchive
}) {
  const latestQuote = getLatestQuote(quotes)
  const [stageTitle, nextStep] = order ? getOrderStage(order, currentUser) : getQuoteStage(latestQuote, currentUser, conversation)
  const latestLog = statusLogs[statusLogs.length - 1]
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
          <Typography variant="h6" fontWeight={900}>{stageTitle}</Typography>
          <Typography color="text.secondary" variant="body2">{nextStep}</Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 1.2, bgcolor: '#ebe6dd', borderColor: '#d4ccc2', borderLeft: '4px solid #0d2fb2' }}>
          <Stack spacing={0.8}>
            <Typography fontWeight={800}>下一步动作</Typography>
            <Typography variant="body2" color="text.secondary">
              主要操作已经放在聊天流和底部快捷入口中，可以边沟通边处理。
            </Typography>
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
