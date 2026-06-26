import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Skeleton, Stack, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { creditApi, reviewApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { ReviewStarsDisplay } from '../../components/reviews/ReviewStarsDisplay.jsx'
import { buildOrderNavigationTarget } from '../../utils/orderNavigation.js'
import { EmptyState, Feedback, PageHeader, panelSx } from '../dline/shared.jsx'

function formatTime(value) {
  if (!value) return '暂无'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '暂无' : date.toLocaleString('zh-CN', { hour12: false })
}

function formatScore(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '暂无'
}

function formatMetric(value) {
  return value === null || value === undefined || value === '' ? '--' : value
}

function formatPercent(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : '--'
}

function normalizeRecords(value) {
  if (Array.isArray(value)) return value
  return Array.isArray(value?.items) ? value.items : []
}

function recordDelta(record) {
  return Number(record.appliedScoreChange ?? record.scoreChange ?? 0)
}

function getRecordOrderId(record) {
  return record.relatedOrderId || record.orderId || null
}

function isReviewLinkedRecord(record) {
  const text = `${record.eventType || ''} ${record.sourceType || ''}`.toUpperCase()
  return text.includes('REVIEW') || text.includes('ARBITRATION')
}

function recordTitle(record) {
  const reason = String(record.reason || '').trim()
  const type = String(record.eventType || '').trim().toUpperCase()
  if (reason) return reason
  if (type.includes('ARBITRATION') && type.includes('REJECTED')) return '评价申诉结果'
  if (type.includes('ARBITRATION') && type.includes('APPROVED')) return '评价申诉回滚'
  if (type.includes('REVIEW')) return '评价带来的信用变化'
  return '信用变化记录'
}

function recordBadge(record) {
  const delta = recordDelta(record)
  if (delta > 0) return { label: '加分', color: 'success' }
  if (delta < 0) return { label: '减分', color: 'warning' }
  return { label: '结果记录', color: 'default' }
}

function creditLevel(score, summaryLevel) {
  const label = String(summaryLevel || '').trim()
  if (label) return label
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return '新用户'
  if (numeric >= 90) return '信用优秀'
  if (numeric >= 75) return '信用良好'
  if (numeric >= 60) return '待提升'
  return '信用较差'
}

function CreditSkeleton() {
  return (
    <Stack spacing={2}>
      <Paper sx={{ ...panelSx, p: 2.3, borderRadius: 3.5 }}>
        <Stack spacing={1.5}>
          <Skeleton variant="text" width="24%" height={24} />
          <Skeleton variant="text" width="36%" height={40} />
          <Skeleton variant="rounded" width="100%" height={110} sx={{ borderRadius: 3 }} />
        </Stack>
      </Paper>
      <Paper sx={{ ...panelSx, p: 2.2, borderRadius: 3.5 }}>
        <Stack spacing={1.2}>
          <Skeleton variant="text" width="22%" height={24} />
          <Skeleton variant="rounded" width="100%" height={90} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" width="100%" height={90} sx={{ borderRadius: 3 }} />
        </Stack>
      </Paper>
    </Stack>
  )
}

export function CreditDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const targetUserId = Number(userId || currentUser.userId)
  const isSelf = targetUserId === Number(currentUser.userId)
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState([])
  const [reviews, setReviews] = useState([])
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(true)
  const [rulesOpen, setRulesOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        if (isSelf) {
          const [summaryData, recordsData] = await Promise.all([
            creditApi.summary(targetUserId, currentUser),
            creditApi.records(targetUserId, currentUser)
          ])
          if (cancelled) return
          setSummary(summaryData || null)
          setRecords(normalizeRecords(recordsData))
          setReviews([])
        } else {
          const [summaryData, reviewsData] = await Promise.all([
            creditApi.summary(targetUserId, currentUser),
            reviewApi.listByUser(targetUserId, currentUser)
          ])
          if (cancelled) return
          setSummary(summaryData || null)
          setReviews(Array.isArray(reviewsData) ? reviewsData : [])
          setRecords([])
        }
        setFeedback({})
      } catch {
        if (!cancelled) {
          setFeedback({ error: '信用信息暂时加载失败，请稍后再试。' })
          setSummary(null)
          setRecords([])
          setReviews([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [targetUserId, isSelf, currentUser])

  const score = useMemo(() => formatScore(summary?.creditScore), [summary?.creditScore])
  const level = useMemo(() => creditLevel(summary?.creditScore, summary?.creditLevel), [summary?.creditScore, summary?.creditLevel])

  if (loading) {
    return (
      <Stack spacing={2}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(-1)} sx={{ alignSelf: 'flex-start' }}>
          返回
        </Button>
        <PageHeader
          eyebrow="信用档案"
          title="信用分"
          description="正在同步最新信用数据。"
        />
        <CreditSkeleton />
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(-1)} sx={{ alignSelf: 'flex-start' }}>
        返回
      </Button>
      <PageHeader
        eyebrow="信用档案"
        title={isSelf ? '我的信用分' : '信用分'}
        description={isSelf ? '信用变化记录与关联评价会统一展示在这里。' : '信用分与历史评价会统一展示在这里。'}
      />
      <Feedback {...feedback} />

      <Paper
        variant="outlined"
        sx={{
          ...panelSx,
          p: 2.3,
          borderRadius: 3.5,
          background: 'linear-gradient(180deg, rgba(255,251,242,.96), rgba(255,255,255,.98))'
        }}
      >
        <Stack spacing={1.4}>
          <Typography variant="overline" sx={{ color: '#0d2fb2', fontWeight: 900, letterSpacing: '.12em' }}>
            Credit Summary
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography sx={{ fontSize: { xs: 32, md: 38 }, fontWeight: 950, lineHeight: 1, color: '#0d2fb2' }}>
                {score}
              </Typography>
              <Typography sx={{ mt: 0.6, fontWeight: 800 }}>{level}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                最近更新：{formatTime(summary?.lastUpdatedAt)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ alignContent: 'flex-start' }}>
              <Chip label={`计分合作 ${formatMetric(summary?.effectiveOrderCount)}`} />
              <Chip label={`完成合作 ${formatMetric(summary?.completedOrderCount)}`} />
              <Chip label={`收到评价 ${formatMetric(summary?.receivedReviewCount)}`} />
              <Chip label={`好评率 ${formatPercent(summary?.goodReviewRate)}`} />
              <Chip label={`争议记录 ${formatMetric(summary?.riskRecordCount)}`} />
            </Stack>
          </Stack>
          <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => setRulesOpen(true)}>
            评分说明
          </Button>
        </Stack>
      </Paper>

      {isSelf ? (
        <Paper variant="outlined" sx={{ ...panelSx, p: 2.2, borderRadius: 3.5 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="h6" fontWeight={900}>信用变化</Typography>
              <Typography color="text.secondary">每一次信用变化、申诉结果和回滚都会在这里留下记录。</Typography>
            </Box>
            {records.length ? (
              <Stack spacing={1.2}>
                {records.map(record => {
                  const delta = recordDelta(record)
                  const badge = recordBadge(record)
                  const orderId = getRecordOrderId(record)
                  const jumpTarget = orderId ? buildOrderNavigationTarget(orderId, { section: isReviewLinkedRecord(record) ? 'reviews' : undefined }) : null
                  return (
                    <Paper
                      key={record.recordId || `${record.eventType}-${record.createdAt}`}
                      variant="outlined"
                      sx={{
                        p: 1.55,
                        borderRadius: 3,
                        bgcolor: '#fffdf8',
                        borderColor: 'rgba(13,47,178,.12)',
                        boxShadow: '0 10px 22px rgba(25,30,45,.05)'
                      }}
                    >
                      <Stack spacing={1}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography fontWeight={900}>{recordTitle(record)}</Typography>
                            <Chip size="small" color={badge.color} label={badge.label} />
                          </Stack>
                          <Typography color={delta > 0 ? 'success.main' : delta < 0 ? 'warning.main' : 'text.secondary'} fontWeight={900}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </Typography>
                        </Stack>
                        <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
                          变更前 {formatScore(record.beforeScore)} · 变更后 {formatScore(record.afterScore || record.scoreAfter)}
                        </Typography>
                        <Typography sx={{ lineHeight: 1.8 }}>
                          {record.reason || '已记录本次信用变化。'}
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {formatTime(record.createdAt)}
                          </Typography>
                          {jumpTarget ? (
                            <Button
                              size="small"
                              startIcon={<ReceiptLongRoundedIcon />}
                              onClick={() => navigate(jumpTarget.to, { state: jumpTarget.state })}
                              sx={{ fontWeight: 900 }}
                            >
                              {isReviewLinkedRecord(record) ? '查看订单评价区' : '查看关联订单'}
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
            ) : (
              <EmptyState>还没有信用变化记录。</EmptyState>
            )}
          </Stack>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ ...panelSx, p: 2.2, borderRadius: 3.5 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="h6" fontWeight={900}>历史评价</Typography>
              <Typography color="text.secondary">这些评价来自真实合作，可用于判断对方的合作体验。</Typography>
            </Box>
            {reviews.length ? (
              <Stack spacing={1.2}>
                {reviews.map(review => {
                  const target = buildOrderNavigationTarget(review.orderId, { section: 'reviews' })
                  return (
                    <Paper
                      key={review.reviewId || `${review.orderId}-${review.createdAt}`}
                      variant="outlined"
                      sx={{
                        p: 1.55,
                        borderRadius: 3,
                        bgcolor: '#fffdf8',
                        borderColor: 'rgba(13,47,178,.12)',
                        boxShadow: '0 10px 22px rgba(25,30,45,.05)'
                      }}
                    >
                      <Stack spacing={1}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                          <Typography fontWeight={900}>
                            {review.direction === 'CUSTOMER_TO_PROVIDER' ? '客户评价摄影师' : '摄影师评价客户'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">{formatTime(review.createdAt)}</Typography>
                        </Stack>
                        <ReviewStarsDisplay value={review.rating} emphasize />
                        <Typography variant="body2" color="text.secondary">
                          {review.reviewerNickname || 'Portra 用户'} → {review.targetUserNickname || 'Portra 用户'}
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                          {review.content || '对方没有留下文字评价'}
                        </Typography>
                        {review.replyContent ? (
                          <Paper variant="outlined" sx={{ p: 1.15, borderRadius: 2.5, bgcolor: '#f5f8ff', borderColor: 'rgba(13,47,178,.14)' }}>
                            <Typography sx={{ color: '#0d2fb2', fontWeight: 900, fontSize: 13, mb: 0.5 }}>追加追评</Typography>
                            <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{review.replyContent}</Typography>
                          </Paper>
                        ) : null}
                        {target ? (
                          <Button
                            size="small"
                            startIcon={<ReceiptLongRoundedIcon />}
                            onClick={() => navigate(target.to, { state: target.state })}
                            sx={{ alignSelf: 'flex-start', fontWeight: 900 }}
                          >
                            查看订单评价区
                          </Button>
                        ) : null}
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
            ) : (
              <EmptyState>该用户暂时还没有历史评价。</EmptyState>
            )}
          </Stack>
        </Paper>
      )}

      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>评分说明</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.1}>
            <Typography>信用分会参考完成合作后的评价、履约情况和申诉处理结果。</Typography>
            <Typography>评价分统一使用星级展示；信用分始终使用数字展示。</Typography>
            <Typography>申诉通过会撤销对应恶评及其信用影响；申诉驳回会保留原评价，并新增一条申诉结果记录。</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRulesOpen(false)}>知道了</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
