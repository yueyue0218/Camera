import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material'
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
import { canEditQuote, getPhotoUsageScopeLabel, getQuoteOrderId, getQuoteStatusLabel } from '../utils/quoteUtils.js'

const STATUS_LABELS = {
  PENDING_PAYMENT: '订单已生成，等待客户付款',
  PAID_PENDING_SHOOT: '订单已支付，等待拍摄',
  SHOOTING: '拍摄履约中',
  PENDING_DELIVERY: '拍摄已结束，等待摄影师交付',
  DELIVERED_PENDING_CONFIRM: '作品已交付，等待客户确认',
  REWORK_REQUIRED: '客户提交了返修要求',
  APPEALING: '争议处理中',
  COMPLETED: '订单已完成',
  CANCELLED: '订单已取消',
  REFUNDED: '订单已退款'
}

function systemCardSx(accent = '#0d2fb2') {
  return {
    width: 'min(100%, 540px)',
    mx: 'auto',
    p: { xs: 1.15, md: 1.3 },
    bgcolor: '#ebe6dd',
    borderColor: '#d4ccc2',
    borderLeft: `4px solid ${accent}`,
    boxShadow: 'none'
  }
}

function isCustomer(conversation, currentUser) {
  return Number(currentUser?.userId) === Number(conversation?.participantAId)
}

function getLatestDelivery(deliveryRecords) {
  return [...deliveryRecords].sort((left, right) => new Date(right.uploadTime || 0) - new Date(left.uploadTime || 0))[0] || null
}

function getDeliveryFileOptions(deliveryRecords) {
  return deliveryRecords
    .filter(record => record.fileId)
    .map(record => ({
      fileId: Number(record.fileId),
      fileName: record.fileName || '作品文件',
      uploadTime: record.uploadTime
    }))
}

export function ConversationSystemCards({
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
  cancelAction,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onOpenOrder,
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
  const orderedQuotes = [...quotes].sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0))
  const canReviewDelivery = order && canCustomerRequestRework(order, currentUser)
  return (
    <>
      {orderedQuotes.map(quote => (
        <QuoteSystemCard
          key={`quote-${quote.quotationId}`}
          quote={quote}
          conversation={conversation}
          currentUser={currentUser}
          loading={loading}
          onStartQuoteEditing={onStartQuoteEditing}
          onConfirmQuote={onConfirmQuote}
          onRejectQuote={onRejectQuote}
          onOpenOrder={onOpenOrder}
        />
      ))}
      {order && (
        <OrderSystemCard
          order={order}
          currentUser={currentUser}
          cancelAction={cancelAction}
          loading={loading}
          onPayOrder={onPayOrder}
          onCancelOrder={onCancelOrder}
          onConfirmOrder={onConfirmOrder}
        />
      )}
      {canReviewDelivery ? (
        <DeliveryReviewCard
          deliveryRecords={deliveryRecords}
          reworkRequirement={reworkRequirement}
          loading={loading}
          onSubmitRework={onSubmitRework}
          onReworkRequirementChange={onReworkRequirementChange}
          onConfirmOrder={onConfirmOrder}
        />
      ) : !!deliveryRecords.length && (
        <DeliverySystemCard
          deliveryRecords={deliveryRecords}
        />
      )}
      {order && canProviderUploadDelivery(order, currentUser) && (
        <DeliveryUploadCard
          order={order}
          deliveryForm={deliveryForm}
          loading={loading}
          onSubmitDelivery={onSubmitDelivery}
          onDeliveryFileChange={onDeliveryFileChange}
          onDeliveryRemarkChange={onDeliveryRemarkChange}
        />
      )}
      {!!photoAuthorizations.length && (
        <AuthorizationSystemCard
          order={order}
          currentUser={currentUser}
          photoAuthorizations={photoAuthorizations}
          deliveryRecords={deliveryRecords}
          authorizationRemarks={authorizationRemarks}
          loading={loading}
          onAuthorizationRemarkChange={onAuthorizationRemarkChange}
          onDecidePhotoAuthorization={onDecidePhotoAuthorization}
        />
      )}
      {order && canProviderRequestPhotoAuthorization(order, currentUser) && (
        <AuthorizationRequestCard
          deliveryRecords={deliveryRecords}
          photoAuthorizationForm={photoAuthorizationForm}
          loading={loading}
          onPhotoAuthorizationFileIdsChange={onPhotoAuthorizationFileIdsChange}
          onPhotoAuthorizationRemarkChange={onPhotoAuthorizationRemarkChange}
          onSubmitPhotoAuthorization={onSubmitPhotoAuthorization}
        />
      )}
      {!!statusLogs.length && (
        <OrderProgressCard statusLogs={statusLogs} />
      )}
    </>
  )
}

function QuoteSystemCard({ quote, conversation, currentUser, loading, onStartQuoteEditing, onConfirmQuote, onRejectQuote, onOpenOrder }) {
  const orderId = getQuoteOrderId(quote)
  return (
    <Paper id="conversation-quote-card" variant="outlined" sx={systemCardSx('#0d2fb2')}>
      <Stack spacing={1.1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography fontWeight={900}>摄影师发送了报价</Typography>
            <Typography color="text.secondary" variant="body2">
              {centToYuan(quote.amountCent)} · {formatTime(quote.shootStartTime)} · {quote.location || '拍摄地点待确认'}
            </Typography>
          </Box>
          <Chip size="small" label={getQuoteStatusLabel(quote.status)} />
        </Stack>
        <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {quote.serviceContent || '服务内容待补充'}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={0.8}>
          <Chip size="small" label={`最晚交付：${formatTime(quote.deliveryDeadline)}`} />
          <Chip size="small" label={getPhotoUsageScopeLabel(quote.photoUsageScope)} />
        </Stack>
        {quote.status === 'PENDING_CONFIRM' && isCustomer(conversation, currentUser) && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button size="small" variant="contained" onClick={() => onConfirmQuote(quote)} disabled={loading}>确认报价</Button>
            <Button size="small" variant="outlined" color="inherit" onClick={() => onRejectQuote(quote)} disabled={loading}>拒绝报价</Button>
          </Stack>
        )}
        {canEditQuote(quote, conversation, currentUser) && (
          <Button size="small" variant="outlined" startIcon={<LocalOfferRoundedIcon />} onClick={() => onStartQuoteEditing(quote)} disabled={loading} sx={{ alignSelf: 'flex-start' }}>
            编辑报价
          </Button>
        )}
        {quote.status === 'CONFIRMED' && orderId && (
          <Button size="small" variant="outlined" startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenOrder(orderId)} sx={{ alignSelf: 'flex-start' }}>
            查看订单档案
          </Button>
        )}
      </Stack>
    </Paper>
  )
}

function OrderSystemCard({ order, currentUser, cancelAction, loading, onPayOrder, onCancelOrder, onConfirmOrder }) {
  return (
    <Paper variant="outlined" sx={systemCardSx('#f7ce3a')}>
      <Stack spacing={1.1}>
        <Typography fontWeight={900}>{STATUS_LABELS[order.status] || '订单进展已更新'}</Typography>
        <Typography color="text.secondary" variant="body2">
          {centToYuan(order.amountCent)} · {formatTime(order.shootStartTime)} - {formatTime(order.shootEndTime)}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {canCustomerPay(order, currentUser) && (
            <Button size="small" variant="contained" startIcon={<PaidRoundedIcon />} onClick={onPayOrder} disabled={loading}>去支付</Button>
          )}
          {cancelAction && (
            <Button size="small" variant="outlined" color="inherit" onClick={() => onCancelOrder(cancelAction)} disabled={loading}>{cancelAction.label}</Button>
          )}
          {canCustomerConfirm(order, currentUser) && (
            <Button size="small" variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder} disabled={loading}>确认接收</Button>
          )}
        </Stack>
        {order.status === 'PAID_PENDING_SHOOT' && Number(order.customerId) === Number(currentUser.userId) && new Date(order.shootStartTime) <= new Date() && (
          <Alert severity="warning">拍摄时间已开始，普通取消入口已关闭。如需处理异常，请继续在会话中说明情况。</Alert>
        )}
      </Stack>
    </Paper>
  )
}

function DeliveryReviewCard({ deliveryRecords, reworkRequirement, loading, onSubmitRework, onReworkRequirementChange, onConfirmOrder }) {
  const latestDelivery = getLatestDelivery(deliveryRecords)
  return (
    <Paper id="conversation-rework-action" variant="outlined" sx={systemCardSx('#0d2fb2')}>
      <Stack spacing={1.1}>
        <Typography fontWeight={900}>摄影师上传了作品</Typography>
        <Typography color="text.secondary" variant="body2">
          请查看交付内容，确认是否接收。{latestDelivery ? `最近交付：${formatTime(latestDelivery.uploadTime)}` : ''}
        </Typography>
        {latestDelivery?.remark && <Typography variant="body2">{latestDelivery.remark}</Typography>}
        <Paper component="form" variant="outlined" onSubmit={onSubmitRework} sx={{ p: 1, bgcolor: '#f8f3eb', borderColor: '#d4ccc2' }}>
          <Stack spacing={1}>
            <TextField
              label="返修要求"
              value={reworkRequirement}
              onChange={event => onReworkRequirementChange(event.target.value)}
              multiline
              minRows={2}
              placeholder="请说明需要调整的照片和修改方向"
              required
            />
            <Typography color="text.secondary" variant="body2">摄影师会根据你的返修要求重新交付。</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button type="button" size="small" variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder} disabled={loading}>确认接收</Button>
              <Button type="submit" size="small" variant="outlined" color="inherit" startIcon={<RefreshRoundedIcon />} disabled={loading}>提交返修</Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  )
}

function DeliverySystemCard({ deliveryRecords }) {
  const latestDelivery = getLatestDelivery(deliveryRecords)
  return (
    <Paper variant="outlined" sx={systemCardSx('#0d2fb2')}>
      <Stack spacing={1.1}>
        <Typography fontWeight={900}>摄影师上传了作品</Typography>
        <Typography color="text.secondary" variant="body2">
          共 {deliveryRecords.length} 次交付{latestDelivery ? ` · 最近交付：${formatTime(latestDelivery.uploadTime)}` : ''}
        </Typography>
        {latestDelivery?.remark && <Typography variant="body2">{latestDelivery.remark}</Typography>}
      </Stack>
    </Paper>
  )
}

function DeliveryUploadCard({ order, deliveryForm, loading, onSubmitDelivery, onDeliveryFileChange, onDeliveryRemarkChange }) {
  return (
    <Paper id="conversation-delivery-action" component="form" variant="outlined" onSubmit={onSubmitDelivery} sx={systemCardSx('#0d2fb2')}>
      <Stack spacing={1.1}>
        <Typography fontWeight={900}>{order.status === 'REWORK_REQUIRED' ? '客户提出返修，请重新上传作品' : '上传作品给客户'}</Typography>
        <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />} sx={{ alignSelf: 'flex-start' }}>
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
        <Button type="submit" variant="contained" startIcon={<TaskAltRoundedIcon />} disabled={loading || !deliveryForm.file} sx={{ alignSelf: 'flex-start' }}>
          {order.status === 'REWORK_REQUIRED' ? '提交返修作品' : '上传交付'}
        </Button>
      </Stack>
    </Paper>
  )
}

function AuthorizationSystemCard({ order, currentUser, photoAuthorizations, deliveryRecords, authorizationRemarks, loading, onAuthorizationRemarkChange, onDecidePhotoAuthorization }) {
  const deliveryFileOptions = getDeliveryFileOptions(deliveryRecords)
  const deliveryFileNameMap = new Map(deliveryFileOptions.map(file => [file.fileId, file.fileName]))
  return (
    <Paper id="conversation-authorization-action" variant="outlined" sx={systemCardSx('#f85104')}>
      <Stack spacing={1.1}>
        <Typography fontWeight={900}>摄影师申请将部分作品用于展示</Typography>
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
                      <Button variant="contained" size="small" startIcon={<CheckCircleRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'approve')} disabled={loading}>同意展示</Button>
                      <Button variant="outlined" size="small" color="inherit" startIcon={<CloseRoundedIcon />} onClick={() => onDecidePhotoAuthorization(authorization, 'reject')} disabled={loading}>拒绝展示</Button>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Paper>
          )
        })}
      </Stack>
    </Paper>
  )
}

function AuthorizationRequestCard({ deliveryRecords, photoAuthorizationForm, loading, onPhotoAuthorizationFileIdsChange, onPhotoAuthorizationRemarkChange, onSubmitPhotoAuthorization }) {
  const deliveryFileOptions = getDeliveryFileOptions(deliveryRecords)
  const deliveryFileNameMap = new Map(deliveryFileOptions.map(file => [file.fileId, file.fileName]))
  return (
    <Paper id="conversation-authorization-action" component="form" variant="outlined" onSubmit={onSubmitPhotoAuthorization} sx={systemCardSx('#f85104')}>
      <Stack spacing={1.1}>
        <Typography fontWeight={900}>申请照片展示授权</Typography>
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
                  <MenuItem key={file.fileId} value={file.fileId}>{file.fileName} · {formatTime(file.uploadTime)}</MenuItem>
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
            <Button type="submit" variant="contained" startIcon={<ImageRoundedIcon />} disabled={loading || !photoAuthorizationForm.fileIds.length} sx={{ alignSelf: 'flex-start' }}>发送授权申请</Button>
          </>
        ) : (
          <Alert severity="info">暂无可授权交付文件，请先完成交付。</Alert>
        )}
      </Stack>
    </Paper>
  )
}

function OrderProgressCard({ statusLogs }) {
  const latest = statusLogs.slice(-3).reverse()
  return (
    <Paper variant="outlined" sx={systemCardSx('#0d2fb2')}>
      <Stack spacing={1}>
        <Typography fontWeight={900}>订单动态</Typography>
        {latest.map(log => (
          <Box key={log.logId || `${log.orderId}-${log.createdAt}`}>
            <Typography fontWeight={800}>{STATUS_LABELS[log.toStatus] || '订单进展已更新'}</Typography>
            <Typography color="text.secondary" variant="body2">{normalizeReason(log.reason) || '合作进展已更新'} · {formatTime(log.createdAt)}</Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  )
}

function normalizeReason(reason) {
  return String(reason || '')
    .replaceAll('需求方', '客户')
    .replaceAll('服务方', '摄影师')
}
