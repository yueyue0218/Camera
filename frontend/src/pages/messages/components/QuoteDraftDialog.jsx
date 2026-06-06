import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { PortraInfoBanner } from '../../../components/portra/index.js'
import { PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'

export function QuoteDraftDialog({
  open,
  quoteForm,
  onQuoteFormChange,
  onSubmit,
  onClose,
  editingQuotationId,
  quoteValidationErrors,
  loading,
  canSubmitQuoteForm
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          bgcolor: '#f8f3eb',
          borderRadius: PORTRA_RADII.panel,
          border: `1px solid ${PORTRA_COLORS.border}`,
          borderTop: `6px solid ${PORTRA_COLORS.blue}`,
          boxShadow: PORTRA_SHADOWS.floating,
          maxHeight: 'min(86vh, 760px)',
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1.2 }}>
        <Typography sx={{ color: PORTRA_COLORS.blue, fontSize: 11, fontWeight: 950, letterSpacing: '.16em' }}>
          PORTRA QUOTE DRAFT
        </Typography>
        <Typography sx={{ mt: 0.45, color: PORTRA_COLORS.ink, fontSize: 22, fontWeight: 950 }}>
          报价单
        </Typography>
        <Typography sx={{ mt: 0.25, color: PORTRA_COLORS.mutedInk, fontSize: 13 }}>
          确认拍摄内容、时间和交付范围后发送给客户。
        </Typography>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          bgcolor: '#f8f3eb',
          borderColor: PORTRA_COLORS.borderMuted,
          overflowY: 'auto',
          '& .MuiOutlinedInput-root': {
            bgcolor: PORTRA_COLORS.white,
            borderRadius: PORTRA_RADII.control,
            '&.Mui-focused fieldset': {
              borderColor: PORTRA_COLORS.blue,
              boxShadow: '0 0 0 3px rgba(13,47,178,.12)'
            }
          }
        }}
      >
        <Stack component="form" id="quote-draft-dialog-form" spacing={1.6} onSubmit={onSubmit}>
          {editingQuotationId && (
            <PortraInfoBanner>正在编辑一份待确认报价。客户确认生成订单后，金额、拍摄时间和交付范围会锁定。</PortraInfoBanner>
          )}
          {!!quoteValidationErrors.length && (
            <PortraInfoBanner tone="warning">
              <Stack spacing={0.5}>
                {quoteValidationErrors.map(error => <Typography key={error} variant="body2">{error}</Typography>)}
              </Stack>
            </PortraInfoBanner>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 1.5 }}>
            <TextField label="报价金额（元）" type="number" size="small" value={quoteForm.amountYuan} onChange={event => onQuoteFormChange({ ...quoteForm, amountYuan: event.target.value })} required sx={{ '& .MuiInputBase-input': { fontSize: 20, fontWeight: 900, color: PORTRA_COLORS.ink } }} />
            <TextField label="拍摄地点" size="small" value={quoteForm.location} onChange={event => onQuoteFormChange({ ...quoteForm, location: event.target.value })} required />
            <TextField label="拍摄开始时间" type="datetime-local" size="small" value={quoteForm.shootStartTime} onChange={event => onQuoteFormChange({ ...quoteForm, shootStartTime: event.target.value })} InputLabelProps={{ shrink: true }} required />
            <TextField label="拍摄结束时间" type="datetime-local" size="small" value={quoteForm.shootEndTime} onChange={event => onQuoteFormChange({ ...quoteForm, shootEndTime: event.target.value })} InputLabelProps={{ shrink: true }} required />
            <TextField label="最晚交付时间" type="datetime-local" size="small" value={quoteForm.deliveryDeadline} onChange={event => onQuoteFormChange({ ...quoteForm, deliveryDeadline: event.target.value })} InputLabelProps={{ shrink: true }} required />
            <TextField select label="照片使用范围" size="small" value={quoteForm.photoUsageScope} onChange={event => onQuoteFormChange({ ...quoteForm, photoUsageScope: event.target.value })}>
              <MenuItem value="PERSONAL_ONLY">仅限个人留念</MenuItem>
              <MenuItem value="PORTFOLIO_ALLOWED">可申请作品展示授权</MenuItem>
              <MenuItem value="COMMERCIAL_ALLOWED">包含商业使用约定</MenuItem>
            </TextField>
            <TextField label="原片数量" type="number" size="small" value={quoteForm.originalCount} onChange={event => onQuoteFormChange({ ...quoteForm, originalCount: event.target.value })} />
            <TextField label="精修数量" type="number" size="small" value={quoteForm.refinedCount} onChange={event => onQuoteFormChange({ ...quoteForm, refinedCount: event.target.value })} />
            <TextField label="服务内容" multiline minRows={2} size="small" value={quoteForm.serviceContent} onChange={event => onQuoteFormChange({ ...quoteForm, serviceContent: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} required />
            <TextField label="订单条款" multiline minRows={2} size="small" value={quoteForm.contractTerms} onChange={event => onQuoteFormChange({ ...quoteForm, contractTerms: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} />
            <TextField label="补充说明" multiline minRows={2} size="small" value={quoteForm.remark} onChange={event => onQuoteFormChange({ ...quoteForm, remark: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, bgcolor: '#ebe6dd', borderTop: `1px solid ${PORTRA_COLORS.borderMuted}` }}>
        <Button color="inherit" onClick={onClose}>取消</Button>
        <Button type="submit" form="quote-draft-dialog-form" variant="contained" disabled={loading || !canSubmitQuoteForm}>
          {editingQuotationId ? '保存修改' : '发送报价'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

