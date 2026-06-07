import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { centToYuan } from '../../../utils/index.js'
import { formatTime } from '../utils/conversationUtils.js'
import { canEditQuote, getQuoteOrderId, quoteStatusMap } from '../utils/quoteUtils.js'
import { InfoRows } from './InfoRows.jsx'
import { QuoteForm } from './QuoteForm.jsx'

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
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, bgcolor: '#fffaf8' }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h6">报价 / 订单协作区</Typography>
            <Typography color="text.secondary">服务方发正式报价，顾客确认后生成订单，再进入托管和交付流程。</Typography>
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
            <Paper key={quote.quotationId} variant="outlined" sx={{ p: 1.6, bgcolor: '#fbfdff' }}>
              <Stack spacing={1.2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography fontWeight={900}>{centToYuan(quote.amountCent)}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      报价 ID {quote.quotationId} · {quote.quoteNo || '当前接口未返回报价编号'}
                    </Typography>
                  </Box>
                  <Chip size="small" color={quote.status === 'PENDING_CONFIRM' ? 'warning' : quote.status === 'CONFIRMED' ? 'success' : 'default'} label={quoteStatusMap[quote.status] || quote.status} />
                </Stack>
                <InfoRows rows={[
                  ['拍摄地点', quote.location || '未填写'],
                  ['拍摄开始', formatTime(quote.shootStartTime)],
                  ['拍摄结束', formatTime(quote.shootEndTime)],
                  ['最晚交付', formatTime(quote.deliveryDeadline)],
                  ['服务内容', quote.serviceContent || '未填写'],
                  ['原片/精修', `${quote.originalCount ?? 0} / ${quote.refinedCount ?? 0}`],
                  ['照片使用范围', quote.photoUsageScope || '未填写'],
                  ['条款', quote.terms || '当前报价接口未返回该字段'],
                  ['合同条款', quote.contractTerms || '当前报价接口未返回该字段'],
                  ['备注', quote.remark || '当前报价接口未返回该字段']
                ]} />
                {quote.status === 'PENDING_CONFIRM' && currentUser.role === 'CUSTOMER' && currentUser.userId === Number(conversation?.participantAId) && (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button size="small" variant="contained" onClick={() => onConfirmQuote(quote)}>确认报价</Button>
                    <Button size="small" variant="outlined" color="inherit" onClick={() => onRejectQuote(quote)}>拒绝报价</Button>
                  </Stack>
                )}
                {canEditQuote(quote, conversation, currentUser) && (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
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
                    <Alert severity="info">报价已确认，可在订单页查看关联订单；当前报价列表接口未返回 orderId。</Alert>
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
