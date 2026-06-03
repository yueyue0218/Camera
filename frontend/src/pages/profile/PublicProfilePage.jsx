import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Alert, Avatar, Box, Button, Paper, Stack, Typography } from '@mui/material'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import { USERS, useAuth } from '../../AuthContext.jsx'
import { creditApi, momentApi, reviewApi } from '../../api.js'
import { EmptyCard } from './components/EmptyCard.jsx'
import { PortfolioGrid } from './components/PortfolioGrid.jsx'
import { ProfileMetrics } from './components/ProfileMetrics.jsx'
import { ProfileSectionHeader } from './components/ProfileSectionHeader.jsx'
import { ReviewList } from './components/ReviewList.jsx'
import {
  buildPortfolioWorks,
  buildProfileStats,
  formatTime,
  getLocalReviewsByTarget,
  getOrderSnapshotsForUser,
  getUserProfile,
  isApiUnavailable,
  isFollowing,
  mergeReviewLists,
  readUserProfiles,
  roleMap,
  toggleFollow
} from './utils/profileUtils.js'

export function PublicProfilePage() {
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
          <ProfileSectionHeader title="历史评价" subtitle="这个用户收到过的订单评价。" />
          <ReviewList reviews={receivedReviews} />
        </Stack>
      )}

      {role === 'PROVIDER' && (
        <>
          <ProfileSectionHeader title="作品集" subtitle="查看这个用户公开发布过的照片动态。" />
          <PortfolioGrid works={works} emptyText="还没有公开作品" onOpenMoment={momentId => navigate(`/moments/${momentId}`)} />
        </>
      )}

      <ProfileSectionHeader title="动态" subtitle="点击动态进入详情页继续浏览。" />
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
