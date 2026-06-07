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

  const activePath = location.pathname.startsWith('/orders')
    ? '/profile'
    : location.pathname.startsWith('/users')
      ? '/profile'
      : location.pathname.startsWith('/moments')
        ? '/feed'
        : ['/hall', '/publish', '/feed', '/messages', '/profile'].some(path => location.pathname.startsWith(path))
          ? location.pathname
          : '/hall'

  return (
    <div className="portra-app">
      <Navbar activePath={activePath} currentUser={currentUser} logout={logout} />
      <div className="portra-main-shell">
        <AppRoutes />
      </div>
    </div>
  )
}
