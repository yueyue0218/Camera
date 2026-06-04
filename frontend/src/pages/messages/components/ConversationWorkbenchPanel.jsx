import { Alert, Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { centToYuan } from '../../../utils/index.js'
import {
  canCustomerConfirm,
  canCustomerPay,
  canCustomerRequestRework,
  canCustomerReviewPhotoAuthorization,
  canProviderRequestPhotoAuthorization,
  canProviderUploadDelivery,
  PHOTO_AUTHORIZATION_STATUS_LABELS
} from '../../orders/orderActions.js'
import { formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'

const ACTIVE_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PAID_PENDING_SHOOT',
  'SHOOTING',
  'PENDING_DELIVERY',
  'DELIVERED_PENDING_CONFIRM',
  'REWORK_REQUIRED',
  'APPEALING'
])

const STATUS_LABELS = {
  PENDING_PAYMENT: '待支付',
  PAID_PENDING_SHOOT: '等待拍摄',
  SHOOTING: '拍摄中',
  PENDING_DELIVERY: '等待交付',
  DELIVERED_PENDING_CONFIRM: '待确认作品',
  REWORK_REQUIRED: '返修中',
  APPEALING: '争议处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款'
}

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

function getCancelAction(order, currentUser) {
  if (getUserOrderRole(order, currentUser) !== 'CUSTOMER') return null
  if (order.status === 'PENDING_PAYMENT') {
    return {
      label: '取消订单',
      confirmText: '确定取消这个待支付订单吗？该订单尚未支付，不涉及退款。',
      reason: '客户取消未支付订单'
    }
  }
  if (order.status === 'PAID_PENDING_SHOOT' && isBeforeShootStart(order)) {
    return {
      label: '取消并申请退款',
      confirmText: '确定取消订单并申请退款吗？平台托管资金将退回客户。',
      reason: '客户拍摄前取消，申请退回托管款'
    }
  }
  return null
}

function getOrderStage(order, currentUser, deliveryRecords) {
  const role = getUserOrderRole(order, currentUser)
  const latestDelivery = deliveryRecords[0]
  if (role === 'CUSTOMER') {
    if (order.status === 'PENDING_PAYMENT') return ['报价已确认，等待你支付', '支付后资金会进入平台托管，摄影师再按约定时间履约。', '你可以完成支付，也可以取消这个待支付订单。']
    if (order.status === 'PAID_PENDING_SHOOT') return ['订单已支付，等待拍摄', '平台托管资金已建立，双方按约定拍摄时间准备。', isBeforeShootStart(order) ? '拍摄开始前，你可以取消并申请退款。' : '拍摄时间已开始，普通取消入口会关闭。']
    if (order.status === 'SHOOTING') return ['当前处于拍摄履约中', '这次拍摄已经进入履约阶段。', '如有异常，请在会话中说明情况，后续走争议处理。']
    if (order.status === 'PENDING_DELIVERY') return ['等待摄影师上传作品', '拍摄已结束，正在等待摄影师交付作品。', '你可以继续沟通交付细节。']
    if (order.status === 'DELIVERED_PENDING_CONFIRM') return ['摄影师已交付作品', latestDelivery ? `最新交付时间：${formatTime(latestDelivery.uploadTime)}` : '请查看交付记录。', '你可以确认接收，也可以提交返修要求。']
    if (order.status === 'REWORK_REQUIRED') return ['返修中', '返修要求已提交，等待摄影师重新交付。', '你可以在聊天里补充说明返修细节。']
    if (order.status === 'COMPLETED') return ['订单已完成', '本次合作已经完成，托管资金已按规则处理。', '可以查看交付记录、处理授权或进入订单档案。']
    if (order.status === 'CANCELLED') return ['订单已取消', '本次订单已经结束。', '可以进入订单档案查看完整记录。']
    if (order.status === 'REFUNDED') return ['订单已退款', '本次订单已退款结束。', '可以进入订单档案查看完整记录。']
    if (order.status === 'APPEALING') return ['平台正在处理争议', '订单处于争议处理阶段，普通履约动作会暂停。', '请等待平台处理结果。']
  }
  if (role === 'PROVIDER') {
    if (order.status === 'PENDING_PAYMENT') return ['客户已确认报价，等待付款', '客户支付后资金会进入平台托管。', '你可以继续沟通拍摄准备事项。']
    if (order.status === 'PAID_PENDING_SHOOT') return ['客户已支付，等待拍摄', '平台托管资金已建立，请按约定时间准备拍摄。', '拍摄信息可在这里持续查看。']
    if (order.status === 'SHOOTING') return ['当前处于拍摄履约中', '这次拍摄已经进入履约阶段。', '拍摄完成后继续交付作品。']
    if (order.status === 'PENDING_DELIVERY') return ['拍摄已结束，请上传作品', '客户正在等待你交付本次作品。', '请上传交付文件，并说明交付内容。']
    if (order.status === 'DELIVERED_PENDING_CONFIRM') return ['作品已交付，等待客户确认', latestDelivery ? `最新交付时间：${formatTime(latestDelivery.uploadTime)}` : '作品已经提交。', '客户会确认接收或提交返修要求。']
    if (order.status === 'REWORK_REQUIRED') return ['客户提出返修，请重新上传作品', '客户已提交返修要求，需要你重新交付。', '请上传返修后的作品。']
    if (order.status === 'COMPLETED') return ['订单已完成', '本次合作已经完成。', '如需展示客片，可申请照片展示授权。']
    if (order.status === 'CANCELLED') return ['订单已取消', '本次订单已经结束。', '可以进入订单档案查看完整记录。']
    if (order.status === 'REFUNDED') return ['订单已退款', '本次订单已退款结束。', '可以进入订单档案查看完整记录。']
    if (order.status === 'APPEALING') return ['平台正在处理争议', '订单处于争议处理阶段，普通履约动作会暂停。', '请等待平台处理结果。']
  }
  return ['本次合作状态', '正在同步本次合作信息。', '请稍后刷新。']
}

function getOrderStatusLabel(status) {
  return STATUS_LABELS[status] || '状态已更新'
}

function getVisibleStatusLogs(statusLogs) {
  return statusLogs.slice(-3).reverse()
}

export function ConversationWorkbenchPanel({
  conversation,
  currentUser,
  quotes,
  order,
  statusLogs,
  deliveryRecords,
  photoAuthorizations,
  deliveryForm,
  reworkRequirement,
  photoAuthorizationForm,
  authorizationRemarks,
  loading,
  onOpenQuoteForm,
  onOpenOrderArchive,
  onPayOrder,
  onCancelOrder,
  onConfirmOrder,
  onSubmitRework,
  onReworkRequirementChange,
  onDeliveryFileChange,
  onDeliveryRemarkChange,
  onSubmitDelivery,
  onPhotoAuthorizationFileIdsChange,
  onPhotoAuthorizationRemarkChange,
  onSubmitPhotoAuthorization,
  onAuthorizationRemarkChange,
  onDecidePhotoAuthorization
}) {
  const latestQuote = getLatestQuote(quotes)
  const pendingQuote = quotes.find(quote => quote.status === 'PENDING_CONFIRM')
  const userOrderRole = getUserOrderRole(order, currentUser)
  const canUploadDelivery = order && canProviderUploadDelivery(order, currentUser)
  const canRequestRework = order && canCustomerRequestRework(order, currentUser)
  const canRequestPhotoAuthorization = order && canProviderRequestPhotoAuthorization(order, currentUser)
  const cancelAction = order ? getCancelAction(order, currentUser) : null
  const deliveryFileOptions = deliveryRecords
    .filter(record => record.fileId)
    .map(record => ({
      fileId: Number(record.fileId),
      fileName: record.fileName || '作品文件',
      uploadTime: record.uploadTime
    }))
  const deliveryFileNameMap = new Map(deliveryFileOptions.map(file => [file.fileId, file.fileName]))
  const [stageTitle, stageDescription, nextStep] = order
    ? getOrderStage(order, currentUser, deliveryRecords)
    : getQuoteStage(latestQuote, pendingQuote, currentUser, conversation)

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.8, md: 2.2 },
        bgcolor: '#f8f3eb',
        borderColor: '#d4ccc2',
        position: { md: 'sticky' },
        top: { md: 16 },
        alignSelf: 'start'
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="overline" color="text.secondary">本次合作</Typography>
          <Typography variant="h6" fontWeight={900}>{stageTitle}</Typography>
          <Typography color="text.secondary">{stageDescription}</Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#ebe6dd', borderColor: '#d4ccc2', borderLeft: '5px solid #0d2fb2' }}>
          <Stack spacing={0.8}>
            <Typography fontWeight={800}>下一步</Typography>
            <Typography>{nextStep}</Typography>
            {order && <Chip size="small" sx={{ alignSelf: 'flex-start' }} label={userOrderRole === 'PROVIDER' ? '你是摄影师' : '你是客户'} />}
          </Stack>
        </Paper>

        {!order && (
          <QuoteSummary
            latestQuote={latestQuote}
            pendingQuote={pendingQuote}
            currentUser={currentUser}
            conversation={conversation}
            loading={loading}
            onOpenQuoteForm={onOpenQuoteForm}
          />
        )}

        {order && (
          <Stack spacing={1.5}>
            <OrderSummary order={order} />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {canCustomerPay(order, currentUser) && (
                <Button variant="contained" startIcon={<PaidRoundedIcon />} onClick={onPayOrder} disabled={loading}>
                  支付订单
                </Button>
              )}
              {cancelAction && (
                <Button variant="outlined" color="inherit" onClick={() => onCancelOrder(cancelAction)} disabled={loading}>
                  {cancelAction.label}
                </Button>
              )}
              {canCustomerConfirm(order, currentUser) && (
                <Button variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder} disabled={loading}>
                  确认接收
                </Button>
              )}
              {order.status === 'PAID_PENDING_SHOOT' && userOrderRole === 'CUSTOMER' && !isBeforeShootStart(order) && (
                <Alert severity="warning" sx={{ width: '100%' }}>拍摄时间已开始，普通取消入口已关闭。如需处理异常，请在会话中说明情况。</Alert>
              )}
            </Stack>

            {canUploadDelivery && (
              <Paper component="form" variant="outlined" onSubmit={onSubmitDelivery} sx={{ p: 1.5, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
                <Stack spacing={1.2}>
                  <Typography fontWeight={800}>{order.status === 'REWORK_REQUIRED' ? '重新上传返修作品' : '上传交付作品'}</Typography>
                  <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                    选择作品文件
                    <input hidden type="file" onChange={event => onDeliveryFileChange(event.target.files?.[0] || null)} />
                  </Button>
                  <Typography color="text.secondary" variant="body2">{deliveryForm.file ? deliveryForm.file.name : '尚未选择文件'}</Typography>
                  <TextField
                    label="交付说明"
                    value={deliveryForm.remark}
                    onChange={event => onDeliveryRemarkChange(event.target.value)}
                    multiline
                    minRows={2}
                    placeholder="说明本次交付内容、返修修改点或注意事项"
                  />
                  <Button type="submit" variant="contained" startIcon={<TaskAltRoundedIcon />} disabled={loading || !deliveryForm.file}>
                    {order.status === 'REWORK_REQUIRED' ? '提交返修作品' : '上传交付'}
                  </Button>
                </Stack>
              </Paper>
            )}

            {canRequestRework && (
              <Paper component="form" variant="outlined" onSubmit={onSubmitRework} sx={{ p: 1.5, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
                <Stack spacing={1.2}>
                  <Typography fontWeight={800}>提交返修要求</Typography>
                  <TextField
                    label="返修要求"
                    value={reworkRequirement}
                    onChange={event => onReworkRequirementChange(event.target.value)}
                    multiline
                    minRows={3}
                    placeholder="请说明需要返修的照片、问题和期望修改方向"
                    required
                  />
                  <Button type="submit" variant="contained" color="warning" startIcon={<RefreshRoundedIcon />} disabled={loading}>
                    请求返修
                  </Button>
                </Stack>
              </Paper>
            )}

            <DeliverySummary deliveryRecords={deliveryRecords} />

            {canRequestPhotoAuthorization && (
              <Paper component="form" variant="outlined" onSubmit={onSubmitPhotoAuthorization} sx={{ p: 1.5, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
                <Stack spacing={1.2}>
                  <Typography fontWeight={800}>申请照片展示授权</Typography>
                  {deliveryFileOptions.length ? (
                    <>
                      <FormControl size="small">
                        <InputLabel>选择交付文件</InputLabel>
                        <Select
                          multiple
                          label="选择交付文件"
                          value={photoAuthorizationForm.fileIds}
                          onChange={event => {
                            const value = event.target.value
                            onPhotoAuthorizationFileIdsChange((typeof value === 'string' ? value.split(',') : value).map(Number))
                          }}
                          renderValue={selected => selected.map(fileId => deliveryFileNameMap.get(Number(fileId)) || '作品文件').join('、')}
                        >
                          {deliveryFileOptions.map(file => (
                            <MenuItem key={file.fileId} value={file.fileId}>
                              {file.fileName} · {formatTime(file.uploadTime)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        label="申请说明"
                        value={photoAuthorizationForm.remark}
                        onChange={event => onPhotoAuthorizationRemarkChange(event.target.value)}
                        multiline
                        minRows={2}
                        placeholder="说明希望展示这些照片的用途，例如作品集客片展示"
                      />
                      <Button type="submit" variant="contained" startIcon={<ImageRoundedIcon />} disabled={loading || !photoAuthorizationForm.fileIds.length}>
                        发送授权申请
                      </Button>
                    </>
                  ) : (
                    <Alert severity="info">暂无可授权交付文件，请先完成交付。</Alert>
                  )}
                </Stack>
              </Paper>
            )}

            <AuthorizationSummary
              order={order}
              currentUser={currentUser}
              photoAuthorizations={photoAuthorizations}
              authorizationRemarks={authorizationRemarks}
              deliveryFileNameMap={deliveryFileNameMap}
              loading={loading}
              onAuthorizationRemarkChange={onAuthorizationRemarkChange}
              onDecidePhotoAuthorization={onDecidePhotoAuthorization}
            />

            <Divider />
            <Stack spacing={1}>
              <Typography fontWeight={800}>订单动态</Typography>
              {getVisibleStatusLogs(statusLogs).map(log => (
                <Paper key={log.logId || `${log.orderId}-${log.createdAt}`} variant="outlined" sx={{ p: 1.2, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
                  <Typography fontWeight={800}>{getOrderStatusLabel(log.toStatus)}</Typography>
                  <Typography color="text.secondary" variant="body2">{log.reason ? normalizeReason(log.reason) : '订单进展已更新'} · {formatTime(log.createdAt)}</Typography>
                </Paper>
              ))}
              {!statusLogs.length && <Typography color="text.secondary">暂无订单动态</Typography>}
            </Stack>
          </Stack>
        )}

        <Button variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive} disabled={!order}>
          查看订单档案
        </Button>
      </Stack>
    </Paper>
  )
}

function getQuoteStage(latestQuote, pendingQuote, currentUser, conversation) {
  if (pendingQuote) {
    return currentUser.role === 'CUSTOMER'
      ? ['摄影师已发送报价', '请查看报价内容，确认后会生成平台托管订单。', '你可以在报价卡上确认或拒绝报价。']
      : ['等待客户确认报价', '客户确认后会生成订单并进入支付环节。', '如果沟通结果变化，可以继续编辑这份待确认报价。']
  }
  if (latestQuote?.status === 'REJECTED') {
    return currentUser.role === 'PROVIDER'
      ? ['报价已被拒绝', '可以继续沟通新的拍摄方案。', '重新确认后，你可以发送新的正式报价。']
      : ['报价已拒绝', '可以继续和摄影师沟通新的方案。', '等待摄影师重新发送报价。']
  }
  if (latestQuote?.status === 'EXPIRED') {
    return currentUser.role === 'PROVIDER'
      ? ['报价已过期', '这份报价不能再确认。', '请根据新的沟通结果重新发送报价。']
      : ['报价已过期', '这份报价已经不能确认。', '请摄影师重新发送报价。']
  }
  if (latestQuote?.status === 'CONFIRMED') {
    return ['报价已确认', '订单信息正在同步到本次合作工作台。', '稍后可在这里继续处理支付和履约。']
  }
  return currentUser.role === 'PROVIDER' && conversation && Number(currentUser.userId) === Number(conversation.participantBId)
    ? ['正在沟通拍摄需求', '这段会话还没有正式报价。', '你可以根据沟通结果发送报价。']
    : ['正在沟通拍摄需求', '这段会话还没有正式报价。', '可以先确认拍摄时间、地点和交付要求。']
}

function QuoteSummary({ latestQuote, pendingQuote, currentUser, conversation, loading, onOpenQuoteForm }) {
  const isProvider = currentUser.role === 'PROVIDER' && Number(currentUser.userId) === Number(conversation?.participantBId)
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
      <Stack spacing={1}>
        <Typography fontWeight={800}>当前报价</Typography>
        {latestQuote ? (
          <>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={getQuoteStatusLabel(latestQuote.status)} />
              <Chip size="small" label={centToYuan(latestQuote.amountCent)} />
            </Stack>
            <Typography color="text.secondary" variant="body2">
              {latestQuote.location || '拍摄地点待确认'} · {getPhotoUsageScopeLabel(latestQuote.photoUsageScope)}
            </Typography>
          </>
        ) : (
          <Typography color="text.secondary">还没有正式报价。</Typography>
        )}
        {isProvider && !pendingQuote && (
          <Button variant="contained" startIcon={<LocalOfferRoundedIcon />} onClick={onOpenQuoteForm} disabled={loading}>
            发送报价
          </Button>
        )}
      </Stack>
    </Paper>
  )
}

function OrderSummary({ order }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip size="small" color={ACTIVE_STATUSES.has(order.status) ? 'primary' : 'default'} label={getOrderStatusLabel(order.status)} />
          <Chip size="small" label={centToYuan(order.amountCent)} />
        </Stack>
        <Typography color="text.secondary" variant="body2">
          拍摄时间：{formatTime(order.shootStartTime)} - {formatTime(order.shootEndTime)}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          最晚交付：{formatTime(order.deliveryDeadline)}
        </Typography>
      </Stack>
    </Paper>
  )
}

function DeliverySummary({ deliveryRecords }) {
  return (
    <Stack spacing={1}>
      <Typography fontWeight={800}>交付作品</Typography>
      {deliveryRecords.slice(0, 3).map(record => (
        <Paper key={record.deliveryId || `${record.orderId}-${record.fileId}-${record.uploadTime}`} variant="outlined" sx={{ p: 1.2, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
          <Typography fontWeight={800}>{record.fileName || '作品文件'}</Typography>
          <Typography color="text.secondary" variant="body2">第 {record.deliveryRound || 1} 次交付 · {formatTime(record.uploadTime)}</Typography>
          {record.remark && <Typography variant="body2">{record.remark}</Typography>}
        </Paper>
      ))}
      {!deliveryRecords.length && <Typography color="text.secondary">还没有交付作品。</Typography>}
    </Stack>
  )
}

function AuthorizationSummary({
  order,
  currentUser,
  photoAuthorizations,
  authorizationRemarks,
  deliveryFileNameMap,
  loading,
  onAuthorizationRemarkChange,
  onDecidePhotoAuthorization
}) {
  return (
    <Stack spacing={1}>
      <Typography fontWeight={800}>照片展示授权</Typography>
      {photoAuthorizations.slice(0, 3).map(authorization => {
        const canReview = canCustomerReviewPhotoAuthorization(order, currentUser, authorization)
        return (
          <Paper key={authorization.id} variant="outlined" sx={{ p: 1.2, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={PHOTO_AUTHORIZATION_STATUS_LABELS[authorization.status] || '授权状态已更新'} />
                {(authorization.files || []).map(file => (
                  <Chip key={file.id || file.fileId} size="small" label={deliveryFileNameMap.get(Number(file.fileId)) || '作品文件'} />
                ))}
              </Stack>
              {authorization.remark && <Typography variant="body2">{authorization.remark}</Typography>}
              {canReview && (
                <Stack spacing={1}>
                  <TextField
                    size="small"
                    label="处理备注（可选）"
                    value={authorizationRemarks[authorization.id] || ''}
                    onChange={event => onAuthorizationRemarkChange(authorization.id, event.target.value)}
                  />
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="contained" size="small" startIcon={<CheckCircleRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'approve')} disabled={loading}>
                      同意展示
                    </Button>
                    <Button variant="outlined" size="small" color="inherit" startIcon={<CloseRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'reject')} disabled={loading}>
                      拒绝展示
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Paper>
        )
      })}
      {!photoAuthorizations.length && <Typography color="text.secondary">暂无照片展示授权申请。</Typography>}
    </Stack>
  )
}

function normalizeReason(reason) {
  return String(reason)
    .replaceAll('需求方', '客户')
    .replaceAll('服务方', '摄影师')
}
