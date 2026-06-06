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
import { PortraDateField, PortraDateTimeField, PortraInfoBanner } from '../../../components/portra/index.js'
import { getQuoteDateYearRange } from '../utils/quoteFormModel.js'
import { PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'

export function QuoteDraftDialog({
  open,
  quoteForm,
  onQuoteFormChange,
  onSubmit,
  onClose,
  editingQuotationId,
  quoteValidationErrors,
  quoteFieldErrors = {},
  loading,
  canSubmitQuoteForm
}) {
  const { minYear, maxYear } = getQuoteDateYearRange()
  const updateField = (field, value) => onQuoteFormChange({ ...quoteForm, [field]: value })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          width: 'min(1120px, calc(100vw - 32px))',
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
          px: { xs: 2.25, md: 3.5 },
          py: { xs: 2.25, md: 3 },
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
        <Stack component="form" id="quote-draft-dialog-form" spacing={2.2} onSubmit={onSubmit}>
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

          <QuoteSection title="交易金额">
            <TextField
              label="报价金额（元）"
              type="number"
              size="small"
              value={quoteForm.amountYuan}
              onChange={event => updateField('amountYuan', event.target.value)}
              error={Boolean(quoteFieldErrors.amountYuan)}
              helperText={quoteFieldErrors.amountYuan || '客户确认后将生成平台托管订单。'}
              required
              sx={{ '& .MuiInputBase-input': { fontSize: 22, fontWeight: 900, color: PORTRA_COLORS.ink } }}
            />
          </QuoteSection>

          <QuoteSection title="拍摄安排">
            <Box sx={fieldGridSx}>
              <TextField
                label="拍摄地点"
                size="small"
                value={quoteForm.location}
                onChange={event => updateField('location', event.target.value)}
                error={Boolean(quoteFieldErrors.location)}
                helperText={quoteFieldErrors.location || '填写双方确认的集合地点或拍摄区域。'}
                required
              />
              <PortraDateTimeField
                label="拍摄开始时间"
                date={quoteForm.shootStartDate}
                hour={quoteForm.shootStartHour}
                minute={quoteForm.shootStartMinute}
                onDateChange={value => updateField('shootStartDate', value)}
                onHourChange={value => updateField('shootStartHour', value)}
                onMinuteChange={value => updateField('shootStartMinute', value)}
                error={quoteFieldErrors.shootStartTime}
                required
                minYear={minYear}
                maxYear={maxYear}
              />
              <PortraDateTimeField
                label="拍摄结束时间"
                date={quoteForm.shootEndDate}
                hour={quoteForm.shootEndHour}
                minute={quoteForm.shootEndMinute}
                onDateChange={value => updateField('shootEndDate', value)}
                onHourChange={value => updateField('shootEndHour', value)}
                onMinuteChange={value => updateField('shootEndMinute', value)}
                error={quoteFieldErrors.shootEndTime}
                required
                minYear={minYear}
                maxYear={maxYear}
              />
            </Box>
          </QuoteSection>

          <QuoteSection title="交付范围">
            <Box sx={fieldGridSx}>
              <PortraDateField
                label="最晚交付日期"
                value={quoteForm.deliveryDeadlineDate}
                onChange={value => updateField('deliveryDeadlineDate', value)}
                error={quoteFieldErrors.deliveryDeadlineDate}
                required
                minYear={minYear}
                maxYear={maxYear}
                helperText="只精确到日期，提交时自动按当天 23:59 作为交付截止。"
              />
              <TextField select label="照片使用范围" size="small" value={quoteForm.photoUsageScope} onChange={event => updateField('photoUsageScope', event.target.value)}>
                <MenuItem value="PERSONAL_ONLY">仅限个人留念</MenuItem>
                <MenuItem value="PORTFOLIO_ALLOWED">可申请作品展示授权</MenuItem>
                <MenuItem value="COMMERCIAL_ALLOWED">包含商业使用约定</MenuItem>
              </TextField>
              <TextField
                label="原片数量"
                type="number"
                size="small"
                value={quoteForm.originalCount}
                onChange={event => updateField('originalCount', event.target.value)}
                error={Boolean(quoteFieldErrors.originalCount)}
                helperText={quoteFieldErrors.originalCount || '可为 0。'}
              />
              <TextField
                label="精修数量"
                type="number"
                size="small"
                value={quoteForm.refinedCount}
                onChange={event => updateField('refinedCount', event.target.value)}
                error={Boolean(quoteFieldErrors.refinedCount)}
                helperText={quoteFieldErrors.refinedCount || '可为 0。'}
              />
            </Box>
          </QuoteSection>

          <QuoteSection title="服务内容与条款">
            <TextField
              label="服务内容"
              multiline
              minRows={2}
              size="small"
              value={quoteForm.serviceContent}
              onChange={event => updateField('serviceContent', event.target.value)}
              error={Boolean(quoteFieldErrors.serviceContent)}
              helperText={quoteFieldErrors.serviceContent || '写清拍摄时长、交付内容和基础修图范围。'}
              required
            />
            <TextField
              label="订单条款"
              multiline
              minRows={2}
              size="small"
              value={quoteForm.contractTerms}
              onChange={event => updateField('contractTerms', event.target.value)}
              error={Boolean(quoteFieldErrors.contractTerms)}
              helperText={quoteFieldErrors.contractTerms || '写清付款托管、取消、改期或授权边界。'}
              required
            />
            <TextField
              label="补充说明"
              multiline
              minRows={2}
              size="small"
              value={quoteForm.remark}
              onChange={event => updateField('remark', event.target.value)}
            />
          </QuoteSection>
        </Stack>
      </DialogContent>

      <DialogActions sx={{
        minHeight: 78,
        px: { xs: 2.25, md: 3.5 },
        py: 1.35,
        bgcolor: '#ebe6dd',
        borderTop: `1px solid ${PORTRA_COLORS.borderMuted}`
      }}>
        <Button color="inherit" onClick={onClose}>取消</Button>
        <Button type="submit" form="quote-draft-dialog-form" variant="contained" disabled={loading || !canSubmitQuoteForm}>
          {editingQuotationId ? '保存修改' : '发送报价'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function QuoteSection({ title, children }) {
  return (
    <Stack spacing={1} sx={sectionSx}>
      <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 14, fontWeight: 950 }}>{title}</Typography>
      {children}
    </Stack>
  )
}

const sectionSx = {
  p: { xs: 1.45, md: 1.75 },
  bgcolor: 'rgba(255, 253, 249, 0.62)',
  border: `1px solid ${PORTRA_COLORS.borderMuted}`,
  borderRadius: PORTRA_RADII.control
}

const fieldGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
  gap: { xs: 1.5, md: 2.25 },
  alignItems: 'start'
}
