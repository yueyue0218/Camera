import { Avatar, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { formatTime } from '../utils/conversationUtils.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'

export function MessageBubble({ message, mine, avatar, avatarText, canSaveSubmittedPhoto, onSaveSubmittedPhoto }) {
  if (!message) return null
  const isImage = message.messageType === 'IMAGE'
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 1 }}>
      {!mine && <Avatar src={avatar || undefined} sx={{ width: 32, height: 32, bgcolor: PORTRA_COLORS.subInk, color: PORTRA_COLORS.paper, fontSize: 13, fontWeight: 900 }}>{avatarText || '对'}</Avatar>}
      <Stack spacing={0.35} alignItems={mine ? 'flex-end' : 'flex-start'} sx={{ maxWidth: { xs: '82%', md: '68%' } }}>
        <Paper
          elevation={0}
          sx={{
            px: isImage ? 0.7 : 1.35,
            py: isImage ? 0.7 : 1.05,
            bgcolor: mine ? PORTRA_COLORS.blue : PORTRA_COLORS.paper,
            color: mine ? PORTRA_COLORS.paper : PORTRA_COLORS.subInk,
            border: mine ? `1px solid ${PORTRA_COLORS.blue}` : `1px solid ${PORTRA_COLORS.borderMuted}`,
            borderRadius: mine ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
            boxShadow: mine ? '0 5px 14px rgba(13, 47, 178, 0.14)' : PORTRA_SHADOWS.subtle
          }}
        >
          {isImage ? (
            <Stack spacing={0.8}>
              <Box
                component="img"
                src={message.content}
                alt="会话图片"
                sx={{ display: 'block', maxWidth: '100%', maxHeight: 280, borderRadius: PORTRA_RADII.control, objectFit: 'cover' }}
              />
              {canSaveSubmittedPhoto && (
                <Button size="small" variant="contained" color="inherit" onClick={onSaveSubmittedPhoto}>
                  保存提交照片
                </Button>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{getSafeDisplayText(message.content, '消息内容')}</Typography>
          )}
        </Paper>
        <Typography variant="caption" sx={{ px: 0.4, color: PORTRA_COLORS.faintInk, fontSize: 11 }}>{formatTime(message.createdAt)}</Typography>
      </Stack>
      {mine && <Avatar src={avatar || undefined} sx={{ width: 32, height: 32, bgcolor: PORTRA_COLORS.blue, color: PORTRA_COLORS.paper, fontSize: 13, fontWeight: 900 }}>{avatarText || '我'}</Avatar>}
    </Box>
  )
}
