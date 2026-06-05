import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress,
  Divider, LinearProgress, Paper, Rating, Stack, Typography
} from '@mui/material'
import MaleIcon from '@mui/icons-material/Male'
import FemaleIcon from '@mui/icons-material/Female'
import ChatRoundedIcon from '@mui/icons-material/ChatRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAlt'
import { useAuth } from '../../AuthContext.jsx'
import { fileApi, momentApi, reviewApi, userApi } from '../../api.js'
import { ReviewList } from './components/ReviewList.jsx'
import {
  formatTime,
  getLocalReviewsByTarget,
  getUserProfile,
  isApiUnavailable,
  mergeReviewLists,
  readUserProfiles,
  roleMap,
  toggleFollow as toggleFollowLocal,
} from './utils/profileUtils.js'

function StatItem({ label, value }) {
  return (
    <Stack alignItems="center" spacing={0.3}>
      <Typography fontWeight={800} variant="h6" lineHeight={1}>{value ?? '—'}</Typography>
      <Typography color="text.secondary" variant="caption">{label}</Typography>
    </Stack>
  )
}

function GenderIcon({ gender }) {
  if (gender === 'MALE') return <MaleIcon sx={{ color: '#1976d2', fontSize: 22 }} />
  if (gender === 'FEMALE') return <FemaleIcon sx={{ color: '#e91e63', fontSize: 22 }} />
  return null
}

export function PublicProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const profileUserId = Number(userId)

  const [publicProfile, setPublicProfile] = useState(null)
  const [moments, setMoments] = useState([])
  const [reviews, setReviews] = useState([])
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [followedByMe, setFollowedByMe] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [profileResult, momentsResult, reviewsResult] = await Promise.allSettled([
        userApi.publicProfile(profileUserId, currentUser),
        momentApi.list({}, currentUser),
        reviewApi.listByUser(profileUserId, currentUser)
      ])
      if (cancelled) return

      if (profileResult.status === 'fulfilled' && profileResult.value) {
        setPublicProfile(profileResult.value)
        setFollowedByMe(Boolean(profileResult.value.followedByCurrentUser))
      } else if (profileResult.status === 'rejected' && !isApiUnavailable(profileResult.reason)) {
        setNotice({ type: 'warning', text: '无法加载完整资料，显示本地缓存数据' })
      }

      const allMoments = momentsResult.status === 'fulfilled' ? momentsResult.value : []
      setMoments(allMoments.filter(m => Number(m.authorId) === profileUserId))

      const remoteReviews = reviewsResult.status === 'fulfilled' ? reviewsResult.value : []
      setReviews(mergeReviewLists(remoteReviews, getLocalReviewsByTarget(profileUserId)))

      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [profileUserId, currentUser.userId])

  useEffect(() => {
    if (!publicProfile?.avatarFileId) return
    let url = ''
    let cancelled = false
    fileApi.downloadObjectUrl(publicProfile.avatarFileId, currentUser)
      .then(u => { if (!cancelled) { url = u; setAvatarUrl(u) } })
      .catch(() => {})
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [publicProfile?.avatarFileId])

  async function toggleFollow() {
    setFollowLoading(true)
    try {
      if (followedByMe) {
        await userApi.unfollow(profileUserId, currentUser)
        setFollowedByMe(false)
        toggleFollowLocal(profileUserId)
      } else {
        await userApi.follow(profileUserId, currentUser)
        setFollowedByMe(true)
        toggleFollowLocal(profileUserId)
      }
      setNotice(null)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
    setFollowLoading(false)
  }

  if (profileUserId === currentUser.userId) return <Navigate to="/profile" replace />

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  // Fallback to local cache if API unavailable
  const storedProfile = readUserProfiles()[String(profileUserId)] || {}
  const role = publicProfile?.currentRole || storedProfile.role || 'CUSTOMER'
  const isProvider = role === 'PROVIDER'
  const pp = publicProfile?.providerProfile || {}
  const nickname = publicProfile?.nickname || storedProfile.nickname || `用户${profileUserId}`
  const gender = publicProfile?.gender
  const avatarSrc = avatarUrl || publicProfile?.avatarData || storedProfile.avatarData || undefined
  const bio = publicProfile?.bio || storedProfile.bio || ''
  const school = publicProfile?.school || ''
  const creditScore = publicProfile?.creditScore ?? null

  const userMomentImages = moments.flatMap(m => m.imageData ? [{ imageData: m.imageData, momentId: m.momentId }] : [])
  const providerReviews = reviews.filter(r => r.direction === 'CUSTOMER_TO_PROVIDER')
  const customerReviews = reviews.filter(r => r.direction === 'PROVIDER_TO_CUSTOMER')
  const shownReviews = isProvider ? providerReviews : customerReviews

  const styleTags = (() => {
    const raw = pp.styleTags
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    return String(raw).split(',').map(s => s.trim()).filter(Boolean)
  })()

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 1, sm: 0 }, pb: 4 }}>
      <Stack spacing={2}>
        {notice && <Alert severity={notice.type} onClose={() => setNotice(null)}>{notice.text}</Alert>}

        {/* ─── 顶部信息卡 ─── */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: '#fff' }}>
          <Stack spacing={2} alignItems="center">
            <Avatar
              src={avatarSrc}
              sx={{ width: 96, height: 96, bgcolor: isProvider ? 'secondary.main' : 'primary.main', fontSize: 36 }}
            >
              {nickname.slice(0, 1)}
            </Avatar>

            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="h5" fontWeight={800}>{nickname}</Typography>
              <GenderIcon gender={gender} />
            </Stack>

            {isProvider ? (
              <>
                <Typography color="text.secondary" variant="body2">
                  {[pp.cityArea, pp.serviceType].filter(Boolean).join(' · ') || roleMap['PROVIDER']}
                </Typography>
                {(pp.priceMin != null || pp.priceMax != null) && (
                  <Typography color="primary.main" fontWeight={800}>
                    ¥{pp.priceMin ?? '?'} ~ ¥{pp.priceMax ?? '?'} 元/次
                  </Typography>
                )}
                <Chip
                  size="small"
                  label={pp.acceptingOrders ? '接单中' : '暂停接单'}
                  sx={{
                    bgcolor: pp.acceptingOrders ? '#e8f5e9' : '#f5f5f5',
                    color: pp.acceptingOrders ? '#2e7d32' : '#757575',
                    fontWeight: 700
                  }}
                />
                <Stack direction="row" spacing={4} justifyContent="center" sx={{ width: '100%', pt: 1 }}>
                  <StatItem label="完成订单" value={pp.completedOrders} />
                  <StatItem label="平均评分" value={pp.avgRating != null ? `${Number(pp.avgRating).toFixed(1)} ★` : null} />
                  <StatItem label="粉丝" value={publicProfile?.followerCount} />
                  <StatItem label="关注" value={publicProfile?.followingCount} />
                </Stack>
              </>
            ) : (
              <>
                {school && <Typography color="text.secondary" variant="body2">{school}</Typography>}
                {bio && <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>{bio}</Typography>}
                {creditScore != null && (
                  <Box sx={{ width: '100%', px: 1 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={700}>信用分</Typography>
                      <Typography variant="body2" fontWeight={700} color="primary">{creditScore}</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(creditScore, 100)}
                      sx={{ height: 8, borderRadius: 4, bgcolor: '#e0e0e0' }}
                    />
                  </Box>
                )}
                <Stack direction="row" spacing={4} justifyContent="center" sx={{ pt: 1 }}>
                  <StatItem label="动态" value={publicProfile?.momentCount ?? moments.length} />
                  <StatItem label="粉丝" value={publicProfile?.followerCount} />
                  <StatItem label="关注" value={publicProfile?.followingCount} />
                </Stack>
              </>
            )}

            {/* 操作按钮 */}
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
              <Button
                variant="outlined"
                size="small"
                startIcon={<ChatRoundedIcon />}
                onClick={() => navigate('/messages')}
              >
                发消息
              </Button>
              <Button
                variant={followedByMe ? 'contained' : 'outlined'}
                size="small"
                startIcon={followedByMe ? <PersonRemoveRoundedIcon /> : <PersonAddRoundedIcon />}
                onClick={toggleFollow}
                disabled={followLoading}
              >
                {followedByMe ? '已关注' : '关注'}
              </Button>
              {isProvider && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CameraAltRoundedIcon />}
                  onClick={() => navigate('/publish')}
                >
                  约拍
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        {/* ─── 摄影师详情区 ─── */}
        {isProvider && (bio || pp.equipment || styleTags.length > 0) && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              {bio && (
                <Box>
                  <Typography fontWeight={700} variant="body2" sx={{ mb: 0.5 }}>简介</Typography>
                  <Typography color="text.secondary" variant="body2">{bio}</Typography>
                </Box>
              )}
              {pp.equipment && (
                <Box>
                  <Typography fontWeight={700} variant="body2" sx={{ mb: 0.5 }}>设备</Typography>
                  <Typography color="text.secondary" variant="body2">{pp.equipment}</Typography>
                </Box>
              )}
              {styleTags.length > 0 && (
                <Box>
                  <Typography fontWeight={700} variant="body2" sx={{ mb: 0.5 }}>风格标签</Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {styleTags.map(tag => (
                      <Chip key={tag} label={tag} size="small" sx={{ mb: 0.5 }} />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Paper>
        )}

        {/* ─── 作品集 / 照片网格 ─── */}
        {userMomentImages.length > 0 && (
          <Box>
            <Typography fontWeight={700} sx={{ mb: 1 }}>{'TA 的动态'}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
              {userMomentImages.map(({ imageData, momentId }) => (
                <Box
                  key={momentId}
                  component="img"
                  src={imageData}
                  alt="作品"
                  onClick={() => navigate(`/moments/${momentId}`)}
                  sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', cursor: 'pointer', borderRadius: 1 }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* ─── 评价列表 ─── */}
        {shownReviews.length > 0 && (
          <Box>
            <Typography fontWeight={700} sx={{ mb: 1 }}>
              {isProvider ? '用户评价' : '摄影师对TA的评价'}
            </Typography>
            <ReviewList reviews={shownReviews} />
          </Box>
        )}

        {userMomentImages.length === 0 && shownReviews.length === 0 && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">暂无内容</Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  )
}
