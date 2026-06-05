import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import WorkRoundedIcon from '@mui/icons-material/WorkRounded'
import { useAuth } from '../../AuthContext.jsx'
import {
  centToYuan,
  conversationApi,
  creditApi,
  demandApi,
  momentApi,
  orderApi,
  readFileAsDataUrl,
  reviewApi
} from '../../api.js'
import { EmptyCard } from './components/EmptyCard.jsx'
import { PortfolioGrid } from './components/PortfolioGrid.jsx'
import { ProfileMetrics } from './components/ProfileMetrics.jsx'
import { ProfileSectionHeader } from './components/ProfileSectionHeader.jsx'
import { ReviewList } from './components/ReviewList.jsx'
import {
  addPortfolioItem,
  buildPortfolioWorks,
  buildProfileStats,
  formatShortTime,
  formatTime,
  getLocalReviewsByTarget,
  getOrderSnapshotsForUser,
  isApiUnavailable,
  mergeReviewLists,
  readFollows,
  readPortfolioItems,
  readSavedPhotos,
  saveConversationRecord,
  saveOrderSnapshots,
  saveUserProfile
} from './utils/profileUtils.js'

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
    img.src = url
  })
}

export function ProfilePage() {
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
      const avatarData = await imageFileToDataUrl(file)
      setProfileForm(prev => ({ ...prev, avatarData }))
      updateProfile({ avatarData })
      setNotice({ type: 'success', text: '头像已更新' })
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
          <ProfileSectionHeader title="历史评价" subtitle="这里展示别人给你的订单评价。" />
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
          <PortfolioGrid works={works} emptyText="作品集里还没有照片动态" onOpenMoment={momentId => navigate(`/moments/${momentId}`)} />
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
      <ProfileSectionHeader title="个人" subtitle="管理头像昵称、身份切换和需求方个人入口。" />
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
