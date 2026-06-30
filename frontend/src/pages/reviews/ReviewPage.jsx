import { useEffect, useState } from 'react'
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { reviewApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { ReviewStarsDisplay } from '../../components/reviews/ReviewStarsDisplay.jsx'
import { ReviewArchiveCard, reviewRoleLabel } from '../../components/reviews/ReviewArchiveCard.jsx'
import { buildOrderNavigationTarget } from '../../utils/orderNavigation.js'
import { EmptyState, Feedback, PageHeader, formatDateTime } from '../dline/shared.jsx'

export function reviewDirectionLabel(direction) {
  return reviewRoleLabel(direction)
}

export function ReviewScore({ value }) {
  return <ReviewStarsDisplay value={value} emphasize />
}

function reviewFeedbackText(type) {
  if (type === 'list') return '历史评价暂时加载失败，请稍后再试。'
  return '评价页暂时打不开，请稍后再试。'
}

export function ReviewPage() {
  const { orderId } = useParams()
  const target = buildOrderNavigationTarget(orderId, { section: 'reviews' })
  if (!target) {
    return <Navigate to="/orders" replace />
  }
  return <Navigate to={target.to} replace state={target.state} />
}

export function UserReviewsPage() {
  const navigate = useNavigate()
  const { userId } = useParams()
  const { currentUser } = useAuth()
  const targetUserId = Number(userId || currentUser.userId)
  const isSelf = Number(targetUserId) === Number(currentUser.userId)
  const [items, setItems] = useState([])
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        const reviews = await reviewApi.listByUser(targetUserId, currentUser)
        if (!alive) return
        setItems(Array.isArray(reviews) ? reviews : [])
        setFeedback({})
      } catch {
        if (alive) setFeedback({ error: reviewFeedbackText('list') })
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [currentUser, targetUserId])

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="全部历史评价"
        title={isSelf ? '我的全部历史评价' : '全部历史评价'}
        description={isSelf ? '这里汇总你收到的全部评价与追评。' : '这里汇总这位用户收到的全部评价与追评。'}
        action={<Button onClick={() => navigate(-1)}>返回</Button>}
      />
      <Feedback {...feedback} />

      <Paper
        variant="outlined"
        sx={{
          p: 1.45,
          borderRadius: 3,
          bgcolor: '#fffaf2',
          borderColor: 'rgba(20, 48, 112, .10)',
          boxShadow: '0 10px 24px rgba(28, 38, 64, .035)'
        }}
      >
        <Stack spacing={0.9}>
          <Typography variant="overline" sx={{ color: '#0d2fb2', fontWeight: 900, letterSpacing: '.12em' }}>
            Review Archive
          </Typography>
          <Typography variant="h6" fontWeight={900}>历史评价</Typography>
          <Typography color="text.secondary">
            评分、评价正文、评价人与被评价人都会统一展示在这里，查看后可直接回到对应约拍的评价区。
          </Typography>
        </Stack>
      </Paper>

      {loading ? <EmptyState>正在加载历史评价...</EmptyState> : null}
      {!loading && items.length ? (
        <Stack spacing={1.15}>
          {items.map(review => (
            <ReviewArchiveCard
              key={review.reviewId || `${review.orderId}-${review.direction}-${review.createdAt}`}
              review={{
                ...review,
                replyTime: review.replyTime ? formatDateTime(review.replyTime) : ''
              }}
              timeText={formatDateTime(review.createdAt)}
              actionLabel="查看本次约拍评价区"
              onAction={item => {
                const target = buildOrderNavigationTarget(item.orderId, {
                  section: 'reviews',
                  reviewId: item.reviewId
                })
                if (target) navigate(target.to, { state: target.state })
              }}
            />
          ))}
        </Stack>
      ) : null}
      {!loading && !items.length ? (
        <EmptyState>
          <Box>
            <Typography fontWeight={900}>暂无历史评价</Typography>
            <Typography sx={{ mt: 0.6, color: 'text.secondary' }}>
              完成合作并产生评价后，这里会显示对应记录。
            </Typography>
          </Box>
        </EmptyState>
      ) : null}

      {isSelf ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          通知和申诉结果不会跳到这里；它们都会直接回到对应订单的评价与申诉区域。
        </Alert>
      ) : null}
    </Stack>
  )
}
