import { Avatar, Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { formatShortTime, getOppositeUserId, roleMap } from '../utils/conversationUtils.js'
import { EmptyMessageCard } from './EmptyMessageCard.jsx'

export function ConversationList({ conversations, currentUser, onOpenConversation }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1, md: 1.5 } }}>
      <Stack spacing={0.5}>
        {conversations.map(conversation => {
          const oppositeId = getOppositeUserId(conversation, currentUser.userId)
          return (
            <Box
              key={conversation.conversationId}
              onClick={() => onOpenConversation(conversation.conversationId)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr auto',
                gap: 1.5,
                alignItems: 'center',
                p: 1.4,
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(118, 81, 212, 0.08)' }
              }}
            >
              <Avatar sx={{ bgcolor: conversation.isLocal ? 'secondary.main' : 'primary.main' }}>
                {conversation.scene?.slice(0, 1) || '会'}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} noWrap>
                  {conversation.scene || `会话 ${conversation.conversationId}`}
                </Typography>
                <Typography color="text.secondary" noWrap>
                  {conversation.lastMessage || `${roleMap[currentUser.role]}与用户 ${oppositeId} 的对话`}
                </Typography>
              </Box>
              <Stack spacing={0.5} alignItems="flex-end">
                <Typography variant="caption" color="text.secondary">{formatShortTime(conversation.updatedAt)}</Typography>
                <Chip size="small" label={conversation.isLocal ? '待接后端' : 'C接口'} />
              </Stack>
            </Box>
          )
        })}
        {!conversations.length && (
          <EmptyMessageCard text={currentUser.role === 'PROVIDER' ? '暂无会话。到需求大厅选择具体需求后发起邀请，接受后会出现在这里。' : '暂无会话。接受服务方邀请后会出现在这里。'} />
        )}
      </Stack>
    </Paper>
  )
}
