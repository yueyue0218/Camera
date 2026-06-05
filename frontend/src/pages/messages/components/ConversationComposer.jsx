import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'
import { MessageToolbarButton } from './MessageToolbarButton.jsx'

export function ConversationComposer({
  content,
  loading,
  imageSending,
  canSeeQuoteEntry,
  canCreateQuote,
  showQuoteForm,
  actions,
  onOpenQuoteForm,
  onStartQuoteEditing,
  onConfirmQuote,
  onRejectQuote,
  onOpenQuoteDetail,
  onPayOrder,
  onCancelOrder,
  onConfirmOrder,
  onOpenOrderArchive,
  onContentChange,
  onSendMessage,
  onChooseMessageImage,
  onUnavailableTool,
  onOpenAction
}) {
  const pendingQuote = actions.pendingQuote
  const hasQuickActions = Boolean(
    actions.canSendQuote
    || actions.canEditQuote
    || actions.canConfirmQuote
    || actions.canPay
    || actions.cancelAction
    || actions.canUploadDelivery
    || actions.canReuploadDelivery
    || actions.canRequestRework
    || actions.canConfirmDelivery
    || actions.canRequestPhotoAuthorization
    || actions.canReviewPhotoAuthorization
    || actions.canViewDispute
  )
  return (
    <Box sx={{ px: { xs: 1.2, md: 1.5 }, py: 1.2, bgcolor: PORTRA_COLORS.paper, borderTop: `1px solid ${PORTRA_COLORS.borderMuted}` }}>
      <Stack spacing={0.9}>
        {hasQuickActions && (
          <Stack spacing={0.6} sx={{ py: 0.8, px: 1, bgcolor: PORTRA_COLORS.paperMuted, borderRadius: PORTRA_RADII.control, borderLeft: `3px solid ${PORTRA_COLORS.yellow}` }}>
            <Typography variant="caption" sx={{ color: PORTRA_COLORS.mutedInk, fontWeight: 900 }}>当前可处理</Typography>
            <Stack direction="row" spacing={0.7} flexWrap="wrap" rowGap={0.7}>
              {actions.canSendQuote && canSeeQuoteEntry && (
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
              {actions.canEditQuote && (
                <Button size="small" variant="outlined" startIcon={<LocalOfferRoundedIcon />} onClick={() => onStartQuoteEditing(pendingQuote)} disabled={loading}>
                  编辑报价
                </Button>
              )}
              {actions.canConfirmQuote && pendingQuote && (
                <Button size="small" variant="contained" startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenQuoteDetail(pendingQuote)} disabled={loading}>
                  查看报价详情
                </Button>
              )}
              {actions.canPay && (
                <Button size="small" variant="contained" startIcon={<PaidRoundedIcon />} onClick={onPayOrder} disabled={loading}>
                  去支付
                </Button>
              )}
              {actions.cancelAction && (
                <Button size="small" variant="outlined" color="inherit" onClick={() => onCancelOrder(actions.cancelAction)} disabled={loading}>
                  {actions.cancelAction.label}
                </Button>
              )}
              {(actions.canUploadDelivery || actions.canReuploadDelivery) && (
                <Button
                  size="small"
                  variant={actions.canReuploadDelivery ? 'contained' : 'outlined'}
                  startIcon={<AddPhotoAlternateRoundedIcon />}
                  onClick={() => onOpenAction(actions.canReuploadDelivery ? 'REUPLOAD_DELIVERY' : 'UPLOAD_DELIVERY')}
                >
                  {actions.canReuploadDelivery ? '重新上传作品' : '上传作品'}
                </Button>
              )}
              {actions.canRequestRework && (
                <Button size="small" variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => onOpenAction('REQUEST_REWORK')}>
                  提交返修
                </Button>
              )}
              {actions.canConfirmDelivery && (
                <Button size="small" variant="contained" startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder} disabled={loading}>
                  确认接收
                </Button>
              )}
              {actions.canRequestPhotoAuthorization && (
                <Button size="small" variant="outlined" startIcon={<ImageRoundedIcon />} onClick={() => onOpenAction('REQUEST_AUTHORIZATION')}>
                  申请照片授权
                </Button>
              )}
              {actions.canReviewPhotoAuthorization && (
                <Button size="small" variant="outlined" startIcon={<CheckCircleRoundedIcon />} href="#conversation-authorization-action">
                  处理授权
                </Button>
              )}
              {actions.canViewDispute && (
                <Button size="small" variant="outlined" color="inherit" onClick={onOpenOrderArchive}>
                  查看争议进展
                </Button>
              )}
              {actions.canOpenOrder && (
                <Button size="small" variant="text" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive}>
                  查看订单
                </Button>
              )}
            </Stack>
          </Stack>
        )}

        <Stack direction="row" spacing={0.3} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" sx={{ mr: 0.5, color: PORTRA_COLORS.faintInk, fontWeight: 800 }}>会话工具</Typography>
          <MessageToolbarButton title="发送图片" component="label" disabled={loading || imageSending}>
            <ImageRoundedIcon fontSize="small" />
            <input hidden type="file" accept="image/*" onChange={onChooseMessageImage} />
          </MessageToolbarButton>
          <MessageToolbarButton title="附件" onClick={() => onUnavailableTool('附件')}><AttachFileRoundedIcon fontSize="small" /></MessageToolbarButton>
          <MessageToolbarButton title="表情" onClick={() => onUnavailableTool('表情')}><EmojiEmotionsRoundedIcon fontSize="small" /></MessageToolbarButton>
          <MessageToolbarButton title="补款" onClick={() => onUnavailableTool('补款')}><AccountBalanceWalletRoundedIcon fontSize="small" /></MessageToolbarButton>
          {actions.canOpenOrder && (
            <MessageToolbarButton title="订单档案" onClick={onOpenOrderArchive}><ReceiptLongRoundedIcon fontSize="small" /></MessageToolbarButton>
          )}
          {actions.canAppeal && (
            <MessageToolbarButton title="平台协助" onClick={() => onUnavailableTool('平台协助')}><SupportAgentRoundedIcon fontSize="small" /></MessageToolbarButton>
          )}
        </Stack>

        <Stack direction="row" alignItems="flex-end" spacing={1}>
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={4}
            placeholder="和对方继续沟通拍摄细节"
            value={content}
            onChange={event => onContentChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSendMessage()
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                minHeight: 42,
                bgcolor: PORTRA_COLORS.white,
                borderRadius: PORTRA_RADII.control,
                '& fieldset': { borderColor: PORTRA_COLORS.border },
                '&:hover fieldset': { borderColor: PORTRA_COLORS.mutedInk },
                '&.Mui-focused fieldset': { borderColor: PORTRA_COLORS.blue, borderWidth: 1 }
              }
            }}
          />
          <Button
            variant="contained"
            endIcon={<SendRoundedIcon />}
            onClick={onSendMessage}
            disabled={!content.trim() || loading}
            sx={{
              minWidth: 88,
              height: 42,
              borderRadius: PORTRA_RADII.control,
              bgcolor: PORTRA_COLORS.blue,
              '&:hover': { bgcolor: PORTRA_COLORS.blueDark },
              '&.Mui-disabled': { bgcolor: PORTRA_COLORS.paperMuted, color: PORTRA_COLORS.faintInk }
            }}
          >
            发送
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
