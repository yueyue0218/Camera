import { Box, Container } from '@mui/material'
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
    <Box sx={{ minHeight: '100vh', pb: { xs: 4, md: 6 }, bgcolor: 'background.default' }}>
      <Navbar activePath={activePath} currentUser={currentUser} logout={logout} />
      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 } }}>
        <AppRoutes />
      </Container>
    </Box>
  )
}
