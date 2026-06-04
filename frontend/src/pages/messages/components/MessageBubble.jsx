import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { formatTime } from '../utils/conversationUtils.js'

export function MessageBubble({ message, mine, canSaveSubmittedPhoto, onSaveSubmittedPhoto }) {
  const isImage = message.messageType === 'IMAGE'
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <Paper
        elevation={0}
        sx={{
          p: 1.4,
          maxWidth: { xs: '82%', md: '70%' },
          bgcolor: mine ? 'primary.main' : '#eef4f7',
          color: mine ? 'primary.contrastText' : 'text.primary',
          borderRadius: mine ? '8px 8px 2px 8px' : '8px 8px 8px 2px'
        }}
      >
        {isImage ? (
          <Stack spacing={0.8}>
            <Box
              component="img"
              src={message.content}
              alt="会话图片"
              sx={{ display: 'block', maxWidth: '100%', maxHeight: 260, borderRadius: 1, objectFit: 'cover' }}
            />
            {canSaveSubmittedPhoto && (
              <Button size="small" variant="contained" color="inherit" onClick={onSaveSubmittedPhoto}>
                保存提交照片
              </Button>
            )}
          </Stack>
        ) : (
          <Typography>{message.content}</Typography>
        )}
        <Typography variant="caption" sx={{ opacity: 0.75 }}>{formatTime(message.createdAt)}</Typography>
      </Paper>
    </Box>
  )
}
