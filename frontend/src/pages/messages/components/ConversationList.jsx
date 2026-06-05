import { Avatar, Box, Paper, Stack, Typography } from '@mui/material'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { formatShortTime, getCounterpartyProfile, getConversationSourceLabel } from '../utils/conversationUtils.js'
import { deriveConversationActions } from '../utils/workbenchState.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'
import { EmptyMessageCard } from './EmptyMessageCard.jsx'
import { StatusChip } from './StatusChip.jsx'

export function ConversationList({ conversations, currentUser, onOpenConversation, onOpenUserProfile }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', bgcolor: PORTRA_COLORS.paper, borderColor: PORTRA_COLORS.borderMuted, borderRadius: PORTRA_RADII.panel, boxShadow: PORTRA_SHADOWS.subtle }}>
      <Stack spacing={0}>
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
          const openCounterpartyProfile = event => {
            event.stopPropagation()
            if (counterparty.userId && typeof onOpenUserProfile === 'function') onOpenUserProfile(counterparty.userId)
          }
          return (
            <Box
              key={conversation.conversationId}
              onClick={() => onOpenConversation(conversation.conversationId)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '52px minmax(0, 1fr) auto 20px',
                gap: 1.4,
                alignItems: 'center',
                minHeight: 84,
                px: { xs: 1.4, md: 2 },
                py: 1.3,
                cursor: 'pointer',
                bgcolor: needsMyAction ? PORTRA_COLORS.yellowSoft : PORTRA_COLORS.paper,
                borderLeft: `4px solid ${needsMyAction ? PORTRA_COLORS.yellow : 'transparent'}`,
                borderBottom: `1px solid ${PORTRA_COLORS.borderMuted}`,
                transition: 'background-color 140ms ease, box-shadow 140ms ease',
                '&:last-of-type': { borderBottom: 0 },
                '&:hover': { bgcolor: PORTRA_COLORS.paperMuted, boxShadow: `inset 4px 0 ${PORTRA_COLORS.blue}` },
                '&:hover .conversation-chevron': { opacity: 1, transform: 'translateX(0)' }
              }}
            >
              <Box onClick={openCounterpartyProfile} sx={{ position: 'relative', width: 46, height: 46 }}>
                <Avatar
                  src={counterparty.avatarData || undefined}
                  sx={{
                    width: 46,
                    height: 46,
                    bgcolor: needsMyAction ? PORTRA_COLORS.blue : PORTRA_COLORS.subInk,
                    color: PORTRA_COLORS.paper,
                    border: `2px solid ${PORTRA_COLORS.paper}`,
                    boxShadow: `0 0 0 1px ${PORTRA_COLORS.border}`,
                    fontWeight: 900,
                    cursor: counterparty.userId ? 'pointer' : 'default'
                  }}
                >
                  {getSafeDisplayText(counterparty.initial, '对').slice(0, 1)}
                </Avatar>
                {needsMyAction && <Box sx={{ position: 'absolute', right: -1, top: -1, width: 10, height: 10, bgcolor: PORTRA_COLORS.orange, border: `2px solid ${PORTRA_COLORS.paper}`, borderRadius: '50%' }} />}
              </Box>
              <Stack spacing={0.5} onClick={openCounterpartyProfile} sx={{ minWidth: 0, cursor: counterparty.userId ? 'pointer' : 'default' }}>
                <Typography fontWeight={900} color={PORTRA_COLORS.ink} noWrap>
                  {getSafeDisplayText(counterparty.nickname, '对方用户')}
                </Typography>
                <Typography variant="body2" sx={{ color: needsMyAction ? PORTRA_COLORS.subInk : PORTRA_COLORS.mutedInk, fontWeight: needsMyAction ? 800 : 500 }} noWrap>
                  {activity}
                </Typography>
                <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk }} noWrap>{topic} · {getSafeDisplayText(getConversationSourceLabel(conversation), '本次合作')}</Typography>
              </Stack>
              <Stack spacing={0.7} alignItems="flex-end" sx={{ minWidth: 96 }}>
                <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk }}>{formatShortTime(conversation.updatedAt)}</Typography>
                <StatusChip label={needsMyAction ? '待我处理' : actions.stage.title} emphasis={needsMyAction} />
              </Stack>
              <ChevronRightRoundedIcon className="conversation-chevron" sx={{ color: PORTRA_COLORS.blue, opacity: needsMyAction ? 0.65 : 0, transform: 'translateX(-4px)', transition: 'all 140ms ease' }} />
            </Box>
          )
        })}
        {!conversations.length && (
          <EmptyMessageCard />
        )}
      </Stack>
    </Paper>
  )
}

function getConversationListTopic(conversation) {
  const scene = String(conversation?.scene || '').trim()
  if (scene && scene !== '约拍沟通' && scene !== '约拍需求沟通') return getSafeDisplayText(scene, '校园约拍')
  if (conversation?.location) return getSafeDisplayText(conversation.location, '校园约拍')
  return '校园约拍'
}

function getConversationListActivity(conversation, actions) {
  const lastMessage = String(conversation?.lastMessage || '').trim()
  if (lastMessage && !['最近有新消息', '点击进入对话'].includes(lastMessage)) return getSafeDisplayText(lastMessage, actions.stage.description)
  return actions.stage.description
}
