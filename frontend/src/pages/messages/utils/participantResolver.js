import { USERS } from '../../../AuthContext.jsx'
import { fileApi, userApi } from '../../../api.js'
import { buildUserProfileTarget } from '../../../utils/orderNavigation.js'
import { getCurrentUserId } from './workbenchState.js'

const USER_PROFILE_STORAGE_KEY = 'camera-p4-user-profiles'

export function resolveConversationParticipants(conversation, currentUser, profileOverride = null) {
  const currentUserId = getCurrentUserId(currentUser)
  const participantAId = normalizeUserId(conversation?.participantAId || conversation?.customerId)
  const participantBId = normalizeUserId(conversation?.participantBId || conversation?.providerUserId || conversation?.providerId)
  const peerUserId = participantAId === currentUserId ? participantBId : participantBId === currentUserId ? participantAId : getKnownPeerId(conversation, currentUserId)
  const peerRole = peerUserId && peerUserId === participantBId ? 'PROVIDER' : 'CUSTOMER'
  const selfRole = currentUserId && currentUserId === participantBId ? 'PROVIDER' : 'CUSTOMER'
  const peerProfile = buildPeerProfile(conversation, peerUserId, peerRole, profileOverride)
  const selfProfile = buildSelfProfile(currentUser, selfRole, currentUserId)

  return {
    currentUserId,
    peerUserId,
    peerRole,
    selfRole,
    peerRoleLabel: roleLabel(peerRole),
    selfRoleLabel: roleLabel(selfRole),
    peerDisplayName: peerProfile.displayName,
    peerAvatarUrl: peerProfile.avatarUrl,
    peerAvatarText: peerProfile.avatarText,
    peerProfilePath: buildUserProfileTarget(peerUserId, currentUser)?.to || '',
    selfDisplayName: selfProfile.displayName,
    selfAvatarUrl: selfProfile.avatarUrl,
    selfAvatarText: selfProfile.avatarText,
    selfProfilePath: '/profile',
    actorsById: {
      ...(currentUserId ? {
        [currentUserId]: {
          userId: currentUserId,
          role: selfRole,
          isCurrentUser: true,
          displayName: selfProfile.displayName,
          avatarData: selfProfile.avatarUrl,
          avatarText: selfProfile.avatarText,
          profilePath: '/profile'
        }
      } : {}),
      ...(peerUserId ? {
        [peerUserId]: {
          userId: peerUserId,
          role: peerRole,
          isCurrentUser: false,
          displayName: peerProfile.displayName,
          avatarData: peerProfile.avatarUrl,
          avatarText: peerProfile.avatarText,
          profilePath: buildUserProfileTarget(peerUserId, currentUser)?.to || `/users/${peerUserId}`
        }
      } : {})
    }
  }
}

export async function loadConversationPeerProfile(peerUserId, peerRole, currentUser) {
  const userId = normalizeUserId(peerUserId)
  if (!userId) return null
  const role = peerRole || undefined
  const [briefResult, publicResult] = await Promise.allSettled([
    userApi.brief(userId, currentUser),
    userApi.publicProfile(userId, currentUser, role)
  ])
  const brief = briefResult.status === 'fulfilled' ? briefResult.value : null
  const publicProfile = publicResult.status === 'fulfilled' ? publicResult.value : null
  const profile = {
    ...(publicProfile || {}),
    ...(brief || {}),
    providerProfile: publicProfile?.providerProfile || brief?.providerProfile,
    userId
  }
  const avatarFileId = profile.avatarFileId || profile.avatarId || profile.profileImageFileId
  if (avatarFileId && !profile.avatarUrl && !profile.avatarData) {
    try {
      profile.avatarUrl = await fileApi.downloadObjectUrl(avatarFileId, currentUser)
      profile.avatarObjectUrl = profile.avatarUrl
    } catch {
      // Avatar image is optional; fallback initials keep the identity stable.
    }
  }
  return profile
}

export function mergeActorDisplay(actor, participants) {
  if (!actor) return null
  const actorUserId = normalizeUserId(actor.userId)
  const display = actorUserId ? participants?.actorsById?.[actorUserId] : null
  return {
    ...actor,
    ...(display || {}),
    displayName: display?.displayName || actor.displayName,
    avatarData: display?.avatarData || actor.avatarData,
    avatarText: display?.avatarText || actor.avatarText,
    profilePath: display?.profilePath || actor.profilePath
  }
}

function buildPeerProfile(conversation, peerUserId, peerRole, profileOverride) {
  const storedProfile = readStoredProfile(peerUserId)
  const demoProfile = Object.values(USERS).find(user => normalizeUserId(user.userId) === peerUserId) || {}
  const roleProfile = peerRole === 'PROVIDER' ? profileOverride?.providerProfile : null
  const displayName = pickText(
    profileOverride?.nickname,
    roleProfile?.displayName,
    roleProfile?.nickname,
    profileOverride?.displayName,
    conversation?.counterpartyNickname,
    conversation?.otherUserNickname,
    peerRole === 'PROVIDER' ? conversation?.providerNickname : conversation?.customerNickname,
    peerRole === 'PROVIDER' ? conversation?.providerName : conversation?.customerName,
    peerRole === 'PROVIDER' ? conversation?.providerDisplayName : conversation?.customerDisplayName,
    storedProfile.nickname,
    storedProfile.displayName,
    demoProfile.nickname,
    demoProfile.displayName,
    peerUserId ? `用户 ${peerUserId}` : '用户'
  )
  const avatarUrl = pickText(
    profileOverride?.avatarUrl,
    profileOverride?.avatarData,
    profileOverride?.avatar,
    roleProfile?.avatarUrl,
    roleProfile?.avatarData,
    conversation?.counterpartyAvatarUrl,
    conversation?.otherUserAvatarUrl,
    peerRole === 'PROVIDER' ? conversation?.providerAvatarUrl : conversation?.customerAvatarUrl,
    storedProfile.avatarData,
    storedProfile.avatarUrl,
    demoProfile.avatarData
  )
  return {
    displayName,
    avatarUrl,
    avatarText: String(displayName || '对').slice(0, 1) || '对'
  }
}

function buildSelfProfile(currentUser, selfRole, currentUserId) {
  const storedProfile = readStoredProfile(currentUserId)
  const demoProfile = Object.values(USERS).find(user => normalizeUserId(user.userId) === currentUserId) || {}
  const displayName = pickText(
    currentUser?.nickname,
    selfRole === 'PROVIDER' ? currentUser?.providerNickname : currentUser?.customerNickname,
    currentUser?.displayName,
    storedProfile.nickname,
    storedProfile.displayName,
    demoProfile.nickname,
    demoProfile.displayName,
    '我'
  )
  const avatarUrl = pickText(
    currentUser?.avatarData,
    currentUser?.avatarUrl,
    storedProfile.avatarData,
    storedProfile.avatarUrl,
    demoProfile.avatarData
  )
  return {
    displayName,
    avatarUrl,
    avatarText: String(displayName || '我').slice(0, 1) || '我'
  }
}

function getKnownPeerId(conversation, currentUserId) {
  const ids = [
    conversation?.counterpartyId,
    conversation?.otherUserId,
    conversation?.customerId,
    conversation?.providerUserId,
    conversation?.providerId
  ].map(normalizeUserId).filter(Boolean)
  return ids.find(id => id !== currentUserId) || null
}

function readStoredProfile(userId) {
  if (typeof window === 'undefined' || !userId) return {}
  try {
    return JSON.parse(window.localStorage.getItem(USER_PROFILE_STORAGE_KEY) || '{}')?.[String(userId)] || {}
  } catch {
    return {}
  }
}

function normalizeUserId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function pickText(...values) {
  return values.map(value => String(value || '').trim()).find(Boolean) || ''
}

function roleLabel(role) {
  return role === 'PROVIDER' ? '摄影师' : '客户'
}
