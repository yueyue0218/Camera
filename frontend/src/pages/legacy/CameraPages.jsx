import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Rating,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography
} from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import DynamicFeedRoundedIcon from '@mui/icons-material/DynamicFeedRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import PublishRoundedIcon from '@mui/icons-material/PublishRounded'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import WorkRoundedIcon from '@mui/icons-material/WorkRounded'
import { USERS, useAuth } from '../../AuthContext.jsx'
import {
  authApi,
  centToYuan,
  conversationApi,
  creditApi,
  demandApi,
  momentApi,
  orderApi,
  quoteApi,
  reviewApi,
  reviewComplaintApi,
  readFileAsDataUrl,
  userApi,
  yuanToCent
} from '../../api.js'
import cameraLogoUrl from '../../assets/camera-logo-mark.png'
import filmAutumnUrl from '../../assets/film-autumn.png'
import filmLibraryUrl from '../../assets/film-library.png'
import filmPhotoClubUrl from '../../assets/film-photo-club.png'
import filmSpringUrl from '../../assets/film-spring.png'
import filmSummerUrl from '../../assets/film-summer.png'
import filmWinterUrl from '../../assets/film-winter.png'

const theme = createTheme({
  palette: {
    primary: { main: '#7651d4', light: '#a894ef', dark: '#4c2f9e' },
    secondary: { main: '#c05f9c', light: '#e4a6ca', dark: '#8f3d72' },
    background: { default: '#f5efff', paper: '#fffaff' },
    text: { primary: '#241a3d', secondary: '#655873' },
    divider: '#e2d4fa'
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, "Microsoft YaHei", "PingFang SC", Arial, sans-serif',
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f5efff',
          backgroundImage: 'linear-gradient(135deg, #fbf7ff 0%, #f1e8ff 46%, #f7f0ff 100%)'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 250, 255, 0.92)',
          backdropFilter: 'blur(14px)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 250, 255, 0.9)',
          borderColor: '#e2d4fa'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 250, 255, 0.9)',
          borderColor: '#e2d4fa'
        }
      }
    }
  }
})

const navItems = [
  { label: '大厅', path: '/hall', icon: <HomeRoundedIcon /> },
  { label: '发布', path: '/publish', icon: <PublishRoundedIcon /> },
  { label: '动态', path: '/feed', icon: <DynamicFeedRoundedIcon /> },
  { label: '会话', path: '/messages', icon: <ChatRoundedIcon /> },
  { label: '个人', path: '/profile', icon: <PersonRoundedIcon /> }
]

const demandStatusMap = {
  OPEN: '开放中',
  MATCHED: '已匹配',
  CLOSED: '已关闭'
}

const responseStatusMap = {
  PENDING_CUSTOMER_ACCEPT: '待需求方接受',
  ACCEPTED: '已接受',
  REJECTED: '已婉拒'
}

const roleMap = {
  CUSTOMER: '需求方',
  PROVIDER: '服务方',
  ADMIN: '管理员'
}

const quoteStatusMap = {
  PENDING_CONFIRM: '待确认',
  CONFIRMED: '已确认',
  REJECTED: '已拒绝',
  EXPIRED: '已过期',
  CANCELLED: '已取消'
}

const orderStatusMap = {
  PENDING_PAYMENT: '待支付',
  PAID_PENDING_SHOOT: '已支付待拍摄',
  SHOOTING: '拍摄中',
  PENDING_DELIVERY: '待交付',
  DELIVERED_PENDING_CONFIRM: '已交付待确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款'
}

const escrowStatusMap = {
  NOT_PAID: '未支付',
  HELD: '平台托管中',
  RELEASED: '已结算',
  REFUNDED: '已退款'
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

const filmPhotos = [filmSpringUrl, filmLibraryUrl, filmSummerUrl, filmPhotoClubUrl, filmAutumnUrl, filmWinterUrl]

function Filmstrip() {
  const reels = [0, 1]

  return (
    <Box className="login-filmstrip" aria-hidden="true">
      <Box className="filmstrip-track">
        {reels.map(reel => (
          <Box className="filmstrip-reel" key={reel}>
            <Box className="filmstrip-photos">
              {filmPhotos.map(src => (
                <Box className="film-frame" key={`${reel}-${src}`}>
                  <Box
                    component="img"
                    className="film-photo"
                    src={src}
                    alt=""
                    aria-hidden="true"
                  />
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Shell />
    </ThemeProvider>
  )
}

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
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
    : navItems.some(item => location.pathname.startsWith(item.path)) ? location.pathname : '/hall'

  return (
    <Box sx={{ minHeight: '100vh', pb: { xs: 4, md: 6 }, bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #e2d4fa' }}>
        <Toolbar sx={{ gap: 2, minHeight: { xs: 64, md: 72 } }}>
          <Box sx={{ minWidth: { xs: 130, md: 190 } }}>
            <BrandLockup />
          </Box>

          <Tabs
            value={activePath === '/' ? '/hall' : navItems.find(item => activePath.startsWith(item.path))?.path || '/hall'}
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

      <Container maxWidth="lg" sx={{ pt: { xs: 2, md: 3 } }}>
        <Routes>
          <Route path="/" element={<Navigate to="/hall" replace />} />
          <Route path="/hall" element={<HallPage />} />
          <Route path="/publish" element={<PublishPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/moments/:momentId" element={<MomentDetailPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<ConversationDetailPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/users/:userId" element={<PublicProfilePage />} />
          <Route path="*" element={<Navigate to="/hall" replace />} />
        </Routes>
      </Container>
    </Box>
  )
}

function LoginRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginChoicePage />} />
      <Route path="/login/sign-in" element={<LoginInfoPage />} />
      <Route path="/login/register" element={<RegisterPage />} />
      <Route path="/login/customer" element={<Navigate to="/login/sign-in" replace />} />
      <Route path="/login/provider" element={<Navigate to="/login/sign-in" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function LoginChoicePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/hall', { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <Box
      className="login-choice-page"
      sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, bgcolor: 'background.default' }}
    >
      <Box className="login-brand-zone">
        <BrandLockup hero />
      </Box>
      <Stack className="login-actions-zone" spacing={1.5}>
        <Button
          className="login-entry-button"
          size="large"
          variant="contained"
          onClick={() => navigate('/login/sign-in')}
          sx={{ minHeight: 60, fontSize: { xs: '1.16rem', sm: '1.28rem' }, fontWeight: 900 }}
        >
          登录
        </Button>
        <Button
          className="login-entry-button login-entry-button-late"
          size="large"
          variant="outlined"
          color="secondary"
          onClick={() => navigate('/login/register')}
          sx={{ minHeight: 60, fontSize: { xs: '1.16rem', sm: '1.28rem' }, fontWeight: 900 }}
        >
          注册
        </Button>
      </Stack>
      <Typography className="filmstrip-title">Looking for beauty.</Typography>
      <Filmstrip />
    </Box>
  )
}

function LoginInfoPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, completeLogin, loginWithDemo } = useAuth()
  const [role, setRole] = useState('CUSTOMER')
  const userKey = role === 'PROVIDER' ? 'provider' : 'customer'
  const demoUser = USERS[userKey]
  const [form, setForm] = useState({
    mobile: demoUser.mobile,
    verifyCode: '123456'
  })
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/hall', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    setForm({
      mobile: demoUser.mobile,
      verifyCode: '123456'
    })
  }, [demoUser.userId, demoUser.mobile])

  useEffect(() => {
    if (location.state?.notice) {
      setNotice({ type: 'success', text: location.state.notice })
    }
  }, [location.state])

  async function submit(event) {
    event.preventDefault()
    setNotice(null)
    setLoading(true)
    const loginBody = {
      loginType: 'MOBILE',
      mobile: form.mobile.trim(),
      verifyCode: form.verifyCode.trim(),
      role
    }

    try {
      const data = await authApi.login(loginBody)
      const responseUser = data?.user || {
        userId: data?.userId,
        nickname: data?.nickname,
        mobile: loginBody.mobile
      }
      completeLogin({
        token: data?.token || data?.accessToken,
        refreshToken: data?.refreshToken,
        user: {
          ...demoUser,
          ...responseUser,
          role: responseUser.role || role,
          mobile: loginBody.mobile || responseUser.mobile || demoUser.mobile
        }
      })
      navigate('/hall', { replace: true })
    } catch (error) {
      if (error.canUseDemoLogin) {
        loginWithDemo({ role, mobile: demoUser.mobile })
        navigate('/hall', { replace: true })
        return
      }
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 4, bgcolor: 'background.default' }}>
      <Container maxWidth="sm">
        <Paper component="form" variant="outlined" onSubmit={submit} sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box component="img" className="brand-logo brand-logo-form" src={cameraLogoUrl} alt="" aria-hidden="true" />
              <Box>
                <Typography variant="h5">登录</Typography>
                <Typography color="text.secondary">当前后端登录接口使用手机号和验证码。</Typography>
              </Box>
            </Stack>

            {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

            <Box>
              <Typography fontWeight={800} sx={{ mb: 1 }}>本次登录身份</Typography>
              <ToggleButtonGroup exclusive value={role} onChange={(_, value) => value && setRole(value)}>
                <ToggleButton value="CUSTOMER">需求方</ToggleButton>
                <ToggleButton value="PROVIDER">服务方</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <TextField
              label="手机号"
              value={form.mobile}
              onChange={event => setForm({ ...form, mobile: event.target.value })}
              inputProps={{ inputMode: 'tel', maxLength: 11 }}
              required
            />
            <TextField
              label="验证码"
              value={form.verifyCode}
              onChange={event => setForm({ ...form, verifyCode: event.target.value })}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              required
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={<LoginRoundedIcon />}
              disabled={loading || !form.mobile.trim() || !form.verifyCode.trim()}
            >
              {loading ? '登录中' : '登录'}
            </Button>
            <Button variant="text" color="inherit" onClick={() => navigate('/login')}>
              返回选择身份
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nickname: '南大同学',
    email: '221000001@smail.nju.edu.cn',
    verifyCode: '123456',
    password: 'camera123'
  })
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)

  async function sendEmailCode() {
    setNotice(null)
    setLoading(true)
    try {
      await authApi.sendCode(form.email.trim())
      setNotice({ type: 'success', text: '南大邮箱验证码已发送' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setNotice(null)
    setLoading(true)
    try {
      await authApi.register({
        nickname: form.nickname.trim(),
        email: form.email.trim(),
        code: form.verifyCode.trim(),
        password: form.password
      })
      navigate('/login/sign-in', { replace: true, state: { notice: '注册成功，请登录' } })
    } catch (error) {
      if (error.canUseDemoRegister) {
        navigate('/login/sign-in', { replace: true, state: { notice: '演示注册成功，请登录' } })
        return
      }
      setNotice({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 4, bgcolor: 'background.default' }}>
      <Container maxWidth="sm">
        <Paper component="form" variant="outlined" onSubmit={submit} sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={2.2}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box component="img" className="brand-logo brand-logo-form" src={cameraLogoUrl} alt="" aria-hidden="true" />
              <Box>
                <Typography variant="h5">注册</Typography>
                <Typography color="text.secondary">使用南大邮箱验证码完成 A3 注册。</Typography>
              </Box>
            </Stack>
            {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
            <TextField
              label="昵称"
              value={form.nickname}
              onChange={event => setForm({ ...form, nickname: event.target.value })}
              required
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                label="南大邮箱"
                value={form.email}
                onChange={event => setForm({ ...form, email: event.target.value })}
                placeholder="221000001@smail.nju.edu.cn"
                required
              />
              <Button
                variant="outlined"
                startIcon={<AlternateEmailRoundedIcon />}
                onClick={sendEmailCode}
                disabled={loading || !form.email.trim()}
                sx={{ minWidth: 132 }}
              >
                发送验证码
              </Button>
            </Stack>
            <TextField
              label="验证码"
              value={form.verifyCode}
              onChange={event => setForm({ ...form, verifyCode: event.target.value })}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              required
            />
            <TextField
              label="密码"
              type="password"
              value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })}
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? '注册中' : '注册并返回登录'}
            </Button>
            <Button variant="text" color="inherit" onClick={() => navigate('/login/sign-in')}>
              已有账号，去登录
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}

function HallPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [filters, setFilters] = useState({
    cityCode: 'NJU',
    expectedDate: '',
    styleTag: '',
    minBudgetYuan: '',
    maxBudgetYuan: '',
    status: 'OPEN'
  })
  const [demands, setDemands] = useState([])
  const [selectedDemand, setSelectedDemand] = useState(null)
  const [responses, setResponses] = useState([])
  const [inviteForm, setInviteForm] = useState({ expectedPriceYuan: 399, message: '你好，我很适合这个需求，想邀请你进一步沟通拍摄方案。' })
  const [snapshot, setSnapshot] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSelectedDemand(null)
    setResponses([])
    setSnapshot(null)
    loadDemands()
  }, [currentUser.userId])

  async function run(action, successText) {
    setLoading(true)
    setNotice(null)
    try {
      const result = await action()
      if (successText) setNotice({ type: 'success', text: successText })
      return result
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      return null
    } finally {
      setLoading(false)
    }
  }

  async function loadDemands() {
    await run(async () => {
      const page = await demandApi.list({
        page: 1,
        size: 20,
        cityCode: filters.cityCode,
        expectedDate: filters.expectedDate,
        styleTag: filters.styleTag,
        minBudgetCent: yuanToCent(filters.minBudgetYuan),
        maxBudgetCent: yuanToCent(filters.maxBudgetYuan),
        status: filters.status
      }, currentUser)
      setDemands(page.records || [])
    })
  }

  async function openDemand(demand) {
    setSnapshot(null)
    await run(async () => {
      const detail = await demandApi.detail(demand.demandId, currentUser)
      setSelectedDemand(detail)
      if (currentUser.role === 'CUSTOMER' && detail.customerId === currentUser.userId) {
        setResponses(await demandApi.responses(detail.demandId, currentUser))
      } else {
        setResponses([])
      }
    })
  }

  async function sendInvitation() {
    if (!selectedDemand) return
    await run(async () => demandApi.invite(selectedDemand.demandId, {
      expectedPriceCent: yuanToCent(inviteForm.expectedPriceYuan),
      message: inviteForm.message
    }, currentUser), '邀请已发送')
  }

  async function deleteDemand(demand) {
    if (!demand) return
    const deleted = await run(async () => {
      await demandApi.delete(demand.demandId, currentUser)
      return true
    }, '需求已删除')
    if (deleted) {
      setSelectedDemand(null)
      setResponses([])
      setSnapshot(null)
      await loadDemands()
    }
  }

  async function acceptResponse(response) {
    const result = await run(async () => {
      const accepted = await demandApi.accept(selectedDemand.demandId, response.responseId, currentUser)
      const conversation = await conversationApi.createFromResponse(accepted, currentUser)
      return { ...accepted, conversation }
    }, '已接受响应并创建会话')
    if (result) {
      setSnapshot(result)
      saveConversationRecord(result.conversation, {
        demandId: selectedDemand.demandId,
        scene: selectedDemand.scene,
        location: selectedDemand.location,
        customerId: selectedDemand.customerId,
        providerUserId: result.providerId
      })
      await loadDemands()
      await openDemand(selectedDemand)
      setSnapshot(result)
    }
  }

  const canInvite = selectedDemand
    && currentUser.role === 'PROVIDER'
    && selectedDemand.status === 'OPEN'
    && selectedDemand.customerId !== currentUser.userId

  const canSeeResponses = selectedDemand
    && currentUser.role === 'CUSTOMER'
    && selectedDemand.customerId === currentUser.userId

  const isSelectedDemandOwner = selectedDemand
    && Number(selectedDemand.customerId) === Number(currentUser.userId)
  const selectedDemandInProgress = selectedDemand?.status === 'MATCHED'

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="需求大厅" subtitle="浏览约拍需求，服务方可响应，需求方可接受响应。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
          <Stack spacing={0.5} sx={{ minWidth: { md: 108 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-city" variant="caption" color="text.secondary" fontWeight={800}>
              城市
            </Typography>
            <TextField
              id="hall-filter-city"
              value={filters.cityCode}
              onChange={event => setFilters({ ...filters, cityCode: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '城市' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 140 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-tag" variant="caption" color="text.secondary" fontWeight={800}>
              标签
            </Typography>
            <TextField
              id="hall-filter-tag"
              placeholder="自然抓拍"
              value={filters.styleTag}
              onChange={event => setFilters({ ...filters, styleTag: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '标签' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 156 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-date" variant="caption" color="text.secondary" fontWeight={800}>
              日期
            </Typography>
            <TextField
              id="hall-filter-date"
              type="date"
              value={filters.expectedDate}
              onChange={event => setFilters({ ...filters, expectedDate: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '日期' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 108 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-min-price" variant="caption" color="text.secondary" fontWeight={800}>
              最低价
            </Typography>
            <TextField
              id="hall-filter-min-price"
              type="number"
              value={filters.minBudgetYuan}
              onChange={event => setFilters({ ...filters, minBudgetYuan: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '最低价' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 108 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-max-price" variant="caption" color="text.secondary" fontWeight={800}>
              最高价
            </Typography>
            <TextField
              id="hall-filter-max-price"
              type="number"
              value={filters.maxBudgetYuan}
              onChange={event => setFilters({ ...filters, maxBudgetYuan: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '最高价' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 140 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-status" variant="caption" color="text.secondary" fontWeight={800}>
              状态
            </Typography>
            <FormControl size="small">
              <Select
                id="hall-filter-status"
                value={filters.status}
                onChange={event => setFilters({ ...filters, status: event.target.value })}
                inputProps={{ 'aria-label': '状态' }}
              >
                <MenuItem value="OPEN">开放中</MenuItem>
                <MenuItem value="MATCHED">已匹配</MenuItem>
                <MenuItem value="">全部</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            <Typography variant="caption" color="transparent" fontWeight={800} aria-hidden="true">
              操作
            </Typography>
            <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={loadDemands} disabled={loading} sx={{ minHeight: 40 }}>
              刷新
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '360px 1fr' }, gap: 2 }}>
        <Stack spacing={1.5}>
          {demands.map(demand => (
            <Card
              key={demand.demandId}
              variant="outlined"
              onClick={() => openDemand(demand)}
              sx={{ cursor: 'pointer', borderColor: selectedDemand?.demandId === demand.demandId ? 'primary.main' : 'divider' }}
            >
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{demand.scene}</Typography>
                    <Chip size="small" label={demandStatusMap[demand.status] || demand.status} />
                  </Stack>
                  <Typography color="text.secondary">{demand.cityCode} · {demand.location}</Typography>
                  <Typography>{centToYuan(demand.budgetMinCent)} 至 {centToYuan(demand.budgetMaxCent)}</Typography>
                  <Typography color="text.secondary">{demand.responseCount} 个响应</Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
          {!demands.length && <EmptyCard text="暂无需求" />}
        </Stack>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minHeight: 420 }}>
          {!selectedDemand ? (
            <EmptyCard text="选择一条需求查看详情" />
          ) : (
            <Stack spacing={2.2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Box>
                  <Typography variant="h5">{selectedDemand.scene}</Typography>
                  <Typography color="text.secondary">{selectedDemand.cityCode} · {selectedDemand.location}</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip color="primary" label={demandStatusMap[selectedDemand.status] || selectedDemand.status} />
                  {isSelectedDemandOwner && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteRoundedIcon />}
                      onClick={() => deleteDemand(selectedDemand)}
                      disabled={loading || selectedDemandInProgress}
                    >
                      删除需求
                    </Button>
                  )}
                </Stack>
              </Stack>
              {isSelectedDemandOwner && selectedDemandInProgress && (
                <Alert severity="info">需求交易正在进行，暂时不能删除。</Alert>
              )}
              <Divider />
              <InfoRows rows={[
                ['需求方编号', selectedDemand.customerId],
                ['时间', `${selectedDemand.expectedDate || '未定日期'} ${selectedDemand.timeSlot || ''}`],
                ['预算', `${centToYuan(selectedDemand.budgetMinCent)} 至 ${centToYuan(selectedDemand.budgetMaxCent)}`],
                ['风格', selectedDemand.styleTags?.length ? selectedDemand.styleTags.join(' / ') : '未填写'],
                ['描述', selectedDemand.description || '未填写']
              ]} />

              {canInvite && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(250, 244, 255, 0.86)' }}>
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                      <Typography variant="h6">发起邀请</Typography>
                      <Button
                        variant="contained"
                        startIcon={<SendRoundedIcon />}
                        onClick={sendInvitation}
                        disabled={loading}
                      >
                        发起邀请
                      </Button>
                    </Stack>
                    <TextField
                      label="邀请报价"
                      type="number"
                      value={inviteForm.expectedPriceYuan}
                      onChange={event => setInviteForm({ ...inviteForm, expectedPriceYuan: event.target.value })}
                    />
                    <TextField
                      label="邀请说明"
                      multiline
                      minRows={2}
                      value={inviteForm.message}
                      onChange={event => setInviteForm({ ...inviteForm, message: event.target.value })}
                    />
                    <Alert severity="info">服务方需要先发起邀请；需求方接受后才会创建会话。</Alert>
                  </Stack>
                </Paper>
              )}

              {canSeeResponses && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(250, 244, 255, 0.86)' }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6">响应列表</Typography>
                      <Button size="small" onClick={() => openDemand(selectedDemand)}>刷新响应</Button>
                    </Stack>
                    {responses.map(response => (
                      <Paper key={response.responseId} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                          <Box>
                            <Typography fontWeight={700}>服务方 {response.providerId}</Typography>
                            <Typography>{response.message}</Typography>
                            <Typography color="text.secondary">
                              {centToYuan(response.expectedPriceCent)} · {responseStatusMap[response.status] || response.status}
                            </Typography>
                          </Box>
                          {response.status === 'PENDING_CUSTOMER_ACCEPT' && selectedDemand.status === 'OPEN' && (
                            <Button variant="contained" onClick={() => acceptResponse(response)}>接受</Button>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                    {!responses.length && <Typography color="text.secondary">暂无响应</Typography>}
                  </Stack>
                </Paper>
              )}

              {snapshot && (
                <Alert
                  severity="success"
                  action={
                    snapshot.conversation?.conversationId ? (
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => navigate(`/messages?conversationId=${snapshot.conversation.conversationId}`)}
                      >
                        进入会话
                      </Button>
                    ) : null
                  }
                >
                  已创建 C 模块会话：响应 {snapshot.responseId}，会话 {snapshot.conversation?.conversationId || '待生成'}。
                </Alert>
              )}
            </Stack>
          )}
        </Paper>
      </Box>
    </Stack>
  )
}

function PublishPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({
    scene: '毕业照',
    cityCode: 'NJU',
    location: '南京大学鼓楼校区',
    expectedDate: '',
    timeSlot: '14:00-16:00',
    budgetMinYuan: 199,
    budgetMaxYuan: 399,
    styleTagsText: '自然抓拍,校园,生活感',
    description: '想拍一组自然、不模板化的校园毕业照，偏生活感。'
  })

  async function submit(event) {
    event.preventDefault()
    setNotice(null)
    try {
      await demandApi.create({
        scene: form.scene,
        cityCode: form.cityCode,
        location: form.location,
        expectedDate: form.expectedDate || null,
        timeSlot: form.timeSlot,
        budgetMinCent: yuanToCent(form.budgetMinYuan),
        budgetMaxCent: yuanToCent(form.budgetMaxYuan),
        styleTags: form.styleTagsText.split(',').map(tag => tag.trim()).filter(Boolean),
        description: form.description
      }, currentUser)
      setNotice({ type: 'success', text: '需求已发布' })
      navigate('/hall')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  if (currentUser.role !== 'CUSTOMER') {
    return (
      <Stack spacing={2}>
        <SectionHeader title="发布" subtitle="发布约拍需求需要使用需求方身份。" />
        <Alert severity="info">请到个人页切换为需求方。</Alert>
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="发布" subtitle="填写约拍需求，服务方会在大厅中响应。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Paper component="form" variant="outlined" onSubmit={submit} sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <TextField label="场景" value={form.scene} onChange={event => setForm({ ...form, scene: event.target.value })} required />
          <TextField label="城市" value={form.cityCode} onChange={event => setForm({ ...form, cityCode: event.target.value })} required />
          <TextField label="地点" value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} required />
          <TextField label="日期" value={form.expectedDate} onChange={event => setForm({ ...form, expectedDate: event.target.value })} placeholder="2026-06-01" inputProps={{ inputMode: 'numeric' }} />
          <TextField label="时间段" value={form.timeSlot} onChange={event => setForm({ ...form, timeSlot: event.target.value })} />
          <TextField label="风格标签" value={form.styleTagsText} onChange={event => setForm({ ...form, styleTagsText: event.target.value })} />
          <TextField label="最低预算" type="number" value={form.budgetMinYuan} onChange={event => setForm({ ...form, budgetMinYuan: event.target.value })} />
          <TextField label="最高预算" type="number" value={form.budgetMaxYuan} onChange={event => setForm({ ...form, budgetMaxYuan: event.target.value })} />
          <TextField
            label="需求描述"
            multiline
            minRows={4}
            value={form.description}
            onChange={event => setForm({ ...form, description: event.target.value })}
            sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}
          />
        </Box>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button type="submit" variant="contained" size="large">发布需求</Button>
        </Stack>
      </Paper>
    </Stack>
  )
}

function FeedPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [moments, setMoments] = useState([])
  const [query, setQuery] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [draft, setDraft] = useState({ title: '', content: '' })
  const [mentionsText, setMentionsText] = useState('')
  const [imageData, setImageData] = useState('')
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    loadMoments()
  }, [currentUser.userId])

  async function loadMoments() {
    try {
      setMoments(await momentApi.list({ keyword: query }, currentUser))
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function chooseImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setImageData(await readFileAsDataUrl(file))
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function publishMoment() {
    setNotice(null)
    try {
      await momentApi.create({
        title: draft.title,
        content: draft.content,
        imageData,
        mentions: parseMentions(mentionsText)
      }, currentUser)
      setDraft({ title: '', content: '' })
      setMentionsText('')
      setImageData('')
      setShowComposer(false)
      setNotice({ type: 'success', text: '动态已发布' })
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function likeMoment(momentId) {
    try {
      await momentApi.like(momentId, currentUser)
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function favoriteMoment(momentId) {
    try {
      await momentApi.favorite(momentId, currentUser)
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function deleteMoment(momentId) {
    try {
      await momentApi.delete(momentId, currentUser)
      setNotice({ type: 'success', text: '动态已删除' })
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  function followAuthor(authorId) {
    toggleFollow(authorId)
    setNotice({ type: 'success', text: '关注列表已更新' })
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="动态" subtitle="搜索动态标题和文案，发布带标题、文案和照片的动态。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField
            fullWidth
            label="搜索动态"
            placeholder="输入标题或文案"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') loadMoments()
            }}
          />
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={loadMoments}>
            搜索
          </Button>
          <Button variant="contained" startIcon={<PublishRoundedIcon />} onClick={() => setShowComposer(value => !value)}>
            发布动态
          </Button>
        </Stack>
      </Paper>

      {showComposer && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <TextField
              label="动态题目"
              value={draft.title}
              onChange={event => setDraft({ ...draft, title: event.target.value })}
              required
            />
            <TextField
              label="动态文案"
              multiline
              minRows={3}
              value={draft.content}
              onChange={event => setDraft({ ...draft, content: event.target.value })}
            />
            <TextField
              label="@"
              placeholder="输入昵称或编号，用逗号分隔"
              value={mentionsText}
              onChange={event => setMentionsText(event.target.value)}
              InputProps={{ startAdornment: <AlternateEmailRoundedIcon color="action" sx={{ mr: 1 }} /> }}
            />
            {imageData && <img className="feed-image" src={imageData} alt="待发布照片" />}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
              <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                选择照片
                <input hidden type="file" accept="image/*" onChange={chooseImage} />
              </Button>
              <Stack direction="row" spacing={1}>
                <Button variant="text" color="inherit" onClick={() => setShowComposer(false)}>取消</Button>
                <Button variant="contained" onClick={publishMoment} disabled={!draft.title.trim()}>发布</Button>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {moments.map(moment => (
          <Card key={moment.momentId} variant="outlined">
            {moment.imageData && (
              <Box
                component="img"
                className="feed-image"
                src={moment.imageData}
                alt="动态照片"
                onClick={() => navigate(`/moments/${moment.momentId}`)}
                sx={{ cursor: 'pointer' }}
              />
            )}
            <CardContent>
              <Stack spacing={1.2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Avatar
                    onClick={() => openUserProfile(moment.authorId)}
                    sx={{ cursor: 'pointer' }}
                  >
                    {roleMap[moment.authorRole]?.slice(0, 1) || '用'}
                  </Avatar>
                  <Box sx={{ cursor: 'pointer' }} onClick={() => openUserProfile(moment.authorId)}>
                    <Typography fontWeight={800}>{roleMap[moment.authorRole] || '用户'} {moment.authorId}</Typography>
                    <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
                  </Box>
                </Stack>
                <Typography
                  variant="h6"
                  onClick={() => navigate(`/moments/${moment.momentId}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  {moment.title || '未命名动态'}
                </Typography>
                <Typography>{moment.content || '分享了一张照片'}</Typography>
                {!!moment.mentions?.length && (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {moment.mentions.map(mention => <MentionChip key={mention} mention={mention} />)}
                  </Stack>
                )}
              </Stack>
            </CardContent>
            <CardActions>
              <IconButton color={moment.likedByCurrentUser ? 'secondary' : 'default'} onClick={() => likeMoment(moment.momentId)}>
                {moment.likedByCurrentUser ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}
              </IconButton>
              <Typography color="text.secondary">{moment.likeCount} 个赞</Typography>
              <Button size="small" onClick={() => favoriteMoment(moment.momentId)}>
                {moment.favoritedByCurrentUser ? '已收藏' : '收藏'} {moment.favoriteCount || 0}
              </Button>
              <Button size="small" onClick={() => followAuthor(moment.authorId)}>
                {isFollowing(moment.authorId) ? '已关注' : '关注作者'}
              </Button>
              <Button size="small" onClick={() => navigate(`/moments/${moment.momentId}`)}>详情</Button>
              {Number(moment.authorId) === currentUser.userId && (
                <Button size="small" color="error" startIcon={<DeleteRoundedIcon />} onClick={() => deleteMoment(moment.momentId)}>
                  删除
                </Button>
              )}
            </CardActions>
          </Card>
        ))}
      </Box>
      {!moments.length && <EmptyCard text="暂无动态" />}
    </Stack>
  )
}

function MomentDetailPage() {
  const { momentId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [moments, setMoments] = useState([])
  const [receivedReviews, setReceivedReviews] = useState([])
  const [showReviews, setShowReviews] = useState(false)
  const [creditSummary, setCreditSummary] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    loadMoments()
  }, [momentId, currentUser.userId])

  async function loadMoments() {
    try {
      const [detail, list] = await Promise.all([
        momentApi.detail(momentId, currentUser).catch(() => null),
        momentApi.list({}, currentUser)
      ])
      const selectedId = Number(momentId)
      const selected = detail || list.find(moment => Number(moment.momentId) === selectedId)
      setMoments(selected ? [selected, ...list.filter(moment => Number(moment.momentId) !== Number(selected.momentId))] : list)
      setNotice(null)
      if (!selected) setNotice({ type: 'warning', text: '该动态不存在或已被删除，先展示最新动态。' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function likeMoment(id) {
    try {
      await momentApi.like(id, currentUser)
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function favoriteMoment(id) {
    try {
      await momentApi.favorite(id, currentUser)
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function deleteMoment(id) {
    try {
      await momentApi.delete(id, currentUser)
      setNotice({ type: 'success', text: '动态已删除' })
      navigate('/feed')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="动态详情" subtitle="查看完整动态，继续下滑浏览更多人的动态详情。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Button variant="text" color="inherit" onClick={() => navigate('/feed')} sx={{ alignSelf: 'flex-start' }}>返回动态</Button>
      <Stack spacing={2.5}>
        {moments.map(moment => (
          <MomentDetailCard
            key={moment.momentId}
            moment={moment}
            currentUser={currentUser}
            onProfile={() => openUserProfile(moment.authorId)}
            onLike={() => likeMoment(moment.momentId)}
            onFavorite={() => favoriteMoment(moment.momentId)}
            onDelete={() => deleteMoment(moment.momentId)}
          />
        ))}
      </Stack>
      {!moments.length && <EmptyCard text="暂无动态" />}
    </Stack>
  )
}

function MomentDetailCard({ moment, currentUser, onProfile, onLike, onFavorite, onDelete }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={1.6}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Avatar onClick={onProfile} sx={{ cursor: 'pointer', bgcolor: moment.authorRole === 'PROVIDER' ? 'secondary.main' : 'primary.main' }}>
            {roleMap[moment.authorRole]?.slice(0, 1) || '用'}
          </Avatar>
          <Box onClick={onProfile} sx={{ cursor: 'pointer', minWidth: 0 }}>
            <Typography fontWeight={900}>{roleMap[moment.authorRole] || '用户'} {moment.authorId}</Typography>
            <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
          </Box>
        </Stack>
        <Typography variant="h5">{moment.title || '未命名动态'}</Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{moment.content || '分享了一张照片'}</Typography>
        {moment.imageData && <img className="feed-image" src={moment.imageData} alt={moment.title || '动态照片'} />}
        {!!moment.mentions?.length && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {moment.mentions.map(mention => <MentionChip key={mention} mention={mention} />)}
          </Stack>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button variant="outlined" startIcon={moment.likedByCurrentUser ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />} onClick={onLike}>
            {moment.likeCount || 0} 个赞
          </Button>
          <Button variant="outlined" onClick={onFavorite}>
            {moment.favoritedByCurrentUser ? '已收藏' : '收藏'} {moment.favoriteCount || 0}
          </Button>
          {Number(moment.authorId) === currentUser.userId && (
            <Button variant="outlined" color="error" startIcon={<DeleteRoundedIcon />} onClick={onDelete}>
              删除
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  )
}

function MessagesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [conversations, setConversations] = useState([])
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const value = new URLSearchParams(location.search).get('conversationId')
    if (value) {
      navigate(`/messages/${value}`, { replace: true })
      return
    }
    let mounted = true
    async function loadConversations() {
      setNotice(null)
      try {
        const remoteConversations = await conversationApi.list(currentUser)
        if (mounted) setConversations(mergeConversationRecords(remoteConversations || [], currentUser))
      } catch (error) {
        if (!mounted) return
        setNotice({ type: 'warning', text: `${error.message} 已先显示本地会话记录。` })
        setConversations(getConversationRecordsForUser(currentUser))
      }
    }
    loadConversations()
    return () => {
      mounted = false
    }
  }, [currentUser.userId, currentUser.role, currentUser.token, location.search, navigate])

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="会话" subtitle="消息列表页只展示对话入口，点击后进入具体聊天框。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Paper variant="outlined" sx={{ p: { xs: 1, md: 1.5 } }}>
        <Stack spacing={0.5}>
          {conversations.map(conversation => {
            const oppositeId = getOppositeUserId(conversation, currentUser.userId)
            return (
              <Box
                key={conversation.conversationId}
                onClick={() => navigate(`/messages/${conversation.conversationId}`)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  gap: 1.5,
                  alignItems: 'center',
                  p: 1.4,
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(118, 81, 212, 0.08)' }
                }}
              >
                <Avatar sx={{ bgcolor: conversation.isLocal ? 'secondary.main' : 'primary.main' }}>
                  {conversation.scene?.slice(0, 1) || '会'}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={800} noWrap>
                    {conversation.scene || `会话 ${conversation.conversationId}`}
                  </Typography>
                  <Typography color="text.secondary" noWrap>
                    {conversation.lastMessage || `${roleMap[currentUser.role]}与用户 ${oppositeId} 的对话`}
                  </Typography>
                </Box>
                <Stack spacing={0.5} alignItems="flex-end">
                  <Typography variant="caption" color="text.secondary">{formatShortTime(conversation.updatedAt)}</Typography>
                  <Chip size="small" label={conversation.isLocal ? '待接后端' : 'C接口'} />
                </Stack>
              </Box>
            )
          })}
          {!conversations.length && (
            <EmptyCard text={currentUser.role === 'PROVIDER' ? '暂无会话。到需求大厅选择具体需求后发起邀请，接受后会出现在这里。' : '暂无会话。接受服务方邀请后会出现在这里。'} />
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}

function ConversationDetailPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [quotes, setQuotes] = useState([])
  const [content, setContent] = useState('')
  const [imageSending, setImageSending] = useState(false)
  const [quoteForm, setQuoteForm] = useState(() => createDefaultQuoteForm())
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = findConversationRecord(conversationId)
    const fallback = stored || buildConversationFallback(conversationId)
    setConversation(fallback)
    loadConversationData(fallback)
  }, [conversationId, currentUser.userId])

  async function run(action, successText) {
    setLoading(true)
    setNotice(null)
    try {
      const result = await action()
      if (successText) setNotice({ type: 'success', text: successText })
      return result
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      return null
    } finally {
      setLoading(false)
    }
  }

  async function loadConversationData(record = conversation) {
    if (!record) return
    if (record.isLocal) {
      setMessages(getLocalMessages(record.conversationId))
      setQuotes([])
      return
    }
    await run(async () => {
      const [nextMessages, nextQuotes] = await Promise.all([
        conversationApi.messages(record.backendConversationId || record.conversationId, currentUser),
        conversationApi.quotes(record.backendConversationId || record.conversationId, currentUser)
      ])
      setMessages(nextMessages)
      setQuotes(nextQuotes)
    })
  }

  async function sendMessage() {
    if (!conversation || !content.trim()) return
    const text = content.trim()
    if (conversation.isLocal) {
      const nextMessages = addLocalMessage(conversation.conversationId, {
        senderId: currentUser.userId,
        messageType: 'TEXT',
        content: text
      })
      updateConversationLastMessage(conversation.conversationId, text)
      setMessages(nextMessages)
      setContent('')
      return
    }
    const sent = await run(async () => conversationApi.sendMessage(conversation.backendConversationId || conversation.conversationId, text, currentUser, 'TEXT'))
    if (sent) {
      updateConversationLastMessage(conversation.conversationId, text)
      setContent('')
      await loadConversationData()
    }
  }

  async function chooseMessageImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !conversation) return
    setImageSending(true)
    try {
      const image = await readFileAsDataUrl(file)
      if (conversation.isLocal) {
        const nextMessages = addLocalMessage(conversation.conversationId, {
          senderId: currentUser.userId,
          messageType: 'IMAGE',
          content: image
        })
        updateConversationLastMessage(conversation.conversationId, '[图片]')
        setMessages(nextMessages)
        return
      }
      const sent = await run(async () => conversationApi.sendMessage(
        conversation.backendConversationId || conversation.conversationId,
        image,
        currentUser,
        'IMAGE'
      ), '图片已发送')
      if (sent) {
        updateConversationLastMessage(conversation.conversationId, '[图片]')
        await loadConversationData()
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setImageSending(false)
    }
  }

  function saveSubmittedPhoto(message) {
    if (!message?.content || !conversation) return
    addSavedPhoto({
      photoId: `message-${message.messageId}`,
      source: 'conversation-submission',
      title: `${conversation.scene || '会话'} 提交照片`,
      imageData: message.content,
      authorId: message.senderId,
      createdAt: message.createdAt
    })
    setNotice({ type: 'success', text: '照片已保存到我的照片' })
  }

  async function createQuote(event) {
    event.preventDefault()
    if (!conversation || conversation.isLocal) {
      setNotice({ type: 'warning', text: '当前会话还没有真实 C conversationId，报价接口暂不能调用。' })
      return
    }
    const quote = await run(async () => quoteApi.create({
      conversationId: conversation.backendConversationId || Number(conversation.conversationId),
      amountCent: yuanToCent(quoteForm.amountYuan),
      shootStartTime: quoteForm.shootStartTime,
      shootEndTime: quoteForm.shootEndTime,
      location: quoteForm.location,
      serviceContent: quoteForm.serviceContent,
      originalCount: Number(quoteForm.originalCount || 0),
      refinedCount: Number(quoteForm.refinedCount || 0),
      deliveryDeadline: quoteForm.deliveryDeadline,
      photoUsageScope: quoteForm.photoUsageScope,
      terms: quoteForm.terms,
      contractTerms: quoteForm.contractTerms,
      safetyNoticeVersion: 'P4-DEMO',
      remark: quoteForm.remark
    }, currentUser), '报价已发送')
    if (quote) {
      setShowQuoteForm(false)
      setQuoteForm(createDefaultQuoteForm())
      await loadConversationData()
    }
  }

  async function confirmQuote(quote) {
    const result = await run(async () => quoteApi.confirm(quote.quotationId, '需求方确认报价', currentUser), '报价已确认，订单已生成')
    if (result?.orderId) {
      await loadConversationData()
      navigate(`/orders?orderId=${result.orderId}`)
    }
  }

  async function rejectQuote(quote) {
    const result = await run(async () => quoteApi.reject(quote.quotationId, '本次暂不采用该报价', currentUser), '报价已拒绝')
    if (result) await loadConversationData()
  }

  const canCreateQuote = conversation
    && currentUser.role === 'PROVIDER'
    && currentUser.userId === Number(conversation.participantBId || USERS.provider.userId)
  const canConfirmQuote = conversation
    && currentUser.role === 'CUSTOMER'
    && currentUser.userId === Number(conversation.participantAId || USERS.customer.userId)

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Button color="inherit" onClick={() => navigate('/messages')}>返回</Button>
            <Avatar
              onClick={() => conversation && openUserProfile(getOppositeUserId(conversation, currentUser.userId))}
              sx={{ bgcolor: conversation?.isLocal ? 'secondary.main' : 'primary.main', cursor: conversation ? 'pointer' : 'default' }}
            >
              {conversation?.scene?.slice(0, 1) || '会'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap>{conversation?.scene || `会话 ${conversationId}`}</Typography>
              <Typography color="text.secondary" noWrap>
                {conversation?.location || '具体对话'} · 对方 {conversation ? getOppositeUserId(conversation, currentUser.userId) : '-'}
              </Typography>
            </Box>
          </Stack>
          <Chip size="small" label={conversation?.isLocal ? '本地对话' : 'C会话'} />
        </Stack>
      </Paper>

      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      {conversation?.interfaceNote && <Alert severity="warning">{conversation.interfaceNote}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
        <Stack spacing={1.2} sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
          {messages.map(message => {
            const mine = message.senderId === currentUser.userId
            const isImage = message.messageType === 'IMAGE'
            const canSaveSubmittedPhoto = isImage && Number(message.senderId) === Number(conversation?.participantBId)
            return (
              <Box key={message.messageId} sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.4,
                    maxWidth: { xs: '82%', md: '70%' },
                    bgcolor: mine ? 'primary.main' : '#eef4f7',
                    color: mine ? 'primary.contrastText' : 'text.primary',
                    borderRadius: mine ? '8px 8px 2px 8px' : '8px 8px 8px 2px'
                  }}
                >
                  {isImage ? (
                    <Stack spacing={0.8}>
                      <Box
                        component="img"
                        src={message.content}
                        alt="会话图片"
                        sx={{ display: 'block', maxWidth: '100%', maxHeight: 260, borderRadius: 1, objectFit: 'cover' }}
                      />
                      {canSaveSubmittedPhoto && (
                        <Button size="small" variant="contained" color="inherit" onClick={() => saveSubmittedPhoto(message)}>
                          保存提交照片
                        </Button>
                      )}
                    </Stack>
                  ) : (
                    <Typography>{message.content}</Typography>
                  )}
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>{formatTime(message.createdAt)}</Typography>
                </Paper>
              </Box>
            )
          })}
          {quotes.map(quote => (
            <Paper key={quote.quotationId} variant="outlined" sx={{ p: 1.6, alignSelf: 'center', width: 'min(520px, 100%)', bgcolor: '#fbfdff' }}>
              <Stack spacing={1.2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography fontWeight={900}>{centToYuan(quote.amountCent)}</Typography>
                  <Chip size="small" color={quote.status === 'PENDING_CONFIRM' ? 'warning' : quote.status === 'CONFIRMED' ? 'success' : 'default'} label={quoteStatusMap[quote.status] || quote.status} />
                </Stack>
                <Typography>{quote.serviceContent}</Typography>
                <Typography color="text.secondary" variant="body2">{quote.location} · {formatTime(quote.shootStartTime)}</Typography>
                {quote.status === 'PENDING_CONFIRM' && canConfirmQuote && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" onClick={() => confirmQuote(quote)}>确认报价</Button>
                    <Button size="small" variant="outlined" color="inherit" onClick={() => rejectQuote(quote)}>拒绝</Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
          {!messages.length && !quotes.length && <Typography color="text.secondary">还没有消息</Typography>}
        </Stack>

        {showQuoteForm && canCreateQuote && (
          <Paper component="form" variant="outlined" onSubmit={createQuote} sx={{ p: 1.5, mt: 1.5, bgcolor: '#fbfdff' }}>
            <Stack spacing={1.5}>
              {conversation?.isLocal && <Alert severity="warning">报价需要真实 C conversationId；当前服务方主动对话缺少后端接口。</Alert>}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                <TextField label="报价金额" type="number" size="small" value={quoteForm.amountYuan} onChange={event => setQuoteForm({ ...quoteForm, amountYuan: event.target.value })} required />
                <TextField label="拍摄地点" size="small" value={quoteForm.location} onChange={event => setQuoteForm({ ...quoteForm, location: event.target.value })} required />
                <TextField label="开始时间" type="datetime-local" size="small" value={quoteForm.shootStartTime} onChange={event => setQuoteForm({ ...quoteForm, shootStartTime: event.target.value })} InputLabelProps={{ shrink: true }} required />
                <TextField label="结束时间" type="datetime-local" size="small" value={quoteForm.shootEndTime} onChange={event => setQuoteForm({ ...quoteForm, shootEndTime: event.target.value })} InputLabelProps={{ shrink: true }} required />
                <TextField label="交付截止" type="datetime-local" size="small" value={quoteForm.deliveryDeadline} onChange={event => setQuoteForm({ ...quoteForm, deliveryDeadline: event.target.value })} InputLabelProps={{ shrink: true }} required />
                <TextField label="精修数量" type="number" size="small" value={quoteForm.refinedCount} onChange={event => setQuoteForm({ ...quoteForm, refinedCount: event.target.value })} />
                <TextField label="服务内容" multiline minRows={2} size="small" value={quoteForm.serviceContent} onChange={event => setQuoteForm({ ...quoteForm, serviceContent: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} required />
              </Box>
              <Stack direction="row" spacing={1}>
                <Button type="submit" variant="contained" disabled={loading || conversation?.isLocal}>发送报价</Button>
                <Button variant="text" color="inherit" onClick={() => setShowQuoteForm(false)}>收起</Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" alignItems="center" spacing={1}>
          {canCreateQuote && (
            <Tooltip title="发起报价">
              <span>
                <IconButton color={showQuoteForm ? 'primary' : 'default'} onClick={() => setShowQuoteForm(value => !value)}>
                  <LocalOfferRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title="发送图片">
            <span>
              <IconButton component="label" disabled={loading || imageSending}>
                <ImageRoundedIcon />
                <input hidden type="file" accept="image/*" onChange={chooseMessageImage} />
              </IconButton>
            </span>
          </Tooltip>
          <TextField
            fullWidth
            size="small"
            placeholder="输入消息"
            value={content}
            onChange={event => setContent(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                sendMessage()
              }
            }}
          />
          <Button variant="contained" endIcon={<SendRoundedIcon />} onClick={sendMessage} disabled={!content.trim() || loading}>
            发送
          </Button>
        </Stack>
      </Paper>
    </Stack>
  )
}

function OrdersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const queryOrderId = useMemo(() => {
    const value = new URLSearchParams(location.search).get('orderId')
    return value ? Number(value) : null
  }, [location.search])
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [statusLogs, setStatusLogs] = useState([])
  const [orderReviews, setOrderReviews] = useState([])
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: '沟通顺畅，履约体验很好。' })
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [arbitrations, setArbitrations] = useState([])
  const [arbitrationForm, setArbitrationForm] = useState({
    reason: '评价内容不实',
    description: ''
  })
  const [showArbitrationForm, setShowArbitrationForm] = useState(false)
  const [sentInvitations, setSentInvitations] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadOrders(queryOrderId)
  }, [currentUser.userId, statusFilter, queryOrderId])

  async function run(action, successText) {
    setLoading(true)
    setNotice(null)
    try {
      const result = await action()
      if (successText) setNotice({ type: 'success', text: successText })
      return result
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      return null
    } finally {
      setLoading(false)
    }
  }

  async function loadOrders(focusOrderId = selectedOrder?.orderId) {
    await run(async () => {
      const [nextOrders, nextInvitations] = await Promise.all([
        orderApi.list({
          role: currentUser.role === 'PROVIDER' ? 'provider' : 'customer',
          status: statusFilter
        }, currentUser),
        currentUser.role === 'PROVIDER' ? demandApi.sentInvitations(currentUser) : Promise.resolve([])
      ])
      setOrders(nextOrders)
      saveOrderSnapshots(nextOrders)
      setSentInvitations(nextInvitations)
      if (focusOrderId) {
        await openOrder(focusOrderId, false)
      } else if (nextOrders.length) {
        await openOrder(nextOrders[0].orderId, false)
      } else {
        setSelectedOrder(null)
        setStatusLogs([])
        setOrderReviews([])
        setArbitrations([])
      }
    })
  }

  async function openOrder(orderOrId, updateUrl = true) {
    const orderId = typeof orderOrId === 'object' ? orderOrId.orderId : orderOrId
    const detail = await orderApi.detail(orderId, currentUser)
    const logs = await orderApi.statusLogs(orderId, currentUser)
    let reviews = getLocalReviewsByOrder(orderId)
    try {
      reviews = mergeReviewLists(await reviewApi.listByOrder(orderId, currentUser), reviews)
    } catch {
      reviews = mergeReviewLists(reviews)
    }
    let complaints = getArbitrationsByOrder(orderId)
    const complaintReviewIds = reviews
      .map(review => review.reviewId)
      .filter(reviewId => reviewId && !String(reviewId).startsWith('local'))
    if (complaintReviewIds.length) {
      try {
        const remoteComplaints = await Promise.all(complaintReviewIds.map(reviewId => complaintApiSafeList(reviewId, currentUser)))
        complaints = mergeComplaints(complaints, remoteComplaints.flat())
      } catch {
        complaints = mergeComplaints(complaints)
      }
    }
    setSelectedOrder(detail)
    saveOrderSnapshots([detail])
    setStatusLogs(logs)
    setOrderReviews(reviews)
    setArbitrations(complaints)
    setShowReviewForm(false)
    setShowArbitrationForm(false)
    if (updateUrl) navigate(`/orders?orderId=${orderId}`, { replace: true })
  }

  async function operateOrder(action) {
    if (!selectedOrder) return
    const result = await run(async () => {
      if (action.kind === 'pay') {
        return orderApi.mockPay(selectedOrder.orderId, selectedOrder.amountCent, currentUser)
      }
      return orderApi.transition(selectedOrder.orderId, action.targetStatus, action.reason, currentUser)
    }, action.successText)
    if (result) {
      await loadOrders(selectedOrder.orderId)
    }
  }

  async function submitReview(event) {
    event.preventDefault()
    if (!selectedOrder) return
    const direction = getOrderReviewDirection(selectedOrder, currentUser.userId)
    const targetUserId = getReviewTargetUserId(selectedOrder, currentUser.userId)
    const result = await run(async () => {
      try {
        return await reviewApi.create(selectedOrder.orderId, {
          rating: reviewForm.rating,
          content: reviewForm.content.trim()
        }, currentUser)
      } catch (error) {
        if (!error.isNetworkError && error.status !== 404 && error.code !== 50001) {
          throw error
        }
        return saveLocalReview({
          orderId: selectedOrder.orderId,
          reviewerId: currentUser.userId,
          targetUserId,
          direction,
          rating: reviewForm.rating,
          content: reviewForm.content.trim()
        })
      }
    }, '评价已提交')
    if (result) {
      setOrderReviews(mergeReviewLists([result], orderReviews, getLocalReviewsByOrder(selectedOrder.orderId)))
      setShowReviewForm(false)
      setReviewForm({ rating: 5, content: '沟通顺畅，履约体验很好。' })
    }
  }

  async function submitArbitration(event) {
    event.preventDefault()
    if (!selectedOrder) return
    const reason = `${arbitrationForm.reason}${arbitrationForm.description.trim() ? `：${arbitrationForm.description.trim()}` : ''}`
    const localRecord = {
      orderId: selectedOrder.orderId,
      reviewId: reviewToComplain?.reviewId,
      applicantId: currentUser.userId,
      respondentId: reviewToComplain?.reviewerId || getReviewTargetUserId(selectedOrder, currentUser.userId),
      reason,
      description: arbitrationForm.description.trim(),
      status: 'PENDING'
    }
    const result = await run(async () => {
      if (reviewToComplain?.reviewId && !String(reviewToComplain.reviewId).startsWith('local')) {
        try {
          return await reviewComplaintApi.create(reviewToComplain.reviewId, {
            reason,
            evidenceFileIds: ''
          }, currentUser)
        } catch (error) {
          if (!isApiUnavailable(error)) throw error
        }
      }
      return saveLocalArbitration(localRecord)
    }, '仲裁申请已提交')
    if (result) {
      setArbitrations(mergeComplaints([result], arbitrations, getArbitrationsByOrder(selectedOrder.orderId)))
      setShowArbitrationForm(false)
      setArbitrationForm({ reason: '评价内容不实', description: '' })
    }
  }

  const action = selectedOrder ? getOrderAction(selectedOrder, currentUser) : null
  const quoteSnapshot = parseQuoteSnapshot(selectedOrder?.quoteSnapshotJson)
  const canReviewSelectedOrder = selectedOrder?.status === 'COMPLETED' && isOrderParticipant(selectedOrder, currentUser.userId)
  const currentReviewDirection = selectedOrder ? getOrderReviewDirection(selectedOrder, currentUser.userId) : ''
  const myReview = orderReviews.find(review => Number(review.reviewerId) === currentUser.userId || review.direction === currentReviewDirection)
  const reviewToComplain = orderReviews.find(review => Number(review.targetUserId) === currentUser.userId && review.isVisible !== false)

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="订单" subtitle="查看成单订单、平台托管状态和每次状态流转日志。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '350px 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, alignSelf: 'start' }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">我的订单</Typography>
              <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => loadOrders()} disabled={loading}>
                刷新
              </Button>
            </Stack>
            <FormControl size="small">
              <InputLabel>状态</InputLabel>
              <Select label="状态" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <MenuItem value="">全部</MenuItem>
                {Object.entries(orderStatusMap).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack spacing={1.2}>
              {orders.map(order => (
                <Card
                  key={order.orderId}
                  variant="outlined"
                  onClick={() => openOrder(order)}
                  sx={{ cursor: 'pointer', borderColor: selectedOrder?.orderId === order.orderId ? 'primary.main' : 'divider' }}
                >
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontWeight={800}>{order.orderNo || `订单 ${order.orderId}`}</Typography>
                        <Chip size="small" label={orderStatusMap[order.status] || order.status} />
                      </Stack>
                      <Typography color="text.secondary">{centToYuan(order.amountCent)} · 对方 {currentUser.role === 'CUSTOMER' ? order.providerUserId : order.customerId}</Typography>
                      <Typography color="text.secondary" variant="body2">{formatTime(order.updatedAt)}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {!orders.length && <EmptyCard text="暂无订单" />}
            </Stack>
            {currentUser.role === 'PROVIDER' && (
              <>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">邀请状态</Typography>
                  {sentInvitations.map(invitation => {
                    const status = invitation.status || 'PENDING'
                    return (
                      <Paper key={invitation.invitationId} variant="outlined" sx={{ p: 1.2, bgcolor: '#fbfdff' }}>
                        <Stack spacing={0.7}>
                          <Typography fontWeight={800}>{invitation.demandScene}</Typography>
                          <Typography color="text.secondary" variant="body2">{invitation.message}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip size="small" label={centToYuan(invitation.expectedPriceCent)} />
                            <Chip
                              size="small"
                              color={status === 'ACCEPTED' ? 'success' : status === 'REJECTED' ? 'default' : 'warning'}
                              label={status === 'ACCEPTED' ? '已接受，可在会话中沟通' : status === 'REJECTED' ? '已被婉拒' : '待处理'}
                            />
                          </Stack>
                        </Stack>
                      </Paper>
                    )
                  })}
                  {!sentInvitations.length && <Typography color="text.secondary">还没有发起过邀请</Typography>}
                </Stack>
              </>
            )}
          </Stack>
        </Paper>

        {!selectedOrder ? (
          <EmptyCard text="选择订单查看详情" />
        ) : (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">{selectedOrder.orderNo || `订单 ${selectedOrder.orderId}`}</Typography>
                    <Typography color="text.secondary">报价 {selectedOrder.quoteId} · 会话 {selectedOrder.conversationId}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip color="primary" label={orderStatusMap[selectedOrder.status] || selectedOrder.status} />
                    <Chip color={selectedOrder.escrowStatus === 'HELD' ? 'success' : 'default'} label={escrowStatusMap[selectedOrder.escrowStatus] || selectedOrder.escrowStatus} />
                  </Stack>
                </Stack>
                <Divider />
                <InfoRows rows={[
                  ['金额', centToYuan(selectedOrder.amountCent)],
                  ['需求方', selectedOrder.customerId],
                  ['服务方', selectedOrder.providerUserId],
                  ['拍摄时间', `${formatTime(selectedOrder.shootStartTime)} 至 ${formatTime(selectedOrder.shootEndTime)}`],
                  ['交付截止', formatTime(selectedOrder.deliveryDeadline)],
                  ['结算/退款', `${selectedOrder.settlementStatus || 'NOT_SETTLED'} / ${selectedOrder.refundStatus || 'NONE'}`]
                ]} />
                {quoteSnapshot && (
                  <>
                    <Divider />
                    <InfoRows rows={[
                      ['拍摄地点', quoteSnapshot.location || '未填写'],
                      ['服务内容', quoteSnapshot.serviceContent || '未填写'],
                      ['原片/精修', `${quoteSnapshot.originalCount || 0} / ${quoteSnapshot.refinedCount || 0}`],
                      ['照片用途', quoteSnapshot.photoUsageScope || '未填写']
                    ]} />
                  </>
                )}
                {action ? (
                  <Button
                    variant="contained"
                    startIcon={action.icon}
                    onClick={() => operateOrder(action)}
                    disabled={loading || !action.allowed}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {action.label}
                  </Button>
                ) : (
                  <Chip icon={<TaskAltRoundedIcon />} label="当前没有可执行操作" sx={{ alignSelf: 'flex-start' }} />
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">评价与仲裁</Typography>
                    <Typography color="text.secondary">订单完成后双方都可以评价；被评价方可对不实评价发起投诉仲裁。</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {canReviewSelectedOrder && !myReview && (
                      <Button
                        variant={showReviewForm ? 'contained' : 'outlined'}
                        startIcon={<RateReviewRoundedIcon />}
                        onClick={() => setShowReviewForm(!showReviewForm)}
                      >
                        评价
                      </Button>
                    )}
                    <Button
                      variant={showArbitrationForm ? 'contained' : 'outlined'}
                      color="inherit"
                      startIcon={<GavelRoundedIcon />}
                      onClick={() => setShowArbitrationForm(!showArbitrationForm)}
                      disabled={!reviewToComplain}
                    >
                      申请仲裁
                    </Button>
                  </Stack>
                </Stack>

                {myReview && (
                  <Alert severity="success">你已评价过该订单，可以在历史评价中查看。</Alert>
                )}
                {!reviewToComplain && (
                  <Alert severity="info">收到对方评价后，才可以对该评价发起仲裁。</Alert>
                )}

                {showReviewForm && (
                  <Paper component="form" variant="outlined" onSubmit={submitReview} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Typography fontWeight={800}>评分</Typography>
                        <Rating
                          value={reviewForm.rating}
                          onChange={(_, value) => setReviewForm({ ...reviewForm, rating: value || 5 })}
                        />
                      </Stack>
                      <TextField
                        label="评价内容"
                        value={reviewForm.content}
                        onChange={event => setReviewForm({ ...reviewForm, content: event.target.value })}
                        multiline
                        minRows={2}
                        required
                      />
                      <Button type="submit" variant="contained" startIcon={<RateReviewRoundedIcon />} disabled={loading}>
                        提交评价
                      </Button>
                    </Stack>
                  </Paper>
                )}

                {showArbitrationForm && (
                  <Paper component="form" variant="outlined" onSubmit={submitArbitration} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <TextField
                        select
                        label="仲裁原因"
                        value={arbitrationForm.reason}
                        onChange={event => setArbitrationForm({ ...arbitrationForm, reason: event.target.value })}
                      >
                        <MenuItem value="评价内容不实">评价内容不实</MenuItem>
                        <MenuItem value="评价包含攻击性表述">评价包含攻击性表述</MenuItem>
                        <MenuItem value="评价与订单无关">评价与订单无关</MenuItem>
                        <MenuItem value="其他评价争议">其他评价争议</MenuItem>
                      </TextField>
                      <TextField
                        label="补充说明"
                        value={arbitrationForm.description}
                        onChange={event => setArbitrationForm({ ...arbitrationForm, description: event.target.value })}
                        multiline
                        minRows={2}
                        required
                      />
                      <Button type="submit" variant="contained" color="warning" startIcon={<GavelRoundedIcon />}>
                        提交仲裁记录
                      </Button>
                    </Stack>
                  </Paper>
                )}

                <ReviewList reviews={orderReviews} emptyText="该订单还没有评价" />

                {arbitrations.length > 0 && (
                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">仲裁记录</Typography>
                    {arbitrations.map(record => (
                      <Paper key={record.arbitrationId} variant="outlined" sx={{ p: 1.5, bgcolor: '#fffaf0' }}>
                        <Stack spacing={0.6}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Typography fontWeight={800}>{record.reason}</Typography>
                            <Chip size="small" color="warning" label={record.status === 'PENDING' ? '待处理' : record.status} />
                          </Stack>
                          <Typography>{record.description}</Typography>
                          <Typography color="text.secondary" variant="body2">
                            申请人 {record.applicantId} · 被申请人 {record.respondentId} · {formatTime(record.createdAt)}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Typography variant="h6">状态日志</Typography>
                {statusLogs.map(log => (
                  <Paper key={log.logId || `${log.orderId}-${log.createdAt}`} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography fontWeight={800}>
                          {orderStatusMap[log.fromStatus] || log.fromStatus || '创建'} → {orderStatusMap[log.toStatus] || log.toStatus}
                        </Typography>
                        <Typography color="text.secondary">{log.reason || '状态流转'}</Typography>
                      </Box>
                      <Typography color="text.secondary" variant="body2">{formatTime(log.createdAt)}</Typography>
                    </Stack>
                  </Paper>
                ))}
                {!statusLogs.length && <Typography color="text.secondary">暂无状态日志</Typography>}
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>
    </Stack>
  )
}

function ProfilePage() {
  const navigate = useNavigate()
  const { userKey, currentUser, setUserKey, logout, updateProfile } = useAuth()
  const [profileForm, setProfileForm] = useState({
    nickname: currentUser.nickname || currentUser.label,
    avatarData: currentUser.avatarData || '',
    bio: currentUser.bio || currentUser.description || '',
    availability: currentUser.availability || ''
  })
  const [profileView, setProfileView] = useState('photos')
  const [moments, setMoments] = useState([])
  const [invitations, setInvitations] = useState([])
  const [portfolioItems, setPortfolioItems] = useState([])
  const [receivedReviews, setReceivedReviews] = useState([])
  const [profileOrders, setProfileOrders] = useState([])
  const [creditSummary, setCreditSummary] = useState(null)
  const [actioningInvitationId, setActioningInvitationId] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    setProfileForm({
      nickname: currentUser.nickname || currentUser.label,
      avatarData: currentUser.avatarData || '',
      bio: currentUser.bio || currentUser.description || '',
      availability: currentUser.availability || ''
    })
  }, [currentUser.userId, currentUser.nickname, currentUser.avatarData, currentUser.label, currentUser.bio, currentUser.description, currentUser.availability])

  useEffect(() => {
    loadProfileData()
  }, [currentUser.userId, currentUser.role])

  useEffect(() => {
    if (currentUser.role === 'PROVIDER' && profileView === 'invitations') {
      setProfileView('portfolio')
    }
    if (currentUser.role === 'CUSTOMER' && profileView === 'portfolio') {
      setProfileView('photos')
    }
  }, [currentUser.role, profileView])

  async function loadProfileData() {
    try {
      const [momentsResult, reviewsResult, creditResult, ordersResult] = await Promise.allSettled([
        momentApi.list({}, currentUser),
        reviewApi.listByUser(currentUser.userId, currentUser),
        creditApi.summary(currentUser.userId, currentUser),
        orderApi.list({ role: currentUser.role === 'PROVIDER' ? 'provider' : 'customer' }, currentUser)
      ])
      const allMoments = momentsResult.status === 'fulfilled' ? momentsResult.value : []
      const nextReviews = reviewsResult.status === 'fulfilled'
        ? mergeReviewLists(reviewsResult.value, getLocalReviewsByTarget(currentUser.userId))
        : mergeReviewLists(getLocalReviewsByTarget(currentUser.userId))
      const nextOrders = ordersResult.status === 'fulfilled' ? ordersResult.value : getOrderSnapshotsForUser(currentUser.userId)
      setMoments(allMoments)
      setReceivedReviews(nextReviews)
      setProfileOrders(nextOrders)
      setCreditSummary(creditResult.status === 'fulfilled' ? creditResult.value : null)
      saveOrderSnapshots(nextOrders)
      setPortfolioItems(readPortfolioItems(currentUser.userId))
      if (currentUser.role === 'CUSTOMER') {
        try {
          setInvitations(await demandApi.invitations(currentUser))
        } catch (error) {
          setInvitations([])
          if (!isApiUnavailable(error)) setNotice({ type: 'error', text: error.message })
        }
      } else {
        setInvitations([])
      }
      if (momentsResult.status === 'rejected' && !isApiUnavailable(momentsResult.reason)) {
        setNotice({ type: 'error', text: momentsResult.reason.message })
      } else {
        const firstRequiredError = [reviewsResult, creditResult, ordersResult]
          .find(result => result.status === 'rejected' && !isApiUnavailable(result.reason))
        if (firstRequiredError) {
          setNotice({ type: 'error', text: firstRequiredError.reason.message })
        } else {
          setNotice(null)
        }
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function chooseAvatar(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setProfileForm({ ...profileForm, avatarData: await readFileAsDataUrl(file) })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  function saveProfile() {
    const nextProfile = {
      nickname: profileForm.nickname.trim() || currentUser.nickname || currentUser.label,
      avatarData: profileForm.avatarData,
      bio: profileForm.bio.trim(),
      description: profileForm.bio.trim(),
      availability: profileForm.availability.trim(),
      role: currentUser.role
    }
    saveUserProfile(currentUser.userId, nextProfile)
    updateProfile(nextProfile)
    setNotice({ type: 'success', text: '个人资料已更新' })
  }

  async function choosePortfolioImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imageData = await readFileAsDataUrl(file)
      const title = file.name?.replace(/\.[^.]+$/, '') || '作品图片'
      const nextItems = addPortfolioItem(currentUser.userId, { title, imageData })
      setPortfolioItems(nextItems)
      setNotice({ type: 'success', text: '作品集图片已上传' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function acceptInvitation(invitation) {
    setActioningInvitationId(invitation.invitationId)
    setNotice(null)
    try {
      const accepted = await demandApi.acceptInvitation(invitation.invitationId, currentUser)
      const conversation = await conversationApi.createFromResponse(accepted, currentUser)
      const record = saveConversationRecord(conversation, {
        demandId: invitation.demandId,
        scene: invitation.demandScene,
        customerId: invitation.customerId,
        providerUserId: invitation.providerId,
        lastMessage: invitation.message
      })
      await loadProfileData()
      navigate(`/messages/${record.conversationId}`)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setActioningInvitationId(null)
    }
  }

  async function rejectInvitation(invitation) {
    setActioningInvitationId(invitation.invitationId)
    setNotice(null)
    try {
      await demandApi.rejectInvitation(invitation.invitationId, currentUser)
      await loadProfileData()
      setNotice({ type: 'success', text: '已暂不接受该邀请' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setActioningInvitationId(null)
    }
  }

  const savedPhotos = readSavedPhotos()
  const follows = readFollows()
  const myMoments = useMemo(
    () => moments.filter(moment => Number(moment.authorId) === currentUser.userId),
    [moments, currentUser.userId]
  )
  const favoriteMoments = useMemo(
    () => moments.filter(moment => moment.favoritedByCurrentUser),
    [moments]
  )

  const profileActions = [
    { key: 'photos', label: '我的照片', icon: <ImageRoundedIcon /> },
    { key: 'follows', label: '我的关注', icon: <FavoriteRoundedIcon /> },
    { key: 'collections', label: '我的收藏', icon: <FavoriteBorderRoundedIcon /> },
    { key: 'reviews', label: '历史评价', icon: <HistoryRoundedIcon /> }
  ]

  function renderProfilePanel() {
    if (profileView === 'photos') {
      return savedPhotos.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          {savedPhotos.map(photo => (
            <Paper key={photo.photoId} variant="outlined" sx={{ p: 1 }}>
              <Stack spacing={1}>
                <img className="feed-image" src={photo.imageData} alt={photo.title} />
                <Typography fontWeight={800}>{photo.title}</Typography>
                <Typography color="text.secondary" variant="body2">作者 {photo.authorId} · {formatShortTime(photo.createdAt)}</Typography>
                <Button
                  component="a"
                  href={photo.imageData}
                  download={`${photo.title || 'photo'}.png`}
                  size="small"
                  variant="outlined"
                >
                  下载
                </Button>
              </Stack>
            </Paper>
          ))}
        </Box>
      ) : <EmptyCard text="还没有保存过照片" />
    }

    if (profileView === 'follows') {
      return follows.length ? (
        <Stack spacing={1}>
          {follows.map(follow => (
            <Paper key={follow.authorId} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1} onClick={() => navigate(`/users/${follow.authorId}`)} sx={{ cursor: 'pointer' }}>
                  <Avatar sx={{ width: 36, height: 36 }}>{String(follow.authorId).slice(0, 1)}</Avatar>
                  <Typography fontWeight={800}>用户 {follow.authorId}</Typography>
                </Stack>
                <Typography color="text.secondary" variant="body2">{formatShortTime(follow.followedAt)} 关注</Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : <EmptyCard text="还没有关注任何人" />
    }

    if (profileView === 'collections') {
      return favoriteMoments.length ? (
        <Stack spacing={1.5}>
          {favoriteMoments.map(moment => (
            <Paper key={moment.momentId} variant="outlined" sx={{ p: 1.5, cursor: 'pointer' }} onClick={() => navigate(`/moments/${moment.momentId}`)}>
              <Stack spacing={0.7}>
                <Typography fontWeight={800}>{moment.title || '未命名动态'}</Typography>
                <Typography>{moment.content || '分享了一张照片'}</Typography>
                <Typography color="text.secondary" variant="body2">
                  作者 {moment.authorId} · {moment.favoriteCount || 0} 次收藏
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : <EmptyCard text="还没有收藏动态" />
    }

    if (profileView === 'reviews') {
      return (
        <Stack spacing={2}>
          <SectionHeader title="历史评价" subtitle="这里展示别人给你的订单评价。" />
          <ReviewList reviews={receivedReviews} />
        </Stack>
      )
    }

    if (profileView === 'portfolio') {
      const works = buildPortfolioWorks(currentUser.userId, myMoments, portfolioItems)
      return (
        <Stack spacing={2}>
          {currentUser.role === 'PROVIDER' && (
            <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />} sx={{ alignSelf: 'flex-start' }}>
              上传作品图片
              <input hidden type="file" accept="image/*" onChange={choosePortfolioImage} />
            </Button>
          )}
          {works.length ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              {works.map(work => (
                <Paper
                  key={work.key}
                  variant="outlined"
                  sx={{ p: 1, cursor: work.momentId ? 'pointer' : 'default' }}
                  onClick={() => work.momentId && navigate(`/moments/${work.momentId}`)}
                >
                  <Stack spacing={1}>
                    <img className="feed-image" src={work.imageData} alt={work.title || '作品图片'} />
                    <Typography fontWeight={800}>{work.title || '作品图片'}</Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          ) : <EmptyCard text="作品集里还没有照片动态" />}
        </Stack>
      )
    }

    if (profileView === 'invitations') {
      if (currentUser.role !== 'CUSTOMER') {
        return <EmptyCard text="切换到需求方身份后可以查看收到的邀请" />
      }
      return invitations.length ? (
        <Stack spacing={1.5}>
          {invitations.map(invitation => {
            const status = invitation.status || 'PENDING'
            const isPending = status === 'PENDING'
            const busy = actioningInvitationId === invitation.invitationId
            return (
              <Paper key={invitation.invitationId} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={800}>服务方 {invitation.providerId}</Typography>
                      <Typography color="text.secondary" noWrap>{invitation.demandScene}</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Chip size="small" label={centToYuan(invitation.expectedPriceCent)} />
                      <Chip size="small" color={isPending ? 'warning' : status === 'ACCEPTED' ? 'success' : 'default'} label={status === 'ACCEPTED' ? '已接受' : status === 'REJECTED' ? '已婉拒' : '待处理'} />
                    </Stack>
                  </Stack>
                  <Typography>{invitation.message}</Typography>
                  <Typography color="text.secondary" variant="body2">{formatTime(invitation.createdAt)}</Typography>
                  {isPending && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant="contained" startIcon={<ChatRoundedIcon />} onClick={() => acceptInvitation(invitation)} disabled={busy}>
                        接受并进入会话
                      </Button>
                      <Button variant="outlined" color="inherit" onClick={() => rejectInvitation(invitation)} disabled={busy}>
                        暂不接受
                      </Button>
                    </Stack>
                  )}
                  {status === 'ACCEPTED' && invitation.responseId && (
                    <Button variant="text" startIcon={<ChatRoundedIcon />} onClick={() => navigate('/messages')}>
                      去会话列表
                    </Button>
                  )}
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      ) : <EmptyCard text="还没有服务方对你的需求发起邀请" />
    }

    return null
  }

  const profileStats = buildProfileStats(currentUser.userId, receivedReviews, profileOrders)

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="个人" subtitle="管理头像昵称、身份切换和需求方个人入口。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Stack spacing={1} alignItems="center">
              <Avatar
                src={profileForm.avatarData || undefined}
                sx={{ width: 76, height: 76, bgcolor: currentUser.role === 'CUSTOMER' ? 'primary.main' : 'secondary.main' }}
              >
                {(profileForm.nickname || currentUser.label).slice(0, 1)}
              </Avatar>
              <ProfileMetrics stats={profileStats} compact />
            </Stack>
            <Stack spacing={1} sx={{ flex: 1, width: '100%' }}>
              <TextField
                label="昵称"
                value={profileForm.nickname}
                onChange={event => setProfileForm({ ...profileForm, nickname: event.target.value })}
              />
              <TextField
                label="简介"
                multiline
                minRows={2}
                value={profileForm.bio}
                onChange={event => setProfileForm({ ...profileForm, bio: event.target.value })}
              />
              <TextField
                label="档期"
                value={profileForm.availability}
                onChange={event => setProfileForm({ ...profileForm, availability: event.target.value })}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                  更换头像
                  <input hidden type="file" accept="image/*" onChange={chooseAvatar} />
                </Button>
                <Button variant="contained" onClick={saveProfile}>保存资料</Button>
              </Stack>
            </Stack>
          </Stack>
          <Divider />
          <Box>
            <Typography fontWeight={800} sx={{ mb: 1 }}>切换身份</Typography>
            <ToggleButtonGroup exclusive value={userKey} onChange={(_, value) => value && setUserKey(value)}>
              <ToggleButton value="customer">需求方</ToggleButton>
              <ToggleButton value="provider">服务方</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1, width: '100%' }}>
            {profileActions.map(action => (
              <Button
                key={action.key}
                variant={profileView === action.key ? 'contained' : 'outlined'}
                onClick={() => setProfileView(action.key)}
                startIcon={action.icon}
                fullWidth
              >
                {action.label}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1, width: '100%' }}>
            <Button variant="outlined" startIcon={<ReceiptLongRoundedIcon />} onClick={() => navigate('/orders')} fullWidth>
              订单
            </Button>
            {currentUser.role === 'PROVIDER' ? (
              <Button
                variant={profileView === 'portfolio' ? 'contained' : 'outlined'}
                startIcon={<WorkRoundedIcon />}
                onClick={() => {
                  setProfileView('portfolio')
                  loadProfileData()
                }}
                fullWidth
              >
                作品集
              </Button>
            ) : (
              <Button
                variant={profileView === 'invitations' ? 'contained' : 'outlined'}
                startIcon={<SendRoundedIcon />}
                onClick={() => {
                  setProfileView('invitations')
                  loadProfileData()
                }}
                fullWidth
              >
                邀请
              </Button>
            )}
          </Box>
          {renderProfilePanel()}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LogoutRoundedIcon />}
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              退出登录
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Stack spacing={1.5}>
        <Typography variant="overline" color="text.secondary">动态</Typography>
        {myMoments.map(moment => (
          <Paper key={moment.momentId} variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={800} onClick={() => navigate(`/moments/${moment.momentId}`)} sx={{ cursor: 'pointer' }}>
                  {moment.title || '未命名动态'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography color="text.secondary" variant="body2">{formatShortTime(moment.createdAt)}</Typography>
                  <IconButton size="small" color="error" onClick={() => momentApi.delete(moment.momentId, currentUser).then(loadProfileData).catch(error => setNotice({ type: 'error', text: error.message }))}>
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
              <Typography>{moment.content || '分享了一张照片'}</Typography>
              {moment.imageData && <img className="feed-image" src={moment.imageData} alt={moment.title || '动态照片'} onClick={() => navigate(`/moments/${moment.momentId}`)} style={{ cursor: 'pointer' }} />}
              <Typography color="text.secondary" variant="body2">
                {moment.likeCount || 0} 个赞 · {moment.favoriteCount || 0} 次收藏
              </Typography>
            </Stack>
          </Paper>
        ))}
        {!myMoments.length && <EmptyCard text="还没有发布过动态" />}
      </Stack>
    </Stack>
  )
}

function PublicProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [moments, setMoments] = useState([])
  const [receivedReviews, setReceivedReviews] = useState([])
  const [showReviews, setShowReviews] = useState(false)
  const [creditSummary, setCreditSummary] = useState(null)
  const [notice, setNotice] = useState(null)
  const profileUserId = Number(userId)

  useEffect(() => {
    async function load() {
      try {
        const [momentsResult, reviewsResult, creditResult] = await Promise.allSettled([
          momentApi.list({}, currentUser),
          reviewApi.listByUser(profileUserId, currentUser),
          creditApi.summary(profileUserId, currentUser)
        ])
        setMoments(momentsResult.status === 'fulfilled' ? momentsResult.value : [])
        setReceivedReviews(reviewsResult.status === 'fulfilled'
          ? mergeReviewLists(reviewsResult.value, getLocalReviewsByTarget(profileUserId))
          : mergeReviewLists(getLocalReviewsByTarget(profileUserId)))
        setCreditSummary(creditResult.status === 'fulfilled' ? creditResult.value : null)
        if (momentsResult.status === 'rejected' && !isApiUnavailable(momentsResult.reason)) {
          setNotice({ type: 'error', text: momentsResult.reason.message })
        } else {
          const firstOptionalError = [reviewsResult, creditResult]
            .find(result => result.status === 'rejected' && !isApiUnavailable(result.reason))
          setNotice(firstOptionalError ? { type: 'error', text: firstOptionalError.reason.message } : null)
        }
      } catch (error) {
        setNotice({ type: 'error', text: error.message })
      }
    }
    load()
  }, [profileUserId, currentUser.userId])

  const userMoments = moments.filter(moment => Number(moment.authorId) === profileUserId)
  const storedProfile = readUserProfiles()[String(profileUserId)] || {}
  const role = userMoments[0]?.authorRole || storedProfile.role || (profileUserId === USERS.provider.userId ? 'PROVIDER' : 'CUSTOMER')
  const profile = getUserProfile(profileUserId, role, userMoments)
  const works = buildPortfolioWorks(profileUserId, userMoments)
  const profileStats = buildProfileStats(profileUserId, receivedReviews, getOrderSnapshotsForUser(profileUserId))

  function follow() {
    toggleFollow(profileUserId)
    setNotice({ type: 'success', text: isFollowing(profileUserId) ? '已关注' : '已取消关注' })
  }

  if (profileUserId === currentUser.userId) {
    return <Navigate to="/profile" replace />
  }

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Stack spacing={1} alignItems="center">
            <Avatar src={profile.avatarData || undefined} sx={{ width: 76, height: 76, bgcolor: role === 'PROVIDER' ? 'secondary.main' : 'primary.main' }}>
              {profile.nickname?.slice(0, 1) || roleMap[role]?.slice(0, 1) || '用'}
            </Avatar>
            <ProfileMetrics stats={profileStats} compact />
          </Stack>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5">{profile.nickname}</Typography>
            <Typography color="text.secondary">{roleMap[role] || '用户'} {profileUserId} · 动态 {userMoments.length}{role === 'PROVIDER' ? ` · 作品 ${works.length}` : ''}</Typography>
            <Typography sx={{ mt: 1 }}>{profile.bio}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>档期：{profile.availability}</Typography>
          </Box>
          <Stack direction={{ xs: 'row', sm: 'column' }} spacing={1}>
            <Button variant={isFollowing(profileUserId) ? 'contained' : 'outlined'} onClick={follow}>
              {isFollowing(profileUserId) ? '已关注' : '关注'}
            </Button>
            <Button variant={showReviews ? 'contained' : 'outlined'} startIcon={<HistoryRoundedIcon />} onClick={() => setShowReviews(!showReviews)}>
              历史评价
            </Button>
          </Stack>
        </Stack>
      </Paper>
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      {showReviews && (
        <Stack spacing={2}>
          <SectionHeader title="历史评价" subtitle="这个用户收到过的订单评价。" />
          <ReviewList reviews={receivedReviews} />
        </Stack>
      )}

      {role === 'PROVIDER' && (
        <>
          <SectionHeader title="作品集" subtitle="查看这个用户公开发布过的照片动态。" />
          {works.length ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          {works.map(work => (
            <Paper
              key={work.key}
              variant="outlined"
              sx={{ p: 1, cursor: work.momentId ? 'pointer' : 'default' }}
              onClick={() => work.momentId && navigate(`/moments/${work.momentId}`)}
            >
              <Stack spacing={1}>
                <img className="feed-image" src={work.imageData} alt={work.title || '作品图片'} />
                <Typography fontWeight={800}>{work.title || '作品图片'}</Typography>
              </Stack>
            </Paper>
          ))}
        </Box>
          ) : <EmptyCard text="还没有公开作品" />}
        </>
      )}

      <SectionHeader title="动态" subtitle="点击动态进入详情页继续浏览。" />
      <Stack spacing={1.5}>
        {userMoments.map(moment => (
          <Paper key={moment.momentId} variant="outlined" sx={{ p: 1.5, cursor: 'pointer' }} onClick={() => navigate(`/moments/${moment.momentId}`)}>
            <Stack spacing={0.7}>
              <Typography fontWeight={800}>{moment.title || '未命名动态'}</Typography>
              <Typography>{moment.content || '分享了一张照片'}</Typography>
              <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
            </Stack>
          </Paper>
        ))}
        {!userMoments.length && <EmptyCard text="还没有公开动态" />}
      </Stack>
    </Stack>
  )
}

function createDefaultQuoteForm() {
  const start = new Date()
  start.setDate(start.getDate() + 3)
  start.setHours(14, 0, 0, 0)
  const end = new Date(start)
  end.setHours(16, 0, 0, 0)
  const delivery = new Date(start)
  delivery.setDate(delivery.getDate() + 7)
  delivery.setHours(20, 0, 0, 0)

  return {
    amountYuan: 399,
    shootStartTime: toDateTimeInput(start),
    shootEndTime: toDateTimeInput(end),
    deliveryDeadline: toDateTimeInput(delivery),
    location: '南京大学鼓楼校区',
    serviceContent: '2 小时校园约拍，包含沟通、拍摄、基础调色和精修交付。',
    originalCount: 60,
    refinedCount: 12,
    photoUsageScope: 'PERSONAL_ONLY',
    terms: 'P4 演示报价',
    contractTerms: '确认报价后生成订单，模拟支付后资金进入平台托管。',
    remark: '可根据天气微调拍摄时间。'
  }
}

function toDateTimeInput(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseQuoteSnapshot(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getOrderAction(order, currentUser) {
  const isCustomer = Number(order.customerId) === currentUser.userId
  const isProvider = Number(order.providerUserId) === currentUser.userId
  if (order.status === 'PENDING_PAYMENT') {
    return {
      kind: 'pay',
      label: '模拟支付',
      icon: <PaidRoundedIcon />,
      allowed: isCustomer,
      successText: '模拟支付成功，资金已进入平台托管'
    }
  }
  if (order.status === 'PAID_PENDING_SHOOT') {
    return {
      kind: 'transition',
      targetStatus: 'SHOOTING',
      label: '开始拍摄',
      icon: <CheckCircleRoundedIcon />,
      allowed: isProvider,
      reason: '服务方开始拍摄',
      successText: '订单已进入拍摄中'
    }
  }
  if (order.status === 'SHOOTING') {
    return {
      kind: 'transition',
      targetStatus: 'PENDING_DELIVERY',
      label: '进入待交付',
      icon: <TaskAltRoundedIcon />,
      allowed: isProvider,
      reason: '拍摄完成，进入待交付',
      successText: '订单已进入待交付'
    }
  }
  if (order.status === 'PENDING_DELIVERY') {
    return {
      kind: 'transition',
      targetStatus: 'DELIVERED_PENDING_CONFIRM',
      label: '模拟交付',
      icon: <TaskAltRoundedIcon />,
      allowed: isProvider,
      reason: '服务方已上传交付文件',
      successText: '订单已进入待确认交付'
    }
  }
  if (order.status === 'DELIVERED_PENDING_CONFIRM') {
    return {
      kind: 'transition',
      targetStatus: 'COMPLETED',
      label: '确认完成',
      icon: <CheckCircleRoundedIcon />,
      allowed: isCustomer,
      reason: '需求方确认完成',
      successText: '订单已完成'
    }
  }
  return null
}

const CONVERSATION_STORAGE_KEY = 'camera-p4-conversations'
const LOCAL_MESSAGE_STORAGE_KEY = 'camera-p4-local-messages'
const SAVED_PHOTO_STORAGE_KEY = 'camera-p4-saved-photos'
const FOLLOW_STORAGE_KEY = 'camera-p4-follows'
const USER_PROFILE_STORAGE_KEY = 'camera-p4-user-profiles'
const PORTFOLIO_STORAGE_KEY = 'camera-p4-portfolios'
const LOCAL_REVIEW_STORAGE_KEY = 'camera-p4-local-reviews'
const ARBITRATION_STORAGE_KEY = 'camera-p4-arbitrations'
const ORDER_SNAPSHOT_STORAGE_KEY = 'camera-p4-order-snapshots'

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function isApiUnavailable(error) {
  return Boolean(error?.isNetworkError)
    || error?.status === 404
    || (error?.code === 50001 && /No static resource|No endpoint|not found/i.test(error.message || ''))
}

function readLocalReviews() {
  return readJsonStorage(LOCAL_REVIEW_STORAGE_KEY, [])
}

function saveLocalReview(review) {
  const reviews = readLocalReviews()
  const nextReview = {
    ...review,
    reviewId: review.reviewId || `local-review-${review.orderId}-${review.reviewerId}-${Date.now()}`,
    rating: Number(review.rating),
    createdAt: review.createdAt || new Date().toISOString(),
    isVisible: review.isVisible ?? true,
    isLocal: true
  }
  const nextReviews = [
    nextReview,
    ...reviews.filter(item => String(item.reviewId) !== String(nextReview.reviewId))
  ]
  writeJsonStorage(LOCAL_REVIEW_STORAGE_KEY, nextReviews)
  return nextReview
}

function readLocalArbitrations() {
  return readJsonStorage(ARBITRATION_STORAGE_KEY, [])
}

function saveLocalArbitration(record) {
  const records = readLocalArbitrations()
  const nextRecord = {
    ...record,
    arbitrationId: record.arbitrationId || `arb-${record.orderId}-${record.applicantId}-${Date.now()}`,
    status: record.status || 'PENDING',
    createdAt: record.createdAt || new Date().toISOString()
  }
  writeJsonStorage(ARBITRATION_STORAGE_KEY, [nextRecord, ...records])
  return nextRecord
}

function normalizeComplaint(record) {
  if (!record) return null
  return {
    arbitrationId: record.arbitrationId || record.complaintId,
    complaintId: record.complaintId,
    reviewId: record.reviewId,
    orderId: Number(record.orderId),
    applicantId: Number(record.applicantId ?? record.complainantId),
    respondentId: Number(record.respondentId),
    reason: record.reason || '评价争议',
    description: record.description || record.arbitrationComment || record.evidenceFileIds || '',
    status: record.status || 'PENDING',
    arbitrationResult: record.arbitrationResult,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    handledAt: record.handledAt
  }
}

function mergeComplaints(...lists) {
  const map = new Map()
  lists.flat().filter(Boolean).map(normalizeComplaint).filter(Boolean).forEach(record => {
    const key = record.complaintId || record.arbitrationId || `${record.reviewId}-${record.applicantId}-${record.createdAt}`
    map.set(String(key), record)
  })
  return Array.from(map.values()).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

function readOrderSnapshots() {
  return readJsonStorage(ORDER_SNAPSHOT_STORAGE_KEY, {})
}

function saveOrderSnapshots(orders) {
  if (!Array.isArray(orders) || !orders.length) return
  const store = readOrderSnapshots()
  orders.forEach(order => {
    if (order?.orderId) {
      store[String(order.orderId)] = {
        ...store[String(order.orderId)],
        ...order,
        cachedAt: new Date().toISOString()
      }
    }
  })
  writeJsonStorage(ORDER_SNAPSHOT_STORAGE_KEY, store)
}

function getOrderSnapshotsForUser(userId) {
  return Object.values(readOrderSnapshots()).filter(order => isOrderParticipant(order, userId))
}

function isOrderParticipant(order, userId) {
  return Number(order?.customerId) === Number(userId) || Number(order?.providerUserId) === Number(userId)
}

function getOrderReviewDirection(order, userId) {
  if (Number(order?.customerId) === Number(userId)) return 'CUSTOMER_TO_PROVIDER'
  if (Number(order?.providerUserId) === Number(userId)) return 'PROVIDER_TO_CUSTOMER'
  return ''
}

function getReviewTargetUserId(order, reviewerId) {
  return Number(order?.customerId) === Number(reviewerId)
    ? Number(order.providerUserId)
    : Number(order?.customerId)
}

function normalizeReview(review) {
  if (!review) return null
  return {
    reviewId: review.reviewId || review.id,
    orderId: Number(review.orderId),
    reviewerId: Number(review.reviewerId),
    targetUserId: Number(review.targetUserId),
    direction: review.direction,
    rating: Number(review.rating || 0),
    content: review.content || '',
    isVisible: review.isVisible ?? true,
    createdAt: review.createdAt
  }
}

function mergeReviewLists(...lists) {
  const map = new Map()
  lists.flat().filter(Boolean).map(normalizeReview).filter(Boolean).forEach(review => {
    const key = review.reviewId || `${review.orderId}-${review.direction}-${review.reviewerId}`
    map.set(String(key), review)
  })
  return Array.from(map.values()).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

function getLocalReviewsByOrder(orderId) {
  return readLocalReviews().filter(review => Number(review.orderId) === Number(orderId))
}

function getLocalReviewsByTarget(userId) {
  return readLocalReviews().filter(review => Number(review.targetUserId) === Number(userId))
}

function getArbitrationsByOrder(orderId) {
  return mergeComplaints(readLocalArbitrations().filter(record => Number(record.orderId) === Number(orderId)))
}

function orderHasArbitration(orderId) {
  return getArbitrationsByOrder(orderId).length > 0
}

function calculateAverageRating(reviews) {
  const ratings = reviews.map(review => Number(review.rating)).filter(rating => rating > 0)
  if (!ratings.length) return null
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
}

function calculateCompletionRate(orders) {
  const relevant = orders.filter(order => {
    const status = order?.status
    return status === 'COMPLETED' || status === 'CANCELLED' || status === 'REFUNDED' || orderHasArbitration(order.orderId)
  })
  if (!relevant.length) return null
  const successful = relevant.filter(order => order.status === 'COMPLETED' && !orderHasArbitration(order.orderId))
  return Math.round((successful.length / relevant.length) * 100)
}

function buildProfileStats(userId, reviews = [], orders = []) {
  const receivedReviews = mergeReviewLists(reviews, getLocalReviewsByTarget(userId))
  const relatedOrders = orders.length ? orders : getOrderSnapshotsForUser(userId)
  const rating = calculateAverageRating(receivedReviews)
  return {
    rating,
    reviewCount: receivedReviews.length,
    completionRate: calculateCompletionRate(relatedOrders),
    completedCount: relatedOrders.filter(order => order.status === 'COMPLETED' && !orderHasArbitration(order.orderId)).length
  }
}

function directionLabel(direction) {
  if (direction === 'CUSTOMER_TO_PROVIDER') return '需求方评价服务方'
  if (direction === 'PROVIDER_TO_CUSTOMER') return '服务方评价需求方'
  return '订单评价'
}

async function complaintApiSafeList(reviewId, currentUser) {
  try {
    return await reviewComplaintApi.listByReview(reviewId, currentUser)
  } catch (error) {
    if (isApiUnavailable(error)) return []
    throw error
  }
}

function readConversationRecords() {
  return readJsonStorage(CONVERSATION_STORAGE_KEY, [])
}

function saveConversationRecord(conversation, meta = {}) {
  const records = readConversationRecords()
  const conversationId = String(conversation.conversationId)
  const previous = records.find(record => String(record.conversationId) === conversationId)
  const now = new Date().toISOString()
  const record = {
    ...previous,
    conversationId,
    backendConversationId: conversation.isLocal ? null : Number(conversation.conversationId),
    isLocal: Boolean(conversation.isLocal),
    participantAId: Number(conversation.participantAId ?? meta.customerId ?? USERS.customer.userId),
    participantBId: Number(conversation.participantBId ?? meta.providerUserId ?? meta.providerId ?? USERS.provider.userId),
    sourceType: conversation.sourceType || previous?.sourceType || 'DEMAND_RESPONSE',
    sourceId: conversation.sourceId ?? previous?.sourceId ?? meta.demandId,
    demandId: meta.demandId ?? previous?.demandId ?? conversation.sourceId,
    scene: meta.scene || previous?.scene || `需求 ${meta.demandId || conversation.sourceId || ''}`,
    location: meta.location || previous?.location || '',
    lastMessage: meta.lastMessage || previous?.lastMessage || '点击进入对话',
    interfaceNote: meta.interfaceNote || previous?.interfaceNote || '',
    updatedAt: conversation.lastMessageTime || conversation.updatedAt || conversation.createdAt || now
  }
  const nextRecords = records.filter(item => String(item.conversationId) !== conversationId)
  nextRecords.unshift(record)
  writeJsonStorage(CONVERSATION_STORAGE_KEY, nextRecords)
  return record
}

function findConversationRecord(conversationId) {
  return readConversationRecords().find(record => String(record.conversationId) === String(conversationId)) || null
}

function getConversationRecordsForUser(currentUser) {
  return readConversationRecords()
    .filter(record => Number(record.participantAId) === currentUser.userId || Number(record.participantBId) === currentUser.userId)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
}

function mergeConversationRecords(remoteConversations, currentUser) {
  const localRecords = getConversationRecordsForUser(currentUser)
  const merged = new Map(localRecords.map(record => [String(record.conversationId), record]))

  remoteConversations.forEach(conversation => {
    const conversationId = String(conversation.conversationId)
    const previous = merged.get(conversationId)
    const record = saveConversationRecord(conversation, {
      demandId: previous?.demandId,
      scene: previous?.scene || `会话 ${conversationId}`,
      location: previous?.location || '',
      lastMessage: previous?.lastMessage || (conversation.lastMessageTime ? '最近有新消息' : '点击进入对话')
    })
    merged.set(conversationId, record)
  })

  return Array.from(merged.values())
    .filter(record => Number(record.participantAId) === currentUser.userId || Number(record.participantBId) === currentUser.userId)
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))
}

function updateConversationLastMessage(conversationId, content) {
  const record = findConversationRecord(conversationId)
  if (!record) return
  saveConversationRecord(record, { lastMessage: content })
}

function buildConversationFallback(conversationId) {
  const isLocal = String(conversationId).startsWith('local-')
  return {
    conversationId: String(conversationId),
    backendConversationId: isLocal ? null : Number(conversationId),
    isLocal,
    participantAId: USERS.customer.userId,
    participantBId: USERS.provider.userId,
    sourceType: isLocal ? 'DEMAND_CONTACT' : 'DEMAND_RESPONSE',
    sourceId: null,
    scene: `会话 ${conversationId}`,
    lastMessage: ''
  }
}

function getOppositeUserId(conversation, currentUserId) {
  return Number(conversation.participantAId) === currentUserId
    ? conversation.participantBId
    : conversation.participantAId
}

function getLocalMessageStore() {
  return readJsonStorage(LOCAL_MESSAGE_STORAGE_KEY, {})
}

function getLocalMessages(conversationId) {
  const store = getLocalMessageStore()
  return store[String(conversationId)] || []
}

function addLocalMessage(conversationId, message) {
  const id = String(conversationId)
  const store = getLocalMessageStore()
  const nextMessage = {
    messageId: `${id}-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    conversationId: id,
    senderId: Number(message.senderId),
    messageType: message.messageType || 'TEXT',
    content: message.content,
    createdAt: new Date().toISOString()
  }
  const nextMessages = [...(store[id] || []), nextMessage]
  store[id] = nextMessages
  writeJsonStorage(LOCAL_MESSAGE_STORAGE_KEY, store)
  return nextMessages
}

function readSavedPhotos() {
  return readJsonStorage(SAVED_PHOTO_STORAGE_KEY, [])
    .filter(photo => photo && (
      photo.source === 'conversation-submission' ||
      String(photo.photoId || '').startsWith('message-')
    ))
}

function addSavedPhoto(photo) {
  const photos = readSavedPhotos()
  const nextPhoto = {
    ...photo,
    photoId: String(photo.photoId),
    savedAt: new Date().toISOString()
  }
  const nextPhotos = [
    nextPhoto,
    ...photos.filter(item => String(item.photoId) !== nextPhoto.photoId)
  ].slice(0, 80)
  writeJsonStorage(SAVED_PHOTO_STORAGE_KEY, nextPhotos)
  return nextPhotos
}

function readFollows() {
  return readJsonStorage(FOLLOW_STORAGE_KEY, [])
}

function readUserProfiles() {
  return readJsonStorage(USER_PROFILE_STORAGE_KEY, {})
}

function saveUserProfile(userId, profile) {
  const profiles = readUserProfiles()
  const id = String(userId)
  profiles[id] = {
    ...profiles[id],
    ...profile,
    userId: Number(userId)
  }
  writeJsonStorage(USER_PROFILE_STORAGE_KEY, profiles)
  return profiles[id]
}

function getUserProfile(userId, role, moments = []) {
  const id = Number(userId)
  const profiles = readUserProfiles()
  const stored = profiles[String(id)] || {}
  const demoUser = Object.values(USERS).find(user => Number(user.userId) === id)
  const inferredRole = role || stored.role || demoUser?.role || moments.find(moment => Number(moment.authorId) === id)?.authorRole || 'CUSTOMER'
  const nickname = stored.nickname || demoUser?.nickname || `${roleMap[inferredRole] || '用户'} ${id}`
  const bio = stored.bio || stored.description || demoUser?.bio || demoUser?.description || '这个人还没有填写简介。'
  return {
    userId: id,
    role: inferredRole,
    nickname,
    avatarData: stored.avatarData || demoUser?.avatarData || '',
    bio,
    description: bio,
    availability: stored.availability || demoUser?.availability || '暂未填写档期'
  }
}

function readPortfolioItems(userId) {
  const store = readJsonStorage(PORTFOLIO_STORAGE_KEY, {})
  return store[String(userId)] || []
}

function addPortfolioItem(userId, item) {
  const store = readJsonStorage(PORTFOLIO_STORAGE_KEY, {})
  const id = String(userId)
  const nextItem = {
    ...item,
    portfolioId: item.portfolioId || `portfolio-${id}-${Date.now()}`,
    createdAt: item.createdAt || new Date().toISOString()
  }
  store[id] = [nextItem, ...(store[id] || [])].slice(0, 80)
  writeJsonStorage(PORTFOLIO_STORAGE_KEY, store)
  return store[id]
}

function buildPortfolioWorks(userId, moments, portfolioItems = readPortfolioItems(userId)) {
  const uploaded = portfolioItems.map(item => ({
    ...item,
    key: item.portfolioId,
    title: item.title || '作品图片',
    imageData: item.imageData,
    createdAt: item.createdAt
  }))
  const momentWorks = moments
    .filter(moment => Number(moment.authorId) === Number(userId) && moment.imageData)
    .map(moment => ({
      key: `moment-${moment.momentId}`,
      momentId: moment.momentId,
      title: moment.title || '动态作品',
      imageData: moment.imageData,
      createdAt: moment.createdAt
    }))
  return [...uploaded, ...momentWorks]
}

function openUserProfile(userId) {
  const id = Number(userId)
  if (!id) return
  window.open(new URL(`/users/${id}`, window.location.origin).toString(), '_blank', 'noopener,noreferrer')
}

function parseMentions(text) {
  return String(text || '')
    .split(/[,\n，\s]+/)
    .map(value => value.replace(/^@+/, '').trim())
    .filter(Boolean)
}

function resolveMentionUserId(mention) {
  const value = String(mention || '').replace(/^@+/, '').trim()
  if (!value) return null
  if (/^\d+$/.test(value)) return Number(value)
  const profiles = readUserProfiles()
  const storedMatch = Object.entries(profiles).find(([, profile]) => profile?.nickname === value)
  if (storedMatch) return Number(storedMatch[0])
  const demoMatch = Object.values(USERS).find(user => user.nickname === value || user.label === value)
  return demoMatch?.userId || null
}

function MentionChip({ mention }) {
  const userId = resolveMentionUserId(mention)
  return (
    <Chip
      size="small"
      label={`@${String(mention).replace(/^@+/, '')}`}
      clickable={Boolean(userId)}
      onClick={userId ? () => openUserProfile(userId) : undefined}
    />
  )
}

function isFollowing(authorId) {
  return readFollows().some(follow => Number(follow.authorId) === Number(authorId))
}

function toggleFollow(authorId) {
  const id = Number(authorId)
  const follows = readFollows()
  const exists = follows.some(follow => Number(follow.authorId) === id)
  const nextFollows = exists
    ? follows.filter(follow => Number(follow.authorId) !== id)
    : [{ authorId: id, followedAt: new Date().toISOString() }, ...follows]
  writeJsonStorage(FOLLOW_STORAGE_KEY, nextFollows)
  return !exists
}

function formatShortTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function SectionHeader({ title, subtitle }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="h5">{title}</Typography>
      <Typography color="text.secondary">{subtitle}</Typography>
    </Stack>
  )
}

function InfoRows({ rows }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px 1fr' }, gap: 1.2 }}>
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: 'contents' }}>
          <Typography color="text.secondary">{label}</Typography>
          <Typography>{value}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function EmptyCard({ text }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
      {text}
    </Paper>
  )
}

function ProfileMetrics({ stats, compact = false }) {
  const rating = stats?.rating
  const completionRate = stats?.completionRate
  return (
    <Stack spacing={0.8} alignItems={compact ? 'center' : 'flex-start'} sx={{ minWidth: compact ? 120 : 0 }}>
      <Stack direction="row" spacing={0.7} alignItems="center">
        <StarRoundedIcon fontSize="small" color="warning" />
        <Typography fontWeight={800}>
          {rating ? rating.toFixed(1) : '暂无评分'}
        </Typography>
      </Stack>
      {rating ? (
        <Rating value={rating} precision={0.1} readOnly size="small" />
      ) : (
        <Typography color="text.secondary" variant="body2">等待首条评价</Typography>
      )}
      <Chip
        size="small"
        color={completionRate === null ? 'default' : completionRate >= 80 ? 'success' : 'warning'}
        label={`完成率 ${completionRate === null ? '暂无' : `${completionRate}%`}`}
      />
    </Stack>
  )
}

function ReviewList({ reviews, emptyText = '暂无历史评价' }) {
  return reviews.length ? (
    <Stack spacing={1.2}>
      {reviews.map(review => (
        <Paper key={review.reviewId || `${review.orderId}-${review.direction}-${review.createdAt}`} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
          <Stack spacing={0.8}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Typography fontWeight={800}>{directionLabel(review.direction)} · 订单 {review.orderId}</Typography>
              <Typography color="text.secondary" variant="body2">{formatTime(review.createdAt)}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Rating value={Number(review.rating || 0)} readOnly size="small" />
              <Typography fontWeight={800}>{Number(review.rating || 0).toFixed(1)}</Typography>
            </Stack>
            <Typography>{review.content || '对方没有留下文字评价'}</Typography>
            <Typography color="text.secondary" variant="body2">
              评价人 {review.reviewerId} · 被评价人 {review.targetUserId}
            </Typography>
          </Stack>
        </Paper>
      ))}
    </Stack>
  ) : <EmptyCard text={emptyText} />
}

function formatTime(value) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export {
  ConversationDetailPage,
  FeedPage,
  HallPage,
  LoginChoicePage,
  LoginInfoPage,
  MessagesPage,
  MomentDetailPage,
  OrdersPage,
  ProfilePage,
  PublicProfilePage,
  PublishPage,
  RegisterPage
}

export default App
