import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import { notificationApi } from '../api/index.js'
import { useWorkflowNavigate } from '../hooks/useWorkflowNavigate.js'
import { PORTRA_STATE_EVENT } from '../pages/portra/PortraPages.jsx'
import { getMessageNavTarget } from '../utils/conversationNavigation.js'

const defaultNavItems = [
  { label: '约拍大厅', path: '/hall', key: 'hall' },
  { label: '动态', path: '/feed', key: 'feed' },
  { label: '消息', path: '/messages', key: 'messages' },
  { label: '个人', path: '/profile', key: 'profile' }
]

const adminNavItems = [
  { label: '概览', path: '/admin', key: 'dashboard' },
  { label: '认证', path: '/admin?tab=certifications', key: 'certifications' },
  { label: '申诉', path: '/admin?tab=complaints', key: 'complaints' },
  { label: '个人', path: '/profile?from=admin', key: 'profile' }
]

function formatUnreadBadge(count) {
  if (!count) return ''
  return count > 99 ? '99+' : String(count)
}

function activeKeyFromPath(pathname, adminSurface, adminTab) {
  if (adminSurface) {
    if (pathname.startsWith('/profile')) return 'profile'
    if (adminTab === 'certifications' || adminTab === 'complaints') return adminTab
    return 'dashboard'
  }

  if (pathname.startsWith('/feed') || pathname.startsWith('/moments')) return 'feed'
  if (pathname.startsWith('/messages')) return 'messages'
  if (pathname.startsWith('/profile') || pathname.startsWith('/users')) return 'profile'
  return 'hall'
}

export function Navbar({
  activePath,
  currentUser,
  logout,
  adminSurface = false,
  adminTab = 'dashboard'
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const workflowNavigate = useWorkflowNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [bellRinging, setBellRinging] = useState(false)
  const initializedRef = useRef(false)
  const activeKey = activeKeyFromPath(activePath, adminSurface, adminTab)
  const currentPathname = location.pathname || activePath
  const items = adminSurface ? adminNavItems : defaultNavItems

  useEffect(() => {
    if (adminSurface) {
      initializedRef.current = false
      setUnreadCount(0)
      setBellRinging(false)
      return undefined
    }

    let alive = true

    const refresh = async event => {
      const detailUnreadCount = typeof event?.detail?.unreadCount === 'number'
        ? event.detail.unreadCount
        : typeof event?.detail?.previewUnreadCount === 'number'
          ? event.detail.previewUnreadCount
          : null

      const shouldRing = Boolean(event?.detail?.ring || event?.detail?.previewRing)

      if (detailUnreadCount !== null) {
        setUnreadCount(detailUnreadCount)
        initializedRef.current = true
        if (shouldRing) {
          setBellRinging(true)
          window.setTimeout(() => setBellRinging(false), 620)
        }
        return
      }

      try {
        const nextUnreadCount = await notificationApi.unreadCount(currentUser)
        if (!alive) return
        setUnreadCount(previous => {
          if (initializedRef.current && nextUnreadCount > previous) {
            setBellRinging(true)
            window.setTimeout(() => setBellRinging(false), 620)
          }
          return nextUnreadCount
        })
        initializedRef.current = true
      } catch {
        if (alive) setUnreadCount(0)
      }
    }

    refresh()
    window.addEventListener(PORTRA_STATE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      alive = false
      window.removeEventListener(PORTRA_STATE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [adminSurface, currentUser])

  return (
    <header className="portra-header">
      <div className="portra-header-inner">
        <button
          className="portra-wordmark"
          type="button"
          onClick={() => navigate(adminSurface ? '/admin' : '/hall')}
          aria-label={adminSurface ? '回到管理台' : '回到约拍大厅'}
        >
          <div className="portra-wordmark-text">Por<span className="t">t</span>r<span className="a">a</span></div>
          <div className="portra-wordmark-sub">Meet Right Now</div>
        </button>

        <nav className="portra-nav" aria-label={adminSurface ? '管理员导航' : '主导航'}>
          {items.map(item => (
            <button
              key={item.key}
              className={`portra-nav-item ${activeKey === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => {
                const target = !adminSurface && item.path === '/messages'
                  ? getMessageNavTarget(activePath)
                  : item.path
                if (!adminSurface && item.path === '/messages') workflowNavigate(target)
                else navigate(target)
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="portra-header-actions">
          {!adminSurface ? (
            <button
              className="portra-notification-btn"
              type="button"
              onClick={() => navigate('/notifications')}
              aria-label={unreadCount ? `通知，${unreadCount} 条未读` : '通知，无未读'}
            >
              {unreadCount ? (
                <NotificationsRoundedIcon className={`portra-notification-bell ${bellRinging ? 'portra-notification-bell--ringing' : ''}`} fontSize="small" />
              ) : (
                <NotificationsNoneRoundedIcon className="portra-notification-bell" fontSize="small" />
              )}
              {unreadCount ? <span className="portra-notice-badge">{formatUnreadBadge(unreadCount)}</span> : null}
            </button>
          ) : null}
          <button
            className={`portra-avatar ${currentUser?.avatarData ? 'has-image' : ''}`}
            type="button"
            onClick={() => navigate(adminSurface ? '/profile?from=admin' : '/profile')}
            aria-label="个人"
            style={currentUser?.avatarData ? { '--avatar-art': `url(${currentUser.avatarData})` } : undefined}
          />
          {adminSurface && currentPathname.startsWith('/profile') ? (
            <button className="portra-mini-btn" type="button" onClick={() => navigate('/admin')}>
              返回管理
            </button>
          ) : null}
          <button
            className="portra-mini-btn"
            type="button"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            退出
          </button>
        </div>
      </div>
    </header>
  )
}
