import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { centToYuan } from '../../../utils/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import {
  canEditQuote,
  getPhotoUsageScopeLabel,
  getQuoteNextStepText,
  getQuoteOrderId,
  getQuoteStatusLabel
} from '../utils/quoteUtils.js'
import { InfoRows } from './InfoRows.jsx'
import { QuoteForm } from './QuoteForm.jsx'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'
import { StatusChip } from './StatusChip.jsx'

export function QuotePanel({
  quotes,
  conversation,
  currentUser,
  canSeeQuoteEntry,
  canCreateQuote,
  showQuoteForm,
  editingQuotationId,
  quoteEntryHint,
  quoteForm,
  quoteValidationErrors,
  loading,
  canSubmitQuoteForm,
  onOpenQuoteForm,
  onCloseQuoteForm,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onOpenOrder,
  onQuoteFormChange,
  onSubmitQuote
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, bgcolor: PORTRA_COLORS.paper, borderColor: PORTRA_COLORS.borderMuted, borderRadius: PORTRA_RADII.panel }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">报价与订单</Typography>
            <Typography color="text.secondary">摄影师发送正式报价，客户确认后生成平台托管订单。</Typography>
          </Box>
          {canSeeQuoteEntry && (
            <Button
              variant={showQuoteForm ? 'contained' : 'outlined'}
              startIcon={<LocalOfferRoundedIcon />}
              onClick={onOpenQuoteForm}
              disabled={!canCreateQuote}
            >
              发起报价
            </Button>
          )}
        </Stack>

        {quoteEntryHint && canSeeQuoteEntry && <Alert severity={canCreateQuote ? 'info' : 'warning'}>{quoteEntryHint}</Alert>}

        {quotes.map(quote => {
          const orderId = getQuoteOrderId(quote)
          return (
            <Paper
              key={quote.quotationId}
              variant="outlined"
              sx={{
                p: { xs: 1.6, md: 2 },
                pl: { xs: 2.4, md: 3 },
                bgcolor: PORTRA_COLORS.paper,
                borderColor: PORTRA_COLORS.borderMuted,
                borderLeft: `4px solid ${PORTRA_COLORS.blue}`,
                borderRadius: PORTRA_RADII.panel,
                boxShadow: 'none'
              }}
            >
              <Stack spacing={1.2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">正式报价单</Typography>
                    <Typography variant="h5" fontWeight={900}>{centToYuan(quote.amountCent)}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {quote.quoteNo ? `报价编号 ${getSafeDisplayText(quote.quoteNo, '本次报价')}` : '确认前可继续沟通调整'}
                    </Typography>
                  </Box>
                  <StatusChip label={getQuoteStatusLabel(quote.status)} />
                </Stack>
                <InfoRows rows={[
                  ['拍摄地点', getSafeDisplayText(quote.location, '拍摄地点待确认')],
                  ['拍摄开始', formatTime(quote.shootStartTime)],
                  ['拍摄结束', formatTime(quote.shootEndTime)],
                  ['最晚交付', formatTime(quote.deliveryDeadline)],
                  ['服务内容', quote.serviceContent || '未填写'],
                  ['原片/精修', `${quote.originalCount ?? 0} / ${quote.refinedCount ?? 0}`],
                  ['照片使用范围', getPhotoUsageScopeLabel(quote.photoUsageScope)],
                  ['下一步', getQuoteNextStepText(quote, currentUser)]
                ]} />
                {quote.status === 'PENDING_CONFIRM' && currentUser.role === 'CUSTOMER' && currentUser.userId === Number(conversation?.participantAId) && (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button size="small" variant="contained" onClick={() => onConfirmQuote(quote)}>确认报价</Button>
                    <Button size="small" variant="outlined" color="inherit" onClick={() => onRejectQuote(quote)}>拒绝报价</Button>
                  </Stack>
                )}
                {canEditQuote(quote, conversation, currentUser) && (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant={String(editingQuotationId) === String(quote.quotationId) ? 'contained' : 'outlined'}
                      startIcon={<LocalOfferRoundedIcon />}
                      onClick={() => onStartQuoteEditing(quote)}
                      disabled={loading}
                    >
                      {String(editingQuotationId) === String(quote.quotationId) ? '正在编辑' : '编辑报价'}
                    </Button>
                  </Stack>
                )}
                {quote.status === 'CONFIRMED' && (
                  orderId ? (
                    <Button size="small" variant="outlined" startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenOrder(orderId)} sx={{ alignSelf: 'flex-start' }}>
                      查看订单
                    </Button>
                  ) : (
                    <Alert severity="info">报价已确认，订单信息会在本次合作面板中同步。</Alert>
                  )
                )}
              </Stack>
            </Paper>
          )
        })}
        {!quotes.length && <Typography color="text.secondary">当前会话还没有正式报价。</Typography>}

        {showQuoteForm && canSeeQuoteEntry && (
          <QuoteForm
            quoteForm={quoteForm}
            onQuoteFormChange={onQuoteFormChange}
            onSubmit={onSubmitQuote}
            onClose={onCloseQuoteForm}
            editingQuotationId={editingQuotationId}
            quoteValidationErrors={quoteValidationErrors}
            loading={loading}
            canSubmitQuoteForm={canSubmitQuoteForm}
          />
        )}
      </Stack>
    </Paper>
  )
}
