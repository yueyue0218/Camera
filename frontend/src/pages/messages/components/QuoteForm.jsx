import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { PortraActionButton, PortraInfoBanner, PortraTicketCard } from '../../../components/portra/index.js'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'

export function QuoteForm({
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
    <PortraTicketCard
      component="form"
      onSubmit={onSubmit}
      sx={{
        p: { xs: 1.6, md: 2 },
        pl: { xs: 2.6, md: 3 },
        bgcolor: '#f0ece5',
        border: `1.5px solid ${PORTRA_COLORS.blue}`,
        borderRadius: 16,
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
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 18, fontWeight: 950 }}>报价单草稿</Typography>
          <Typography sx={{ color: PORTRA_COLORS.mutedInk, fontSize: 13 }}>确认拍摄内容、时间和交付范围后发送给客户。</Typography>
        </Box>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="报价金额（元）" type="number" size="small" value={quoteForm.amountYuan} onChange={event => onQuoteFormChange({ ...quoteForm, amountYuan: event.target.value })} required />
          <TextField label="拍摄地点" size="small" value={quoteForm.location} onChange={event => onQuoteFormChange({ ...quoteForm, location: event.target.value })} required />
          <TextField label="拍摄开始时间" type="datetime-local" size="small" value={quoteForm.shootStartTime} onChange={event => onQuoteFormChange({ ...quoteForm, shootStartTime: event.target.value })} InputLabelProps={{ shrink: true }} required />
          <TextField label="拍摄结束时间" type="datetime-local" size="small" value={quoteForm.shootEndTime} onChange={event => onQuoteFormChange({ ...quoteForm, shootEndTime: event.target.value })} InputLabelProps={{ shrink: true }} required />
          <TextField label="最晚交付时间" type="datetime-local" size="small" value={quoteForm.deliveryDeadline} onChange={event => onQuoteFormChange({ ...quoteForm, deliveryDeadline: event.target.value })} InputLabelProps={{ shrink: true }} required />
          <TextField label="原片数量" type="number" size="small" value={quoteForm.originalCount} onChange={event => onQuoteFormChange({ ...quoteForm, originalCount: event.target.value })} />
          <TextField label="精修数量" type="number" size="small" value={quoteForm.refinedCount} onChange={event => onQuoteFormChange({ ...quoteForm, refinedCount: event.target.value })} />
          <TextField select label="照片使用范围" size="small" value={quoteForm.photoUsageScope} onChange={event => onQuoteFormChange({ ...quoteForm, photoUsageScope: event.target.value })}>
            <MenuItem value="PERSONAL_ONLY">仅限个人留念</MenuItem>
            <MenuItem value="PORTFOLIO_ALLOWED">可申请作品展示授权</MenuItem>
            <MenuItem value="COMMERCIAL_ALLOWED">包含商业使用约定</MenuItem>
          </TextField>
          <TextField label="服务内容" multiline minRows={2} size="small" value={quoteForm.serviceContent} onChange={event => onQuoteFormChange({ ...quoteForm, serviceContent: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} required />
          <TextField label="基础约定" multiline minRows={2} size="small" value={quoteForm.terms} onChange={event => onQuoteFormChange({ ...quoteForm, terms: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} />
          <TextField label="订单条款" multiline minRows={2} size="small" value={quoteForm.contractTerms} onChange={event => onQuoteFormChange({ ...quoteForm, contractTerms: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} />
          <TextField label="补充说明" multiline minRows={2} size="small" value={quoteForm.remark} onChange={event => onQuoteFormChange({ ...quoteForm, remark: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} />
        </Box>
        <Stack direction="row" spacing={1}>
          <PortraActionButton type="submit" disabled={loading || !canSubmitQuoteForm}>
            {editingQuotationId ? '保存报价修改' : '发送报价'}
          </PortraActionButton>
          <PortraActionButton tone="secondary" onClick={onClose}>收起</PortraActionButton>
        </Stack>
      </Stack>
    </PortraTicketCard>
  )
}
