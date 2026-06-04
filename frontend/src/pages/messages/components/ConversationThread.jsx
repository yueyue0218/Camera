import { Button, Divider, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import { MessageBubble } from './MessageBubble.jsx'

export function ConversationThread({
  messages,
  conversation,
  currentUser,
  content,
  loading,
  imageSending,
  canSeeQuoteEntry,
  canCreateQuote,
  showQuoteForm,
  editingQuotationId,
  onOpenQuoteForm,
  onContentChange,
  onSendMessage,
  onChooseMessageImage,
  onSaveSubmittedPhoto
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
      <Stack spacing={1.2} sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
        {messages.map(message => {
          const mine = message.senderId === currentUser.userId
          const isImage = message.messageType === 'IMAGE'
          const canSaveSubmittedPhoto = isImage && Number(message.senderId) === Number(conversation?.participantBId)
          return (
            <MessageBubble
              key={message.messageId}
              message={message}
              mine={mine}
              canSaveSubmittedPhoto={canSaveSubmittedPhoto}
              onSaveSubmittedPhoto={() => onSaveSubmittedPhoto(message)}
            />
          )
        })}
        {!messages.length && <Typography color="text.secondary">还没有消息</Typography>}
      </Stack>

      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" alignItems="center" spacing={1}>
        {canSeeQuoteEntry && (
          <Tooltip title="发起报价">
            <span>
              <IconButton
                color={showQuoteForm ? 'primary' : 'default'}
                onClick={onOpenQuoteForm}
                disabled={!canCreateQuote}
              >
                <LocalOfferRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
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
          placeholder="输入消息"
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
    </Paper>
  )
}
