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
  profiles[userId] = {
    ...profiles[userId],
    userId: Number(user.userId),
    role: user.role,
    nickname: user.nickname,
    avatarData: user.avatarData || '',
    bio: user.bio || user.description || '',
    description: user.description || user.bio || '',
    availability: user.availability || ''
  }
  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profiles))
}

function normalizeSession(session) {
  if (!session?.user) return null
  const role = session.user.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER'
  const demoUser = USERS[roleToUserKey(role)]
  const userId = Number(session.user.userId || demoUser.userId)
  const storedProfile = readUserProfiles()[String(userId)] || {}
  const bio = session.user.bio || session.user.description || storedProfile.bio || storedProfile.description || demoUser.bio || demoUser.description || ''
  const availability = session.user.availability || storedProfile.availability || demoUser.availability || ''
  return {
    token: session.token || session.accessToken || `demo-token-${role.toLowerCase()}-${userId}`,
    refreshToken: session.refreshToken || '',
    user: {
      ...demoUser,
      ...storedProfile,
      ...session.user,
      userId,
      role,
      label: role === 'PROVIDER' ? '服务方' : '需求方',
      nickname: session.user.nickname || storedProfile.nickname || demoUser.nickname,
      avatarData: session.user.avatarData || storedProfile.avatarData || demoUser.avatarData,
      bio,
      description: bio,
      availability
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
    const nextUser = {
      ...session.user,
      ...partial
    }
    saveStoredProfile(nextUser)
    const nextSession = normalizeSession({
      ...session,
      user: nextUser
    })
    setSession(nextSession)
    persistSession(nextSession)
    return nextSession
  }

  function logout() {
    setSession(null)
    persistSession(null)
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
    updateProfile
  }), [session, userKey, currentUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('缺少登录状态上下文')
  return context
}
