import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { formatTime } from '../utils/conversationUtils.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'

export function MessageBubble({ message, mine, actor, canSaveSubmittedPhoto, onSaveSubmittedPhoto, onRetry }) {
  if (!message) return null
  const isImage = message.messageType === 'IMAGE'
  const deliveryStatus = message.deliveryStatus || (message.optimistic ? 'sending' : 'sent')
  const sending = deliveryStatus === 'sending'
  const failed = deliveryStatus === 'failed'
  const avatarAccent = mine ? PORTRA_COLORS.blue : PORTRA_COLORS.subInk
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 1.05 }}>
      {!mine && (
        <MessageActorAvatar
          actor={actor}
          dataKind="bubble"
          accent={avatarAccent}
          fallbackText="对"
        />
      )}
      <Stack spacing={0.38} sx={{ maxWidth: { xs: '86%', md: 'min(64%, 620px)' }, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Paper
          elevation={0}
          sx={{
            px: isImage ? 0.75 : 1.75,
            py: isImage ? 0.75 : 1.22,
            bgcolor: mine ? PORTRA_COLORS.blue : PORTRA_COLORS.paper,
            color: mine ? PORTRA_COLORS.paper : PORTRA_COLORS.subInk,
            border: mine ? `1px solid ${PORTRA_COLORS.blue}` : `1px solid ${PORTRA_COLORS.borderMuted}`,
            borderRadius: mine ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
            boxShadow: mine ? '0 10px 22px rgba(13, 47, 178, 0.14)' : PORTRA_SHADOWS.subtle,
            overflow: 'hidden'
          }}
        >
          {isImage ? (
            <Stack spacing={0.8}>
              <Box
                component="img"
                src={message.content}
                alt="沟通图片"
                sx={{ display: 'block', maxWidth: { xs: '100%', md: 420 }, maxHeight: 300, borderRadius: PORTRA_RADII.control, objectFit: 'cover' }}
              />
              {canSaveSubmittedPhoto && (
                <Button size="small" variant="contained" color="inherit" onClick={onSaveSubmittedPhoto}>
                  保存提交照片
                </Button>
              )}
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 15, lineHeight: 1.58, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{getSafeDisplayText(message.content, '消息内容')}</Typography>
          )}
        </Paper>
        <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center', px: 0.4 }}>
          <Typography variant="caption" sx={{ color: failed ? '#b42318' : PORTRA_COLORS.faintInk, fontSize: 12 }}>
            {formatTime(message.createdAt)}
          </Typography>
          {sending && (
            <Stack direction="row" spacing={0.45} sx={{ alignItems: 'center', color: PORTRA_COLORS.faintInk }}>
              <CircularProgress size={11} thickness={5} sx={{ color: PORTRA_COLORS.faintInk }} />
              <Typography variant="caption" sx={{ fontSize: 12, color: PORTRA_COLORS.faintInk }}>发送中</Typography>
            </Stack>
          )}
          {failed && (
            <Button
              size="small"
              color="error"
              onClick={onRetry}
              sx={{ minHeight: 22, px: 0.6, py: 0, fontSize: 12, fontWeight: 850 }}
            >
              发送失败，点击重试
            </Button>
          )}
        </Stack>
      </Stack>
      {mine && (
        <MessageActorAvatar
          actor={actor}
          dataKind="bubble"
          accent={avatarAccent}
          fallbackText="我"
        />
      )}
    </Box>
  )
}
