import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { formatTime } from '../utils/conversationUtils.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'

export function MessageBubble({ message, mine, actor, canSaveSubmittedPhoto, onSaveSubmittedPhoto }) {
  if (!message) return null
  const isImage = message.messageType === 'IMAGE'
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
      <Stack spacing={0.38} sx={{ maxWidth: { xs: '86%', md: 'min(66%, 620px)' }, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Paper
          elevation={0}
          sx={{
            px: isImage ? 0.75 : 1.55,
            py: isImage ? 0.75 : 1.12,
            bgcolor: mine ? PORTRA_COLORS.blue : PORTRA_COLORS.white,
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
                alt="会话图片"
                sx={{ display: 'block', maxWidth: { xs: '100%', md: 420 }, maxHeight: 300, borderRadius: PORTRA_RADII.control, objectFit: 'cover' }}
              />
              {canSaveSubmittedPhoto && (
                <Button size="small" variant="contained" color="inherit" onClick={onSaveSubmittedPhoto}>
                  保存提交照片
                </Button>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ lineHeight: 1.68, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{getSafeDisplayText(message.content, '消息内容')}</Typography>
          )}
        </Paper>
        <Typography variant="caption" sx={{ px: 0.4, color: PORTRA_COLORS.faintInk, fontSize: 11 }}>{formatTime(message.createdAt)}</Typography>
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
