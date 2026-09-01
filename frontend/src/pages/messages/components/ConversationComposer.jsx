import { useRef, useState } from 'react'
import { Box, Button, IconButton, Popover, Stack, TextField, Typography } from '@mui/material'
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import { buildOrderAction } from '../../../utils/orderNavigation.js'
import { PortraActionLink, PortraPrimaryAction, PortraSecondaryAction } from '../../../components/portra/index.js'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'
import { MessageToolbarButton } from './MessageToolbarButton.jsx'

export function ConversationComposer({
  content,
  loading,
  imageSending,
  canSeeQuoteEntry,
  canCreateQuote,
  showQuoteForm,
  quoteActionLabel = '发送报价',
  quoteEntryHint = '',
  actions,
  orderId,
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
  pendingAttachment,
  onChooseMessageImage,
  onChooseMessageFile,
  onRemoveAttachment,
  onUnavailableTool,
  onOpenAction
}) {
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const [emojiAnchor, setEmojiAnchor] = useState(null)
  const pendingQuote = actions.pendingQuote
  const orderAction = buildOrderAction(orderId)
  const canOpenOrderArchive = Boolean(orderAction && typeof onOpenOrderArchive === 'function')
  const openOrderArchive = event => {
    event?.stopPropagation()
    if (canOpenOrderArchive) onOpenOrderArchive(orderAction.orderId)
  }
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
  const sendingDisabled = loading || imageSending
  const canSend = Boolean(content.trim() || pendingAttachment) && !sendingDisabled
  const chooseImage = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onChooseMessageImage?.(file)
  }
  const chooseFile = event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onChooseMessageFile?.(file)
  }
  const insertEmoji = emoji => {
    onContentChange(`${content || ''}${emoji}`)
    setEmojiAnchor(null)
  }
  return (
    <Box sx={{ px: { xs: 1.1, md: 1.35 }, pt: 0.68, pb: 0.72, bgcolor: PORTRA_COLORS.paper, borderTop: `1px solid ${PORTRA_COLORS.borderMuted}`, boxShadow: '0 -1px 0 rgba(255, 255, 255, 0.62) inset' }}>
      <Stack spacing={0.62}>
        {hasQuickActions && (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={0.75}
            sx={{
              alignItems: { xs: 'stretch', md: 'center' },
              py: 0.28,
              px: 0.55,
              bgcolor: 'transparent',
              borderRadius: PORTRA_RADII.control,
              border: 0,
              boxShadow: 'none'
            }}
          >
            <Stack direction="row" spacing={0.8} sx={{ minWidth: 0, alignItems: 'center', flex: 1 }}>
              <Typography variant="caption" sx={{ color: PORTRA_COLORS.mutedInk, fontWeight: 950, flexShrink: 0 }}>下一步</Typography>
              {quoteEntryHint && (
                <Typography variant="caption" noWrap sx={{ color: PORTRA_COLORS.faintInk, minWidth: 0 }}>
                  {quoteEntryHint}
                </Typography>
              )}
            </Stack>
            <Stack direction="row" spacing={0.55} sx={{ flexWrap: 'wrap', rowGap: 0.55 }}>
              {actions.canSendQuote && canSeeQuoteEntry && (
                <PortraSecondaryAction
                  startIcon={<LocalOfferRoundedIcon />}
                  onClick={onOpenQuoteForm}
                  disabled={!canCreateQuote && !showQuoteForm}
                >
                  {showQuoteForm ? '收起报价单' : quoteActionLabel}
                </PortraSecondaryAction>
              )}
              {actions.canEditQuote && (
                <PortraSecondaryAction startIcon={<LocalOfferRoundedIcon />} onClick={() => onStartQuoteEditing(pendingQuote)} disabled={loading}>
                  编辑报价
                </PortraSecondaryAction>
              )}
              {actions.canConfirmQuote && pendingQuote && (
                <PortraPrimaryAction startIcon={<ReceiptLongRoundedIcon />} onClick={() => onOpenQuoteDetail(pendingQuote)} disabled={loading}>
                  查看报价详情
                </PortraPrimaryAction>
              )}
              {actions.canPay && (
                <PortraPrimaryAction startIcon={<PaidRoundedIcon />} onClick={onPayOrder} disabled={loading}>
                  去支付
                </PortraPrimaryAction>
              )}
              {actions.cancelAction && (
                <PortraSecondaryAction onClick={() => onCancelOrder(actions.cancelAction)} disabled={loading}>
                  {actions.cancelAction.label}
                </PortraSecondaryAction>
              )}
              {(actions.canUploadDelivery || actions.canReuploadDelivery) && (
                <PortraPrimaryAction
                  startIcon={<AddPhotoAlternateRoundedIcon />}
                  onClick={() => onOpenAction(actions.canReuploadDelivery ? 'REUPLOAD_DELIVERY' : 'UPLOAD_DELIVERY')}
                >
                  {actions.canReuploadDelivery ? '重新上传作品' : '上传作品'}
                </PortraPrimaryAction>
              )}
              {actions.canRequestRework && (
                <PortraSecondaryAction startIcon={<RefreshRoundedIcon />} onClick={() => onOpenAction('REQUEST_REWORK')}>
                  提交返修
                </PortraSecondaryAction>
              )}
              {actions.canConfirmDelivery && (
                <PortraPrimaryAction startIcon={<CheckCircleRoundedIcon />} onClick={onConfirmOrder} disabled={loading}>
                  确认接收
                </PortraPrimaryAction>
              )}
              {actions.canRequestPhotoAuthorization && (
                <PortraSecondaryAction startIcon={<ImageRoundedIcon />} onClick={() => onOpenAction('REQUEST_AUTHORIZATION')}>
                  申请展示授权
                </PortraSecondaryAction>
              )}
              {actions.canReviewPhotoAuthorization && (
                <PortraSecondaryAction startIcon={<CheckCircleRoundedIcon />} href="#conversation-authorization-action">
                  处理授权
                </PortraSecondaryAction>
              )}
              {actions.canViewDispute && canOpenOrderArchive && (
                <PortraActionLink onClick={openOrderArchive}>
                  查看争议进展
                </PortraActionLink>
              )}
              {actions.canOpenOrder && canOpenOrderArchive && (
                <PortraActionLink data-message-order-entry="composer-primary" startIcon={<ReceiptLongRoundedIcon />} onClick={openOrderArchive}>
                  查看订单
                </PortraActionLink>
              )}
            </Stack>
          </Stack>
        )}

        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', flexWrap: 'wrap', minHeight: 30 }}>
          <Typography variant="caption" sx={{ mr: 0.5, color: PORTRA_COLORS.faintInk, fontWeight: 750 }}>沟通工具</Typography>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={chooseImage} />
          <input ref={fileInputRef} type="file" hidden onChange={chooseFile} />
          <MessageToolbarButton title="发送图片" onClick={() => imageInputRef.current?.click()} disabled={sendingDisabled}>
            <ImageRoundedIcon fontSize="small" />
          </MessageToolbarButton>
          <MessageToolbarButton title="发送附件" onClick={() => fileInputRef.current?.click()} disabled={sendingDisabled}><AttachFileRoundedIcon fontSize="small" /></MessageToolbarButton>
          <MessageToolbarButton title="插入表情" onClick={event => setEmojiAnchor(event.currentTarget)} disabled={sendingDisabled}><EmojiEmotionsRoundedIcon fontSize="small" /></MessageToolbarButton>
          <Popover
            open={Boolean(emojiAnchor)}
            anchorEl={emojiAnchor}
            onClose={() => setEmojiAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Stack direction="row" spacing={0.45} sx={{ p: 0.8, bgcolor: PORTRA_COLORS.paper }}>
              {['😀', '😊', '👌', '👍', '🙏', '📷', '✨', '❤️'].map(emoji => (
                <Button key={emoji} size="small" onClick={() => insertEmoji(emoji)} sx={emojiButtonSx}>
                  {emoji}
                </Button>
              ))}
            </Stack>
          </Popover>
          <MessageToolbarButton title="补款功能将作为订单交易能力单独设计" unavailable onClick={() => onUnavailableTool('补款')}><AccountBalanceWalletRoundedIcon fontSize="small" /></MessageToolbarButton>
          {actions.canOpenOrder && canOpenOrderArchive && (
            <MessageToolbarButton title="查看订单" data-message-order-entry="composer-toolbar" onClick={openOrderArchive}><ReceiptLongRoundedIcon fontSize="small" /></MessageToolbarButton>
          )}
          {actions.canAppeal && (
            <MessageToolbarButton title="平台协助" onClick={() => onUnavailableTool('平台协助')}><SupportAgentRoundedIcon fontSize="small" /></MessageToolbarButton>
          )}
        </Stack>

        {pendingAttachment && (
          <Stack direction="row" spacing={0.9} sx={pendingAttachmentSx}>
            {pendingAttachment.previewUrl ? (
              <Box component="img" src={pendingAttachment.previewUrl} alt={pendingAttachment.name} sx={pendingImageSx} />
            ) : (
              <Box sx={pendingFileIconSx}><AttachFileRoundedIcon fontSize="small" /></Box>
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 13, fontWeight: 900 }} noWrap>
                {pendingAttachment.name}
              </Typography>
              <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk }}>
                {pendingAttachment.kind === 'IMAGE' ? '图片' : '附件'} · {formatFileSize(pendingAttachment.size)}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onRemoveAttachment} disabled={sendingDisabled} sx={{ color: PORTRA_COLORS.faintInk }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}

        <Stack data-message-composer-input-row="true" direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={4}
            placeholder="和对方继续沟通拍摄细节"
            value={content}
            onChange={event => onContentChange(event.target.value)}
            disabled={sendingDisabled}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (canSend) onSendMessage()
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                minHeight: 42,
                bgcolor: PORTRA_COLORS.page,
                borderRadius: PORTRA_RADII.control,
                '& fieldset': { borderColor: PORTRA_COLORS.border },
                '&:hover fieldset': { borderColor: PORTRA_COLORS.mutedInk },
                '&.Mui-focused fieldset': { borderColor: PORTRA_COLORS.blue, borderWidth: 1 },
                '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(13,47,178,.08)' }
              }
            }}
          />
          <Button
            variant="contained"
            onClick={onSendMessage}
            disabled={!canSend}
            aria-label="发送"
            sx={{
              minWidth: 44,
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: PORTRA_COLORS.blue,
              '&:hover': { bgcolor: PORTRA_COLORS.blueDark },
              '&.Mui-disabled': { bgcolor: PORTRA_COLORS.paperMuted, color: PORTRA_COLORS.faintInk }
            }}
          >
            <SendRoundedIcon />
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}

function formatFileSize(size) {
  const value = Number(size || 0)
  if (!Number.isFinite(value) || value <= 0) return '未知大小'
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

const pendingAttachmentSx = {
  alignItems: 'center',
  p: 0.75,
  borderRadius: PORTRA_RADII.control,
  bgcolor: PORTRA_COLORS.page,
  border: `1px solid ${PORTRA_COLORS.borderMuted}`
}

const pendingImageSx = {
  width: 42,
  height: 42,
  borderRadius: '10px',
  objectFit: 'cover',
  bgcolor: PORTRA_COLORS.paperMuted,
  flexShrink: 0
}

const pendingFileIconSx = {
  width: 42,
  height: 42,
  borderRadius: '10px',
  display: 'grid',
  placeItems: 'center',
  bgcolor: PORTRA_COLORS.paperMuted,
  color: PORTRA_COLORS.blue,
  flexShrink: 0
}

const emojiButtonSx = {
  minWidth: 32,
  width: 32,
  height: 32,
  p: 0,
  fontSize: 18,
  borderRadius: '9px'
}
