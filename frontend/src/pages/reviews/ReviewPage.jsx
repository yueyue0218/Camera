import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Box, Button, Paper, Rating, Stack, TextField, Typography } from '@mui/material'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { creditApi, orderApi, reviewApi, reviewComplaintApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, Feedback, PageHeader, formatDateTime, panelSx, portra } from '../dline/shared.jsx'
import './reviews.css'

function ReviewScore({ value }) {
  const numeric = Number(value)
  const score = Number.isFinite(numeric) ? numeric : 0
  const filled = Math.max(0, Math.min(5, Math.round(score)))

  return (
    <Stack direction="row" spacing={1} alignItems="center" className="review-score-wrap">
      <Typography className="review-score-pill">{score ? score.toFixed(1) : '--'} 分</Typography>
      <Box className="review-score-meter" aria-label={`评分 ${score.toFixed(1)}`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className={index < filled ? 'filled' : ''} />
        ))}
      </Box>
    </Stack>
  )
}

function ReviewItem({ item, index = 0, onOpenOrder }) {
  const avatarText = String(item.reviewerId || item.targetUserId || 'U').slice(-2)
  const orderId = item.orderId || item.targetOrderId

  return (
    <Paper className="review-ticket" style={{ '--review-index': index }} sx={{ ...panelSx, p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar sx={{ bgcolor: portra.primary, width: 40, height: 40 }}>{avatarText}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={900}>{item.direction || '评价'}</Typography>
              <Typography variant="body2" className="review-order-line">
                订单 #{item.orderId || item.targetOrderId || '-'}
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ textAlign: 'right' }}>
            <ReviewScore value={item.rating} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, whiteSpace: 'nowrap' }}>
              {formatDateTime(item.createdAt)}
            </Typography>
          </Box>
        </Stack>
        <Typography className="review-content" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
          {item.content || '暂无评价正文'}
        </Typography>
        {item.replyContent ? (
          <Box className="review-reply">
            <span>追评</span>
            <p>{item.replyContent}</p>
          </Box>
        ) : null}
        {orderId ? (
          <Button
            size="small"
            variant="text"
            startIcon={<ReceiptLongRoundedIcon />}
            onClick={() => onOpenOrder(orderId)}
            sx={{ alignSelf: 'flex-start', fontWeight: 900 }}
          >
            查看关联订单
          </Button>
        ) : null}
      </Stack>
    </Paper>
  )
}

export function ReviewPage() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { currentUser } = useAuth()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [credit, setCredit] = useState(null)
  const [form, setForm] = useState({ rating: 5, content: '' })
  const [complaintReason, setComplaintReason] = useState('')
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [complaintSubmitting, setComplaintSubmitting] = useState(false)

  const myReview = useMemo(
    () => items.find(item => Number(item.reviewerId) === Number(currentUser.userId)),
    [currentUser.userId, items]
  )
  const receivedReview = useMemo(
    () => items.find(item => Number(item.targetUserId) === Number(currentUser.userId) && item.isVisible !== false),
    [currentUser.userId, items]
  )
  const canReview = ['COMPLETED', 'REFUNDED'].includes(order?.status) && !myReview

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        const [nextOrder, reviews, summary] = await Promise.all([
          orderApi.detail(orderId, currentUser),
          reviewApi.listByOrder(orderId, currentUser),
          creditApi.summary(currentUser.userId, currentUser)
        ])
        if (!alive) return
        setOrder(nextOrder)
        setItems(Array.isArray(reviews) ? reviews : [])
        setCredit(summary)
        setFeedback({})
      } catch (error) {
        if (alive) setFeedback({ error: error.message })
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [currentUser, orderId])

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await reviewApi.create(orderId, { rating: form.rating, content: form.content.trim() }, currentUser)
      setForm({ rating: 5, content: '' })
      setFeedback({ success: '评价已提交' })
      const reviews = await reviewApi.listByOrder(orderId, currentUser)
      setItems(Array.isArray(reviews) ? reviews : [])
    } catch (error) {
      setFeedback({ error: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  async function complain(reviewId) {
    if (!complaintReason.trim()) {
      setFeedback({ error: '请先填写申诉原因' })
      return
    }
    setComplaintSubmitting(true)
    try {
      await reviewComplaintApi.create(reviewId, { reason: complaintReason.trim(), evidenceFileIds: '' }, currentUser)
      setComplaintReason('')
      setFeedback({ success: '申诉已提交' })
    } catch (error) {
      setFeedback({ error: error.message })
    } finally {
      setComplaintSubmitting(false)
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="PORTRA REVIEW"
        title={`订单 ${orderId} 评价`}
        description="订单完成后双方可进行评价，评价会影响信用分。"
      />
      <Feedback {...feedback} />

      {credit ? (
        <Paper sx={{ ...panelSx, p: 2 }}>
          <Typography variant="overline" sx={{ color: portra.primary, fontWeight: 900, letterSpacing: '0.14em' }}>
            MY CREDIT
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Box>
              <Typography variant="h4" fontWeight={900} color={portra.primary}>
                {credit.creditScore ?? '--'}
              </Typography>
              <Typography color="text.secondary">{credit.creditLevel || '信用等级暂无'}</Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Alert severity="info" sx={{ py: 0.5 }}>{credit.completedOrderCount ?? '暂无'} 个已完成订单</Alert>
              <Alert severity="info" sx={{ py: 0.5 }}>{credit.receivedReviewCount ?? '暂无'} 条收到评价</Alert>
              <Alert severity="info" sx={{ py: 0.5 }}>{credit.averageRating ?? '暂无'} 平均星级</Alert>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {canReview ? (
        <Paper component="form" onSubmit={submit} sx={{ ...panelSx, p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6" fontWeight={900}>提交评价</Typography>
            <Rating value={form.rating} onChange={(_, value) => setForm(current => ({ ...current, rating: value || 5 }))} />
            <TextField
              label="评价内容"
              multiline
              minRows={3}
              value={form.content}
              onChange={event => setForm(current => ({ ...current, content: event.target.value }))}
            />
            <Button type="submit" variant="contained" startIcon={<RateReviewRoundedIcon />} disabled={submitting}>
              {submitting ? '提交中...' : '提交评价'}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Alert severity="info">{myReview ? '你已经评价过该订单。' : '当前订单状态暂不可评价。'}</Alert>
      )}

      {receivedReview ? (
        <Paper sx={{ ...panelSx, p: 2 }}>
          <Typography variant="h6" fontWeight={900}>对收到的评价发起申诉</Typography>
          <Typography color="text.secondary" mb={1.5}>
            仅被评价方可申诉，管理端会进行仲裁。
          </Typography>
          <Stack spacing={1.5}>
            <TextField label="申诉原因" value={complaintReason} onChange={event => setComplaintReason(event.target.value)} />
            <Button color="warning" startIcon={<ReportProblemRoundedIcon />} disabled={complaintSubmitting} onClick={() => complain(receivedReview.reviewId)}>
              {complaintSubmitting ? '提交中...' : '提交申诉'}
            </Button>
          </Stack>
        </Paper>
      ) : null}

      <Typography variant="h6" fontWeight={900}>订单评价</Typography>
      {loading ? <EmptyState>正在加载评价...</EmptyState> : null}
      {!loading && items.length ? (
        <Stack gap={1.5}>
          {items.map((item, index) => (
            <ReviewItem key={item.reviewId} item={item} index={index} onOpenOrder={id => navigate(`/orders?orderId=${id}`)} />
          ))}
        </Stack>
      ) : null}
      {!loading && !items.length ? <EmptyState>暂无评价</EmptyState> : null}
    </Stack>
  )
}

export function UserReviewsPage() {
  const navigate = useNavigate()
  const { userId } = useParams()
  const { currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        const reviews = await reviewApi.listByUser(userId, currentUser)
        if (!alive) return
        setItems(Array.isArray(reviews) ? reviews : [])
        setFeedback({})
      } catch (error) {
        if (alive) setFeedback({ error: error.message })
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [currentUser, userId])

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="PORTRA REVIEW"
        title={`用户 #${userId || '-'} 的评价`}
        description="查看某位用户收到的评价。"
        action={<Button onClick={() => navigate(-1)}>返回</Button>}
      />
      <Feedback {...feedback} />
      {loading ? <EmptyState>正在加载评价...</EmptyState> : null}
      {!loading && items.length ? (
        <Stack gap={1.5}>
          {items.map((item, index) => (
            <ReviewItem key={item.reviewId} item={item} index={index} onOpenOrder={id => navigate(`/orders?orderId=${id}`)} />
          ))}
        </Stack>
      ) : null}
      {!loading && !items.length ? <EmptyState>暂无收到的评价。</EmptyState> : null}
    </Stack>
  )
}
