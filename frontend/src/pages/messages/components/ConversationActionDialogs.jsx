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
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS, QUOTE_VISUAL } from '../MessageVisualTokens.js'
import { centToYuan } from '../../../utils/index.js'
import { formatFileDisplayName } from '../../../utils/displayFormatters.js'
import { PortraStatusBadge } from '../../../components/portra/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import { buildQuoteDisplayModel } from '../utils/quoteDisplayModel.js'
import { QuoteMoneyText } from './QuoteMoneyText.jsx'
import { DeliveryUploadDialog } from '../../deliveries/components/DeliveryUploadDialog.jsx'
import { DeliveryFileGrid } from '../../deliveries/components/DeliveryFileGrid.jsx'
import { flattenDeliveryFiles, isAuthorizableDeliveryFile } from '../../deliveries/deliveryDisplay.js'

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
  onDeliveryFilesChange,
  onDeliveryRemarkChange,
  onReworkRequirementChange,
  onPhotoAuthorizationFileIdsChange,
  onPhotoAuthorizationRemarkChange,
  onSubmitDelivery,
  onSubmitRework,
  onSubmitPhotoAuthorization
}) {
  const safeDeliveryForm = deliveryForm || { files: [], remark: '' }
  const safePhotoAuthorizationForm = {
    fileIds: Array.isArray(photoAuthorizationForm?.fileIds) ? photoAuthorizationForm.fileIds : [],
    remark: photoAuthorizationForm?.remark || ''
  }
  const quoteDisplay = quote ? buildQuoteDisplayModel(quote) : null
  const deliveryFiles = flattenDeliveryFiles(deliveryRecords)
    .filter(file => file.fileId && isAuthorizableDeliveryFile(file))
    .map(file => ({
      fileId: Number(file.fileId),
      id: file.id || `authorization-${file.fileId}`,
      fileName: formatFileDisplayName(file, '作品'),
      mimeType: file.mimeType,
      fileType: file.fileType,
      uploadTime: file.uploadTime,
      source: file
    }))
  const selectedAuthorizationFileIds = new Set(safePhotoAuthorizationForm.fileIds.map(Number))

  function toggleAuthorizationFile(file) {
    const fileId = Number(file?.fileId)
    if (!fileId) return
    const next = new Set(selectedAuthorizationFileIds)
    if (next.has(fileId)) next.delete(fileId)
    else next.add(fileId)
    onPhotoAuthorizationFileIdsChange(Array.from(next))
  }

  async function submitAndClose(handler, event) {
    event.preventDefault()
    if (typeof handler !== 'function') return
    const succeeded = await handler(event)
    if (succeeded) onClose()
  }

  return (
    <>
      <Dialog open={activeAction === 'QUOTE_DETAIL' && Boolean(quote)} onClose={onClose} fullWidth maxWidth="sm" PaperProps={quoteDialogPaperProps}>
        <DialogTitle sx={quoteDialogTitleSx}>
          <Stack direction="row" spacing={1.2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: 'rgba(255,255,255,.74)', fontSize: 12, fontWeight: 800, letterSpacing: 0 }}>报价详情</Typography>
              <QuoteMoneyText
                amountText={quoteDisplay ? quoteDisplay.amountText : '--'}
                sx={{ mt: 0.45, color: '#fff', fontSize: 34, fontWeight: 900 }}
              />
              {quoteDisplay?.messageCreatedAtText && (
                <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,.66)', fontSize: 12.5, lineHeight: 1.3 }}>
                  创建于 {quoteDisplay.messageCreatedAtText}
                </Typography>
              )}
            </Box>
            {quoteDisplay && <PortraStatusBadge label={quoteDisplay.statusLabel} tone={quoteDisplay.statusTone} sx={{ mt: 0.2, bgcolor: 'rgba(255,255,255,.18)', color: '#fff' }} />}
          </Stack>
        </DialogTitle>
        <DialogContent sx={quoteDialogContentSx}>
          {quoteDisplay ? (
            <Box sx={quoteDialogBodySx}>
              <Stack spacing={1.45}>
                <QuoteDetailSection
                  title="拍摄安排"
                  rows={[
                    ['拍摄开始时间', quoteDisplay.shootStartTimeText],
                    ['拍摄结束时间', quoteDisplay.shootEndTimeText],
                    ['拍摄地点', quoteDisplay.shootLocationText]
                  ]}
                />
                <QuoteDetailSection
                  title="服务与交付"
                  rows={[
                    ['原片 / 精修', quoteDisplay.originalRefinedText],
                    ['最晚交付', quoteDisplay.deliveryDeadlineText],
                    ['服务内容', quoteDisplay.serviceContentText, 'wide']
                  ]}
                />
                <QuoteDetailSection
                  title="使用与备注"
                  rows={[
                    ['用途', quoteDisplay.photoUsageLabel],
                    ['备注', quoteDisplay.remarkText, 'wide']
                  ]}
                />
                <Box sx={quoteNoticeSx}>
                  客户确认报价后将生成平台担保订单；付款后资金先进入平台担保，订单完成后再结算给摄影师。
                </Box>
              </Stack>
            </Box>
          ) : (
            <DialogContentText sx={{ pt: 1 }}>
              报价详情暂时无法打开，请刷新后重试。
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button color="inherit" variant="text" onClick={onClose}>关闭</Button>
          {canResendQuote && (
            <Button color="inherit" variant="outlined" disabled={loading || !quote} onClick={() => onResendQuote?.(quote)}>
              重新发送报价
            </Button>
          )}
          {canRejectQuote && (
            <Button color="inherit" variant="outlined" disabled={loading || !quote} onClick={() => onRejectQuote?.(quote)}>
              拒绝报价
            </Button>
          )}
          {canConfirmQuote && (
            <Button variant="contained" disabled={loading || !quote} onClick={() => onConfirmQuote?.(quote)}>
              确认报价
            </Button>
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
                付款后资金进入平台担保，拍摄和作品确认后再结算给摄影师。
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

      <DeliveryUploadDialog
        open={activeAction === 'UPLOAD_DELIVERY' || activeAction === 'REUPLOAD_DELIVERY'}
        mode={activeAction === 'REUPLOAD_DELIVERY' ? 'rework' : 'upload'}
        value={safeDeliveryForm}
        loading={loading}
        onClose={onClose}
        onChange={nextValue => {
          onDeliveryFilesChange?.(nextValue.files || [])
          onDeliveryRemarkChange?.(nextValue.remark || '')
        }}
        onSubmit={onSubmitDelivery}
      />

      <Dialog open={activeAction === 'REQUEST_REWORK'} onClose={onClose} fullWidth maxWidth="sm" PaperProps={dialogPaperProps}>
        <DialogTitle sx={dialogTitleSx}>提交返修要求</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Stack component="form" id="rework-dialog-form" spacing={2} sx={{ pt: 1 }} onSubmit={event => submitAndClose(onSubmitRework, event)}>
            <DialogContentText>请说明需要调整的照片和修改方向，摄影师会根据要求重新上传作品。</DialogContentText>
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
        <DialogTitle sx={dialogTitleSx}>申请展示授权</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Stack component="form" id="authorization-dialog-form" spacing={2} sx={{ pt: 1 }} onSubmit={event => submitAndClose(onSubmitPhotoAuthorization, event)}>
            <DialogContentText>请选择已交付的照片，并说明希望展示这些照片的用途。压缩包不会用于公开展示。</DialogContentText>
            {deliveryFiles.length ? (
              <Stack spacing={1}>
                <Typography sx={{ color: PORTRA_COLORS.faintInk, fontSize: 12, fontWeight: 900 }}>
                  已选择 {selectedAuthorizationFileIds.size} 张
                </Typography>
                <DeliveryFileGrid
                  files={deliveryFiles}
                  mode="select"
                  compact
                  selectedFileIds={selectedAuthorizationFileIds}
                  onToggleSelect={toggleAuthorizationFile}
                />
              </Stack>
            ) : (
              <DialogContentText>暂无可授权的照片，请先上传图片交付文件。</DialogContentText>
            )}
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
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.1 }}>
      {(Array.isArray(rows) ? rows : []).map(([label, value]) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <Typography sx={{ color: PORTRA_COLORS.faintInk, fontSize: 11, fontWeight: 900 }}>{label}</Typography>
          <Typography sx={{ color: PORTRA_COLORS.subInk, fontSize: 14, lineHeight: 1.65 }}>{value}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function QuoteDetailSection({ title, rows = [] }) {
  return (
    <Box sx={quoteSectionSx}>
      <Typography sx={quoteSectionTitleSx}>{title}</Typography>
      <Box sx={quoteDetailGridSx}>
        {rows.map(([label, value, span]) => (
          <Box key={label} sx={{ minWidth: 0, gridColumn: span === 'wide' ? '1 / -1' : 'auto' }}>
            <Typography sx={quoteDetailLabelSx}>{label}</Typography>
            <Typography sx={quoteDetailValueSx}>{value}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

const dialogPaperProps = {
  sx: {
    bgcolor: PORTRA_COLORS.paper,
    borderRadius: PORTRA_RADII.control,
    border: `1px solid ${PORTRA_COLORS.border}`,
    borderTop: `6px solid ${PORTRA_COLORS.blue}`,
    boxShadow: PORTRA_SHADOWS.floating,
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 58,
      borderTop: '1px dashed rgba(13,47,178,.2)'
    }
  }
}

const quoteDialogPaperProps = {
  sx: {
    bgcolor: PORTRA_COLORS.paper,
    borderRadius: '16px',
    border: `1px solid ${PORTRA_COLORS.border}`,
    overflow: 'hidden',
    boxShadow: '0 22px 56px rgba(13,47,178,.14), 0 2px 8px rgba(0,0,0,.08)'
  }
}

const quoteDialogTitleSx = {
  px: 3,
  py: 1.7,
  bgcolor: PORTRA_COLORS.blue,
  borderBottom: '1px solid rgba(255,255,255,.16)'
}

const quoteDialogContentSx = {
  p: 0,
  '& .MuiDialogContentText-root': { color: PORTRA_COLORS.mutedInk, lineHeight: 1.7 },
  '& .MuiOutlinedInput-root': { bgcolor: PORTRA_COLORS.paperSoft, borderRadius: PORTRA_RADII.control }
}

const quoteDialogBodySx = {
  px: 3,
  pt: 4,
  pb: 2.2
}

const quoteSectionSx = {
  pb: 1.25,
  borderBottom: `1px solid ${QUOTE_VISUAL.divider}`,
  '&:last-of-type': {
    borderBottom: 0,
    pb: 0
  }
}

const quoteSectionTitleSx = {
  mb: 0.95,
  color: QUOTE_VISUAL.ink,
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.35
}

const quoteDetailGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
  columnGap: 2.2,
  rowGap: 1.15
}

const quoteDetailLabelSx = {
  color: QUOTE_VISUAL.muted,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.35
}

const quoteDetailValueSx = {
  mt: 0.28,
  color: QUOTE_VISUAL.ink,
  fontSize: 15.5,
  fontWeight: 500,
  lineHeight: 1.55,
  overflowWrap: 'anywhere'
}

const quoteNoticeSx = {
  p: 1.25,
  bgcolor: 'rgba(238,243,255,.62)',
  border: `1px solid ${QUOTE_VISUAL.divider}`,
  borderRadius: '12px',
  color: QUOTE_VISUAL.muted,
  fontSize: 13,
  lineHeight: 1.7
}

const dialogTitleSx = {
  pb: 1,
  color: PORTRA_COLORS.ink,
  fontWeight: 900
}

const dialogContentSx = {
  '& .MuiDialogContentText-root': { color: PORTRA_COLORS.mutedInk, lineHeight: 1.7 },
  '& .MuiOutlinedInput-root': { bgcolor: PORTRA_COLORS.paperSoft, borderRadius: PORTRA_RADII.control }
}

const dialogActionsSx = {
  px: 3,
  py: 1.5,
  borderTop: `1px solid ${PORTRA_COLORS.borderMuted}`,
  bgcolor: PORTRA_COLORS.paperMuted
}
