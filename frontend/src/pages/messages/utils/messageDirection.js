import { getCurrentUserId } from './workbenchState.js'

export function getMessageDirection(event, currentUser) {
  if (!event) return 'system'
  if (event.actorRole === 'PLATFORM' || event.side === 'center') return 'system'
  const currentUserId = getCurrentUserId(currentUser)
  const actorId = Number(event.actorId || event.actor?.userId || event.meta?.message?.senderId)
  if (currentUserId && Number.isFinite(actorId) && actorId === currentUserId) return 'self'
  if (event.actor?.isCurrentUser) return 'self'
  if (event.side === 'self') return 'self'
  return 'peer'
}
