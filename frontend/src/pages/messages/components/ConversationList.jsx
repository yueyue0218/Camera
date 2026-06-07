import { useEffect, useRef, useState } from 'react'
import { Avatar, Box, Paper, Stack, Typography } from '@mui/material'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { formatShortTime, getConversationSourceLabel } from '../utils/conversationUtils.js'
import { deriveConversationActions } from '../utils/workbenchState.js'
import { loadConversationPeerProfile, resolveConversationParticipants } from '../utils/participantResolver.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'
import { EmptyMessageCard } from './EmptyMessageCard.jsx'
import { StatusChip } from './StatusChip.jsx'

export function ConversationList({ conversations, currentUser, onOpenConversation }) {
  const [peerProfiles, setPeerProfiles] = useState({})
  const avatarObjectUrlsRef = useRef([])

  useEffect(() => {
    if (!currentUser || !conversations.length) return undefined

    let isCancelled = false
    const targets = new Map()
    conversations.forEach(conversation => {
      const participant = resolveConversationParticipants(conversation, currentUser)
      if (participant.peerUserId && !Object.prototype.hasOwnProperty.call(peerProfiles, participant.peerUserId)) {
        targets.set(participant.peerUserId, participant.peerRole)
      }
    })

    if (!targets.size) return undefined

    Promise.all(Array.from(targets.entries()).map(async ([peerUserId, peerRole]) => {
      try {
        const profile = await loadConversationPeerProfile(peerUserId, peerRole, currentUser)
        if (profile?.avatarObjectUrl) avatarObjectUrlsRef.current.push(profile.avatarObjectUrl)
        return [peerUserId, profile]
      } catch (error) {
        console.debug('[messages] failed to load conversation list peer profile', { peerUserId, error })
        return [peerUserId, null]
      }
    })).then(entries => {
      if (isCancelled) return
      setPeerProfiles(previous => entries.reduce((next, [peerUserId, profile]) => {
        next[peerUserId] = profile || null
        return next
      }, { ...previous }))
    })

    return () => {
      isCancelled = true
    }
  }, [conversations, currentUser, peerProfiles])

  useEffect(() => () => {
    avatarObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    avatarObjectUrlsRef.current = []
  }, [])

  return (
    <Paper variant="outlined" sx={{ p: 1, overflow: 'hidden', bgcolor: PORTRA_COLORS.paperMuted, borderColor: PORTRA_COLORS.borderMuted, borderRadius: PORTRA_RADII.panel, boxShadow: PORTRA_SHADOWS.subtle }}>
      <Stack spacing={1}>
        {conversations.map(conversation => {
          const baseParticipant = resolveConversationParticipants(conversation, currentUser)
          const participant = resolveConversationParticipants(conversation, currentUser, peerProfiles[baseParticipant.peerUserId])
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
                gridTemplateColumns: '52px minmax(0, 1fr) auto 20px',
                gap: 1.4,
                alignItems: 'center',
                minHeight: 84,
                px: { xs: 1.5, md: 2 },
                py: 1.4,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                bgcolor: needsMyAction ? PORTRA_COLORS.blueSoft : PORTRA_COLORS.paper,
                border: `1px solid ${needsMyAction ? 'rgba(13,47,178,.2)' : PORTRA_COLORS.borderMuted}`,
                borderRadius: '10px',
                transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background-color 150ms ease',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 8,
                  bottom: 8,
                  width: 3,
                  bgcolor: needsMyAction ? PORTRA_COLORS.blue : PORTRA_COLORS.paper,
                  borderRadius: '0 2px 2px 0',
                  transition: 'background-color 150ms ease'
                },
                '&:hover': {
                  transform: 'translateY(-2px)',
                  bgcolor: needsMyAction ? PORTRA_COLORS.blueSoft : PORTRA_COLORS.paper,
                  boxShadow: '0 6px 20px rgba(13,47,178,.10)',
                  borderColor: 'rgba(13,47,178,.22)'
                },
                '&:hover::before': { bgcolor: PORTRA_COLORS.blue },
                '&:hover .conversation-chevron': { opacity: 1, transform: 'translateX(0)' }
              }}
            >
              <Box sx={{ position: 'relative', width: 46, height: 46 }}>
                <Avatar
                  src={participant.peerAvatarUrl || undefined}
                  sx={{
                    width: 46,
                    height: 46,
                    bgcolor: needsMyAction ? PORTRA_COLORS.blue : PORTRA_COLORS.blueSoft,
                    color: needsMyAction ? PORTRA_COLORS.paper : PORTRA_COLORS.blue,
                    border: `2px solid ${PORTRA_COLORS.paper}`,
                    boxShadow: `0 0 0 1px ${PORTRA_COLORS.border}`,
                    fontWeight: 900
                  }}
                >
                  {getSafeDisplayText(participant.peerAvatarText, '对').slice(0, 1)}
                </Avatar>
                {needsMyAction && <Box sx={{ position: 'absolute', right: -1, top: -1, width: 10, height: 10, bgcolor: PORTRA_COLORS.orange, border: `2px solid ${PORTRA_COLORS.paper}`, borderRadius: '50%' }} />}
              </Box>
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography fontWeight={900} color={PORTRA_COLORS.ink} noWrap>
                  {getSafeDisplayText(participant.peerDisplayName, participant.peerUserId ? `用户 ${participant.peerUserId}` : '沟通对象')}
                </Typography>
                <Typography variant="body2" sx={{ color: needsMyAction ? PORTRA_COLORS.subInk : PORTRA_COLORS.mutedInk, fontWeight: needsMyAction ? 800 : 500 }} noWrap>
                  {activity}
                </Typography>
                <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk }} noWrap>{topic} · {getSafeDisplayText(getConversationSourceLabel(conversation), '约拍沟通')}</Typography>
              </Stack>
              <Stack spacing={0.7} sx={{ minWidth: 96, alignItems: 'flex-end' }}>
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
