import { useNavigate } from 'react-router-dom'

const navItems = [
  { label: '\u5927\u5385', path: '/hall' },
  { label: '\u52a8\u6001', path: '/feed' },
  { label: '\u6d88\u606f', path: '/messages' },
  { label: '\u4e2a\u4eba', path: '/profile' }
]

const roleMap = {
  CUSTOMER: '\u9700\u6c42\u65b9',
  PROVIDER: '\u670d\u52a1\u65b9',
  ADMIN: '\u7ba1\u7406\u5458'
}

export function Navbar({ activePath, currentUser, logout }) {
  const navigate = useNavigate()
  const tabValue = activePath === '/'
    ? '/hall'
    : navItems.find(item => activePath.startsWith(item.path))?.path || '/hall'

  return (
    <header className="portra-header">
      <div className="portra-header-inner">
        <button className="portra-wordmark" type="button" onClick={() => navigate('/hall')}>
          <span className="portra-wordmark-text"><span className="t">Portr</span><span className="a">a</span></span>
          <span className="portra-wordmark-sub">Meet Right Now</span>
        </button>

        <nav className="portra-nav" aria-label="\u4e3b\u5bfc\u822a">
          {navItems.filter(item => !item.customerOnly || currentUser.role === 'CUSTOMER').map(item => (
            <button
              className={`portra-nav-item ${!item.passive && tabValue === item.path ? 'active' : ''}`}
              key={`${item.label}-${item.path}`}
              type="button"
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="portra-header-actions">
          <button
            className="portra-icon-btn"
            title={roleMap[currentUser.role] || '\u7528\u6237'}
            type="button"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            {'\u9000\u51fa'}
          </button>
          <span className="portra-avatar" aria-hidden="true" />
        </div>
      </div>
    </header>
  )
}
