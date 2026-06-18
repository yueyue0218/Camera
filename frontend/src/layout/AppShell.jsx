import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import { AppRoutes, LoginRoutes } from '../routes.jsx'
import { Navbar } from './Navbar.jsx'

export default function AppShell() {
  const location = useLocation()
  const { currentUser, isAuthenticated, logout } = useAuth()
  const isLoginRoute = location.pathname === '/login' || location.pathname.startsWith('/login/')

  if (isLoginRoute) {
    return <LoginRoutes />
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  const searchParams = new URLSearchParams(location.search)
  const hasAdminAccess = currentUser?.role === 'ADMIN' || currentUser?.adminCapable
  const adminSurface = hasAdminAccess
    && (location.pathname.startsWith('/admin')
      || (location.pathname.startsWith('/profile') && searchParams.get('from') === 'admin'))
  const adminTab = adminSurface && location.pathname.startsWith('/admin')
    ? (searchParams.get('tab') || 'dashboard')
    : null
  const activePath = adminSurface
    ? (location.pathname.startsWith('/profile') ? '/profile' : '/admin')
    : location.pathname.startsWith('/orders')
      ? '/profile'
      : location.pathname.startsWith('/users')
        ? '/profile'
        : location.pathname.startsWith('/moments')
          ? '/feed'
          : ['/hall', '/publish', '/feed', '/messages', '/profile'].some(path => location.pathname.startsWith(path))
            ? location.pathname
            : '/hall'
  const isFixedWorkflow = /^\/messages\/[^/]+/.test(location.pathname)

  return (
    <div className="portra-app">
      <Navbar
        activePath={activePath}
        currentUser={currentUser}
        logout={logout}
        adminSurface={adminSurface}
        adminTab={adminTab}
      />
      <div className={`portra-main-shell${isFixedWorkflow ? ' portra-main-shell--fixed-workflow' : ''}`}>
        <AppRoutes />
      </div>
    </div>
  )
}
