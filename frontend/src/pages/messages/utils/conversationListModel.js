import { getSafeDisplayText } from '../MessageVisualTokens.js'
import { deriveConversationActions } from './workbenchState.js'
import { buildConversationPreview, getConversationActivityTime } from './messagePreviewFormatter.js'
import { isConversationUnread } from './conversationReadState.js'
import { resolveConversationParticipants } from './participantResolver.js'

const ACTION_BADGE_TYPES = new Set([
  'CONFIRM_QUOTE',
  'PAY',
  'UPLOAD_DELIVERY',
  'REUPLOAD_DELIVERY',
  'CONFIRM_DELIVERY',
  'REQUEST_REWORK',
  'REVIEW_AUTHORIZATION'
])

export function buildConversationListItems({
  conversations = [],
  currentUser,
  peerProfiles = {},
  activeConversationId = null
}) {
  return conversations
    .map(conversation => {
      const baseParticipant = resolveConversationParticipants(conversation, currentUser)
      const participant = resolveConversationParticipants(
        conversation,
        currentUser,
        peerProfiles[baseParticipant.peerUserId]
      )
      const actions = deriveConversationActions({
        conversation,
        order: conversation.activeOrder,
        activeRole: currentUser?.role,
        currentUser
      })
      const preview = buildConversationPreview(conversation)
      const needsMyAction = actions.primaryActions.some(action => ACTION_BADGE_TYPES.has(action))
      const unread = isConversationUnread(conversation, currentUser, {
        activeConversationId,
        latestSenderId: preview.senderId
      })
      return {
        conversation,
        participant,
        actions,
        preview,
        needsMyAction,
        unread,
        activityTime: getConversationActivityTime(conversation),
        title: getSafeDisplayText(
          participant.peerDisplayName,
          participant.peerUserId ? `用户 ${participant.peerUserId}` : '沟通对象'
        )
      }
    })
    .sort((left, right) => toTime(right.activityTime) - toTime(left.activityTime)
      || Number(right.conversation?.conversationId || 0) - Number(left.conversation?.conversationId || 0))
}

export function formatConversationListTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  if (target === today) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  if (target === today - 24 * 60 * 60 * 1000) return '昨天'
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function toTime(value) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}
