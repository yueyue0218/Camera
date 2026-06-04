import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'

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
    <Paper
      component="form"
      variant="outlined"
      onSubmit={onSubmit}
      sx={{
        p: { xs: 1.5, md: 2 },
        pl: { xs: 2.4, md: 3 },
        bgcolor: '#f8f3eb',
        borderColor: '#d4ccc2',
        borderLeft: '6px solid #0d2fb2'
      }}
    >
      <Stack spacing={1.5}>
        {editingQuotationId && (
          <Alert severity="info">正在编辑一份待确认报价。客户确认生成订单后，金额、拍摄时间和交付范围会锁定。</Alert>
        )}
        {!!quoteValidationErrors.length && (
          <Alert severity="warning">
            <Stack spacing={0.5}>
              {quoteValidationErrors.map(error => <Typography key={error} variant="body2">{error}</Typography>)}
            </Stack>
          </Alert>
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
          <Button type="submit" variant="contained" disabled={loading || !canSubmitQuoteForm}>
            {editingQuotationId ? '保存报价修改' : '发送报价'}
          </Button>
          <Button variant="text" color="inherit" onClick={onClose}>收起</Button>
        </Stack>
      </Stack>
    </Paper>
  )
}
