import { Avatar, Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { formatShortTime, getCounterpartyProfile, getConversationSourceLabel } from '../utils/conversationUtils.js'
import { deriveConversationActions } from '../utils/workbenchState.js'
import { EmptyMessageCard } from './EmptyMessageCard.jsx'

export function ConversationList({ conversations, currentUser, onOpenConversation }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1, md: 1.5 } }}>
      <Stack spacing={0.5}>
        {conversations.map(conversation => {
          const counterparty = getCounterpartyProfile(conversation, currentUser)
          const actions = deriveConversationActions({
            conversation,
            order: conversation.activeOrder,
            activeRole: currentUser.role,
            currentUser
          })
          const topic = getConversationListTopic(conversation)
          const needsMyAction = actions.primaryActions.some(action => ['CONFIRM_QUOTE', 'PAY', 'UPLOAD_DELIVERY', 'REUPLOAD_DELIVERY', 'CONFIRM_DELIVERY', 'REQUEST_REWORK', 'REVIEW_AUTHORIZATION'].includes(action))
          const activity = getConversationListActivity(conversation, actions)
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
                '&:hover': { bgcolor: 'rgba(13, 47, 178, 0.06)' }
              }}
            >
              <Avatar src={counterparty.avatarData || undefined} sx={{ bgcolor: '#0d2fb2' }}>
                {counterparty.initial}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} noWrap>
                  {counterparty.nickname !== '对方用户' ? counterparty.nickname : `${actions.stage.title} · ${topic}`}
                </Typography>
                <Typography color="text.secondary" noWrap>
                  {topic} · {activity} · {getConversationSourceLabel(conversation)}
                </Typography>
              </Box>
              <Stack spacing={0.5} alignItems="flex-end">
                <Typography variant="caption" color="text.secondary">{formatShortTime(conversation.updatedAt)}</Typography>
                <Chip size="small" color={needsMyAction ? 'primary' : 'default'} label={needsMyAction ? '轮到我处理' : actions.stage.title} />
              </Stack>
            </Box>
          )
        })}
        {!conversations.length && (
          <EmptyMessageCard text={currentUser.role === 'PROVIDER' ? '暂无会话。到需求大厅选择具体需求后发起邀请，接受后会出现在这里。' : '暂无会话。接受摄影师邀请后会出现在这里。'} />
        )}
      </Stack>
    </Paper>
  )
}

function getConversationListTopic(conversation) {
  const scene = String(conversation?.scene || '').trim()
  if (scene && scene !== '约拍沟通' && scene !== '约拍需求沟通') return scene
  if (conversation?.location) return conversation.location
  return '校园约拍'
}

function getConversationListActivity(conversation, actions) {
  const lastMessage = String(conversation?.lastMessage || '').trim()
  if (lastMessage && !['最近有新消息', '点击进入对话'].includes(lastMessage)) return lastMessage
  return actions.stage.description
}
