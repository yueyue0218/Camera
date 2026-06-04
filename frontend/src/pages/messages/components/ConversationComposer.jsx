import { Box, Button, IconButton, Stack, TextField, Tooltip } from '@mui/material'
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
  return (
    <Box sx={{ p: { xs: 1.2, md: 1.5 }, bgcolor: '#ebe6dd' }}>
      <Stack spacing={1.1}>
        <Stack direction="row" spacing={0.4} alignItems="center" flexWrap="wrap">
          <ToolButton title="发送图片">
            <IconButton component="label" size="small" disabled={loading || imageSending}>
              <ImageRoundedIcon fontSize="small" />
              <input hidden type="file" accept="image/*" onChange={onChooseMessageImage} />
            </IconButton>
          </ToolButton>
          <ToolButton title="附件">
            <IconButton size="small" onClick={() => onUnavailableTool('附件')}><AttachFileRoundedIcon fontSize="small" /></IconButton>
          </ToolButton>
          <ToolButton title="表情">
            <IconButton size="small" onClick={() => onUnavailableTool('表情')}><EmojiEmotionsRoundedIcon fontSize="small" /></IconButton>
          </ToolButton>
          {actions.role === 'PROVIDER' && !actions.hasOrder && (
            <ToolButton title="报价">
              <IconButton size="small" onClick={onOpenQuoteForm} disabled={!actions.canSendQuote && !actions.canEditQuote}>
                <LocalOfferRoundedIcon fontSize="small" />
              </IconButton>
            </ToolButton>
          )}
          {(actions.canUploadDelivery || actions.canReuploadDelivery) && (
            <ToolButton title={actions.canReuploadDelivery ? '重新上传作品' : '上传作品'}>
              <IconButton size="small" onClick={() => onOpenAction(actions.canReuploadDelivery ? 'REUPLOAD_DELIVERY' : 'UPLOAD_DELIVERY')}><AddPhotoAlternateRoundedIcon fontSize="small" /></IconButton>
            </ToolButton>
          )}
          {actions.canRequestPhotoAuthorization && (
            <ToolButton title="申请照片展示授权">
              <IconButton size="small" onClick={() => onOpenAction('REQUEST_AUTHORIZATION')}><ImageRoundedIcon fontSize="small" /></IconButton>
            </ToolButton>
          )}
          <ToolButton title="补款">
            <IconButton size="small" onClick={() => onUnavailableTool('补款')}><AccountBalanceWalletRoundedIcon fontSize="small" /></IconButton>
          </ToolButton>
          {actions.canAppeal && (
            <ToolButton title="申请平台协助">
              <IconButton size="small" onClick={() => onUnavailableTool('平台协助')}><SupportAgentRoundedIcon fontSize="small" /></IconButton>
            </ToolButton>
          )}
          {actions.canOpenOrder && (
            <ToolButton title="订单档案">
              <IconButton size="small" onClick={onOpenOrderArchive}><ReceiptLongRoundedIcon fontSize="small" /></IconButton>
            </ToolButton>
          )}
        </Stack>

        <Stack direction="row" spacing={0.8} flexWrap="wrap" rowGap={0.8}>
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
          {actions.canConfirmQuote && (
            <>
              <Button size="small" variant="contained" onClick={() => onConfirmQuote(pendingQuote)} disabled={loading}>
                确认报价
              </Button>
              <Button size="small" variant="outlined" color="inherit" onClick={() => onRejectQuote(pendingQuote)} disabled={loading}>
                拒绝报价
              </Button>
            </>
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
            <Button size="small" variant="outlined" color="inherit" startIcon={<ReceiptLongRoundedIcon />} onClick={onOpenOrderArchive}>
              查看订单
            </Button>
          )}
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
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

function ToolButton({ title, children }) {
  return (
    <Tooltip title={title}>
      <span>{children}</span>
    </Tooltip>
  )
}
