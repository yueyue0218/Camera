import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography
} from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { creditApi, reviewApi } from '../../api/index.js'
import { demoCreditRecords, demoCreditSummary } from '../../mocks/dline/creditFixtures.js'
import { demoReviews } from '../../mocks/dline/reviewFixtures.js'

function useCreditDemoMode() {
  const [params] = useSearchParams()
  return import.meta.env.DEV && params.get('demo') === '1'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('zh-CN')
}

function toPublicTimeline(records) {
  return records.slice(0, 3).map(record => ({
    ...record,
    reason: '信用变化已脱敏展示',
    extra: record.eventType ? '近期履约情况稳定' : ''
  }))
}

function scoreLevel(score, summaryLevel) {
  if (summaryLevel) return summaryLevel
  const numeric = Number(score)
  if (Number.isNaN(numeric)) return '信用未知'
  if (numeric >= 90) return '信用优秀'
  if (numeric >= 70) return '信用良好'
  return '信用较差'
}

function scoreProgress(score) {
  const numeric = Number(score)
  if (Number.isNaN(numeric)) return 0
  return Math.max(0, Math.min(100, numeric))
}

function CreditAvatar({ userId, score }) {
  const label = String(userId || '用户').slice(-2)
  return (
    <div className="credit-avatar">
      <div className="credit-avatar-ring" style={{ '--credit-progress': `${scoreProgress(score)}%` }}>
        <span>{Number.isFinite(Number(score)) ? score : '--'}</span>
      </div>
      <div className="credit-avatar-meta">
        <strong>{label}</strong>
        <span>当前信用分</span>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, detail, onClick, active = false }) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component className={`credit-summary-card ${onClick ? 'clickable' : ''} ${active ? 'active' : ''}`} type={onClick ? 'button' : undefined} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </Component>
  )
}

function TimelineItem({ record }) {
  return (
    <article className="credit-timeline-item">
      <div className={`credit-timeline-score ${record.scoreChange >= 0 ? 'positive' : 'negative'}`}>
        {record.scoreChange > 0 ? '+' : ''}{record.scoreChange}
      </div>
      <div className="credit-timeline-body">
        <div className="credit-timeline-head">
          <strong>{record.reason || '信用变化'}</strong>
          <time>{formatDateTime(record.createdAt)}</time>
        </div>
        <p>{record.extra || `变动后分数：${record.scoreAfter ?? '-'}`}</p>
      </div>
    </article>
  )
}

function ReviewCard({ review }) {
  const avatarText = review.reviewerId ? String(review.reviewerId).slice(-2) : 'U'
  return (
    <article className="credit-review-card">
      <div className="credit-review-head">
        <div className="credit-review-user">
          <Avatar className="credit-review-avatar">{avatarText}</Avatar>
          <div>
            <strong>用户 #{review.reviewerId || '-'}</strong>
            <span>{formatDate(review.createdAt)}</span>
          </div>
        </div>
        <span className="credit-rating-pill">{review.rating || '-'} 分</span>
      </div>
      <p className="credit-review-content">{review.content || '暂无评价内容'}</p>
      {review.replyContent ? (
        <div className="credit-review-reply">
          <span>追评</span>
          <p>{review.replyContent}</p>
        </div>
      ) : null}
    </article>
  )
}

export function CreditDetailPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { userId } = useParams()
  const demoMode = useCreditDemoMode()
  const publicView = Boolean(userId)
  const resolvedUserId = useMemo(() => {
    if (publicView && userId === 'demo-user') return 2001
    const numeric = Number(publicView ? userId : currentUser?.userId)
    return Number.isNaN(numeric) ? null : numeric
  }, [currentUser?.userId, publicView, userId])

  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ruleOpen, setRuleOpen] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!resolvedUserId) {
        setLoading(false)
        setError('暂时无法加载信用数据')
        return
      }
      setLoading(true)
      setError('')
      try {
        const [summaryData, recordData, reviewData] = demoMode
          ? [demoCreditSummary, demoCreditRecords, demoReviews]
          : await Promise.all([
            creditApi.summary(resolvedUserId, currentUser),
            creditApi.records(resolvedUserId, currentUser),
            reviewApi.listByUser(resolvedUserId, currentUser)
          ])
        if (!alive) return
        setSummary(summaryData || null)
        setRecords(Array.isArray(recordData?.items) ? recordData.items : Array.isArray(recordData) ? recordData : [])
        setReviews(Array.isArray(reviewData?.items) ? reviewData.items : Array.isArray(reviewData) ? reviewData : [])
      } catch (loadError) {
        if (!alive) return
        setError(loadError.message || '暂时无法加载信用数据')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [currentUser, demoMode, resolvedUserId])

  const score = summary?.creditScore
  const level = scoreLevel(score, summary?.creditLevel)
  const completedOrders = summary?.completedOrderCount ?? summary?.completedOrders ?? null
  const reviewCount = summary?.receivedReviewCount ?? reviews.length
  const averageRating = summary?.averageRating ?? (reviews.length ? (reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length).toFixed(1) : null)
  const onTimeRate = summary?.onTimeRate ?? null
  const recentChange = records[0]
  const visibleRecords = publicView ? toPublicTimeline(records) : records
  const recentReviews = reviews.slice(0, 3)
  const detailPath = publicView
    ? `/users/${userId}/reviews${demoMode ? '?demo=1' : ''}`
    : `/users/${resolvedUserId}/reviews${demoMode ? '?demo=1' : ''}`

  return (
    <section className="credit-page">
      <div className="portra-crumb credit-crumb">
        <button className="portra-back" type="button" onClick={() => navigate(-1)}>← 返回上一页</button>
        <span>{publicView ? `公开主页信用详情 · 用户 #${userId || '-'}` : '我的信用详情'} {demoMode ? <span className="credit-demo-badge">开发预览数据</span> : null}</span>
      </div>

      <Paper className="credit-hero" elevation={0}>
        <div className="credit-hero-copy">
          <Typography variant="overline" className="credit-kicker">信用评分模块</Typography>
          <Typography variant="h3" className="credit-title">
            {loading ? '信用数据加载中' : `信用分 ${score ?? '--'}`}
          </Typography>
          <Typography className="credit-subtitle">
            {loading ? '正在获取最新信用与评价数据' : summary?.summary || '近期交易表现稳定'}
          </Typography>
          <div className="credit-hero-meta">
            <span>{level}</span>
            <span>已完成订单 {completedOrders ?? '暂无'}</span>
            <span>收到评价 {reviewCount ?? '暂无'}</span>
            <span>平均评价 {averageRating ?? '暂无'}</span>
            {onTimeRate ? <span>按时履约率 {onTimeRate}%</span> : null}
          </div>
        </div>
        <div className="credit-hero-visual" style={{ '--credit-progress': `${scoreProgress(score)}%` }}>
          <div className="credit-hero-ring">
            <span>{Number.isFinite(Number(score)) ? score : '--'}</span>
          </div>
          <div className="credit-hero-note">
            <strong>{level}</strong>
            <p>{recentChange ? `${recentChange.scoreChange > 0 ? '+' : ''}${recentChange.scoreChange} · ${publicView ? '最近变化已脱敏' : recentChange.reason}` : '暂无最近信用变化'}</p>
          </div>
        </div>
      </Paper>

      {error ? (
        <div className="credit-error-card">
          <strong>暂时无法加载信用数据</strong>
          <span>请稍后重试</span>
          {import.meta.env.DEV ? <small>{error}</small> : null}
          <button className="portra-secondary-btn" type="button" onClick={() => window.location.reload()}>重新加载</button>
        </div>
      ) : null}

      <section className="credit-section">
        <div className="credit-section-head">
          <h2>数据概览</h2>
          <span>点击评价数可直接进入评价列表</span>
        </div>
        <div className="credit-summary-grid">
          <SummaryCard label="已完成订单数" value={loading ? '...' : (completedOrders ?? '暂无')} detail="反映履约稳定性" />
          <SummaryCard
            label="收到评价数"
            value={loading ? '...' : (reviewCount ?? '暂无')}
            detail="查看收到的真实反馈"
            onClick={() => navigate(detailPath)}
            active
          />
          <SummaryCard label="平均评价星级" value={loading ? '...' : (averageRating ?? '暂无')} detail="来自近期开单后的评价" />
          {onTimeRate ? <SummaryCard label="按时履约率" value={`${onTimeRate}%`} detail="可选后端字段" /> : null}
        </div>
      </section>

      <section className="credit-section">
        <div className="credit-section-head">
          <h2>{publicView ? '信用变化摘要' : '信用变化时间线'}</h2>
          <span>{publicView ? '公开页仅显示脱敏摘要' : '最近 3 - 5 条变化记录'}</span>
        </div>
        <div className="credit-timeline">
          {loading ? (
            <div className="credit-placeholder">信用变化加载中...</div>
          ) : visibleRecords.length ? visibleRecords.map(record => <TimelineItem key={record.recordId} record={record} />) : (
            <div className="credit-empty">暂无信用变化记录</div>
          )}
        </div>
      </section>

      <section className="credit-section">
        <div className="credit-section-head">
          <h2>近期评价预览</h2>
          <button className="credit-link-btn" type="button" onClick={() => navigate(detailPath)}>查看全部评价 →</button>
        </div>
        <div className="credit-review-grid">
          {loading ? (
            <div className="credit-placeholder">评价加载中...</div>
          ) : recentReviews.length ? recentReviews.map(review => <ReviewCard key={review.reviewId} review={review} />) : (
            <div className="credit-empty">暂无评价预览</div>
          )}
        </div>
      </section>

      <section className="credit-footer">
        <button className="credit-rule-link" type="button" onClick={() => setRuleOpen(true)}>了解信用分如何计算 →</button>
      </section>

      <Dialog open={ruleOpen} onClose={() => setRuleOpen(false)} fullWidth maxWidth="sm" className="credit-rule-dialog">
        <DialogTitle>信用分如何计算</DialogTitle>
        <DialogContent>
          <Stack gap={1.5}>
            <Alert severity="info">信用分综合参考履约表现、评价反馈、申诉处理结果与平台规则。</Alert>
            <Divider />
            <Typography variant="body2" className="credit-rule-text">
              我们只展示当前账号可见的公开信息。公开主页不会展示内部备注，也不会展示敏感的信用变动细节。
            </Typography>
            <Stack gap={1} className="credit-rule-list">
              <div><strong>履约记录</strong><span>按时完成、取消率与异常处理情况会影响分值。</span></div>
              <div><strong>评价反馈</strong><span>收到的真实评价、追评与负面反馈都会纳入参考。</span></div>
              <div><strong>申诉结果</strong><span>审核后成立的申诉会影响信用判断。</span></div>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </section>
  )
}
