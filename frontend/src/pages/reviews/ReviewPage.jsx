import { useEffect, useMemo, useState } from 'react'
import { Alert, Avatar, Box, Button, Chip, Paper, Rating, Stack, TextField, Typography } from '@mui/material'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { creditApi, orderApi, reviewApi, reviewComplaintApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, Feedback, PageHeader, formatDateTime, panelSx, portra } from '../dline/shared.jsx'
import './reviews.css'

export function reviewDirectionLabel(direction) {
  const value = String(direction || '').trim().toUpperCase()
  if (value === 'CUSTOMER_TO_PROVIDER') return '来自单主的评价'
  if (value === 'PROVIDER_TO_CUSTOMER') return '来自摄影师的评价'
  return '评价记录'
}

function formatCreditScore(value) {
  if (value === null || value === undefined) return '暂无'
  if (typeof value === 'string' && value.trim() === '') return '暂无'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '暂无'
}

function complaintStatusTone(status) {
  const value = String(status || '').trim().toUpperCase()

  if (value === 'REJECTED') {
    return {
      label: '已驳回',
      chipColor: 'warning',
      accent: '#c76a00',
      surface: 'rgba(255,196,86,.12)'
    }
  }

  if (value === 'APPROVED' || value === 'REVIEW_HIDDEN' || value === 'RESOLVED') {
    return {
      label: '已处理',
      chipColor: 'success',
      accent: '#157347',
      surface: 'rgba(46,160,67,.10)'
    }
  }

  if (value === 'PROCESSING') {
    return {
      label: '处理中',
      chipColor: 'info',
      accent: portra.primary,
      surface: 'rgba(13,47,178,.10)'
    }
  }

  return {
    label: '待提交',
    chipColor: 'primary',
    accent: portra.primary,
    surface: 'rgba(13,47,178,.08)'
  }
}

export function ReviewScore({ value }) {
  const numeric = Number(value)
  const score = Number.isFinite(numeric) ? numeric : 0
  const filled = Math.max(0, Math.min(5, Math.round(score)))

  return (
    <Stack direction="row" spacing={1} alignItems="center" className="review-score-wrap">
      <Typography className="review-score-pill">{Number.isFinite(numeric) ? score.toFixed(1) : '--'} 分</Typography>
      <Box className="review-score-meter" aria-label={`评分 ${Number.isFinite(numeric) ? score.toFixed(1) : '暂无'}`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className={index < filled ? 'filled' : ''} />
        ))}
      </Box>
    </Stack>
  )
}

function ReviewItem({ item, index = 0, onOpenOrder, onOpenReview }) {
  const avatarText = String(item.reviewerId || item.targetUserId || 'U').slice(-2)
  const orderId = item.orderId || item.targetOrderId
  const directionLabel = reviewDirectionLabel(item.direction)

  const openReview = () => {
    if (item.reviewId != null) {
      onOpenReview?.(item.reviewId)
    }
  }

  return (
    <Paper
      className="review-ticket"
      role="button"
      tabIndex={0}
      onClick={openReview}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openReview()
        }
      }}
      style={{ '--review-index': index }}
      sx={{ ...panelSx, p: 2, cursor: 'pointer' }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar sx={{ bgcolor: portra.primary, width: 40, height: 40 }}>{avatarText}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={900}>{directionLabel}</Typography>
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
            onClick={event => {
              event.stopPropagation()
              onOpenOrder(orderId)
            }}
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
  const complaintTone = useMemo(
    () => complaintStatusTone(receivedReview?.complaintStatus),
    [receivedReview?.complaintStatus]
  )

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
      const reviews = await reviewApi.listByOrder(orderId, currentUser)
      setItems(Array.isArray(reviews) ? reviews : [])
      setForm({ rating: 5, content: '' })
      setFeedback({ success: '评价已提交' })
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
        description="订单完成后双方可以进行评价，评价会影响信用分。"
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
                {formatCreditScore(credit.creditScore)}
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
        <Paper
          sx={{
            ...panelSx,
            p: 2.25,
            borderRadius: 4,
            border: `1px solid ${complaintTone.surface}`,
            background:
              `radial-gradient(circle at top right, ${complaintTone.surface}, transparent 30%), linear-gradient(145deg, rgba(255,253,248,.98), rgba(247,244,237,.96))`
          }}
        >
          <Stack spacing={1.6}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Box>
                <Typography variant="overline" sx={{ color: complaintTone.accent, fontWeight: 900, letterSpacing: '.16em' }}>
                  REVIEW APPEAL
                </Typography>
                <Typography variant="h6" fontWeight={900}>对收到的评价发起申诉</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.8 }}>
                  仅被评价方可以申诉，提交后会进入管理端处理链路。
                </Typography>
              </Box>
              <Chip label={complaintTone.label} color={complaintTone.chipColor} sx={{ fontWeight: 800, minWidth: 84 }} />
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 1.6,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,.68)',
                borderColor: 'rgba(13,47,178,.12)'
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">收到的评价</Typography>
                  <Typography fontWeight={900} sx={{ mt: 0.4 }}>
                    订单 #{receivedReview.orderId || '-'} · {reviewDirectionLabel(receivedReview.direction)}
                  </Typography>
                  <Typography sx={{ mt: 0.9, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                    {receivedReview.content || '暂无评价正文'}
                  </Typography>
                </Box>
                <Box sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                  <ReviewScore value={receivedReview.rating} />
                </Box>
              </Stack>
            </Paper>

            <TextField
              label="申诉原因"
              multiline
              minRows={4}
              placeholder="请明确说明争议点，例如评价内容与订单事实不符、存在恶意差评、证据链不完整等。"
              helperText="尽量写清楚事实、时间点和争议内容，后续仲裁会更快。"
              value={complaintReason}
              onChange={event => setComplaintReason(event.target.value)}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
              <Alert severity="info" sx={{ flex: 1, borderRadius: 3 }}>
                当前评价申诉不会直接修改评价结果，需等待处理结论。
              </Alert>
              <Button
                color="warning"
                variant="contained"
                startIcon={<ReportProblemRoundedIcon />}
                disabled={complaintSubmitting}
                onClick={() => complain(receivedReview.reviewId)}
                sx={{ minWidth: 148, alignSelf: { xs: 'stretch', md: 'center' } }}
              >
                {complaintSubmitting ? '提交中...' : '提交申诉'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Typography variant="h6" fontWeight={900}>订单评价</Typography>
      {loading ? <EmptyState>正在加载评价...</EmptyState> : null}
      {!loading && items.length ? (
        <Stack gap={1.5}>
          {items.map((item, index) => (
            <ReviewItem
              key={item.reviewId}
              item={item}
              index={index}
              onOpenOrder={id => navigate(`/orders?orderId=${id}`)}
              onOpenReview={id => navigate(`/reviews/${id}`)}
            />
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
  const targetUserId = userId || currentUser.userId
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
      } catch (error) {
        if (alive) setFeedback({ error: error.message })
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
        eyebrow="PORTRA REVIEW"
        title={isSelf ? '我的评价' : `用户 #${targetUserId} 的评价`}
        description={isSelf ? '查看你收到的评价与追评。' : '查看某位用户收到的评价。'}
        action={<Button onClick={() => navigate(-1)}>返回</Button>}
      />
      <Feedback {...feedback} />
      {loading ? <EmptyState>正在加载评价...</EmptyState> : null}
      {!loading && items.length ? (
        <Stack gap={1.5}>
          {items.map((item, index) => (
            <ReviewItem
              key={item.reviewId}
              item={item}
              index={index}
              onOpenOrder={id => navigate(`/orders?orderId=${id}`)}
              onOpenReview={id => navigate(`/reviews/${id}`)}
            />
          ))}
        </Stack>
      ) : null}
      {!loading && !items.length ? <EmptyState>暂无收到的评价。</EmptyState> : null}
    </Stack>
  )
}
