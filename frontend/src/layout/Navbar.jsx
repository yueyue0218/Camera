import { AppBar, Box, Button, Chip, Tab, Tabs, Toolbar, Typography, Stack } from '@mui/material'
import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import DynamicFeedRoundedIcon from '@mui/icons-material/DynamicFeedRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import PublishRoundedIcon from '@mui/icons-material/PublishRounded'
import { useNavigate } from 'react-router-dom'
import cameraLogoUrl from '../assets/camera-logo-mark.png'

const navItems = [
  { label: '大厅', path: '/hall', icon: <HomeRoundedIcon /> },
  { label: '发布', path: '/publish', icon: <PublishRoundedIcon /> },
  { label: '动态', path: '/feed', icon: <DynamicFeedRoundedIcon /> },
  { label: '会话', path: '/messages', icon: <ChatRoundedIcon /> },
  { label: '个人', path: '/profile', icon: <PersonRoundedIcon /> }
]

const roleMap = {
  CUSTOMER: '需求方',
  PROVIDER: '服务方',
  ADMIN: '管理员'
}

function BrandLockup({ hero = false }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={hero ? 1.8 : 1.1}
      className={hero ? 'brand-lockup brand-lockup-hero' : 'brand-lockup'}
    >
      <Box
        component="img"
        className={hero ? 'brand-logo brand-logo-hero' : 'brand-logo'}
        src={cameraLogoUrl}
        alt=""
        aria-hidden="true"
      />
      <Typography
        className={hero ? 'camera-word camera-hero-word' : 'camera-word camera-hero-word camera-nav-word'}
        variant={hero ? 'h3' : 'h5'}
      >
        Camera
      </Typography>
    </Stack>
  )
}

export function Navbar({ activePath, currentUser, logout }) {
  const navigate = useNavigate()
  const tabValue = activePath === '/'
    ? '/hall'
    : navItems.find(item => activePath.startsWith(item.path))?.path || '/hall'

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #e2d4fa' }}>
      <Toolbar sx={{ gap: 2, minHeight: { xs: 64, md: 72 } }}>
        <Box sx={{ minWidth: { xs: 130, md: 190 } }}>
          <BrandLockup />
        </Box>

        <Tabs
          value={tabValue}
          onChange={(_, value) => navigate(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1, minHeight: 48 }}
        >
          {navItems.map(item => (
            <Tab
              key={item.path}
              value={item.path}
              icon={item.icon}
              iconPosition="start"
              label={item.label}
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>

        <Chip
          label={`当前：${roleMap[currentUser.role]}`}
          color={currentUser.role === 'CUSTOMER' ? 'primary' : 'secondary'}
          variant="outlined"
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        />
        <Button
          variant="text"
          color="inherit"
          startIcon={<LogoutRoundedIcon />}
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
          sx={{ display: { xs: 'none', md: 'inline-flex' } }}
        >
          退出
        </Button>
      </Toolbar>
    </AppBar>
  )
}
