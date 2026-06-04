import { Box, Button, IconButton, Stack, TextField, Tooltip } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'

export function ConversationComposer({
  content,
  loading,
  imageSending,
  canSeeQuoteEntry,
  canCreateQuote,
  showQuoteForm,
  quickActions,
  onOpenQuoteForm,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onPayOrder,
  onCancelOrder,
  onConfirmOrder,
  onOpenOrderArchive,
  onContentChange,
  onSendMessage,
  onChooseMessageImage
}) {
  const pendingQuote = quickActions.pendingQuote
  return (
    <Box sx={{ p: { xs: 1.2, md: 1.5 }, bgcolor: '#ebe6dd' }}>
      <Stack spacing={1.1}>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" rowGap={0.8}>
          {canSeeQuoteEntry && (
            <Button
              size="small"
              variant={showQuoteForm ? 'contained' : 'outlined'}
              startIcon={<LocalOfferRoundedIcon />}
              onClick={onOpenQuoteForm}
              disabled={!canCreateQuote && !showQuoteForm}
            >
              {showQuoteForm ? '收起报价单' : '发送报价'}
            </Button>
          )}
          {quickActions.canEditPendingQuote && (
            <Button size="small" variant="outlined" startIcon={<LocalOfferRoundedIcon />} onClick={() => onStartQuoteEditing(pendingQuote)} disabled={loading}>
              编辑报价
            </Button>
          )}
          {quickActions.canConfirmPendingQuote && (
            <>
              <Button size="small" variant="contained" onClick={() => onConfirmQuote(pendingQuote)} disabled={loading}>
                确认报价
              </Button>
              <Button size="small" variant="outlined" color="inherit" onClick={() => onRejectQuote(pendingQuote)} disabled={loading}>
                拒绝报价
              </Button>
            </>
          )}
          {quickActions.canPay && (
            <Button size="small" variant="contained" startIcon={<PaidRoundedIcon />} onClick={onPayOrder} disabled={loading}>
              去支付
            </Button>
          )}
          {quickActions.canCancel && (
            <Button size="small" variant="outlined" color="inherit" onClick={() => onCancelOrder(quickActions.cancelAction)} disabled={loading}>
              {quickActions.cancelAction.label}
            </Button>
          )}
          {quickActions.canUploadDelivery && (
            <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />} href="#conversation-delivery-action">
              上传作品
            </Button>
          )}
          {quickActions.canRequestRework && (
            <Button size="small" variant="outlined" startIcon={<RefreshRoundedIcon />} href="#conversation-rework-action">
              提交返修
            </Button>
          )}
          {quickActions.canConfirmOrder && (
            <Button size="small" variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder} disabled={loading}>
              确认接收
            </Button>
          )}
          {quickActions.canRequestPhotoAuthorization && (
            <Button size="small" variant="outlined" startIcon={<ImageRoundedIcon />} href="#conversation-authorization-action">
              申请授权
            </Button>
          )}
          {quickActions.hasPendingAuthorization && (
            <Button size="small" variant="outlined" startIcon={<CheckCircleRoundedIcon />} href="#conversation-authorization-action">
              处理授权
            </Button>
          )}
          {quickActions.canOpenOrder && (
            <Button size="small" variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive}>
              查看订单
            </Button>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="发送图片">
            <span>
              <IconButton component="label" disabled={loading || imageSending}>
                <ImageRoundedIcon />
              <input hidden type="file" accept="image/*" onChange={onChooseMessageImage} />
            </IconButton>
            </span>
          </Tooltip>
          <TextField
            fullWidth
            size="small"
            placeholder="和对方继续沟通拍摄细节"
            value={content}
            onChange={event => onContentChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSendMessage()
              }
            }}
          />
          <Button variant="contained" endIcon={<SendRoundedIcon />} onClick={onSendMessage} disabled={!content.trim() || loading}>
            发送
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
