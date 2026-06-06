import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLastConversationPath } from '../utils/conversationNavigation.js'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import { useAuth } from '../AuthContext.jsx'
import { notificationApi } from '../api/index.js'
import { DND_KEY, PORTRA_STATE_EVENT } from '../pages/portra/PortraPages.jsx'

const navItems = [
  { label: '约拍大厅', path: '/hall', key: 'hall' },
  { label: '动态', path: '/feed', key: 'feed' },
  { label: '消息', path: '/messages', key: 'messages' },
  { label: '个人', path: '/profile', key: 'profile' }
]

function activeKeyFromPath(pathname) {
  if (pathname.startsWith('/feed') || pathname.startsWith('/moments')) return 'feed'
  if (pathname.startsWith('/messages')) return 'messages'
  if (pathname.startsWith('/profile') || pathname.startsWith('/users')) return 'profile'
  return 'hall'
}

export function Navbar({ activePath, currentUser, logout }) {
  const navigate = useNavigate()
  const { setUserKey, switchRole, session } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [bellRinging, setBellRinging] = useState(false)
  const initializedRef = useRef(false)
  const activeKey = activeKeyFromPath(activePath)
  const isProvider = currentUser?.role === 'PROVIDER'

  useEffect(() => {
    let alive = true

    const refresh = async event => {
      if (import.meta.env.DEV && typeof event?.detail?.previewUnreadCount === 'number') {
        setUnreadCount(event.detail.previewUnreadCount)
        if (event.detail.previewRing) {
          setBellRinging(true)
          window.setTimeout(() => setBellRinging(false), 620)
        }
        return
      }

      try {
        const dnd = localStorage.getItem(DND_KEY) === '1'
        const data = await notificationApi.listMine(currentUser)
        const items = Array.isArray(data) ? data : []
        const nextUnreadCount = items.filter(item => {
          const type = String(item.type || '').toUpperCase()
          const relatedType = String(item.relatedType || '').toUpperCase()
          const isMessageNotice = type.includes('MESSAGE') || relatedType.includes('MESSAGE') || relatedType.includes('CONVERSATION')
          return !item.isRead && !(dnd && isMessageNotice)
        }).length
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
  }, [currentUser])

  return (
    <header className="portra-header">
      <div className="portra-header-inner">
        <button className="portra-wordmark" type="button" onClick={() => navigate('/hall')} aria-label="回到约拍大厅">
          <div className="portra-wordmark-text">Por<span className="t">t</span>r<span className="a">a</span></div>
          <div className="portra-wordmark-sub">Meet Right Now</div>
        </button>

        <nav className="portra-nav" aria-label="主导航">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`portra-nav-item ${activeKey === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => navigate(item.path === '/messages' ? getLastConversationPath() || '/messages' : item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="portra-header-actions">
          <div className="portra-role-toggle" aria-label="身份切换">
            <button
              type="button"
              className={`portra-role-btn ${!isProvider ? 'active' : ''}`}
              onClick={() => session?.token?.startsWith('demo') ? setUserKey('customer') : switchRole('CUSTOMER')}
            >
              单主
            </button>
            <button
              type="button"
              className={`portra-role-btn ${isProvider ? 'active' : ''}`}
              onClick={() => session?.token?.startsWith('demo') ? setUserKey('provider') : switchRole('PROVIDER')}
            >
              摄影师
            </button>
          </div>
          <button className="portra-icon-btn" type="button" onClick={() => navigate('/hall')} aria-label="搜索">⌕</button>
          <button className="portra-notification-btn" type="button" onClick={() => navigate('/notifications')} aria-label="通知">
            {unreadCount ? (
              <NotificationsRoundedIcon className={`portra-notification-bell ${bellRinging ? 'portra-notification-bell--ringing' : ''}`} fontSize="small" />
            ) : (
              <NotificationsNoneRoundedIcon className="portra-notification-bell" fontSize="small" />
            )}
            {unreadCount ? <span className="portra-notice-badge" /> : null}
          </button>
          <button className="portra-avatar" type="button" onClick={() => navigate('/profile')} aria-label="个人" />
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
