import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { USERS } from './auth/demoUsers.js'
import { authSessionFromResponse, clearLegacyStoredAuthentication } from './auth/phoneAuth.js'
import { authApi } from './api.js'

export { USERS }

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
    cityCode: user.cityCode || prev.cityCode || '',
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

function normalizedUserId(session) {
  const value = tokenSubject(session.token || session.accessToken)
    || session.user.userId
    || session.user.id
    || session.user.user?.userId
    || session.user.user?.id
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function normalizeAdminSession(session) {
  const rawToken = session.token || session.accessToken || ''
  if (!rawToken || rawToken.startsWith('demo-token-')) return null
  const value = tokenSubject(rawToken)
    || session.user.userId
    || session.user.id
    || session.user.user?.userId
    || session.user.user?.id
  const userId = Number(value)

  if (!Number.isFinite(userId)) return null

  return {
    token: rawToken,
    user: {
      ...session.user,
      userId,
      id: userId,
      role: 'ADMIN',
      adminCapable: true,
      label: '绠＄悊鍛?',
      nickname: session.user.nickname || '绠＄悊鍛?',
      bio: session.user.bio || '',
      description: session.user.description || session.user.bio || ''
    }
  }
}

function normalizeSession(session) {
  if (!session?.user) return null
  if (session.user.role === 'ADMIN') return normalizeAdminSession(session)
  const rawToken = session.token || session.accessToken || ''
  if (!rawToken || rawToken.startsWith('demo-token-')) return null
  const role = session.user.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER'
  const demoUser = USERS[roleToUserKey(role)]
  const userId = normalizedUserId(session)
  if (!userId) return null
  const storedProfile = readUserProfiles()[String(userId)] || {}
  const availability = session.user.availability || storedProfile.availability || demoUser.availability || ''
  const cityCode = session.user.cityCode || storedProfile.cityCode || ''

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
  return {
    token: rawToken,
    user: {
      ...demoUser,
      ...storedProfile,
      ...session.user,
      userId,
      id: userId,
      role,
      adminCapable: Boolean(session.user.adminCapable),
      cityCode,
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const sessionRef = useRef(null)
  const restoreStartedRef = useRef(false)
  const currentUser = session ? { ...session.user, token: session.token } : null
  const userKey = roleToUserKey(currentUser?.role)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const completeLogin = useCallback((nextSession) => {
    const normalized = normalizeSession(nextSession)
    setSession(normalized)
    sessionRef.current = normalized
    return normalized
  }, [])

  useEffect(() => {
    if (restoreStartedRef.current) return
    restoreStartedRef.current = true
    clearLegacyStoredAuthentication()

    authApi.refresh()
      .then(data => completeLogin(authSessionFromResponse(data)))
      .catch(() => {
        setSession(null)
        sessionRef.current = null
      })
      .finally(() => setIsRestoringSession(false))
  }, [completeLogin])

  function updateProfile(partial) {
    if (!session) return null
    // Route nickname/bio updates to the correct role-specific field,
    // but only when the caller didn't already supply the role-specific field explicitly.
    const roleFields = {}
    if (partial.role === 'PROVIDER') {
      if (partial.nickname != null) roleFields.providerNickname = partial.nickname
      if (partial.bio != null && !('providerBio' in partial)) roleFields.providerBio = partial.bio
    } else if (partial.role === 'CUSTOMER') {
      if (partial.nickname != null) roleFields.customerNickname = partial.nickname
      if (partial.bio != null && !('customerBio' in partial)) roleFields.customerBio = partial.bio
    }
    const nextUser = { ...session.user, ...partial, ...roleFields }
    saveStoredProfile(nextUser)
    const nextSession = normalizeSession({ ...session, user: nextUser })
    setSession(nextSession)
    sessionRef.current = nextSession
    return nextSession
  }

  const logout = useCallback(async () => {
    const activeSession = sessionRef.current
    setSession(null)
    sessionRef.current = null
    if (!activeSession?.token) return
    try {
      await authApi.logout({ token: activeSession.token })
    } catch {
      // If only the access token expired, rotate once through the HttpOnly cookie and
      // immediately revoke that refreshed server session so a reload cannot sign back in.
      try {
        const refreshed = await authApi.refresh()
        if (refreshed?.token) await authApi.logout({ token: refreshed.token })
      } catch {
        // Invalid or revoked server sessions remain unusable; local state is already clear.
      }
    }
  }, [])

  function switchRole(newRole) {
    if (!session) return
    if (session.user.role === 'ADMIN') return
    const nextSession = normalizeSession({
      ...session,
      user: { ...session.user, role: newRole }
    })
    setSession(nextSession)
    sessionRef.current = nextSession
  }

  const value = useMemo(() => ({
    session,
    token: session?.token || '',
    userKey,
    currentUser,
    isAuthenticated: Boolean(session),
    isRestoringSession,
    completeLogin,
    logout,
    switchRole,
    updateProfile
  }), [session, userKey, currentUser, isRestoringSession, completeLogin, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('缺少登录状态上下文')
  return context
}
