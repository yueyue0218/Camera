import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { reviewApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { ReviewStarsDisplay } from '../../components/reviews/ReviewStarsDisplay.jsx'
import { buildOrderNavigationTarget } from '../../utils/orderNavigation.js'
import { EmptyState, Feedback, PageHeader, formatDateTime, panelSx } from '../dline/shared.jsx'

export function reviewDirectionLabel(direction) {
  const value = String(direction || '').trim().toUpperCase()
  if (value === 'CUSTOMER_TO_PROVIDER') return '客户评价摄影师'
  if (value === 'PROVIDER_TO_CUSTOMER') return '摄影师评价客户'
  return '订单评价'
}

export function ReviewScore({ value }) {
  return <ReviewStarsDisplay value={value} emphasize />
}

function reviewFeedbackText(type) {
  if (type === 'list') return '历史评价暂时加载失败，请稍后再试。'
  return '评价页暂时打不开，请稍后再试。'
}

function ReviewArchiveCard({ review, onOpenOrder }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        ...panelSx,
        p: 2.1,
        borderRadius: 3.5,
        bgcolor: '#fffdf8',
        borderColor: 'rgba(13,47,178,.12)',
        boxShadow: '0 10px 24px rgba(25,30,45,.055)'
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography fontWeight={900}>{reviewDirectionLabel(review.direction)}</Typography>
            <Chip
              size="small"
              label={`订单 #${review.orderId || '-'}`}
              sx={{ height: 24, fontWeight: 800, bgcolor: 'rgba(13,47,178,.08)', color: '#0d2fb2' }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(review.createdAt)}
          </Typography>
        </Stack>

        <ReviewStarsDisplay value={review.rating} size="large" emphasize />

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">评价人</Typography>
          <Typography fontWeight={800}>{review.reviewerNickname || 'Portra 用户'}</Typography>
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">被评价人</Typography>
          <Typography fontWeight={800}>{review.targetUserNickname || 'Portra 用户'}</Typography>
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">评价内容</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>
            {review.content || '对方没有留下文字评价'}
          </Typography>
        </Stack>

        {review.replyContent ? (
          <Paper
            variant="outlined"
            sx={{
              p: 1.3,
              borderRadius: 2.5,
              bgcolor: '#f5f8ff',
              borderColor: 'rgba(13,47,178,.14)'
            }}
          >
            <Stack spacing={0.5}>
              <Typography sx={{ color: '#0d2fb2', fontWeight: 900, fontSize: 13 }}>追加追评</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{review.replyContent}</Typography>
              {review.replyTime ? (
                <Typography variant="body2" color="text.secondary">{formatDateTime(review.replyTime)}</Typography>
              ) : null}
            </Stack>
          </Paper>
        ) : null}

        <Button
          variant="text"
          size="small"
          startIcon={<ReceiptLongRoundedIcon />}
          onClick={() => onOpenOrder?.(review)}
          sx={{ alignSelf: 'flex-start', fontWeight: 900 }}
        >
          查看订单评价区
        </Button>
      </Stack>
    </Paper>
  )
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
          ...panelSx,
          p: 2.2,
          borderRadius: 3.5,
          background: 'linear-gradient(180deg, rgba(255,251,242,.96), rgba(255,255,255,.98))'
        }}
      >
        <Stack spacing={1}>
          <Typography variant="overline" sx={{ color: '#0d2fb2', fontWeight: 900, letterSpacing: '.12em' }}>
            Review Archive
          </Typography>
          <Typography variant="h6" fontWeight={900}>历史评价</Typography>
          <Typography color="text.secondary">
            评分、评价正文、评价人与被评价人、订单信息都会统一展示在这里。
          </Typography>
        </Stack>
      </Paper>

      {loading ? <EmptyState>正在加载历史评价...</EmptyState> : null}
      {!loading && items.length ? (
        <Stack spacing={1.35}>
          {items.map(review => (
            <ReviewArchiveCard
              key={review.reviewId || `${review.orderId}-${review.direction}-${review.createdAt}`}
              review={review}
              onOpenOrder={item => {
                const target = buildOrderNavigationTarget(item.orderId, { section: 'reviews' })
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
