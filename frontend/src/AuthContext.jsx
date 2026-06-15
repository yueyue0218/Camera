import { createContext, useContext, useMemo, useState } from 'react'
import { USERS } from './auth/demoUsers.js'

export { USERS }

const AUTH_STORAGE_KEY = 'camera-p4-auth'
const USER_PROFILE_STORAGE_KEY = 'camera-p4-user-profiles'

const AuthContext = createContext(null)

function roleToUserKey(role) {
  return role === 'PROVIDER' ? 'provider' : 'customer'
}

function readUserProfiles() {
  try {
    return JSON.parse(localStorage.getItem(USER_PROFILE_STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function saveStoredProfile(user) {
  if (!user?.userId) return
  const profiles = readUserProfiles()
  const userId = String(user.userId)
  const prev = profiles[userId] || {}
  // Blob URLs (blob:...) only live for the current page session — don't persist them.
  // Keep the previously stored data URL so it survives page reloads.
  const avatarData = user.avatarData && !user.avatarData.startsWith('blob:')
    ? user.avatarData
    : (prev.avatarData || '')
  profiles[userId] = {
    ...prev,
    userId: Number(user.userId),
    role: user.role,
    nickname: user.nickname,
    avatarFileId: user.avatarFileId || null,
    avatarData,
    bio: user.bio || user.description || '',
    description: user.description || user.bio || '',
    availability: user.availability || '',
    customerNickname: user.customerNickname || user.nickname || '',
    customerBio: user.customerBio !== undefined ? user.customerBio : (user.role !== 'PROVIDER' ? (user.bio || '') : profiles[userId]?.customerBio || ''),
    providerNickname: user.providerNickname !== undefined ? user.providerNickname : profiles[userId]?.providerNickname || null,
    providerBio: user.providerBio !== undefined ? user.providerBio : profiles[userId]?.providerBio || ''
  }
  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profiles))
}

function tokenSubject(token) {
  if (!token || typeof token !== 'string' || token.split('.').length < 2) return null
  try {
    const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.sub || payload.userId || payload.id || null
  } catch {
    return null
  }
}

function isDemoToken(token) {
  return typeof token === 'string' && token.startsWith('demo-token-')
}

function normalizedUserId(session, demoUser) {
  const token = session.token || session.accessToken
  if (isDemoToken(token)) {
    return Number(demoUser.userId)
  }
  const value = tokenSubject(session.token || session.accessToken)
    || session.user.userId
    || session.user.id
    || session.user.user?.userId
    || session.user.user?.id
    || demoUser.userId
  const number = Number(value)
  return Number.isFinite(number) ? number : Number(demoUser.userId)
}

function normalizeSession(session) {
  if (!session?.user) return null
  if (session.user.role === 'ADMIN') return null
  const role = session.user.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER'
  const demoUser = USERS[roleToUserKey(role)]
  const userId = normalizedUserId(session, demoUser)
  const storedProfile = readUserProfiles()[String(userId)] || {}
  const availability = session.user.availability || storedProfile.availability || demoUser.availability || ''

  // Dual-identity: customer fields come from users table, provider fields from provider_profiles
  const customerNickname = session.user.customerNickname || storedProfile.customerNickname
    || session.user.nickname || storedProfile.nickname || demoUser.nickname
  const customerBio = session.user.customerBio !== undefined ? session.user.customerBio
    : (storedProfile.customerBio !== undefined ? storedProfile.customerBio : (session.user.bio || storedProfile.bio || demoUser.bio || demoUser.description || ''))
  const providerNickname = session.user.providerNickname !== undefined ? session.user.providerNickname
    : storedProfile.providerNickname || null
  const providerBio = session.user.providerBio !== undefined ? session.user.providerBio
    : storedProfile.providerBio || ''

  const isProvider = role === 'PROVIDER'
  const nickname = isProvider ? (providerNickname || customerNickname) : customerNickname
  const bio = isProvider ? providerBio : customerBio
  const rawToken = session.token || session.accessToken
  const token = isDemoToken(rawToken)
    ? `demo-token-${role.toLowerCase()}-${userId}`
    : (rawToken || `demo-token-${role.toLowerCase()}-${userId}`)

  return {
    token,
    refreshToken: session.refreshToken || '',
    user: {
      ...demoUser,
      ...storedProfile,
      ...session.user,
      userId,
      id: userId,
      role,
      label: role === 'PROVIDER' ? '服务方' : '需求方',
      nickname,
      avatarData: (storedProfile.avatarData && !storedProfile.avatarData.startsWith('blob:') ? storedProfile.avatarData : null)
        || (session.user.avatarData && !session.user.avatarData.startsWith('blob:') ? session.user.avatarData : null)
        || demoUser.avatarData,
      bio,
      description: bio,
      availability,
      customerNickname,
      customerBio,
      providerNickname,
      providerBio
    }
  }
}

function readStoredSession() {
  try {
    return normalizeSession(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)))
  } catch {
    return null
  }
}

function persistSession(session) {
  if (session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)
  const currentUser = session ? { ...session.user, token: session.token } : null
  const userKey = roleToUserKey(currentUser?.role)

  function completeLogin(nextSession) {
    const normalized = normalizeSession(nextSession)
    setSession(normalized)
    persistSession(normalized)
    return normalized
  }

  function loginWithDemo({ role, mobile }) {
    const demoUser = USERS[roleToUserKey(role)]
    return completeLogin({
      token: `demo-token-${demoUser.role.toLowerCase()}-${demoUser.userId}`,
      user: {
        ...demoUser,
        mobile: mobile || demoUser.mobile
      }
    })
  }

  function setUserKey(nextUserKey) {
    if (!USERS[nextUserKey]) return
    const demoUser = USERS[nextUserKey]
    const storedProfile = readUserProfiles()[String(demoUser.userId)] || {}
    const nextSession = normalizeSession({
      ...session,
      user: {
        ...demoUser,
        ...storedProfile
      }
    })
    setSession(nextSession)
    persistSession(nextSession)
  }

  function updateProfile(partial) {
    if (!session) return null
    // Route nickname/bio updates to the correct role-specific field
    const roleFields = {}
    if (partial.role === 'PROVIDER') {
      if (partial.nickname != null) roleFields.providerNickname = partial.nickname
      if (partial.bio != null) roleFields.providerBio = partial.bio
    } else if (partial.role === 'CUSTOMER') {
      if (partial.nickname != null) roleFields.customerNickname = partial.nickname
      if (partial.bio != null) roleFields.customerBio = partial.bio
    }
    const nextUser = { ...session.user, ...partial, ...roleFields }
    saveStoredProfile(nextUser)
    const nextSession = normalizeSession({ ...session, user: nextUser })
    setSession(nextSession)
    persistSession(nextSession)
    return nextSession
  }

  function logout() {
    setSession(null)
    persistSession(null)
  }

  function switchRole(newRole) {
    if (!session) return
    const nextSession = normalizeSession({
      ...session,
      user: { ...session.user, role: newRole }
    })
    setSession(nextSession)
    persistSession(nextSession)
  }

  const value = useMemo(() => ({
    session,
    token: session?.token || '',
    userKey,
    currentUser,
    isAuthenticated: Boolean(session),
    completeLogin,
    loginWithDemo,
    logout,
    setUserKey,
    switchRole,
    updateProfile
  }), [session, userKey, currentUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('缺少登录状态上下文')
  return context
}
