import { Avatar } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { buildUserProfileTarget } from '../../../utils/orderNavigation.js'
import { PORTRA_COLORS } from '../MessageVisualTokens.js'

export function MessageActorAvatar({
  actor,
  fallbackText = '对',
  avatarData = '',
  accent = PORTRA_COLORS.subInk,
  dataKind,
  sx
}) {
  const navigate = useNavigate()
  if (!actor) return null

  const profileTarget = buildUserProfileTarget(actor, actor.isCurrentUser ? { userId: actor.userId } : null)
  const profilePath = actor.profilePath || profileTarget?.to || ''
  const canOpenProfile = Boolean(profilePath)
  const openProfile = event => {
    event.stopPropagation()
    if (canOpenProfile) {
      navigate(profilePath)
      return
    }
    console.debug('[messages] actor avatar missing profile path', { actor })
  }

  return (
    <Avatar
      data-message-avatar={dataKind}
      data-avatar-user-id={actor.userId || ''}
      data-avatar-profile-path={profilePath}
      src={avatarData || actor.avatarData || undefined}
      onClick={openProfile}
      sx={{
        width: 38,
        height: 38,
        flexShrink: 0,
        bgcolor: accent,
        color: PORTRA_COLORS.paper,
        fontSize: 14,
        fontWeight: 900,
        cursor: canOpenProfile ? 'pointer' : 'default',
        ...sx
      }}
    >
      {actor.avatarText || fallbackText}
    </Avatar>
  )
}
