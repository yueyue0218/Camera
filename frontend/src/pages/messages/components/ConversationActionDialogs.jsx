import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Radio,
  RadioGroup,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'
import { centToYuan } from '../../../utils/index.js'
import { formatDate, formatTime } from '../utils/conversationUtils.js'
import { getPhotoUsageScopeLabel, getQuoteStatusLabel } from '../utils/quoteUtils.js'
import { StatusChip } from './StatusChip.jsx'

export function ConversationActionDialogs({
  activeAction,
  loading,
  quote,
  order,
  paymentMethod,
  canConfirmQuote,
  canRejectQuote,
  canResendQuote,
  deliveryRecords,
  deliveryForm,
  reworkRequirement,
  photoAuthorizationForm,
  onClose,
  onPaymentMethodChange,
  onConfirmQuote,
  onRejectQuote,
  onResendQuote,
  onConfirmPayment,
  onDeliveryFileChange,
  onDeliveryRemarkChange,
  onReworkRequirementChange,
  onPhotoAuthorizationFileIdsChange,
  onPhotoAuthorizationRemarkChange,
  onSubmitDelivery,
  onSubmitRework,
  onSubmitPhotoAuthorization
}) {
  const safeDeliveryForm = deliveryForm || { file: null, remark: '' }
  const safePhotoAuthorizationForm = {
    fileIds: Array.isArray(photoAuthorizationForm?.fileIds) ? photoAuthorizationForm.fileIds : [],
    remark: photoAuthorizationForm?.remark || ''
  }
  const deliveryFiles = (Array.isArray(deliveryRecords) ? deliveryRecords : [])
    .filter(record => record.fileId)
    .map(record => ({
      fileId: Number(record.fileId),
      fileName: getSafeDisplayText(record.fileName, '作品文件')
    }))

  async function submitAndClose(handler, event) {
    event.preventDefault()
    if (typeof handler !== 'function') return
    const succeeded = await handler(event)
    if (succeeded) onClose()
  }

  return (
    <>
      <Dialog open={activeAction === 'QUOTE_DETAIL' && Boolean(quote)} onClose={onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
        <DialogTitle sx={dialogTitleSx}>报价详情</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          {quote ? (
            <Stack spacing={1.4} sx={{ pt: 1 }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: PORTRA_COLORS.blue, fontSize: 24, fontWeight: 950 }}>{centToYuan(quote.amountCent)}</Typography>
                <StatusChip label={getQuoteStatusLabel(quote.status)} />
              </Stack>
              <DetailRows rows={[
                ['拍摄时间', `${formatTime(quote.shootStartTime)} - ${formatTime(quote.shootEndTime)}`],
                ['拍摄地点', getSafeDisplayText(quote.location, '拍摄地点待确认')],
                ['服务内容', getSafeDisplayText(quote.serviceContent, '按双方沟通内容执行')],
                ['原片/精修', `${quote.originalCount ?? 0} / ${quote.refinedCount ?? 0}`],
                ['照片用途', getPhotoUsageScopeLabel(quote.photoUsageScope)],
                ['最晚交付', formatDate(quote.deliveryDeadline)],
                ['备注', getSafeDisplayText(quote.remark, '无额外备注')]
              ]} />
              <Box sx={{ p: 1, bgcolor: PORTRA_COLORS.paperMuted, borderRadius: PORTRA_RADII.control, color: PORTRA_COLORS.mutedInk, fontSize: 14, lineHeight: 1.7 }}>
                客户确认报价后将生成平台托管订单；付款后资金先进入平台托管，订单完成后再结算给摄影师。
              </Box>
            </Stack>
          ) : (
            <DialogContentText sx={{ pt: 1 }}>
              报价详情暂时无法打开，请刷新后重试。
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button color="inherit" variant="text" onClick={onClose}>关闭</Button>
          {quote && (canConfirmQuote || canRejectQuote) && (
            <>
              {canRejectQuote && <Button variant="outlined" color="inherit" disabled={loading} onClick={() => onRejectQuote(quote)}>拒绝报价</Button>}
              {canConfirmQuote && <Button variant="contained" disabled={loading} onClick={() => onConfirmQuote(quote)}>确认报价</Button>}
            </>
          )}
          {quote && canResendQuote && (
            <Button variant="contained" disabled={loading} onClick={() => onResendQuote(quote)}>重新发送报价</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={activeAction === 'PAYMENT' && Boolean(order)} onClose={onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
        <DialogTitle sx={dialogTitleSx}>确认支付</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          {order ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography sx={{ color: PORTRA_COLORS.blue, fontSize: 24, fontWeight: 950 }}>{centToYuan(order.amountCent)}</Typography>
              <DetailRows rows={[
                ['拍摄概要', `${getSafeDisplayText(order.serviceContent, '本次校园约拍')} · ${getSafeDisplayText(order.shootLocation, '拍摄地点待确认')}`],
                ['拍摄时间', `${formatTime(order.shootStartTime)} - ${formatTime(order.shootEndTime)}`]
              ]} />
              <Box sx={{ p: 1, bgcolor: PORTRA_COLORS.paperMuted, borderRadius: PORTRA_RADII.control, color: PORTRA_COLORS.mutedInk, fontSize: 14, lineHeight: 1.7 }}>
                付款后资金进入平台托管，拍摄和交付完成后再结算给摄影师。
              </Box>
              <FormControl>
                <Typography variant="caption" sx={{ mb: 0.5, color: PORTRA_COLORS.faintInk, fontWeight: 900 }}>支付方式</Typography>
                <RadioGroup row value={paymentMethod} onChange={event => onPaymentMethodChange(event.target.value)}>
                  <FormControlLabel value="WECHAT" control={<Radio />} label="微信支付" />
                  <FormControlLabel value="ALIPAY" control={<Radio />} label="支付宝支付" />
                </RadioGroup>
              </FormControl>
            </Stack>
          ) : (
            <DialogContentText sx={{ pt: 1 }}>
              支付信息暂时无法打开，请刷新后重试。
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button color="inherit" variant="text" onClick={onClose}>取消</Button>
          <Button variant="contained" disabled={loading || !order} onClick={onConfirmPayment}>确认支付</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeAction === 'UPLOAD_DELIVERY' || activeAction === 'REUPLOAD_DELIVERY'} onClose={onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
        <DialogTitle sx={dialogTitleSx}>{activeAction === 'REUPLOAD_DELIVERY' ? '重新上传作品' : '上传作品'}</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Stack component="form" id="delivery-dialog-form" spacing={2} sx={{ pt: 1 }} onSubmit={event => submitAndClose(onSubmitDelivery, event)}>
            <DialogContentText>
              {activeAction === 'REUPLOAD_DELIVERY' ? '请根据客户的返修要求上传调整后的作品。' : '选择本次交付文件，并补充必要的交付说明。'}
            </DialogContentText>
            <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
              选择作品文件
              <input hidden type="file" onChange={event => onDeliveryFileChange(event.target.files?.[0] || null)} />
            </Button>
            <Typography color="text.secondary" variant="body2">{safeDeliveryForm.file ? getSafeDisplayText(safeDeliveryForm.file.name, '已选择作品文件') : '尚未选择文件'}</Typography>
            <TextField
              label="交付说明"
              value={safeDeliveryForm.remark}
              onChange={event => onDeliveryRemarkChange(event.target.value)}
              multiline
              minRows={3}
              placeholder="说明本次交付内容、返修修改点或注意事项"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button color="inherit" variant="text" onClick={onClose}>取消</Button>
          <Button type="submit" form="delivery-dialog-form" variant="contained" disabled={loading || !safeDeliveryForm.file}>
            {activeAction === 'REUPLOAD_DELIVERY' ? '上传返修作品' : '上传作品'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeAction === 'REQUEST_REWORK'} onClose={onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
        <DialogTitle sx={dialogTitleSx}>提交返修要求</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Stack component="form" id="rework-dialog-form" spacing={2} sx={{ pt: 1 }} onSubmit={event => submitAndClose(onSubmitRework, event)}>
            <DialogContentText>请说明需要调整的照片和修改方向，摄影师会根据要求重新交付。</DialogContentText>
            <TextField
              autoFocus
              label="返修要求"
              value={reworkRequirement || ''}
              onChange={event => onReworkRequirementChange(event.target.value)}
              multiline
              minRows={4}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button color="inherit" variant="text" onClick={onClose}>取消</Button>
          <Button type="submit" form="rework-dialog-form" variant="contained" disabled={loading || !String(reworkRequirement || '').trim()}>提交返修</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={activeAction === 'REQUEST_AUTHORIZATION'} onClose={onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
        <DialogTitle sx={dialogTitleSx}>申请照片展示授权</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Stack component="form" id="authorization-dialog-form" spacing={2} sx={{ pt: 1 }} onSubmit={event => submitAndClose(onSubmitPhotoAuthorization, event)}>
            <DialogContentText>请选择已经交付的作品，并说明希望展示这些照片的用途。</DialogContentText>
            <FormControl>
              <InputLabel>选择已交付作品</InputLabel>
              <Select
                multiple
                label="选择已交付作品"
                value={safePhotoAuthorizationForm.fileIds}
                onChange={event => {
                  const value = event.target.value
                  onPhotoAuthorizationFileIdsChange((typeof value === 'string' ? value.split(',') : value).map(Number))
                }}
                renderValue={selected => selected.map(fileId => deliveryFiles.find(file => file.fileId === Number(fileId))?.fileName || '作品文件').join('、')}
              >
                {deliveryFiles.map(file => <MenuItem key={file.fileId} value={file.fileId}>{file.fileName}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="申请说明"
              value={safePhotoAuthorizationForm.remark}
              onChange={event => onPhotoAuthorizationRemarkChange(event.target.value)}
              multiline
              minRows={3}
              placeholder="例如：用于个人作品集客片展示"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button color="inherit" variant="text" onClick={onClose}>取消</Button>
          <Button type="submit" form="authorization-dialog-form" variant="contained" disabled={loading || !safePhotoAuthorizationForm.fileIds.length}>提交申请</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function DetailRows({ rows = [] }) {
  return (
    <Stack spacing={0.7}>
      {(Array.isArray(rows) ? rows : []).map(([label, value]) => (
        <Stack key={label} direction="row" spacing={1.2} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="caption" sx={{ width: 76, flexShrink: 0, color: PORTRA_COLORS.faintInk, fontWeight: 900 }}>{label}</Typography>
          <Typography variant="body2" sx={{ color: PORTRA_COLORS.subInk, lineHeight: 1.65 }}>{value}</Typography>
        </Stack>
      ))}
    </Stack>
  )
}

const dialogPaperProps = {
  sx: {
    bgcolor: PORTRA_COLORS.paper,
    borderRadius: PORTRA_RADII.control,
    border: `1px solid ${PORTRA_COLORS.border}`,
    borderTop: `4px solid ${PORTRA_COLORS.blue}`,
    boxShadow: PORTRA_SHADOWS.floating
  }
}

const dialogTitleSx = {
  pb: 1,
  color: PORTRA_COLORS.ink,
  fontWeight: 900
}

const dialogContentSx = {
  '& .MuiDialogContentText-root': { color: PORTRA_COLORS.mutedInk, lineHeight: 1.7 },
  '& .MuiOutlinedInput-root': { bgcolor: PORTRA_COLORS.white, borderRadius: PORTRA_RADII.control }
}

const dialogActionsSx = {
  px: 3,
  py: 1.5,
  borderTop: `1px solid ${PORTRA_COLORS.borderMuted}`,
  bgcolor: PORTRA_COLORS.paperMuted
}
