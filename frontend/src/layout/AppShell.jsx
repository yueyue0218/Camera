import { Box } from '@mui/material'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import { AppRoutes, LoginRoutes } from '../routes.jsx'
import { Navbar } from './Navbar.jsx'

export default function AppShell() {
  const location = useLocation()
  const { currentUser, isAuthenticated, logout } = useAuth()
  const isLoginRoute = location.pathname === '/login' || location.pathname.startsWith('/login/')

  if (isLoginRoute) return <LoginRoutes />

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return (
    <Box className="portra-app">
      <Navbar activePath={location.pathname} currentUser={currentUser} logout={logout} />
      <main className="portra-main">
        <AppRoutes />
      </main>
    </Box>
  )
}
