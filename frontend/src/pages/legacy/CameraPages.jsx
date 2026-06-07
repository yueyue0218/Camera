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
  deliveryApi,
  momentApi,
  orderApi,
  photoAuthorizationApi,
  quoteApi,
  reviewApi,
  reviewComplaintApi,
  readFileAsDataUrl,
  userApi,
  yuanToCent
} from '../../api.js'
import {
  canCustomerConfirm,
  canCustomerPay,
  canCustomerRequestRework,
  canCustomerReviewPhotoAuthorization,
  canProviderRequestPhotoAuthorization,
  canProviderUploadDelivery,
  canShowOrderNormalActions,
  ORDER_STATUS_LABELS,
  PHOTO_AUTHORIZATION_STATUS_LABELS
} from '../orders/orderActions.js'
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
  { label: '澶у巺', path: '/hall', icon: <HomeRoundedIcon /> },
  { label: '鍙戝竷', path: '/publish', icon: <PublishRoundedIcon /> },
  { label: '鍔ㄦ€?', path: '/feed', icon: <DynamicFeedRoundedIcon /> },
  { label: '浼氳瘽', path: '/messages', icon: <ChatRoundedIcon /> },
  { label: '涓汉', path: '/profile', icon: <PersonRoundedIcon /> }
]

const demandStatusMap = {
  OPEN: '寮€鏀句腑',
  MATCHED: '宸插尮閰?',
  CLOSED: '宸插叧闂?',
}

const responseStatusMap = {
  PENDING_CUSTOMER_ACCEPT: '寰呴渶姹傛柟鎺ュ彈',
  ACCEPTED: '宸叉帴鍙?',
  REJECTED: '宸插鎷?',
}

const roleMap = {
  CUSTOMER: '闇€姹傛柟',
  PROVIDER: '鏈嶅姟鏂?',
  ADMIN: '绠＄悊鍛?',
}

const quoteStatusMap = {
  PENDING_CONFIRM: '寰呯‘璁?',
  CONFIRMED: '宸茬‘璁?',
  REJECTED: '宸叉嫆缁?',
  EXPIRED: '宸茶繃鏈?',
  CANCELLED: '宸插彇娑?',
}

const orderStatusMap = {
  ...ORDER_STATUS_LABELS,
  PENDING_PAYMENT: '寰呮敮浠?',
  PAID_PENDING_SHOOT: '宸叉敮浠樺緟鎷嶆憚',
  SHOOTING: '鎷嶆憚涓?',
  PENDING_DELIVERY: '寰呬氦浠?',
  DELIVERED_PENDING_CONFIRM: '宸蹭氦浠樺緟纭',
  COMPLETED: '宸插畬鎴?',
  CANCELLED: '宸插彇娑?',
  REFUNDED: '宸查€€娆?',
  APPEALING: '鐢宠瘔涓?',
  REWORK_REQUIRED: '杩斾慨涓?',
}

const escrowStatusMap = {
  NOT_PAID: '鏈敮浠?',
  HELD: '骞冲彴鎵樼涓?',
  RELEASED: '宸茬粨绠?',
  REFUNDED: '宸查€€娆?',
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
            label={`褰撳墠锛?{roleMap[currentUser.role]}`}
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
            閫€鍑?
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
          鐧诲綍
        </Button>
        <Button
          className="login-entry-button login-entry-button-late"
          size="large"
          variant="outlined"
          color="secondary"
          onClick={() => navigate('/login/register')}
          sx={{ minHeight: 60, fontSize: { xs: '1.16rem', sm: '1.28rem' }, fontWeight: 900 }}
        >
          娉ㄥ唽
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
                <Typography variant="h5">鐧诲綍</Typography>
                <Typography color="text.secondary">褰撳墠鍚庣鐧诲綍鎺ュ彛浣跨敤鎵嬫満鍙峰拰楠岃瘉鐮併€?/Typography>
              </Box>
            </Stack>

            {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

            <Box>
              <Typography fontWeight={800} sx={{ mb: 1 }}>鏈鐧诲綍韬唤</Typography>
              <ToggleButtonGroup exclusive value={role} onChange={(_, value) => value && setRole(value)}>
                <ToggleButton value="CUSTOMER">闇€姹傛柟</ToggleButton>
                <ToggleButton value="PROVIDER">鏈嶅姟鏂?/ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <TextField
              label="鎵嬫満鍙?
              value={form.mobile}
              onChange={event => setForm({ ...form, mobile: event.target.value })}
              inputProps={{ inputMode: 'tel', maxLength: 11 }}
              required
            />
            <TextField
              label="楠岃瘉鐮?
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
              {loading ? '鐧诲綍涓? : '鐧诲綍'}
            </Button>
            <Button variant="text" color="inherit" onClick={() => navigate('/login')}>
              杩斿洖閫夋嫨韬唤
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
    nickname: '鍗楀ぇ鍚屽',
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
      setNotice({ type: 'success', text: '鍗楀ぇ閭楠岃瘉鐮佸凡鍙戦€? })
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
      navigate('/login/sign-in', { replace: true, state: { notice: '娉ㄥ唽鎴愬姛锛岃鐧诲綍' } })
    } catch (error) {
      if (error.canUseDemoRegister) {
        navigate('/login/sign-in', { replace: true, state: { notice: '婕旂ず娉ㄥ唽鎴愬姛锛岃鐧诲綍' } })
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
                <Typography variant="h5">娉ㄥ唽</Typography>
                <Typography color="text.secondary">浣跨敤鍗楀ぇ閭楠岃瘉鐮佸畬鎴?A3 娉ㄥ唽銆?/Typography>
              </Box>
            </Stack>
            {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
            <TextField
              label="鏄电О"
              value={form.nickname}
              onChange={event => setForm({ ...form, nickname: event.target.value })}
              required
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                label="鍗楀ぇ閭"
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
                鍙戦€侀獙璇佺爜
              </Button>
            </Stack>
            <TextField
              label="楠岃瘉鐮?
              value={form.verifyCode}
              onChange={event => setForm({ ...form, verifyCode: event.target.value })}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              required
            />
            <TextField
              label="瀵嗙爜"
              type="password"
              value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })}
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? '娉ㄥ唽涓? : '娉ㄥ唽骞惰繑鍥炵櫥褰?}
            </Button>
            <Button variant="text" color="inherit" onClick={() => navigate('/login/sign-in')}>
              宸叉湁璐﹀彿锛屽幓鐧诲綍
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
  const [inviteForm, setInviteForm] = useState({ expectedPriceYuan: 399, message: '浣犲ソ锛屾垜寰堥€傚悎杩欎釜闇€姹傦紝鎯抽個璇蜂綘杩涗竴姝ユ矡閫氭媿鎽勬柟妗堛€? })
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
    }, currentUser), '閭€璇峰凡鍙戦€?)
  }

  async function deleteDemand(demand) {
    if (!demand) return
    const deleted = await run(async () => {
      await demandApi.delete(demand.demandId, currentUser)
      return true
    }, '闇€姹傚凡鍒犻櫎')
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
    }, '宸叉帴鍙楀搷搴斿苟鍒涘缓浼氳瘽')
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
      <SectionHeader title="闇€姹傚ぇ鍘? subtitle="娴忚绾︽媿闇€姹傦紝鏈嶅姟鏂瑰彲鍝嶅簲锛岄渶姹傛柟鍙帴鍙楀搷搴斻€? />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      <Paper className="portra-toolbar" variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
          <Stack spacing={0.5} sx={{ minWidth: { md: 108 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-city" variant="caption" color="text.secondary" fontWeight={800}>
              鍩庡競
            </Typography>
            <TextField
              id="hall-filter-city"
              value={filters.cityCode}
              onChange={event => setFilters({ ...filters, cityCode: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '鍩庡競' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 140 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-tag" variant="caption" color="text.secondary" fontWeight={800}>
              鏍囩
            </Typography>
            <TextField
              id="hall-filter-tag"
              placeholder="鑷劧鎶撴媿"
              value={filters.styleTag}
              onChange={event => setFilters({ ...filters, styleTag: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '鏍囩' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 156 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-date" variant="caption" color="text.secondary" fontWeight={800}>
              鏃ユ湡
            </Typography>
            <TextField
              id="hall-filter-date"
              type="date"
              value={filters.expectedDate}
              onChange={event => setFilters({ ...filters, expectedDate: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '鏃ユ湡' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 108 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-min-price" variant="caption" color="text.secondary" fontWeight={800}>
              鏈€浣庝环
            </Typography>
            <TextField
              id="hall-filter-min-price"
              type="number"
              value={filters.minBudgetYuan}
              onChange={event => setFilters({ ...filters, minBudgetYuan: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '鏈€浣庝环' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 108 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-max-price" variant="caption" color="text.secondary" fontWeight={800}>
              鏈€楂樹环
            </Typography>
            <TextField
              id="hall-filter-max-price"
              type="number"
              value={filters.maxBudgetYuan}
              onChange={event => setFilters({ ...filters, maxBudgetYuan: event.target.value })}
              size="small"
              inputProps={{ 'aria-label': '鏈€楂樹环' }}
            />
          </Stack>
          <Stack spacing={0.5} sx={{ minWidth: { md: 140 }, justifyContent: 'flex-end' }}>
            <Typography component="label" htmlFor="hall-filter-status" variant="caption" color="text.secondary" fontWeight={800}>
              鐘舵€?
            </Typography>
            <FormControl size="small">
              <Select
                id="hall-filter-status"
                value={filters.status}
                onChange={event => setFilters({ ...filters, status: event.target.value })}
                inputProps={{ 'aria-label': '鐘舵€? }}
              >
                <MenuItem value="OPEN">寮€鏀句腑</MenuItem>
                <MenuItem value="MATCHED">宸插尮閰?/MenuItem>
                <MenuItem value="">鍏ㄩ儴</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            <Typography variant="caption" color="transparent" fontWeight={800} aria-hidden="true">
              鎿嶄綔
            </Typography>
            <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={loadDemands} disabled={loading} sx={{ minHeight: 40 }}>
              鍒锋柊
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '360px 1fr' }, gap: 2 }}>
        <Stack spacing={1.5}>
          {demands.map(demand => (
            <Card
              className="portra-ticket-card"
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
                  <Typography color="text.secondary">{demand.cityCode} 路 {demand.location}</Typography>
                  <Typography>{centToYuan(demand.budgetMinCent)} 鑷?{centToYuan(demand.budgetMaxCent)}</Typography>
                  <Typography color="text.secondary">{demand.responseCount} 涓搷搴?/Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
          {!demands.length && <EmptyCard text="鏆傛棤闇€姹? />}
        </Stack>

        <Paper className="portra-detail-ticket" variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minHeight: 420 }}>
          {!selectedDemand ? (
            <EmptyCard text="閫夋嫨涓€鏉￠渶姹傛煡鐪嬭鎯? />
          ) : (
            <Stack spacing={2.2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Box>
                  <Typography variant="h5">{selectedDemand.scene}</Typography>
                  <Typography color="text.secondary">{selectedDemand.cityCode} 路 {selectedDemand.location}</Typography>
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
                      鍒犻櫎闇€姹?
                    </Button>
                  )}
                </Stack>
              </Stack>
              {isSelectedDemandOwner && selectedDemandInProgress && (
                <Alert severity="info">闇€姹備氦鏄撴鍦ㄨ繘琛岋紝鏆傛椂涓嶈兘鍒犻櫎銆?/Alert>
              )}
              <Divider />
              <InfoRows rows={[
                ['闇€姹傛柟缂栧彿', selectedDemand.customerId],
                ['鏃堕棿', `${selectedDemand.expectedDate || '鏈畾鏃ユ湡'} ${selectedDemand.timeSlot || ''}`],
                ['棰勭畻', `${centToYuan(selectedDemand.budgetMinCent)} 鑷?${centToYuan(selectedDemand.budgetMaxCent)}`],
                ['椋庢牸', selectedDemand.styleTags?.length ? selectedDemand.styleTags.join(' / ') : '鏈～鍐?],
                ['鎻忚堪', selectedDemand.description || '鏈～鍐?]
              ]} />

              {canInvite && (
                <Paper className="portra-system-card" variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                      <Typography variant="h6">鍙戣捣閭€璇?/Typography>
                      <Button
                        variant="contained"
                        startIcon={<SendRoundedIcon />}
                        onClick={sendInvitation}
                        disabled={loading}
                      >
                        鍙戣捣閭€璇?
                      </Button>
                    </Stack>
                    <TextField
                      label="閭€璇锋姤浠?
                      type="number"
                      value={inviteForm.expectedPriceYuan}
                      onChange={event => setInviteForm({ ...inviteForm, expectedPriceYuan: event.target.value })}
                    />
                    <TextField
                      label="閭€璇疯鏄?
                      multiline
                      minRows={2}
                      value={inviteForm.message}
                      onChange={event => setInviteForm({ ...inviteForm, message: event.target.value })}
                    />
                    <Alert severity="info">鏈嶅姟鏂归渶瑕佸厛鍙戣捣閭€璇凤紱闇€姹傛柟鎺ュ彈鍚庢墠浼氬垱寤轰細璇濄€?/Alert>
                  </Stack>
                </Paper>
              )}

              {canSeeResponses && (
                <Paper className="portra-system-card" variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6">鍝嶅簲鍒楄〃</Typography>
                      <Button size="small" onClick={() => openDemand(selectedDemand)}>鍒锋柊鍝嶅簲</Button>
                    </Stack>
                    {responses.map(response => (
                      <Paper key={response.responseId} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                          <Box>
                            <Typography fontWeight={700}>鏈嶅姟鏂?{response.providerId}</Typography>
                            <Typography>{response.message}</Typography>
                            <Typography color="text.secondary">
                              {centToYuan(response.expectedPriceCent)} 路 {responseStatusMap[response.status] || response.status}
                            </Typography>
                          </Box>
                          {response.status === 'PENDING_CUSTOMER_ACCEPT' && selectedDemand.status === 'OPEN' && (
                            <Button variant="contained" onClick={() => acceptResponse(response)}>鎺ュ彈</Button>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                    {!responses.length && <Typography color="text.secondary">鏆傛棤鍝嶅簲</Typography>}
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
                        杩涘叆浼氳瘽
                      </Button>
                    ) : null
                  }
                >
                  宸插垱寤?C 妯″潡浼氳瘽锛氬搷搴?{snapshot.responseId}锛屼細璇?{snapshot.conversation?.conversationId || '寰呯敓鎴?}銆?
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
    scene: '姣曚笟鐓?,
    cityCode: 'NJU',
    location: '鍗椾含澶у榧撴ゼ鏍″尯',
    expectedDate: '',
    timeSlot: '14:00-16:00',
    budgetMinYuan: 199,
    budgetMaxYuan: 399,
    styleTagsText: '鑷劧鎶撴媿,鏍″洯,鐢熸椿鎰?,
    description: '鎯虫媿涓€缁勮嚜鐒躲€佷笉妯℃澘鍖栫殑鏍″洯姣曚笟鐓э紝鍋忕敓娲绘劅銆?
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
      setNotice({ type: 'success', text: '闇€姹傚凡鍙戝竷' })
      navigate('/hall')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  if (currentUser.role !== 'CUSTOMER') {
    return (
      <Stack spacing={2}>
        <SectionHeader title="鍙戝竷" subtitle="鍙戝竷绾︽媿闇€姹傞渶瑕佷娇鐢ㄩ渶姹傛柟韬唤銆? />
        <Alert severity="info">璇峰埌涓汉椤靛垏鎹负闇€姹傛柟銆?/Alert>
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="鍙戝竷" subtitle="濉啓绾︽媿闇€姹傦紝鏈嶅姟鏂逛細鍦ㄥぇ鍘呬腑鍝嶅簲銆? />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Paper component="form" variant="outlined" onSubmit={submit} sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <TextField label="鍦烘櫙" value={form.scene} onChange={event => setForm({ ...form, scene: event.target.value })} required />
          <TextField label="鍩庡競" value={form.cityCode} onChange={event => setForm({ ...form, cityCode: event.target.value })} required />
          <TextField label="鍦扮偣" value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} required />
          <TextField label="鏃ユ湡" value={form.expectedDate} onChange={event => setForm({ ...form, expectedDate: event.target.value })} placeholder="2026-06-01" inputProps={{ inputMode: 'numeric' }} />
          <TextField label="鏃堕棿娈? value={form.timeSlot} onChange={event => setForm({ ...form, timeSlot: event.target.value })} />
          <TextField label="椋庢牸鏍囩" value={form.styleTagsText} onChange={event => setForm({ ...form, styleTagsText: event.target.value })} />
          <TextField label="鏈€浣庨绠? type="number" value={form.budgetMinYuan} onChange={event => setForm({ ...form, budgetMinYuan: event.target.value })} />
          <TextField label="鏈€楂橀绠? type="number" value={form.budgetMaxYuan} onChange={event => setForm({ ...form, budgetMaxYuan: event.target.value })} />
          <TextField
            label="闇€姹傛弿杩?
            multiline
            minRows={4}
            value={form.description}
            onChange={event => setForm({ ...form, description: event.target.value })}
            sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}
          />
        </Box>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button type="submit" variant="contained" size="large">鍙戝竷闇€姹?/Button>
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
      setNotice({ type: 'success', text: '鍔ㄦ€佸凡鍙戝竷' })
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
      setNotice({ type: 'success', text: '鍔ㄦ€佸凡鍒犻櫎' })
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  function followAuthor(authorId) {
    toggleFollow(authorId)
    setNotice({ type: 'success', text: '鍏虫敞鍒楄〃宸叉洿鏂? })
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="鍔ㄦ€? subtitle="鎼滅储鍔ㄦ€佹爣棰樺拰鏂囨锛屽彂甯冨甫鏍囬銆佹枃妗堝拰鐓х墖鐨勫姩鎬併€? />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField
            fullWidth
            label="鎼滅储鍔ㄦ€?
            placeholder="杈撳叆鏍囬鎴栨枃妗?
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') loadMoments()
            }}
          />
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={loadMoments}>
            鎼滅储
          </Button>
          <Button variant="contained" startIcon={<PublishRoundedIcon />} onClick={() => setShowComposer(value => !value)}>
            鍙戝竷鍔ㄦ€?
          </Button>
        </Stack>
      </Paper>

      {showComposer && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <TextField
              label="鍔ㄦ€侀鐩?
              value={draft.title}
              onChange={event => setDraft({ ...draft, title: event.target.value })}
              required
            />
            <TextField
              label="鍔ㄦ€佹枃妗?
              multiline
              minRows={3}
              value={draft.content}
              onChange={event => setDraft({ ...draft, content: event.target.value })}
            />
            <TextField
              label="@"
              placeholder="杈撳叆鏄电О鎴栫紪鍙凤紝鐢ㄩ€楀彿鍒嗛殧"
              value={mentionsText}
              onChange={event => setMentionsText(event.target.value)}
              InputProps={{ startAdornment: <AlternateEmailRoundedIcon color="action" sx={{ mr: 1 }} /> }}
            />
            {imageData && <img className="feed-image" src={imageData} alt="寰呭彂甯冪収鐗? />}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
              <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                閫夋嫨鐓х墖
                <input hidden type="file" accept="image/*" onChange={chooseImage} />
              </Button>
              <Stack direction="row" spacing={1}>
                <Button variant="text" color="inherit" onClick={() => setShowComposer(false)}>鍙栨秷</Button>
                <Button variant="contained" onClick={publishMoment} disabled={!draft.title.trim()}>鍙戝竷</Button>
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
                alt="鍔ㄦ€佺収鐗?
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
                    {roleMap[moment.authorRole]?.slice(0, 1) || '鐢?}
                  </Avatar>
                  <Box sx={{ cursor: 'pointer' }} onClick={() => openUserProfile(moment.authorId)}>
                    <Typography fontWeight={800}>{roleMap[moment.authorRole] || '鐢ㄦ埛'} {moment.authorId}</Typography>
                    <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
                  </Box>
                </Stack>
                <Typography
                  variant="h6"
                  onClick={() => navigate(`/moments/${moment.momentId}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  {moment.title || '鏈懡鍚嶅姩鎬?}
                </Typography>
                <Typography>{moment.content || '鍒嗕韩浜嗕竴寮犵収鐗?}</Typography>
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
              <Typography color="text.secondary">{moment.likeCount} 涓禐</Typography>
              <Button size="small" onClick={() => favoriteMoment(moment.momentId)}>
                {moment.favoritedByCurrentUser ? '宸叉敹钘? : '鏀惰棌'} {moment.favoriteCount || 0}
              </Button>
              <Button size="small" onClick={() => followAuthor(moment.authorId)}>
                {isFollowing(moment.authorId) ? '宸插叧娉? : '鍏虫敞浣滆€?}
              </Button>
              <Button size="small" onClick={() => navigate(`/moments/${moment.momentId}`)}>璇︽儏</Button>
              {Number(moment.authorId) === currentUser.userId && (
                <Button size="small" color="error" startIcon={<DeleteRoundedIcon />} onClick={() => deleteMoment(moment.momentId)}>
                  鍒犻櫎
                </Button>
              )}
            </CardActions>
          </Card>
        ))}
      </Box>
      {!moments.length && <EmptyCard text="鏆傛棤鍔ㄦ€? />}
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
      if (!selected) setNotice({ type: 'warning', text: '璇ュ姩鎬佷笉瀛樺湪鎴栧凡琚垹闄わ紝鍏堝睍绀烘渶鏂板姩鎬併€? })
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
      setNotice({ type: 'success', text: '鍔ㄦ€佸凡鍒犻櫎' })
      navigate('/feed')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="鍔ㄦ€佽鎯? subtitle="鏌ョ湅瀹屾暣鍔ㄦ€侊紝缁х画涓嬫粦娴忚鏇村浜虹殑鍔ㄦ€佽鎯呫€? />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Button variant="text" color="inherit" onClick={() => navigate('/feed')} sx={{ alignSelf: 'flex-start' }}>杩斿洖鍔ㄦ€?/Button>
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
      {!moments.length && <EmptyCard text="鏆傛棤鍔ㄦ€? />}
    </Stack>
  )
}

function MomentDetailCard({ moment, currentUser, onProfile, onLike, onFavorite, onDelete }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={1.6}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Avatar onClick={onProfile} sx={{ cursor: 'pointer', bgcolor: moment.authorRole === 'PROVIDER' ? 'secondary.main' : 'primary.main' }}>
            {roleMap[moment.authorRole]?.slice(0, 1) || '鐢?}
          </Avatar>
          <Box onClick={onProfile} sx={{ cursor: 'pointer', minWidth: 0 }}>
            <Typography fontWeight={900}>{roleMap[moment.authorRole] || '鐢ㄦ埛'} {moment.authorId}</Typography>
            <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
          </Box>
        </Stack>
        <Typography variant="h5">{moment.title || '鏈懡鍚嶅姩鎬?}</Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{moment.content || '鍒嗕韩浜嗕竴寮犵収鐗?}</Typography>
        {moment.imageData && <img className="feed-image" src={moment.imageData} alt={moment.title || '鍔ㄦ€佺収鐗?} />}
        {!!moment.mentions?.length && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {moment.mentions.map(mention => <MentionChip key={mention} mention={mention} />)}
          </Stack>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button variant="outlined" startIcon={moment.likedByCurrentUser ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />} onClick={onLike}>
            {moment.likeCount || 0} 涓禐
          </Button>
          <Button variant="outlined" onClick={onFavorite}>
            {moment.favoritedByCurrentUser ? '宸叉敹钘? : '鏀惰棌'} {moment.favoriteCount || 0}
          </Button>
          {Number(moment.authorId) === currentUser.userId && (
            <Button variant="outlined" color="error" startIcon={<DeleteRoundedIcon />} onClick={onDelete}>
              鍒犻櫎
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
        setNotice({ type: 'warning', text: `${error.message} 宸插厛鏄剧ず鏈湴浼氳瘽璁板綍銆俙 })
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
      <SectionHeader title="浼氳瘽" subtitle="娑堟伅鍒楄〃椤靛彧灞曠ず瀵硅瘽鍏ュ彛锛岀偣鍑诲悗杩涘叆鍏蜂綋鑱婂ぉ妗嗐€? />
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
                  {conversation.scene?.slice(0, 1) || '浼?}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={800} noWrap>
                    {conversation.scene || `浼氳瘽 ${conversation.conversationId}`}
                  </Typography>
                  <Typography color="text.secondary" noWrap>
                    {conversation.lastMessage || `${roleMap[currentUser.role]}涓庣敤鎴?${oppositeId} 鐨勫璇漙}
                  </Typography>
                </Box>
                <Stack spacing={0.5} alignItems="flex-end">
                  <Typography variant="caption" color="text.secondary">{formatShortTime(conversation.updatedAt)}</Typography>
                  <Chip size="small" label={conversation.isLocal ? '寰呮帴鍚庣' : 'C鎺ュ彛'} />
                </Stack>
              </Box>
            )
          })}
          {!conversations.length && (
            <EmptyCard text={currentUser.role === 'PROVIDER' ? '鏆傛棤浼氳瘽銆傚埌闇€姹傚ぇ鍘呴€夋嫨鍏蜂綋闇€姹傚悗鍙戣捣閭€璇凤紝鎺ュ彈鍚庝細鍑虹幇鍦ㄨ繖閲屻€? : '鏆傛棤浼氳瘽銆傛帴鍙楁湇鍔℃柟閭€璇峰悗浼氬嚭鐜板湪杩欓噷銆?} />
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
  const [editingQuotationId, setEditingQuotationId] = useState(null)
  const [quoteValidationErrors, setQuoteValidationErrors] = useState([])
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
      await refreshConversationData(record)
    })
  }

  async function refreshConversationData(record = conversation) {
    if (!record || record.isLocal) return
    const [nextMessages, nextQuotes] = await Promise.all([
      conversationApi.messages(record.backendConversationId || record.conversationId, currentUser),
      conversationApi.quotes(record.backendConversationId || record.conversationId, currentUser)
    ])
    setMessages(nextMessages)
    setQuotes(nextQuotes)
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
        updateConversationLastMessage(conversation.conversationId, '[鍥剧墖]')
        setMessages(nextMessages)
        return
      }
      const sent = await run(async () => conversationApi.sendMessage(
        conversation.backendConversationId || conversation.conversationId,
        image,
        currentUser,
        'IMAGE'
      ), '鍥剧墖宸插彂閫?)
      if (sent) {
        updateConversationLastMessage(conversation.conversationId, '[鍥剧墖]')
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
      title: `${conversation.scene || '浼氳瘽'} 鎻愪氦鐓х墖`,
      imageData: message.content,
      authorId: message.senderId,
      createdAt: message.createdAt
    })
    setNotice({ type: 'success', text: '鐓х墖宸蹭繚瀛樺埌鎴戠殑鐓х墖' })
  }

  async function createQuote(event) {
    event.preventDefault()
    const validationErrors = validateQuoteForm(quoteForm, conversation, currentUser, quotes, { editingQuotationId })
    setQuoteValidationErrors(validationErrors)
    if (validationErrors.length) {
      setNotice({ type: 'warning', text: validationErrors[0] })
      return
    }
    const quotePayload = buildQuotePayload(quoteForm, conversation)
    const quote = await run(async () => editingQuotationId
      ? quoteApi.update(editingQuotationId, quotePayload, currentUser)
      : quoteApi.create(quotePayload, currentUser), editingQuotationId ? '鎶ヤ环宸叉洿鏂? : '鎶ヤ环宸插彂閫?)
    if (quote) {
      setShowQuoteForm(false)
      setEditingQuotationId(null)
      setQuoteValidationErrors([])
      setQuoteForm(createDefaultQuoteForm())
      await loadConversationData()
    }
  }

  function startQuoteEditing(quote) {
    setEditingQuotationId(quote.quotationId)
    setQuoteForm(createQuoteFormFromQuote(quote))
    setQuoteValidationErrors([])
    setShowQuoteForm(true)
    setNotice({ type: 'info', text: '姝ｅ湪缂栬緫寰呯‘璁ゆ姤浠凤紝淇濆瓨鍓嶅鎴蜂粛鐪嬪埌鍘熸姤浠枫€? })
  }

  function closeQuoteForm() {
    setShowQuoteForm(false)
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteForm(createDefaultQuoteForm())
  }

  async function confirmQuote(quote) {
    setLoading(true)
    setNotice(null)
    try {
      const result = await quoteApi.confirm(quote.quotationId, '闇€姹傛柟纭鎶ヤ环', currentUser)
      setNotice({ type: 'success', text: '鎶ヤ环宸茬‘璁わ紝璁㈠崟宸茬敓鎴? })
      if (result?.orderId) {
        await refreshConversationData()
        navigate(`/orders?orderId=${result.orderId}`)
      } else {
        await refreshConversationData()
        setNotice({ type: 'success', text: '鎶ヤ环宸茬‘璁わ紝鍙湪璁㈠崟椤垫煡鐪嬪叧鑱旇鍗曘€? })
      }
    } catch (error) {
      try {
        await refreshConversationData()
      } catch {
        // Keep the original quote confirmation error visible.
      }
      setNotice({ type: 'error', text: getQuoteConfirmationErrorText(error) })
    } finally {
      setLoading(false)
    }
  }

  async function rejectQuote(quote) {
    const result = await run(async () => quoteApi.reject(quote.quotationId, '鏈鏆備笉閲囩敤璇ユ姤浠?, currentUser), '鎶ヤ环宸叉嫆缁?)
    if (result) await loadConversationData()
  }

  const isBackendConversation = Boolean(conversation && !conversation.isLocal && getBackendConversationId(conversation))
  const isConversationProvider = conversation && currentUser.userId === Number(conversation.participantBId)
  const isConversationCustomer = conversation && currentUser.userId === Number(conversation.participantAId)
  const pendingQuote = hasPendingQuote(quotes)
  const editingQuote = editingQuotationId
    ? quotes.find(quote => String(quote.quotationId) === String(editingQuotationId))
    : null
  const canCreateQuote = conversation
    && currentUser.role === 'PROVIDER'
    && isConversationProvider
    && isBackendConversation
    && !pendingQuote
  const canEditSelectedQuote = editingQuote
    && canEditQuote(editingQuote, conversation, currentUser)
  const canSubmitQuoteForm = editingQuotationId ? canEditSelectedQuote : canCreateQuote
  const canConfirmQuote = conversation
    && currentUser.role === 'CUSTOMER'
    && isConversationCustomer
  const canSeeQuoteEntry = conversation && currentUser.role === 'PROVIDER' && isConversationProvider
  const quoteEntryHint = getQuoteEntryHint(conversation, currentUser, quotes)
  const sourceLabel = getConversationSourceLabel(conversation)
  const sourceHint = getConversationSourceHint(conversation)
  const sourceRows = buildConversationSourceRows(conversation, currentUser, sourceLabel)

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Button color="inherit" onClick={() => navigate('/messages')}>杩斿洖</Button>
            <Avatar
              onClick={() => conversation && openUserProfile(getOppositeUserId(conversation, currentUser.userId))}
              sx={{ bgcolor: conversation?.isLocal ? 'secondary.main' : 'primary.main', cursor: conversation ? 'pointer' : 'default' }}
            >
              {conversation?.scene?.slice(0, 1) || '浼?}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap>{conversation?.scene || `浼氳瘽 ${conversationId}`}</Typography>
              <Typography color="text.secondary" noWrap>
                {conversation?.location || '鍏蜂綋瀵硅瘽'} 路 瀵规柟 {conversation ? getOppositeUserId(conversation, currentUser.userId) : '-'}
              </Typography>
            </Box>
          </Stack>
          <Chip size="small" label={conversation?.isLocal ? '鏈湴瀵硅瘽' : 'C浼氳瘽'} />
        </Stack>
      </Paper>

      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      {conversation?.interfaceNote && <Alert severity="warning">{conversation.interfaceNote}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, bgcolor: '#fbfdff' }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
            <Box>
              <Typography variant="h6">浼氳瘽宸ヤ綔鍙?/Typography>
              <Typography color="text.secondary">杩欓噷鎵胯浇娌熼€氥€佹姤浠枫€佽鍗曞叆鍙ｅ拰鍚庣画灞ョ害鍗忎綔锛屼笉鏄櫘閫氱鑱娿€?/Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" color={isBackendConversation ? 'primary' : 'default'} label={isBackendConversation ? '鐪熷疄 C 浼氳瘽' : '鏈湴 fallback 浼氳瘽'} />
              <Chip size="small" label={currentUser.role === 'PROVIDER' ? '褰撳墠韬唤锛氭湇鍔℃柟' : '褰撳墠韬唤锛氶【瀹?} />
            </Stack>
          </Stack>
          <InfoRows rows={sourceRows} />
          <Alert severity="info">{sourceHint}</Alert>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, bgcolor: '#fffaf8' }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
            <Box>
              <Typography variant="h6">鎶ヤ环 / 璁㈠崟鍗忎綔鍖?/Typography>
              <Typography color="text.secondary">鏈嶅姟鏂瑰彂姝ｅ紡鎶ヤ环锛岄【瀹㈢‘璁ゅ悗鐢熸垚璁㈠崟锛屽啀杩涘叆鎵樼鍜屼氦浠樻祦绋嬨€?/Typography>
            </Box>
            {canSeeQuoteEntry && (
              <Button
                variant={showQuoteForm ? 'contained' : 'outlined'}
                startIcon={<LocalOfferRoundedIcon />}
                onClick={() => {
                  if (showQuoteForm && !editingQuotationId) {
                    closeQuoteForm()
                    return
                  }
                  setQuoteForm(createDefaultQuoteForm())
                  setEditingQuotationId(null)
                  setQuoteValidationErrors([])
                  setShowQuoteForm(true)
                }}
                disabled={!canCreateQuote}
              >
                鍙戣捣鎶ヤ环
              </Button>
            )}
          </Stack>

          {quoteEntryHint && canSeeQuoteEntry && <Alert severity={canCreateQuote ? 'info' : 'warning'}>{quoteEntryHint}</Alert>}

          {quotes.map(quote => {
            const orderId = getQuoteOrderId(quote)
            return (
              <Paper key={quote.quotationId} variant="outlined" sx={{ p: 1.6, bgcolor: '#fbfdff' }}>
                <Stack spacing={1.2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography fontWeight={900}>{centToYuan(quote.amountCent)}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        鎶ヤ环 ID {quote.quotationId} 路 {quote.quoteNo || '褰撳墠鎺ュ彛鏈繑鍥炴姤浠风紪鍙?}
                      </Typography>
                    </Box>
                    <Chip size="small" color={quote.status === 'PENDING_CONFIRM' ? 'warning' : quote.status === 'CONFIRMED' ? 'success' : 'default'} label={quoteStatusMap[quote.status] || quote.status} />
                  </Stack>
                  <InfoRows rows={[
                    ['鎷嶆憚鍦扮偣', quote.location || '鏈～鍐?],
                    ['鎷嶆憚寮€濮?, formatTime(quote.shootStartTime)],
                    ['鎷嶆憚缁撴潫', formatTime(quote.shootEndTime)],
                    ['鏈€鏅氫氦浠?, formatTime(quote.deliveryDeadline)],
                    ['鏈嶅姟鍐呭', quote.serviceContent || '鏈～鍐?],
                    ['鍘熺墖/绮句慨', `${quote.originalCount ?? 0} / ${quote.refinedCount ?? 0}`],
                    ['鐓х墖浣跨敤鑼冨洿', quote.photoUsageScope || '鏈～鍐?],
                    ['鏉℃', quote.terms || '褰撳墠鎶ヤ环鎺ュ彛鏈繑鍥炶瀛楁'],
                    ['鍚堝悓鏉℃', quote.contractTerms || '褰撳墠鎶ヤ环鎺ュ彛鏈繑鍥炶瀛楁'],
                    ['澶囨敞', quote.remark || '褰撳墠鎶ヤ环鎺ュ彛鏈繑鍥炶瀛楁']
                  ]} />
                  {quote.status === 'PENDING_CONFIRM' && canConfirmQuote && (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button size="small" variant="contained" onClick={() => confirmQuote(quote)}>纭鎶ヤ环</Button>
                      <Button size="small" variant="outlined" color="inherit" onClick={() => rejectQuote(quote)}>鎷掔粷鎶ヤ环</Button>
                    </Stack>
                  )}
                  {canEditQuote(quote, conversation, currentUser) && (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant={String(editingQuotationId) === String(quote.quotationId) ? 'contained' : 'outlined'}
                        startIcon={<LocalOfferRoundedIcon />}
                        onClick={() => startQuoteEditing(quote)}
                        disabled={loading}
                      >
                        {String(editingQuotationId) === String(quote.quotationId) ? '姝ｅ湪缂栬緫' : '缂栬緫鎶ヤ环'}
                      </Button>
                    </Stack>
                  )}
                  {quote.status === 'CONFIRMED' && (
                    orderId ? (
                      <Button size="small" variant="outlined" startIcon={<ReceiptLongRoundedIcon />} onClick={() => navigate(`/orders?orderId=${orderId}`)} sx={{ alignSelf: 'flex-start' }}>
                        鏌ョ湅璁㈠崟
                      </Button>
                    ) : (
                      <Alert severity="info">鎶ヤ环宸茬‘璁わ紝鍙湪璁㈠崟椤垫煡鐪嬪叧鑱旇鍗曪紱褰撳墠鎶ヤ环鍒楄〃鎺ュ彛鏈繑鍥?orderId銆?/Alert>
                    )
                  )}
                </Stack>
              </Paper>
            )
          })}
          {!quotes.length && <Typography color="text.secondary">褰撳墠浼氳瘽杩樻病鏈夋寮忔姤浠枫€?/Typography>}

          {showQuoteForm && canSeeQuoteEntry && (
            <Paper component="form" variant="outlined" onSubmit={createQuote} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
              <Stack spacing={1.5}>
                {editingQuotationId && (
                  <Alert severity="info">褰撳墠姝ｅ湪缂栬緫鎶ヤ环 {editingQuotationId}銆備粎寰呯‘璁ゆ姤浠峰彲缂栬緫锛涘鎴风‘璁ょ敓鎴愯鍗曞悗锛岃鍗曟牳蹇冩潯娆句細鍐荤粨銆?/Alert>
                )}
                {!!quoteValidationErrors.length && (
                  <Alert severity="warning">
                    <Stack spacing={0.5}>
                      {quoteValidationErrors.map(error => <Typography key={error} variant="body2">{error}</Typography>)}
                    </Stack>
                  </Alert>
                )}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                  <TextField label="鎶ヤ环閲戦" type="number" size="small" value={quoteForm.amountYuan} onChange={event => setQuoteForm({ ...quoteForm, amountYuan: event.target.value })} required />
                  <TextField label="鎷嶆憚鍦扮偣" size="small" value={quoteForm.location} onChange={event => setQuoteForm({ ...quoteForm, location: event.target.value })} required />
                  <TextField label="寮€濮嬫椂闂? type="datetime-local" size="small" value={quoteForm.shootStartTime} onChange={event => setQuoteForm({ ...quoteForm, shootStartTime: event.target.value })} InputLabelProps={{ shrink: true }} required />
                  <TextField label="缁撴潫鏃堕棿" type="datetime-local" size="small" value={quoteForm.shootEndTime} onChange={event => setQuoteForm({ ...quoteForm, shootEndTime: event.target.value })} InputLabelProps={{ shrink: true }} required />
                  <TextField label="浜や粯鎴" type="datetime-local" size="small" value={quoteForm.deliveryDeadline} onChange={event => setQuoteForm({ ...quoteForm, deliveryDeadline: event.target.value })} InputLabelProps={{ shrink: true }} required />
                  <TextField label="鍘熺墖鏁伴噺" type="number" size="small" value={quoteForm.originalCount} onChange={event => setQuoteForm({ ...quoteForm, originalCount: event.target.value })} />
                  <TextField label="绮句慨鏁伴噺" type="number" size="small" value={quoteForm.refinedCount} onChange={event => setQuoteForm({ ...quoteForm, refinedCount: event.target.value })} />
                  <TextField label="鐓х墖浣跨敤鑼冨洿" size="small" value={quoteForm.photoUsageScope} onChange={event => setQuoteForm({ ...quoteForm, photoUsageScope: event.target.value })} />
                  <TextField label="鏈嶅姟鍐呭" multiline minRows={2} size="small" value={quoteForm.serviceContent} onChange={event => setQuoteForm({ ...quoteForm, serviceContent: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} required />
                  <TextField label="鏉℃" multiline minRows={2} size="small" value={quoteForm.terms} onChange={event => setQuoteForm({ ...quoteForm, terms: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} />
                  <TextField label="鍚堝悓鏉℃" multiline minRows={2} size="small" value={quoteForm.contractTerms} onChange={event => setQuoteForm({ ...quoteForm, contractTerms: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} />
                  <TextField label="澶囨敞" multiline minRows={2} size="small" value={quoteForm.remark} onChange={event => setQuoteForm({ ...quoteForm, remark: event.target.value })} sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }} />
                </Box>
                <Alert severity="info">褰撳墠浼氳瘽鎺ュ彛鏈繑鍥炴槑纭。鏈熷紑濮?缁撴潫瀛楁锛屽洜姝ゆ湰杞棤娉曞仛妗ｆ湡鑼冨洿鏍￠獙锛屽彧鏍￠獙鎶ヤ环鏃堕棿椤哄簭銆?/Alert>
                <Stack direction="row" spacing={1}>
                  <Button type="submit" variant="contained" disabled={loading || !canSubmitQuoteForm}>
                    {editingQuotationId ? '淇濆瓨鎶ヤ环淇敼' : '鍙戦€佹姤浠?}
                  </Button>
                  <Button variant="text" color="inherit" onClick={closeQuoteForm}>鏀惰捣</Button>
                </Stack>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>

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
                        alt="浼氳瘽鍥剧墖"
                        sx={{ display: 'block', maxWidth: '100%', maxHeight: 260, borderRadius: 1, objectFit: 'cover' }}
                      />
                      {canSaveSubmittedPhoto && (
                        <Button size="small" variant="contained" color="inherit" onClick={() => saveSubmittedPhoto(message)}>
                          淇濆瓨鎻愪氦鐓х墖
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
          {!messages.length && <Typography color="text.secondary">杩樻病鏈夋秷鎭?/Typography>}
        </Stack>

        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" alignItems="center" spacing={1}>
          {canSeeQuoteEntry && (
            <Tooltip title="鍙戣捣鎶ヤ环">
              <span>
                <IconButton
                  color={showQuoteForm ? 'primary' : 'default'}
                  onClick={() => {
                    if (showQuoteForm && !editingQuotationId) {
                      closeQuoteForm()
                      return
                    }
                    setQuoteForm(createDefaultQuoteForm())
                    setEditingQuotationId(null)
                    setQuoteValidationErrors([])
                    setShowQuoteForm(true)
                  }}
                  disabled={!canCreateQuote}
                >
                  <LocalOfferRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title="鍙戦€佸浘鐗?>
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
            placeholder="杈撳叆娑堟伅"
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
            鍙戦€?
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
  const [deliveryRecords, setDeliveryRecords] = useState([])
  const [deliveryForm, setDeliveryForm] = useState({ file: null, remark: '' })
  const [reworkRequirement, setReworkRequirement] = useState('')
  const [photoAuthorizations, setPhotoAuthorizations] = useState([])
  const [photoAuthorizationForm, setPhotoAuthorizationForm] = useState({ fileIds: [], remark: '' })
  const [authorizationRemarks, setAuthorizationRemarks] = useState({})
  const [orderReviews, setOrderReviews] = useState([])
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: '娌熼€氶『鐣咃紝灞ョ害浣撻獙寰堝ソ銆? })
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [arbitrations, setArbitrations] = useState([])
  const [arbitrationForm, setArbitrationForm] = useState({
    reason: '璇勪环鍐呭涓嶅疄',
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
        currentUser.role === 'PROVIDER' ? demandApi.sentInvitations(currentUser).catch(() => []) : Promise.resolve([])
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
        setDeliveryRecords([])
        setPhotoAuthorizations([])
        setOrderReviews([])
        setArbitrations([])
      }
    })
  }

  async function openOrder(orderOrId, updateUrl = true) {
    const orderId = typeof orderOrId === 'object' ? orderOrId.orderId : orderOrId
    const detail = await orderApi.detail(orderId, currentUser)
    const logs = await orderApi.statusLogs(orderId, currentUser)
    const deliveries = await deliveryApi.listByOrder(orderId, currentUser)
    const authorizations = await photoAuthorizationApi.listByOrder(orderId, currentUser)
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
    setDeliveryRecords(deliveries)
    setDeliveryForm({ file: null, remark: '' })
    setReworkRequirement('')
    setPhotoAuthorizations(authorizations)
    setPhotoAuthorizationForm({ fileIds: [], remark: '' })
    setAuthorizationRemarks({})
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

  async function submitDelivery(event) {
    event.preventDefault()
    if (!selectedOrder || !deliveryForm.file) return
    const result = await run(async () => deliveryApi.upload(
      selectedOrder.orderId,
      deliveryForm.file,
      deliveryForm.remark.trim(),
      currentUser
    ), selectedOrder.status === 'REWORK_REQUIRED' ? '杩斾慨浜や粯宸蹭笂浼? : '浜や粯鏂囦欢宸蹭笂浼?)
    if (result) {
      setDeliveryForm({ file: null, remark: '' })
      await loadOrders(selectedOrder.orderId)
    }
  }

  async function submitRework(event) {
    event.preventDefault()
    if (!selectedOrder) return
    const trimmedRequirement = reworkRequirement.trim()
    if (!trimmedRequirement) {
      setNotice({ type: 'warning', text: '璇峰～鍐欒繑淇姹? })
      return
    }
    const result = await run(async () => orderApi.requestRework(
      selectedOrder.orderId,
      trimmedRequirement,
      currentUser
    ), '杩斾慨璇锋眰宸叉彁浜?)
    if (result) {
      setReworkRequirement('')
      await loadOrders(selectedOrder.orderId)
    }
  }

  async function cancelSelectedOrder(cancelAction) {
    if (!selectedOrder || !cancelAction) return
    if (!window.confirm(cancelAction.confirmText)) return
    const result = await run(async () => orderApi.cancel(
      selectedOrder.orderId,
      { reason: cancelAction.reason },
      currentUser
    ), cancelAction.successText)
    if (result) {
      await loadOrders(selectedOrder.orderId)
    }
  }

  async function submitPhotoAuthorizationRequest(event) {
    event.preventDefault()
    if (!selectedOrder || !photoAuthorizationForm.fileIds.length) return
    const result = await run(async () => photoAuthorizationApi.request(selectedOrder.orderId, {
      fileIds: photoAuthorizationForm.fileIds,
      remark: photoAuthorizationForm.remark.trim()
    }, currentUser), '鐓х墖灞曠ず鎺堟潈鐢宠宸插彂閫?)
    if (result) {
      setPhotoAuthorizationForm({ fileIds: [], remark: '' })
      setPhotoAuthorizations(await photoAuthorizationApi.listByOrder(selectedOrder.orderId, currentUser))
    }
  }

  async function handlePhotoAuthorizationDecision(authorization, decision) {
    if (!selectedOrder) return
    const remark = (authorizationRemarks[authorization.id] || '').trim()
    const action = decision === 'approve' ? photoAuthorizationApi.approve : photoAuthorizationApi.reject
    const successText = decision === 'approve' ? '宸插悓鎰忕収鐗囧睍绀烘巿鏉? : '宸叉嫆缁濈収鐗囧睍绀烘巿鏉?
    const result = await run(async () => action(authorization.id, { remark }, currentUser), successText)
    if (result) {
      setAuthorizationRemarks({ ...authorizationRemarks, [authorization.id]: '' })
      setPhotoAuthorizations(await photoAuthorizationApi.listByOrder(selectedOrder.orderId, currentUser))
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
    }, '璇勪环宸叉彁浜?)
    if (result) {
      setOrderReviews(mergeReviewLists([result], orderReviews, getLocalReviewsByOrder(selectedOrder.orderId)))
      setShowReviewForm(false)
      setReviewForm({ rating: 5, content: '娌熼€氶『鐣咃紝灞ョ害浣撻獙寰堝ソ銆? })
    }
  }

  async function submitArbitration(event) {
    event.preventDefault()
    if (!selectedOrder) return
    const reason = `${arbitrationForm.reason}${arbitrationForm.description.trim() ? `锛?{arbitrationForm.description.trim()}` : ''}`
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
    }, '浠茶鐢宠宸叉彁浜?)
    if (result) {
      setArbitrations(mergeComplaints([result], arbitrations, getArbitrationsByOrder(selectedOrder.orderId)))
      setShowArbitrationForm(false)
      setArbitrationForm({ reason: '璇勪环鍐呭涓嶅疄', description: '' })
    }
  }

  const action = selectedOrder ? getOrderAction(selectedOrder, currentUser) : null
  const quoteSnapshot = parseQuoteSnapshot(selectedOrder?.quoteSnapshotJson)
  const canUploadDelivery = selectedOrder && canProviderUploadDelivery(selectedOrder, currentUser)
  const canRequestRework = selectedOrder && canCustomerRequestRework(selectedOrder, currentUser)
  const canRequestPhotoAuthorization = selectedOrder && canProviderRequestPhotoAuthorization(selectedOrder, currentUser)
  const cancelAction = selectedOrder ? getCustomerCancelAction(selectedOrder, currentUser) : null
  const showShootStartedCancelNotice = selectedOrder
    && shouldShowShootStartedCancelNotice(selectedOrder, currentUser)
  const deliveryFileOptions = useMemo(() => {
    const map = new Map()
    deliveryRecords
      .filter(record => record.fileId)
      .forEach(record => {
        const fileId = Number(record.fileId)
        if (!map.has(fileId)) {
          map.set(fileId, {
            fileId,
            fileName: record.fileName || `鏂囦欢 ${fileId}`,
            uploadTime: record.uploadTime
          })
        }
      })
    return Array.from(map.values())
  }, [deliveryRecords])
  const deliveryFileNameMap = useMemo(() => new Map(
    deliveryFileOptions.map(file => [Number(file.fileId), file.fileName])
  ), [deliveryFileOptions])
  const latestDeliveryUploadTime = useMemo(() => getLatestDeliveryUploadTime(deliveryRecords), [deliveryRecords])
  const estimatedAutoConfirmTime = latestDeliveryUploadTime ? addDays(latestDeliveryUploadTime, 7) : null
  const fulfillmentNotice = selectedOrder
    ? getOrderFulfillmentNotice(selectedOrder, statusLogs, deliveryRecords, latestDeliveryUploadTime, estimatedAutoConfirmTime)
    : null
  const canReviewSelectedOrder = selectedOrder?.status === 'COMPLETED' && isOrderParticipant(selectedOrder, currentUser.userId)
  const currentReviewDirection = selectedOrder ? getOrderReviewDirection(selectedOrder, currentUser.userId) : ''
  const myReview = orderReviews.find(review => Number(review.reviewerId) === currentUser.userId || review.direction === currentReviewDirection)
  const reviewToComplain = orderReviews.find(review => Number(review.targetUserId) === currentUser.userId && review.isVisible !== false)

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="璁㈠崟" subtitle="鏌ョ湅鎴愬崟璁㈠崟銆佸钩鍙版墭绠＄姸鎬佸拰姣忔鐘舵€佹祦杞棩蹇椼€? />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '350px 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, alignSelf: 'start' }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">鎴戠殑璁㈠崟</Typography>
              <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => loadOrders()} disabled={loading}>
                鍒锋柊
              </Button>
            </Stack>
            <FormControl size="small">
              <InputLabel>鐘舵€?/InputLabel>
              <Select label="鐘舵€? value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <MenuItem value="">鍏ㄩ儴</MenuItem>
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
                        <Typography fontWeight={800}>{order.orderNo || `璁㈠崟 ${order.orderId}`}</Typography>
                        <Chip size="small" label={orderStatusMap[order.status] || order.status} />
                      </Stack>
                      <Typography color="text.secondary">{centToYuan(order.amountCent)} 路 瀵规柟 {currentUser.role === 'CUSTOMER' ? order.providerUserId : order.customerId}</Typography>
                      <Typography color="text.secondary" variant="body2">{formatTime(order.updatedAt)}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {!orders.length && <EmptyCard text="鏆傛棤璁㈠崟" />}
            </Stack>
            {currentUser.role === 'PROVIDER' && (
              <>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">閭€璇风姸鎬?/Typography>
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
                              label={status === 'ACCEPTED' ? '宸叉帴鍙楋紝鍙湪浼氳瘽涓矡閫? : status === 'REJECTED' ? '宸茶濠夋嫆' : '寰呭鐞?}
                            />
                          </Stack>
                        </Stack>
                      </Paper>
                    )
                  })}
                  {!sentInvitations.length && <Typography color="text.secondary">杩樻病鏈夊彂璧疯繃閭€璇?/Typography>}
                </Stack>
              </>
            )}
          </Stack>
        </Paper>

        {!selectedOrder ? (
          <EmptyCard text="閫夋嫨璁㈠崟鏌ョ湅璇︽儏" />
        ) : (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">{selectedOrder.orderNo || `璁㈠崟 ${selectedOrder.orderId}`}</Typography>
                    <Typography color="text.secondary">鎶ヤ环 {selectedOrder.quoteId} 路 浼氳瘽 {selectedOrder.conversationId}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip color="primary" label={orderStatusMap[selectedOrder.status] || selectedOrder.status} />
                    <Chip color={selectedOrder.escrowStatus === 'HELD' ? 'success' : 'default'} label={escrowStatusMap[selectedOrder.escrowStatus] || selectedOrder.escrowStatus} />
                  </Stack>
                </Stack>
                <Divider />
                <InfoRows rows={[
                  ['閲戦', centToYuan(selectedOrder.amountCent)],
                  ['闇€姹傛柟', selectedOrder.customerId],
                  ['鏈嶅姟鏂?, selectedOrder.providerUserId],
                  ['鎷嶆憚鏃堕棿', `${formatTime(selectedOrder.shootStartTime)} 鑷?${formatTime(selectedOrder.shootEndTime)}`],
                  ['浜や粯鎴', formatTime(selectedOrder.deliveryDeadline)],
                  ['缁撶畻/閫€娆?, `${selectedOrder.settlementStatus || 'NOT_SETTLED'} / ${selectedOrder.refundStatus || 'NONE'}`]
                ]} />
                {fulfillmentNotice && (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography fontWeight={900}>{fulfillmentNotice.title}</Typography>
                          <Typography color="text.secondary" variant="body2">{fulfillmentNotice.description}</Typography>
                        </Box>
                        <Chip size="small" color={fulfillmentNotice.color} label={orderStatusMap[selectedOrder.status] || selectedOrder.status} />
                      </Stack>
                      <InfoRows rows={fulfillmentNotice.rows} />
                      {fulfillmentNotice.note && <Alert severity={fulfillmentNotice.severity}>{fulfillmentNotice.note}</Alert>}
                    </Stack>
                  </Paper>
                )}
                {quoteSnapshot && (
                  <>
                    <Divider />
                    <InfoRows rows={[
                      ['鎷嶆憚鍦扮偣', quoteSnapshot.location || '鏈～鍐?],
                      ['鏈嶅姟鍐呭', quoteSnapshot.serviceContent || '鏈～鍐?],
                      ['鍘熺墖/绮句慨', `${quoteSnapshot.originalCount || 0} / ${quoteSnapshot.refinedCount || 0}`],
                      ['鐓х墖鐢ㄩ€?, quoteSnapshot.photoUsageScope || '鏈～鍐?]
                    ]} />
                  </>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button variant="outlined" onClick={() => navigate(`/orders/${selectedOrder.orderId}/delivery`)}>
                    鏌ョ湅浜や粯
                  </Button>
                  <Button variant="outlined" onClick={() => navigate(`/orders/${selectedOrder.orderId}/reviews`)}>
                    D 绾胯瘎浠?
                  </Button>
                </Stack>
                {action && canShowOrderNormalActions(selectedOrder) ? (
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
                  <Chip icon={<TaskAltRoundedIcon />} label="褰撳墠娌℃湁鍙墽琛屾搷浣? sx={{ alignSelf: 'flex-start' }} />
                )}
                {cancelAction && (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fffaf8' }}>
                    <Stack spacing={1}>
                      <Typography fontWeight={900}>{cancelAction.title}</Typography>
                      <Typography color="text.secondary" variant="body2">{cancelAction.description}</Typography>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CloseRoundedIcon />}
                        onClick={() => cancelSelectedOrder(cancelAction)}
                        disabled={loading}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {cancelAction.label}
                      </Button>
                    </Stack>
                  </Paper>
                )}
                {showShootStartedCancelNotice && (
                  <Alert severity="warning">鎷嶆憚寮€濮嬪悗涓嶅彲鐩存帴鍙栨秷锛屽鏈変簤璁璧扮敵璇夋垨鑱旂郴骞冲彴澶勭悊銆?/Alert>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">浜や粯浣滃搧</Typography>
                    <Typography color="text.secondary">鎽勫奖甯堝繀椤婚€氳繃涓婁紶浜や粯鏂囦欢鎺ㄨ繘寰呯‘璁ょ姸鎬侊紝杩斾慨涔熶粠杩欓噷閲嶆柊涓婁紶銆?/Typography>
                  </Box>
                  {canUploadDelivery && (
                    <Chip color="secondary" label={selectedOrder.status === 'REWORK_REQUIRED' ? '鍙笂浼犺繑淇氦浠? : '鍙笂浼犱氦浠?} />
                  )}
                </Stack>

                {canUploadDelivery && (
                  <Paper component="form" variant="outlined" onSubmit={submitDelivery} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <Button variant="outlined" component="label" startIcon={<AddPhotoAlternateRoundedIcon />}>
                          閫夋嫨浜や粯鏂囦欢
                          <input
                            hidden
                            type="file"
                            onChange={event => setDeliveryForm({ ...deliveryForm, file: event.target.files?.[0] || null })}
                          />
                        </Button>
                        <Typography color="text.secondary" variant="body2">
                          {deliveryForm.file ? deliveryForm.file.name : '灏氭湭閫夋嫨鏂囦欢'}
                        </Typography>
                      </Stack>
                      <TextField
                        label="浜や粯璇存槑"
                        value={deliveryForm.remark}
                        onChange={event => setDeliveryForm({ ...deliveryForm, remark: event.target.value })}
                        multiline
                        minRows={2}
                        placeholder="璇存槑鏈浜や粯鍐呭銆佽繑淇慨鏀圭偣鎴栨敞鎰忎簨椤?
                      />
                      <Button type="submit" variant="contained" startIcon={<TaskAltRoundedIcon />} disabled={loading || !deliveryForm.file}>
                        涓婁紶浜や粯
                      </Button>
                    </Stack>
                  </Paper>
                )}

                {canRequestRework && (
                  <Paper component="form" variant="outlined" onSubmit={submitRework} sx={{ p: 1.5, bgcolor: '#fffaf0' }}>
                    <Stack spacing={1.5}>
                      <Typography fontWeight={800}>璇峰啓鍑哄悗缁繑淇姹?/Typography>
                      <TextField
                        label="杩斾慨瑕佹眰"
                        value={reworkRequirement}
                        onChange={event => setReworkRequirement(event.target.value)}
                        multiline
                        minRows={3}
                        placeholder="璇疯鏄庨渶瑕佽繑淇殑鐓х墖銆侀棶棰樺拰鏈熸湜淇敼鏂瑰悜"
                        required
                      />
                      <Button type="submit" variant="contained" color="warning" startIcon={<RefreshRoundedIcon />} disabled={loading}>
                        璇锋眰杩斾慨
                      </Button>
                    </Stack>
                  </Paper>
                )}

                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">浜や粯璁板綍</Typography>
                  {deliveryRecords.map(record => (
                    <Paper key={record.deliveryId || `${record.orderId}-${record.fileId}-${record.uploadTime}`} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                      <Stack spacing={0.7}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                          <Typography fontWeight={800}>
                            {record.fileName || `鏂囦欢 ${record.fileId || '-'}`}
                          </Typography>
                          <Chip size="small" label={`绗?${record.deliveryRound || 1} 娆′氦浠?{record.isLatest ? ' 路 鏈€鏂? : ''}`} />
                        </Stack>
                        <Typography color="text.secondary" variant="body2">
                          fileId {record.fileId || '-'} 路 {record.status || 'DELIVERED'} 路 {formatTime(record.uploadTime)}
                        </Typography>
                        <Typography>{record.remark || '鏃犱氦浠樿鏄?}</Typography>
                      </Stack>
                    </Paper>
                  ))}
                  {!deliveryRecords.length && <Typography color="text.secondary">鏆傛棤浜や粯璁板綍</Typography>}
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">鐓х墖灞曠ず鎺堟潈</Typography>
                    <Typography color="text.secondary">瀹㈡埛鍚屾剰鍚庯紝鎽勫奖甯堟墠鑳芥妸鏈鍗曚氦浠樼収鐗囦綔涓虹湡瀹炲鐗囧睍绀恒€?/Typography>
                  </Box>
                  {selectedOrder.status === 'COMPLETED' && (
                    <Chip color="success" label="璁㈠崟宸插畬鎴愶紝鍙鐞嗘巿鏉? />
                  )}
                </Stack>

                {canRequestPhotoAuthorization && (
                  <Paper component="form" variant="outlined" onSubmit={submitPhotoAuthorizationRequest} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <Typography fontWeight={800}>鍙戣捣灞曠ず鎺堟潈鐢宠</Typography>
                      {deliveryFileOptions.length ? (
                        <>
                          <FormControl size="small">
                            <InputLabel>閫夋嫨浜や粯鏂囦欢</InputLabel>
                            <Select
                              multiple
                              label="閫夋嫨浜や粯鏂囦欢"
                              value={photoAuthorizationForm.fileIds}
                              onChange={event => {
                                const value = event.target.value
                                setPhotoAuthorizationForm({
                                  ...photoAuthorizationForm,
                                  fileIds: (typeof value === 'string' ? value.split(',') : value).map(Number)
                                })
                              }}
                              renderValue={selected => selected
                                .map(fileId => deliveryFileNameMap.get(Number(fileId)) || `鏂囦欢 ${fileId}`)
                                .join('銆?)}
                            >
                              {deliveryFileOptions.map(file => (
                                <MenuItem key={file.fileId} value={file.fileId}>
                                  {file.fileName} 路 {formatTime(file.uploadTime)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <TextField
                            label="鐢宠璇存槑"
                            value={photoAuthorizationForm.remark}
                            onChange={event => setPhotoAuthorizationForm({ ...photoAuthorizationForm, remark: event.target.value })}
                            multiline
                            minRows={2}
                            placeholder="璇存槑甯屾湜灞曠ず杩欎簺鐓х墖鐨勭敤閫旓紝渚嬪浣滃搧闆嗗鐗囧睍绀?
                          />
                          <Button
                            type="submit"
                            variant="contained"
                            startIcon={<ImageRoundedIcon />}
                            disabled={loading || !photoAuthorizationForm.fileIds.length}
                          >
                            鍙戦€佹巿鏉冪敵璇?
                          </Button>
                        </>
                      ) : (
                        <Alert severity="info">鏆傛棤鍙巿鏉冧氦浠樻枃浠讹紝璇峰厛瀹屾垚浜や粯銆?/Alert>
                      )}
                    </Stack>
                  </Paper>
                )}

                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">鎺堟潈鐢宠璁板綍</Typography>
                  {photoAuthorizations.map(authorization => {
                    const canReviewAuthorization = canCustomerReviewPhotoAuthorization(selectedOrder, currentUser, authorization)
                    const statusLabel = PHOTO_AUTHORIZATION_STATUS_LABELS[authorization.status] || authorization.status
                    return (
                      <Paper key={authorization.id} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                        <Stack spacing={1}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Box>
                              <Typography fontWeight={800}>鎺堟潈鐢宠 {authorization.id}</Typography>
                              <Typography color="text.secondary" variant="body2">
                                鏈嶅姟鏂?{authorization.providerUserId} 路 瀹㈡埛 {authorization.customerId}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              color={authorization.status === 'GRANTED' ? 'success' : authorization.status === 'REJECTED' ? 'default' : 'warning'}
                              label={statusLabel}
                            />
                          </Stack>
                          <Typography color="text.secondary" variant="body2">
                            {authorization.status === 'GRANTED'
                              ? '鍙敤浜庝綔鍝侀泦'
                              : authorization.status === 'REJECTED'
                                ? '瀹㈡埛宸叉嫆缁?
                                : '绛夊緟瀹㈡埛纭'}
                            {authorization.authorizedAt ? ` 路 ${formatTime(authorization.authorizedAt)}` : ''}
                          </Typography>
                          <Typography>{authorization.remark || '鏃犲娉?}</Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {(authorization.files || []).map(file => (
                              <Chip
                                key={file.id || file.fileId}
                                size="small"
                                icon={<ImageRoundedIcon />}
                                label={deliveryFileNameMap.get(Number(file.fileId)) || `鏂囦欢 ${file.fileId}`}
                              />
                            ))}
                            {!(authorization.files || []).length && (
                              <Typography color="text.secondary" variant="body2">鏈繑鍥炴巿鏉冩枃浠朵俊鎭?/Typography>
                            )}
                          </Stack>

                          {canReviewAuthorization && (
                            <Stack spacing={1.2}>
                              <TextField
                                size="small"
                                label="澶勭悊澶囨敞锛堝彲閫夛級"
                                value={authorizationRemarks[authorization.id] || ''}
                                onChange={event => setAuthorizationRemarks({
                                  ...authorizationRemarks,
                                  [authorization.id]: event.target.value
                                })}
                              />
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Button
                                  variant="contained"
                                  color="success"
                                  startIcon={<CheckCircleRoundedIcon />}
                                  onClick={() => handlePhotoAuthorizationDecision(authorization, 'approve')}
                                  disabled={loading}
                                >
                                  鍚屾剰灞曠ず
                                </Button>
                                <Button
                                  variant="outlined"
                                  color="inherit"
                                  startIcon={<CloseRoundedIcon />}
                                  onClick={() => handlePhotoAuthorizationDecision(authorization, 'reject')}
                                  disabled={loading}
                                >
                                  鎷掔粷灞曠ず
                                </Button>
                              </Stack>
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    )
                  })}
                  {!photoAuthorizations.length && <Typography color="text.secondary">鏆傛棤鐓х墖鎺堟潈鐢宠</Typography>}
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">璇勪环涓庝徊瑁?/Typography>
                    <Typography color="text.secondary">璁㈠崟瀹屾垚鍚庡弻鏂归兘鍙互璇勪环锛涜璇勪环鏂瑰彲瀵逛笉瀹炶瘎浠峰彂璧锋姇璇変徊瑁併€?/Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {canReviewSelectedOrder && !myReview && (
                      <Button
                        variant={showReviewForm ? 'contained' : 'outlined'}
                        startIcon={<RateReviewRoundedIcon />}
                        onClick={() => setShowReviewForm(!showReviewForm)}
                      >
                        璇勪环
                      </Button>
                    )}
                    <Button
                      variant={showArbitrationForm ? 'contained' : 'outlined'}
                      color="inherit"
                      startIcon={<GavelRoundedIcon />}
                      onClick={() => setShowArbitrationForm(!showArbitrationForm)}
                      disabled={!reviewToComplain}
                    >
                      鐢宠浠茶
                    </Button>
                  </Stack>
                </Stack>

                {myReview && (
                  <Alert severity="success">浣犲凡璇勪环杩囪璁㈠崟锛屽彲浠ュ湪鍘嗗彶璇勪环涓煡鐪嬨€?/Alert>
                )}
                {!reviewToComplain && (
                  <Alert severity="info">鏀跺埌瀵规柟璇勪环鍚庯紝鎵嶅彲浠ュ璇ヨ瘎浠峰彂璧蜂徊瑁併€?/Alert>
                )}

                {showReviewForm && (
                  <Paper component="form" variant="outlined" onSubmit={submitReview} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Typography fontWeight={800}>璇勫垎</Typography>
                        <Rating
                          value={reviewForm.rating}
                          onChange={(_, value) => setReviewForm({ ...reviewForm, rating: value || 5 })}
                        />
                      </Stack>
                      <TextField
                        label="璇勪环鍐呭"
                        value={reviewForm.content}
                        onChange={event => setReviewForm({ ...reviewForm, content: event.target.value })}
                        multiline
                        minRows={2}
                        required
                      />
                      <Button type="submit" variant="contained" startIcon={<RateReviewRoundedIcon />} disabled={loading}>
                        鎻愪氦璇勪环
                      </Button>
                    </Stack>
                  </Paper>
                )}

                {showArbitrationForm && (
                  <Paper component="form" variant="outlined" onSubmit={submitArbitration} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <TextField
                        select
                        label="浠茶鍘熷洜"
                        value={arbitrationForm.reason}
                        onChange={event => setArbitrationForm({ ...arbitrationForm, reason: event.target.value })}
                      >
                        <MenuItem value="璇勪环鍐呭涓嶅疄">璇勪环鍐呭涓嶅疄</MenuItem>
                        <MenuItem value="璇勪环鍖呭惈鏀诲嚮鎬ц〃杩?>璇勪环鍖呭惈鏀诲嚮鎬ц〃杩?/MenuItem>
                        <MenuItem value="璇勪环涓庤鍗曟棤鍏?>璇勪环涓庤鍗曟棤鍏?/MenuItem>
                        <MenuItem value="鍏朵粬璇勪环浜夎">鍏朵粬璇勪环浜夎</MenuItem>
                      </TextField>
                      <TextField
                        label="琛ュ厖璇存槑"
                        value={arbitrationForm.description}
                        onChange={event => setArbitrationForm({ ...arbitrationForm, description: event.target.value })}
                        multiline
                        minRows={2}
                        required
                      />
                      <Button type="submit" variant="contained" color="warning" startIcon={<GavelRoundedIcon />}>
                        鎻愪氦浠茶璁板綍
                      </Button>
                    </Stack>
                  </Paper>
                )}

                <ReviewList reviews={orderReviews} emptyText="璇ヨ鍗曡繕娌℃湁璇勪环" />

                {arbitrations.length > 0 && (
                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">浠茶璁板綍</Typography>
                    {arbitrations.map(record => (
                      <Paper key={record.arbitrationId} variant="outlined" sx={{ p: 1.5, bgcolor: '#fffaf0' }}>
                        <Stack spacing={0.6}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Typography fontWeight={800}>{record.reason}</Typography>
                            <Chip size="small" color="warning" label={record.status === 'PENDING' ? '寰呭鐞? : record.status} />
                          </Stack>
                          <Typography>{record.description}</Typography>
                          <Typography color="text.secondary" variant="body2">
                            鐢宠浜?{record.applicantId} 路 琚敵璇蜂汉 {record.respondentId} 路 {formatTime(record.createdAt)}
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
                <Typography variant="h6">鐘舵€佹棩蹇?/Typography>
                {statusLogs.map(log => (
                  <Paper key={log.logId || `${log.orderId}-${log.createdAt}`} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography fontWeight={800}>
                          {orderStatusMap[log.fromStatus] || log.fromStatus || '鍒涘缓'} 鈫?{orderStatusMap[log.toStatus] || log.toStatus}
                        </Typography>
                        <Typography color="text.secondary">{log.reason || '鐘舵€佹祦杞?}</Typography>
                      </Box>
                      <Typography color="text.secondary" variant="body2">{formatTime(log.createdAt)}</Typography>
                    </Stack>
                  </Paper>
                ))}
                {!statusLogs.length && <Typography color="text.secondary">鏆傛棤鐘舵€佹棩蹇?/Typography>}
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
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const ratio = Math.min(200 / img.width, 200 / img.height, 1)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * ratio)
          canvas.height = Math.round(img.height * ratio)
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('鍥剧墖鍔犺浇澶辫触')) }
        img.src = url
      })
      setProfileForm({ ...profileForm, avatarData: compressed })
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
    setNotice({ type: 'success', text: '涓汉璧勬枡宸叉洿鏂? })
  }

  async function choosePortfolioImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imageData = await readFileAsDataUrl(file)
      const title = file.name?.replace(/\.[^.]+$/, '') || '浣滃搧鍥剧墖'
      const nextItems = addPortfolioItem(currentUser.userId, { title, imageData })
      setPortfolioItems(nextItems)
      setNotice({ type: 'success', text: '浣滃搧闆嗗浘鐗囧凡涓婁紶' })
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
      setNotice({ type: 'success', text: '宸叉殏涓嶆帴鍙楄閭€璇? })
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
    { key: 'photos', label: '鎴戠殑鐓х墖', icon: <ImageRoundedIcon /> },
    { key: 'follows', label: '鎴戠殑鍏虫敞', icon: <FavoriteRoundedIcon /> },
    { key: 'collections', label: '鎴戠殑鏀惰棌', icon: <FavoriteBorderRoundedIcon /> },
    { key: 'reviews', label: '鍘嗗彶璇勪环', icon: <HistoryRoundedIcon /> }
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
                <Typography color="text.secondary" variant="body2">浣滆€?{photo.authorId} 路 {formatShortTime(photo.createdAt)}</Typography>
                <Button
                  component="a"
                  href={photo.imageData}
                  download={`${photo.title || 'photo'}.png`}
                  size="small"
                  variant="outlined"
                >
                  涓嬭浇
                </Button>
              </Stack>
            </Paper>
          ))}
        </Box>
      ) : <EmptyCard text="杩樻病鏈変繚瀛樿繃鐓х墖" />
    }

    if (profileView === 'follows') {
      return follows.length ? (
        <Stack spacing={1}>
          {follows.map(follow => (
            <Paper key={follow.authorId} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1} onClick={() => navigate(`/users/${follow.authorId}`)} sx={{ cursor: 'pointer' }}>
                  <Avatar sx={{ width: 36, height: 36 }}>{String(follow.authorId).slice(0, 1)}</Avatar>
                  <Typography fontWeight={800}>鐢ㄦ埛 {follow.authorId}</Typography>
                </Stack>
                <Typography color="text.secondary" variant="body2">{formatShortTime(follow.followedAt)} 鍏虫敞</Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : <EmptyCard text="杩樻病鏈夊叧娉ㄤ换浣曚汉" />
    }

    if (profileView === 'collections') {
      return favoriteMoments.length ? (
        <Stack spacing={1.5}>
          {favoriteMoments.map(moment => (
            <Paper key={moment.momentId} variant="outlined" sx={{ p: 1.5, cursor: 'pointer' }} onClick={() => navigate(`/moments/${moment.momentId}`)}>
              <Stack spacing={0.7}>
                <Typography fontWeight={800}>{moment.title || '鏈懡鍚嶅姩鎬?}</Typography>
                <Typography>{moment.content || '鍒嗕韩浜嗕竴寮犵収鐗?}</Typography>
                <Typography color="text.secondary" variant="body2">
                  浣滆€?{moment.authorId} 路 {moment.favoriteCount || 0} 娆℃敹钘?
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : <EmptyCard text="杩樻病鏈夋敹钘忓姩鎬? />
    }

    if (profileView === 'reviews') {
      return (
        <Stack spacing={2}>
          <SectionHeader title="鍘嗗彶璇勪环" subtitle="杩欓噷灞曠ず鍒汉缁欎綘鐨勮鍗曡瘎浠枫€? />
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
              涓婁紶浣滃搧鍥剧墖
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
                    <img className="feed-image" src={work.imageData} alt={work.title || '浣滃搧鍥剧墖'} />
                    <Typography fontWeight={800}>{work.title || '浣滃搧鍥剧墖'}</Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          ) : <EmptyCard text="浣滃搧闆嗛噷杩樻病鏈夌収鐗囧姩鎬? />}
        </Stack>
      )
    }

    if (profileView === 'invitations') {
      if (currentUser.role !== 'CUSTOMER') {
        return <EmptyCard text="鍒囨崲鍒伴渶姹傛柟韬唤鍚庡彲浠ユ煡鐪嬫敹鍒扮殑閭€璇? />
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
                      <Typography fontWeight={800}>鏈嶅姟鏂?{invitation.providerId}</Typography>
                      <Typography color="text.secondary" noWrap>{invitation.demandScene}</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Chip size="small" label={centToYuan(invitation.expectedPriceCent)} />
                      <Chip size="small" color={isPending ? 'warning' : status === 'ACCEPTED' ? 'success' : 'default'} label={status === 'ACCEPTED' ? '宸叉帴鍙? : status === 'REJECTED' ? '宸插鎷? : '寰呭鐞?} />
                    </Stack>
                  </Stack>
                  <Typography>{invitation.message}</Typography>
                  <Typography color="text.secondary" variant="body2">{formatTime(invitation.createdAt)}</Typography>
                  {isPending && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant="contained" startIcon={<ChatRoundedIcon />} onClick={() => acceptInvitation(invitation)} disabled={busy}>
                        鎺ュ彈骞惰繘鍏ヤ細璇?
                      </Button>
                      <Button variant="outlined" color="inherit" onClick={() => rejectInvitation(invitation)} disabled={busy}>
                        鏆備笉鎺ュ彈
                      </Button>
                    </Stack>
                  )}
                  {status === 'ACCEPTED' && invitation.responseId && (
                    <Button variant="text" startIcon={<ChatRoundedIcon />} onClick={() => navigate('/messages')}>
                      鍘讳細璇濆垪琛?
                    </Button>
                  )}
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      ) : <EmptyCard text="杩樻病鏈夋湇鍔℃柟瀵逛綘鐨勯渶姹傚彂璧烽個璇? />
    }

    return null
  }

  const profileStats = buildProfileStats(currentUser.userId, receivedReviews, profileOrders)

  return (
    <Stack spacing={2.5}>
      <SectionHeader title="涓汉" subtitle="绠＄悊澶村儚鏄电О銆佽韩浠藉垏鎹㈠拰闇€姹傛柟涓汉鍏ュ彛銆? />
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
                label="鏄电О"
                value={profileForm.nickname}
                onChange={event => setProfileForm({ ...profileForm, nickname: event.target.value })}
              />
              <TextField
                label="绠€浠?
                multiline
                minRows={2}
                value={profileForm.bio}
                onChange={event => setProfileForm({ ...profileForm, bio: event.target.value })}
              />
              <TextField
                label="妗ｆ湡"
                value={profileForm.availability}
                onChange={event => setProfileForm({ ...profileForm, availability: event.target.value })}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                  鏇存崲澶村儚
                  <input hidden type="file" accept="image/*" onChange={chooseAvatar} />
                </Button>
                <Button variant="contained" onClick={saveProfile}>淇濆瓨璧勬枡</Button>
              </Stack>
            </Stack>
          </Stack>
          <Divider />
          <Box>
            <Typography fontWeight={800} sx={{ mb: 1 }}>鍒囨崲韬唤</Typography>
            <ToggleButtonGroup exclusive value={userKey} onChange={(_, value) => value && setUserKey(value)}>
              <ToggleButton value="customer">闇€姹傛柟</ToggleButton>
              <ToggleButton value="provider">鏈嶅姟鏂?/ToggleButton>
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
              璁㈠崟
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
                浣滃搧闆?
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
                閭€璇?
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
              閫€鍑虹櫥褰?
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Stack spacing={1.5}>
        <Typography variant="overline" color="text.secondary">鍔ㄦ€?/Typography>
        {myMoments.map(moment => (
          <Paper key={moment.momentId} variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={800} onClick={() => navigate(`/moments/${moment.momentId}`)} sx={{ cursor: 'pointer' }}>
                  {moment.title || '鏈懡鍚嶅姩鎬?}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography color="text.secondary" variant="body2">{formatShortTime(moment.createdAt)}</Typography>
                  <IconButton size="small" color="error" onClick={() => momentApi.delete(moment.momentId, currentUser).then(loadProfileData).catch(error => setNotice({ type: 'error', text: error.message }))}>
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
              <Typography>{moment.content || '鍒嗕韩浜嗕竴寮犵収鐗?}</Typography>
              {moment.imageData && <img className="feed-image" src={moment.imageData} alt={moment.title || '鍔ㄦ€佺収鐗?} onClick={() => navigate(`/moments/${moment.momentId}`)} style={{ cursor: 'pointer' }} />}
              <Typography color="text.secondary" variant="body2">
                {moment.likeCount || 0} 涓禐 路 {moment.favoriteCount || 0} 娆℃敹钘?
              </Typography>
            </Stack>
          </Paper>
        ))}
        {!myMoments.length && <EmptyCard text="杩樻病鏈夊彂甯冭繃鍔ㄦ€? />}
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
    setNotice({ type: 'success', text: isFollowing(profileUserId) ? '宸插叧娉? : '宸插彇娑堝叧娉? })
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
              {profile.nickname?.slice(0, 1) || roleMap[role]?.slice(0, 1) || '鐢?}
            </Avatar>
            <ProfileMetrics stats={profileStats} compact />
          </Stack>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5">{profile.nickname}</Typography>
            <Typography color="text.secondary">{roleMap[role] || '鐢ㄦ埛'} {profileUserId} 路 鍔ㄦ€?{userMoments.length}{role === 'PROVIDER' ? ` 路 浣滃搧 ${works.length}` : ''}</Typography>
            <Typography sx={{ mt: 1 }}>{profile.bio}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>妗ｆ湡锛歿profile.availability}</Typography>
          </Box>
          <Stack direction={{ xs: 'row', sm: 'column' }} spacing={1}>
            <Button variant={isFollowing(profileUserId) ? 'contained' : 'outlined'} onClick={follow}>
              {isFollowing(profileUserId) ? '宸插叧娉? : '鍏虫敞'}
            </Button>
            <Button variant={showReviews ? 'contained' : 'outlined'} startIcon={<HistoryRoundedIcon />} onClick={() => setShowReviews(!showReviews)}>
              鍘嗗彶璇勪环
            </Button>
          </Stack>
        </Stack>
      </Paper>
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      {showReviews && (
        <Stack spacing={2}>
          <SectionHeader title="鍘嗗彶璇勪环" subtitle="杩欎釜鐢ㄦ埛鏀跺埌杩囩殑璁㈠崟璇勪环銆? />
          <ReviewList reviews={receivedReviews} />
        </Stack>
      )}

      {role === 'PROVIDER' && (
        <>
          <SectionHeader title="浣滃搧闆? subtitle="鏌ョ湅杩欎釜鐢ㄦ埛鍏紑鍙戝竷杩囩殑鐓х墖鍔ㄦ€併€? />
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
                <img className="feed-image" src={work.imageData} alt={work.title || '浣滃搧鍥剧墖'} />
                <Typography fontWeight={800}>{work.title || '浣滃搧鍥剧墖'}</Typography>
              </Stack>
            </Paper>
          ))}
        </Box>
          ) : <EmptyCard text="杩樻病鏈夊叕寮€浣滃搧" />}
        </>
      )}

      <SectionHeader title="鍔ㄦ€? subtitle="鐐瑰嚮鍔ㄦ€佽繘鍏ヨ鎯呴〉缁х画娴忚銆? />
      <Stack spacing={1.5}>
        {userMoments.map(moment => (
          <Paper key={moment.momentId} variant="outlined" sx={{ p: 1.5, cursor: 'pointer' }} onClick={() => navigate(`/moments/${moment.momentId}`)}>
            <Stack spacing={0.7}>
              <Typography fontWeight={800}>{moment.title || '鏈懡鍚嶅姩鎬?}</Typography>
              <Typography>{moment.content || '鍒嗕韩浜嗕竴寮犵収鐗?}</Typography>
              <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
            </Stack>
          </Paper>
        ))}
        {!userMoments.length && <EmptyCard text="杩樻病鏈夊叕寮€鍔ㄦ€? />}
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
    location: '鍗椾含澶у榧撴ゼ鏍″尯',
    serviceContent: '2 灏忔椂鏍″洯绾︽媿锛屽寘鍚矡閫氥€佹媿鎽勩€佸熀纭€璋冭壊鍜岀簿淇氦浠樸€?,
    originalCount: 60,
    refinedCount: 12,
    photoUsageScope: 'PERSONAL_ONLY',
    terms: 'P4 婕旂ず鎶ヤ环',
    contractTerms: '纭鎶ヤ环鍚庣敓鎴愯鍗曪紝妯℃嫙鏀粯鍚庤祫閲戣繘鍏ュ钩鍙版墭绠°€?,
    remark: '鍙牴鎹ぉ姘斿井璋冩媿鎽勬椂闂淬€?
  }
}

function buildQuotePayload(form, conversation) {
  return {
    conversationId: conversation.backendConversationId || Number(conversation.conversationId),
    amountCent: yuanToCent(form.amountYuan),
    shootStartTime: form.shootStartTime,
    shootEndTime: form.shootEndTime,
    location: form.location,
    serviceContent: form.serviceContent,
    originalCount: Number(form.originalCount || 0),
    refinedCount: Number(form.refinedCount || 0),
    deliveryDeadline: form.deliveryDeadline,
    photoUsageScope: form.photoUsageScope,
    terms: form.terms,
    contractTerms: form.contractTerms,
    safetyNoticeVersion: 'P4-DEMO',
    remark: form.remark
  }
}

function createQuoteFormFromQuote(quote) {
  return {
    amountYuan: quote.amountCent ? Number(quote.amountCent) / 100 : '',
    shootStartTime: toDateTimeInputValue(quote.shootStartTime),
    shootEndTime: toDateTimeInputValue(quote.shootEndTime),
    deliveryDeadline: toDateTimeInputValue(quote.deliveryDeadline),
    location: quote.location || '',
    serviceContent: quote.serviceContent || '',
    originalCount: quote.originalCount ?? 0,
    refinedCount: quote.refinedCount ?? 0,
    photoUsageScope: quote.photoUsageScope || 'PERSONAL_ONLY',
    terms: quote.terms || '',
    contractTerms: quote.contractTerms || '',
    remark: quote.remark || ''
  }
}

function toDateTimeInput(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toDateTimeInputValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 16)
  return toDateTimeInput(new Date(value))
}

function parseQuoteSnapshot(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getBackendConversationId(conversation) {
  const value = conversation?.backendConversationId || conversation?.conversationId
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function getConversationSourceLabel(conversation) {
  const sourceType = conversation?.sourceType
  if (!sourceType) return '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'
  if (sourceType === 'DEMAND_RESPONSE') return '闇€姹傚ぇ鍘呮矡閫?
  if (sourceType === 'SERVICE_PACKAGE') return '鏈嶅姟姗辩獥棰勮娌熼€?
  if (sourceType.includes('SCHEDULE')) return '妗ｆ湡棰勭害娌熼€?
  return sourceType
}

function buildConversationSourceRows(conversation, currentUser, sourceLabel) {
  const rows = [
    ['浼氳瘽 ID', conversation?.conversationId || '鏈姞杞?],
    ['鍚庣 conversationId', getBackendConversationId(conversation) || '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'],
    ['瀵规柟鐢ㄦ埛 ID', conversation ? getOppositeUserId(conversation, currentUser.userId) : '鏈姞杞?],
    ['鏉ユ簮绫诲瀷', conversation?.sourceType || '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'],
    ['涓氬姟鏉ユ簮', sourceLabel]
  ]

  if (conversation?.sourceType === 'DEMAND_RESPONSE') {
    rows.push(['鍝嶅簲 ID', conversation.sourceId || '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'])
    rows.push(['闇€姹?ID', conversation.demandId || '褰撳墠鎺ュ彛鏈繑鍥?])
    return rows
  }

  if (conversation?.sourceType === 'SERVICE_PACKAGE') {
    rows.push(['鏈嶅姟姗辩獥 ID', conversation.sourceId || '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'])
    rows.push(['妗ｆ湡 ID', conversation.scheduleId || '褰撳墠鎺ュ彛鏈繑鍥?])
    return rows
  }

  rows.push(['鏉ユ簮 ID', conversation?.sourceId || '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'])
  rows.push(['闇€姹?ID', conversation?.demandId || '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'])
  rows.push(['鏈嶅姟姗辩獥 ID', conversation?.servicePackageId || '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'])
  rows.push(['妗ｆ湡 ID', conversation?.scheduleId || '褰撳墠鎺ュ彛鏈繑鍥炶瀛楁'])
  return rows
}

function getConversationSourceHint(conversation) {
  if (!conversation) return '浼氳瘽浠嶅湪鍔犺浇銆?
  if (conversation.isLocal) {
    return '褰撳墠鏄湰鍦?fallback 浼氳瘽锛屽彧鑳借亰澶╂紨绀猴紝涓嶈兘鍒涘缓鐪熷疄鎶ヤ环鎴栬鍗曘€?
  }
  if (conversation.sourceType === 'DEMAND_RESPONSE') {
    return '璇ヤ細璇濇潵鑷渶姹傚ぇ鍘呭搷搴旀帴鍙楋紝鍚庣画搴斿湪杩欓噷娌熼€氥€佹姤浠峰苟鐢熸垚鎵樼璁㈠崟銆?
  }
  if (conversation.sourceType === 'SERVICE_PACKAGE') {
    return '璇ヤ細璇濇潵鑷湇鍔℃┍绐楀挩璇㈡垨棰勭害鎰忓悜锛涘綋鍓嶅墠绔彧灞曠ず鏉ユ簮锛屼笉瀹炵幇姗辩獥棰勮銆侀攣妗ｆ湡鎴栦粯娆俱€?
  }
  return '褰撳墠鏉ユ簮绫诲瀷涓嶅睘浜庡凡鏄庣‘鐨勯渶姹傚ぇ鍘呮垨鏈嶅姟姗辩獥娴佺▼锛屾湰杞彧鍋氬睍绀猴紝涓嶆柊澧炰笟鍔″姩浣溿€?
}

function getQuoteOrderId(quote) {
  return quote?.orderId || quote?.order?.orderId || quote?.confirmedOrderId || null
}

function canEditQuote(quote, conversation, currentUser) {
  return Boolean(quote)
    && quote.status === 'PENDING_CONFIRM'
    && !getQuoteOrderId(quote)
    && currentUser?.role === 'PROVIDER'
    && Number(currentUser.userId) === Number(conversation?.participantBId)
    && Number(currentUser.userId) === Number(quote.providerUserId)
}

function hasPendingQuote(quotes) {
  return quotes.some(quote => quote.status === 'PENDING_CONFIRM')
}

function getQuoteEntryHint(conversation, currentUser, quotes) {
  if (!conversation) return ''
  if (currentUser.role !== 'PROVIDER') return ''
  if (currentUser.userId !== Number(conversation.participantBId)) {
    return '鍙湁璇ヤ細璇濈殑鏈嶅姟鏂瑰彲浠ュ彂璧锋寮忔姤浠枫€?
  }
  if (conversation.isLocal || !getBackendConversationId(conversation)) {
    return '褰撳墠涓嶆槸鍚庣鐪熷疄浼氳瘽锛屼笉鑳界敓鎴愭姤浠枫€?
  }
  if (hasPendingQuote(quotes)) {
    return '宸叉湁寰呯‘璁ゆ姤浠凤紝闇€瀹㈡埛纭鎴栨嫆缁濆悗鍐嶅彂鏂版姤浠枫€?
  }
  return '鍙互鍩轰簬鏈娌熼€氬彂璧锋寮忔姤浠凤紝椤惧纭鍚庝細鐢熸垚璁㈠崟銆?
}

function validateQuoteForm(form, conversation, currentUser, quotes, options = {}) {
  const errors = []
  const editingQuotationId = options.editingQuotationId
  if (!conversation || conversation.isLocal || !getBackendConversationId(conversation)) {
    errors.push('褰撳墠浼氳瘽蹇呴』鏄湡瀹炲悗绔細璇濓紝鎵嶈兘鍙戣捣鎶ヤ环銆?)
  }
  if (currentUser.role !== 'PROVIDER' || currentUser.userId !== Number(conversation?.participantBId)) {
    errors.push('鍙湁璇ヤ細璇濈殑鏈嶅姟鏂瑰彲浠ュ彂璧锋姤浠枫€?)
  }
  const hasOtherPendingQuote = quotes.some(quote =>
    quote.status === 'PENDING_CONFIRM'
    && (!editingQuotationId || String(quote.quotationId) !== String(editingQuotationId))
  )
  if (hasOtherPendingQuote) {
    errors.push('宸叉湁寰呯‘璁ゆ姤浠凤紝闇€瀹㈡埛纭鎴栨嫆缁濆悗鍐嶅彂鏂版姤浠枫€?)
  }

  const amountCent = yuanToCent(form.amountYuan)
  if (!hasAtMostTwoDecimalPlaces(form.amountYuan)) {
    errors.push('閲戦鏈€澶氫繚鐣欎袱浣嶅皬鏁般€?)
  }
  if (!Number.isInteger(amountCent) || amountCent <= 0) {
    errors.push('鎶ヤ环閲戦蹇呴』澶т簬 0锛屼笖杞崲鎴愬垎鍚庡繀椤绘槸鏈夋晥鏁存暟銆?)
  }

  const shootStart = parseInputDate(form.shootStartTime)
  const shootEnd = parseInputDate(form.shootEndTime)
  const deliveryDeadline = parseInputDate(form.deliveryDeadline)
  const now = new Date()
  if (!shootStart) errors.push('鎷嶆憚寮€濮嬫椂闂村繀濉€?)
  if (!shootEnd) errors.push('鎷嶆憚缁撴潫鏃堕棿蹇呭～銆?)
  if (!deliveryDeadline) errors.push('鏈€鏅氫氦浠樻椂闂村繀濉€?)
  if (shootStart && shootStart <= now) {
    errors.push('鎷嶆憚寮€濮嬫椂闂村繀椤绘櫄浜庡綋鍓嶆椂闂淬€?)
  }
  if (shootStart && shootEnd && shootEnd <= shootStart) {
    errors.push('鎷嶆憚缁撴潫鏃堕棿蹇呴』鏅氫簬鎷嶆憚寮€濮嬫椂闂淬€?)
  }
  if (shootEnd && deliveryDeadline && deliveryDeadline <= shootEnd) {
    errors.push('鏈€鏅氫氦浠樻椂闂村繀椤绘櫄浜庢媿鎽勭粨鏉熸椂闂淬€?)
  }

  if (!String(form.location || '').trim()) {
    errors.push('鎷嶆憚鍦扮偣涓嶈兘涓虹┖銆?)
  }
  if (!String(form.serviceContent || '').trim()) {
    errors.push('鏈嶅姟鍐呭涓嶈兘涓虹┖銆?)
  }
  if (!isNonNegativeInteger(form.originalCount)) {
    errors.push('鍘熺墖鏁伴噺蹇呴』鏄潪璐熸暣鏁般€?)
  }
  if (!isNonNegativeInteger(form.refinedCount)) {
    errors.push('绮句慨鏁伴噺蹇呴』鏄潪璐熸暣鏁般€?)
  }

  if (conversation?.scheduleStartTime && conversation?.scheduleEndTime && shootStart && shootEnd) {
    const scheduleStart = parseInputDate(conversation.scheduleStartTime)
    const scheduleEnd = parseInputDate(conversation.scheduleEndTime)
    if (scheduleStart && scheduleEnd && (shootStart < scheduleStart || shootEnd > scheduleEnd)) {
      errors.push('鎷嶆憚鏃堕棿蹇呴』钀藉湪璇ヤ細璇濇槑纭繑鍥炵殑妗ｆ湡鑼冨洿鍐呫€?)
    }
  }
  return errors
}

function getQuoteConfirmationErrorText(error) {
  const message = error?.message || ''
  if (message.includes('Quote has expired')) {
    return '璇ユ姤浠峰凡杩囨湡锛岃鎽勫奖甯堥噸鏂板彂璧锋姤浠枫€?
  }
  if (message.includes('Provider already has an active order in this shoot time range')) {
    return '璇ユ憚褰卞笀鍦ㄦ墍閫夋媿鎽勬椂闂村凡鏈夎鍗曪紝璇烽噸鏂板崗鍟嗘椂闂淬€?
  }
  return message || '鎶ヤ环纭澶辫触'
}

function hasAtMostTwoDecimalPlaces(value) {
  const text = String(value ?? '').trim()
  return /^\d+(\.\d{1,2})?$/.test(text)
}

function parseInputDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isNonNegativeInteger(value) {
  if (value === '' || value === null || value === undefined) return true
  const number = Number(value)
  return Number.isInteger(number) && number >= 0
}

function getOrderAction(order, currentUser) {
  const isProvider = Number(order.providerUserId) === currentUser.userId
  if (canCustomerPay(order, currentUser)) {
    return {
      kind: 'pay',
      label: '妯℃嫙鏀粯',
      icon: <PaidRoundedIcon />,
      allowed: true,
      successText: '妯℃嫙鏀粯鎴愬姛锛岃祫閲戝凡杩涘叆骞冲彴鎵樼'
    }
  }
  if (order.status === 'PAID_PENDING_SHOOT') {
    return {
      kind: 'transition',
      targetStatus: 'SHOOTING',
      label: '寮€濮嬫媿鎽?,
      icon: <CheckCircleRoundedIcon />,
      allowed: isProvider,
      reason: '鏈嶅姟鏂瑰紑濮嬫媿鎽?,
      successText: '璁㈠崟宸茶繘鍏ユ媿鎽勪腑'
    }
  }
  if (order.status === 'SHOOTING') {
    return {
      kind: 'transition',
      targetStatus: 'PENDING_DELIVERY',
      label: '杩涘叆寰呬氦浠?,
      icon: <TaskAltRoundedIcon />,
      allowed: isProvider,
      reason: '鎷嶆憚瀹屾垚锛岃繘鍏ュ緟浜や粯',
      successText: '璁㈠崟宸茶繘鍏ュ緟浜や粯'
    }
  }
  if (canCustomerConfirm(order, currentUser)) {
    return {
      kind: 'transition',
      targetStatus: 'COMPLETED',
      label: '纭瀹屾垚',
      icon: <CheckCircleRoundedIcon />,
      allowed: true,
      reason: '闇€姹傛柟纭瀹屾垚',
      successText: '璁㈠崟宸插畬鎴?
    }
  }
  return null
}

function getCustomerCancelAction(order, currentUser) {
  if (!isOrderCustomer(order, currentUser)) return null
  if (order.status === 'PENDING_PAYMENT') {
    return {
      label: '鍙栨秷寰呮敮浠樿鍗?,
      title: '鍙栨秷寰呮敮浠樿鍗?,
      description: '璇ヨ鍗曞皻鏈敮浠橈紝鍙栨秷鍚庤鍗曠粨鏉燂紝涓嶆秹鍙婇€€娆俱€?,
      confirmText: '纭畾鍙栨秷杩欎釜寰呮敮浠樿鍗曞悧锛熻鎿嶄綔涓嶆秹鍙婇€€娆俱€?,
      reason: '瀹㈡埛鍙栨秷鏈敮浠樿鍗?,
      successText: '寰呮敮浠樿鍗曞凡鍙栨秷'
    }
  }
  if (order.status === 'PAID_PENDING_SHOOT' && isBeforeShootStart(order)) {
    return {
      label: '鍙栨秷骞剁敵璇烽€€娆?,
      title: '鎷嶆憚鍓嶅彇娑堝苟閫€娆?,
      description: '璁㈠崟宸叉敮浠樹笖鎷嶆憚灏氭湭寮€濮嬶紝鍙栨秷鍚庡钩鍙版墭绠¤祫閲戝皢閫€鍥炲鎴枫€?,
      confirmText: '纭畾鍙栨秷璁㈠崟骞剁敵璇烽€€娆惧悧锛熷钩鍙版墭绠¤祫閲戝皢閫€鍥炲鎴枫€?,
      reason: '瀹㈡埛鎷嶆憚鍓嶅彇娑堬紝鐢宠閫€鍥炴墭绠℃',
      successText: '璁㈠崟宸插彇娑堬紝閫€娆剧姸鎬佸凡鏇存柊'
    }
  }
  return null
}

function shouldShowShootStartedCancelNotice(order, currentUser) {
  return isOrderCustomer(order, currentUser)
    && order.status === 'PAID_PENDING_SHOOT'
    && !isBeforeShootStart(order)
}

function isOrderCustomer(order, currentUser) {
  return Boolean(order)
    && Boolean(currentUser)
    && Number(order.customerId) === Number(currentUser.userId)
}

function isBeforeShootStart(order) {
  const shootStartTime = parseInputDate(order?.shootStartTime)
  return Boolean(shootStartTime) && new Date() < shootStartTime
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
    reason: record.reason || '璇勪环浜夎',
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
  if (direction === 'CUSTOMER_TO_PROVIDER') return '闇€姹傛柟璇勪环鏈嶅姟鏂?
  if (direction === 'PROVIDER_TO_CUSTOMER') return '鏈嶅姟鏂硅瘎浠烽渶姹傛柟'
  return '璁㈠崟璇勪环'
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
    scene: meta.scene || previous?.scene || `闇€姹?${meta.demandId || conversation.sourceId || ''}`,
    location: meta.location || previous?.location || '',
    lastMessage: meta.lastMessage || previous?.lastMessage || '鐐瑰嚮杩涘叆瀵硅瘽',
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
      scene: previous?.scene || `浼氳瘽 ${conversationId}`,
      location: previous?.location || '',
      lastMessage: previous?.lastMessage || (conversation.lastMessageTime ? '鏈€杩戞湁鏂版秷鎭? : '鐐瑰嚮杩涘叆瀵硅瘽')
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
    scene: `浼氳瘽 ${conversationId}`,
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
  const nickname = stored.nickname || demoUser?.nickname || `${roleMap[inferredRole] || '鐢ㄦ埛'} ${id}`
  const bio = stored.bio || stored.description || demoUser?.bio || demoUser?.description || '杩欎釜浜鸿繕娌℃湁濉啓绠€浠嬨€?
  return {
    userId: id,
    role: inferredRole,
    nickname,
    avatarData: stored.avatarData || demoUser?.avatarData || '',
    bio,
    description: bio,
    availability: stored.availability || demoUser?.availability || '鏆傛湭濉啓妗ｆ湡'
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
    title: item.title || '浣滃搧鍥剧墖',
    imageData: item.imageData,
    createdAt: item.createdAt
  }))
  const momentWorks = moments
    .filter(moment => Number(moment.authorId) === Number(userId) && moment.imageData)
    .map(moment => ({
      key: `moment-${moment.momentId}`,
      momentId: moment.momentId,
      title: moment.title || '鍔ㄦ€佷綔鍝?,
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
    .split(/[,\n锛孿s]+/)
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
    <Stack className="portra-section-header" spacing={0.5}>
      <Typography className="portra-section-kicker" variant="overline">PORTRA / CAMERA</Typography>
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
          {rating ? rating.toFixed(1) : '鏆傛棤璇勫垎'}
        </Typography>
      </Stack>
      {rating ? (
        <Rating value={rating} precision={0.1} readOnly size="small" />
      ) : (
        <Typography color="text.secondary" variant="body2">绛夊緟棣栨潯璇勪环</Typography>
      )}
      <Chip
        size="small"
        color={completionRate === null ? 'default' : completionRate >= 80 ? 'success' : 'warning'}
        label={`瀹屾垚鐜?${completionRate === null ? '鏆傛棤' : `${completionRate}%`}`}
      />
    </Stack>
  )
}

function ReviewList({ reviews, emptyText = '鏆傛棤鍘嗗彶璇勪环' }) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  return reviews.length ? (
    <Stack spacing={1.2}>
      {reviews.map(review => {
        const canOpenOrder = [review.reviewerId, review.targetUserId].some(userId => Number(userId) === Number(currentUser.userId))
        return (
        <Paper
          key={review.reviewId || `${review.orderId}-${review.direction}-${review.createdAt}`}
          variant="outlined"
          role={canOpenOrder ? 'button' : undefined}
          tabIndex={canOpenOrder ? 0 : undefined}
          onClick={canOpenOrder ? () => navigate(`/orders?orderId=${review.orderId}`) : undefined}
          onKeyDown={canOpenOrder ? event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              navigate(`/orders?orderId=${review.orderId}`)
            }
          } : undefined}
          sx={{ p: 1.5, bgcolor: '#fbfdff', cursor: canOpenOrder ? 'pointer' : 'default' }}
        >
          <Stack spacing={0.8}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Typography fontWeight={800}>{directionLabel(review.direction)} 路 璁㈠崟 {review.orderId}</Typography>
              <Typography color="text.secondary" variant="body2">{formatTime(review.createdAt)}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Rating value={Number(review.rating || 0)} readOnly size="small" />
              <Typography fontWeight={800}>{Number(review.rating || 0).toFixed(1)}</Typography>
            </Stack>
            <Typography>{review.content || '瀵规柟娌℃湁鐣欎笅鏂囧瓧璇勪环'}</Typography>
            <Typography color="text.secondary" variant="body2">
              璇勪环浜?{review.reviewerId} 路 琚瘎浠蜂汉 {review.targetUserId}
            </Typography>
          </Stack>
        </Paper>
      )})}
    </Stack>
  ) : <EmptyCard text={emptyText} />
}

function formatTime(value) {
  if (!value) return '鍒氬垰'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function getLatestDeliveryUploadTime(records) {
  const latestTimestamp = records
    .map(record => new Date(record.uploadTime).getTime())
    .filter(timestamp => Number.isFinite(timestamp))
    .reduce((latest, timestamp) => Math.max(latest, timestamp), 0)
  return latestTimestamp ? new Date(latestTimestamp) : null
}

function getOrderFulfillmentNotice(order, statusLogs, deliveryRecords, latestDeliveryUploadTime, estimatedAutoConfirmTime) {
  const status = order.status
  const baseRows = [
    ['鎵樼鐘舵€?, escrowStatusMap[order.escrowStatus] || order.escrowStatus || '褰撳墠鎺ュ彛鏈繑鍥?],
    ['缁撶畻鐘舵€?, settlementStatusMap[order.settlementStatus] || order.settlementStatus || '褰撳墠鎺ュ彛鏈繑鍥?]
  ]
  const latestReworkLog = getLatestStatusLog(statusLogs, 'REWORK_REQUIRED')
  const latestCompletedLog = getLatestStatusLog(statusLogs, 'COMPLETED')

  if (status === 'PENDING_PAYMENT') {
    return {
      title: '绛夊緟瀹㈡埛鏀粯',
      description: '瀹㈡埛鏀粯鍚庯紝璧勯噾杩涘叆骞冲彴鎵樼锛岃鍗曞啀杩涘叆寰呮媿鎽勫饱绾﹂樁娈点€?,
      color: 'warning',
      severity: 'info',
      rows: [
        ['璁㈠崟閲戦', centToYuan(order.amountCent)],
        ...baseRows
      ],
      note: '褰撳墠鏀粯鍏ュ彛璋冪敤鍚庣妯℃嫙鏀粯鎺ュ彛锛涙湭鏀粯鍓嶄笉搴旇繘鍏ユ媿鎽勬垨浜や粯銆?
    }
  }

  if (status === 'PAID_PENDING_SHOOT') {
    return {
      title: '宸叉敮浠橈紝绛夊緟鎷嶆憚',
      description: '骞冲彴鎵樼璧勯噾宸插缓绔嬶紝鍙屾柟搴旀寜鎶ヤ环绾﹀畾鐨勬媿鎽勬椂闂村饱绾︺€?,
      color: 'info',
      severity: 'warning',
      rows: [
        ['鎷嶆憚寮€濮?, formatTimeOrMissing(order.shootStartTime)],
        ['鎷嶆憚缁撴潫', formatTimeOrMissing(order.shootEndTime)],
        ...baseRows
      ],
      note: '褰撳墠鐘舵€佹帹杩涚敱鍚庣鐘舵€佹帴鍙ｅ畬鎴愶紱鎸夋媿鎽勬椂闂磋嚜鍔ㄦ帹杩涗粛寰呭悗绔畾鏃朵换鍔℃垨鎺ュ彛鎺ュ叆銆?
    }
  }

  if (status === 'SHOOTING') {
    return {
      title: '鎷嶆憚涓?,
      description: '璁㈠崟澶勪簬鎷嶆憚灞ョ害闃舵锛屾媿鎽勫畬鎴愬悗鎵嶈繘鍏ュ緟浜や粯銆?,
      color: 'info',
      severity: 'warning',
      rows: [
        ['鎷嶆憚寮€濮?, formatTimeOrMissing(order.shootStartTime)],
        ['鎷嶆憚缁撴潫', formatTimeOrMissing(order.shootEndTime)],
        ...baseRows
      ],
      note: '褰撳墠鐘舵€佹帹杩涚敱鍚庣鐘舵€佹帴鍙ｅ畬鎴愶紱鎸夋媿鎽勬椂闂磋嚜鍔ㄦ帹杩涗粛寰呭悗绔畾鏃朵换鍔℃垨鎺ュ彛鎺ュ叆銆?
    }
  }

  if (status === 'PENDING_DELIVERY') {
    return {
      title: '绛夊緟鏈嶅姟鏂逛笂浼犱綔鍝?,
      description: '鎽勫奖甯堥渶閫氳繃浜や粯鍏ュ彛涓婁紶浣滃搧锛屼笂浼犳垚鍔熷悗璁㈠崟杩涘叆寰呭鎴风‘璁ゃ€?,
      color: 'secondary',
      severity: 'info',
      rows: [
        ['鏈€鏅氫氦浠樻椂闂?, formatTimeOrMissing(order.deliveryDeadline)],
        ['宸叉湁浜や粯璁板綍', `${deliveryRecords.length} 鏉],
        ...baseRows
      ],
      note: '瓒呮椂鏈氦浠橀€€娆捐鍒欏緟鍚庣鎺ュ彛纭/鎺ュ叆锛涘墠绔湰杞笉浼氳Е鍙戦€€娆俱€?
    }
  }

  if (status === 'DELIVERED_PENDING_CONFIRM') {
    return {
      title: '宸蹭氦浠橈紝绛夊緟瀹㈡埛纭',
      description: '瀹㈡埛闇€纭鎺ユ敹浣滃搧锛屾垨鎻愪氦杩斾慨瑕佹眰锛涙湭澶勭悊鏃剁敱鍚庣鑷姩纭浠诲姟澶勭悊銆?,
      color: 'primary',
      severity: latestDeliveryUploadTime ? 'info' : 'warning',
      rows: [
        ['鏈€鏂颁氦浠樻椂闂?, formatTimeOrMissing(latestDeliveryUploadTime)],
        ['棰勮鑷姩纭鏃堕棿', estimatedAutoConfirmTime ? formatTime(estimatedAutoConfirmTime) : '褰撳墠鎺ュ彛鏈繑鍥炲彲闈犱氦浠樻椂闂?],
        ['浜や粯璁板綍', `${deliveryRecords.length} 鏉],
        ...baseRows
      ],
      note: '鎽勫奖甯堝凡浜や粯浣滃搧銆傚鎴烽渶鍦ㄤ氦浠樺悗 7 澶╁唴纭鎺ユ敹鎴栨彁浜よ繑淇姹傦紱鑻?7 澶╁唴鏈鐞嗭紝绯荤粺灏嗚嚜鍔ㄧ‘璁よ鍗曞畬鎴愬苟閲婃斁鎵樼璧勯噾銆傚墠绔粎灞曠ず瑙勫垯锛屼笉妯℃嫙鑷姩纭銆?
    }
  }

  if (status === 'REWORK_REQUIRED') {
    return {
      title: '杩斾慨涓?,
      description: '瀹㈡埛宸叉彁浜よ繑淇姹傦紝绛夊緟鏈嶅姟鏂归噸鏂颁笂浼犱綔鍝併€?,
      color: 'warning',
      severity: 'warning',
      rows: [
        ['鏈€杩戣繑淇姹?, latestReworkLog?.reason || latestReworkLog?.remark || '褰撳墠鎺ュ彛鏈繑鍥?],
        ['杩斾慨鐘舵€佹椂闂?, formatTimeOrMissing(latestReworkLog?.createdAt)],
        ['宸叉湁浜や粯璁板綍', `${deliveryRecords.length} 鏉],
        ...baseRows
      ],
      note: '鏈嶅姟鏂瑰繀椤婚€氳繃浜や粯鍏ュ彛閲嶆柊涓婁紶浣滃搧锛涢〉闈笉浼氭彁渚涚粫杩囦笂浼犵殑杩斾慨瀹屾垚鎸夐挳銆?
    }
  }

  if (status === 'COMPLETED') {
    return {
      title: '璁㈠崟宸插畬鎴?,
      description: '璁㈠崟瀹屾垚鍚庯紝鎵樼璧勯噾搴旈噴鏀剧粰鏈嶅姟鏂癸紝骞惰繘鍏ョ粨绠楀畬鎴愮姸鎬併€?,
      color: 'success',
      severity: 'success',
      rows: [
        ['瀹屾垚璁板綍鏃堕棿', formatTimeOrMissing(latestCompletedLog?.createdAt || order.completeTime)],
        ['鑷姩纭鏃堕棿', formatTimeOrMissing(order.autoConfirmTime)],
        ...baseRows
      ],
      note: '瀹屾垚鍚庣殑璇勪环鍏ュ彛鍜岀収鐗囨巿鏉冨叆鍙ｅ湪涓嬫柟灞曠ず锛涜嫢璁㈠崟鐢?7 澶╄鍒欒嚜鍔ㄧ‘璁わ紝鍙€氳繃鐘舵€佹棩蹇楁煡鐪嬬郴缁熷畬鎴愯褰曘€?
    }
  }

  if (status === 'APPEALING') {
    return {
      title: '璁㈠崟鐢宠瘔涓?,
      description: '璁㈠崟澶勪簬浜夎澶勭悊闃舵锛屾甯稿饱绾﹀姩浣滃簲鏆傚仠銆?,
      color: 'error',
      severity: 'warning',
      rows: baseRows,
      note: '鐢宠瘔/浠茶缁撴灉銆侀€€娆炬垨缁撶畻瑁佸畾浠嶅緟鍚庣姝ｅ紡鎺ュ彛鎺ュ叆锛屾湰杞笉鍋囧疄鐜般€?
    }
  }

  if (status === 'REFUNDED' || status === 'CANCELLED') {
    return {
      title: status === 'REFUNDED' ? '璁㈠崟宸查€€娆? : '璁㈠崟宸插彇娑?,
      description: '璁㈠崟宸茬粨鏉燂紝涓嶅啀灞曠ず姝ｅ父灞ョ害鍔ㄤ綔銆?,
      color: 'default',
      severity: 'info',
      rows: [
        ['閫€娆剧姸鎬?, order.refundStatus || '褰撳墠鎺ュ彛鏈繑鍥?],
        ...baseRows
      ],
      note: '閫€娆?鍙栨秷鍚庣殑鍚庣画澶勭悊浠ョ姸鎬佹棩蹇楀拰鍚庣杩斿洖涓哄噯銆?
    }
  }

  return {
    title: '璁㈠崟灞ョ害鐘舵€?,
    description: '褰撳墠鐘舵€佹殏鏃犱笓闂ㄦ彁绀恒€?,
    color: 'default',
    severity: 'info',
    rows: baseRows,
    note: ''
  }
}

function getLatestStatusLog(statusLogs, targetStatus) {
  return statusLogs
    .filter(log => (log.toStatus || log.targetStatus || log.status) === targetStatus)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
}

function formatTimeOrMissing(value) {
  return value ? formatTime(value) : '褰撳墠鎺ュ彛鏈繑鍥?
}

function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
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
    RegisterPage,
}

export default App

