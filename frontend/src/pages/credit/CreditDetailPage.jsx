import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { creditApi, reviewApi } from '../../api/index.js'
import { ReviewArchiveCard } from '../../components/reviews/ReviewArchiveCard.jsx'
import { buildOrderNavigationTarget } from '../../utils/orderNavigation.js'
import '../profile/profile.css'
import './credit.css'

function formatTime(value) {
  if (!value) return '暂无'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '暂无' : date.toLocaleString('zh-CN', { hour12: false })
}

function formatUpdatedTime(value) {
  if (!value) return '暂无'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '暂无' : date.toLocaleString('zh-CN', { hour12: false })
}

function formatScore(value) {
  if (value === null || value === undefined) return '暂无'
  if (typeof value === 'string' && value.trim() === '') return '暂无'
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

function creditUnavailableMessage() {
  return '信用页暂时打不开，请稍后再试。'
}

function creditLevel(score, summaryLevel) {
  const label = String(summaryLevel || '').trim()
  if (label) {
    return label.startsWith('信用') || ['新用户', '待积累', '待提升'].includes(label) ? label : `信用${label}`
  }
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return '新用户'
  if (numeric >= 90) return '信用优秀'
  if (numeric >= 75) return '信用良好'
  if (numeric >= 60) return '待提升'
  return '信用较差'
}

function normalizeRecords(value) {
  if (Array.isArray(value)) return value
  return Array.isArray(value?.items) ? value.items : []
}

function getRecordOrderId(record) {
  if (record.relatedOrderId) return record.relatedOrderId
  if (record.orderId) return record.orderId
  const sourceType = String(record.sourceType || '').toUpperCase()
  return sourceType.includes('ORDER') ? record.sourceId : null
}

function getReviewJumpTarget(review) {
  if (!review?.orderId) return null
  return buildOrderNavigationTarget(review.orderId, {
    section: 'reviews',
    reviewId: review.reviewId
  })
}

function getRecordReviewJumpTarget(record) {
  const orderId = getRecordOrderId(record)
  if (!orderId) return null
  const sourceType = String(record.sourceType || '').toUpperCase()
  const eventType = String(record.eventType || '').toUpperCase()
  const sourceId = record.sourceId
  if (sourceType.includes('ARBITRATION') || eventType.includes('ARBITRATION') || eventType.includes('COMPLAINT')) {
    return buildOrderNavigationTarget(orderId, {
      section: 'reviews',
      complaintId: sourceId
    })
  }
  if (sourceType.includes('REVIEW') || eventType.includes('REVIEW')) {
    return buildOrderNavigationTarget(orderId, {
      section: 'reviews',
      reviewId: sourceId
    })
  }
  return null
}

function recordMetaLabel(record, orderId) {
  if (orderId) return '关联订单'
  const sourceType = String(record.sourceType || '').toUpperCase()
  const eventType = String(record.eventType || '').toUpperCase()
  if (sourceType.includes('REVIEW') || eventType.includes('REVIEW')) return '评价'
  if (sourceType.includes('ORDER') || eventType.includes('ORDER')) return '合作'
  if (sourceType.includes('REFUND') || eventType.includes('REFUND')) return '退款'
  return '分数变化'
}

function recordTitle(record, delta) {
  const text = `${record.eventType || ''} ${record.reason || ''} ${record.sourceType || ''}`.toUpperCase()
  if (text.includes('REVIEW')) return delta < 0 ? '收到低分评价' : '收到订单评价'
  if (text.includes('REFUND')) return '退款责任记录'
  if (text.includes('CANCEL')) return '订单取消记录'
  if (text.includes('ORDER')) return delta < 0 ? '订单履约异常' : '订单履约记录'
  if (delta < 0) return '这次减分'
  if (delta > 0) return '这次加分'
  return '分数变化'
}

function recordDetail(record, delta) {
  const text = `${record.eventType || ''} ${record.reason || ''} ${record.sourceType || ''}`.toUpperCase()
  if (text.includes('REVIEW')) {
    if (delta < 0) return '这次低分评价会拉低当前信用分，后续稳定合作和好评会慢慢补回来。'
    if (delta > 0) return '这次评价不错，已经体现在信用分里。'
    return '这次评价已经收下，分数暂时没有变化。'
  }
  if (text.includes('REFUND')) return '这次退款情况已经记在信用分参考里。'
  if (text.includes('CANCEL')) return '这次取消合作已经记在信用分参考里。'
  if (text.includes('ORDER')) return '这次合作结果已经记在信用分参考里。'
  if (delta < 0) return '这次情况会影响信用分，后续多完成合作、多收好评会逐步恢复。'
  if (delta > 0) return '这次情况让信用表现更好了。'
  return '这次情况已经记在信用页里。'
}

export function CreditDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const targetUserId = Number(userId || currentUser.userId)
  const isSelf = targetUserId === currentUser.userId
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState([])
  const [reviews, setReviews] = useState([])
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rulesOpen, setRulesOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      if (isSelf) {
        const [summaryResult, recordsResult] = await Promise.allSettled([
          creditApi.summary(targetUserId, currentUser),
          creditApi.records(targetUserId, currentUser)
        ])
        if (cancelled) return
        setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null)
        setRecords(recordsResult.status === 'fulfilled' ? normalizeRecords(recordsResult.value) : [])
        const failed = [summaryResult, recordsResult].find(result => result.status === 'rejected')
        setNotice(failed ? creditUnavailableMessage() : null)
      } else {
        const [summaryResult, reviewsResult] = await Promise.allSettled([
          creditApi.summary(targetUserId, currentUser),
          reviewApi.listByUser(targetUserId, currentUser)
        ])
        if (cancelled) return
        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value)
        } else {
          setNotice(creditUnavailableMessage())
        }
        setReviews(reviewsResult.status === 'fulfilled' ? (Array.isArray(reviewsResult.value) ? reviewsResult.value : []) : [])
        setRecords([])
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [targetUserId, isSelf, currentUser])

  const score = useMemo(
    () => formatScore(summary?.creditScore),
    [summary?.creditScore]
  )
  const level = useMemo(
    () => creditLevel(summary?.creditScore, summary?.creditLevel),
    [summary?.creditScore, summary?.creditLevel]
  )

  const effectiveOrders = formatMetric(summary?.effectiveOrderCount)
  const completedOrders = formatMetric(summary?.completedOrderCount)
  const reviewCount = formatMetric(summary?.receivedReviewCount)
  const goodReviewRate = formatPercent(summary?.goodReviewRate)
  const defaultRate = formatPercent(summary?.defaultRate)
  const riskRecords = formatMetric(summary?.riskRecordCount)
  const recordCount = records.length
  const hasRecords = records.length > 0
  const hasSummary = summary != null
  const lastUpdated = summary?.lastUpdatedAt || records[0]?.createdAt || null
  const displayScore = hasSummary ? score : '暂无'
  const displayLevel = hasSummary ? level : '新用户'
  const displayRecordCount = isSelf ? (hasRecords ? recordCount : '暂无') : '仅自己可见'
  const overviewEffectiveOrders = hasSummary ? effectiveOrders : '--'
  const overviewGoodReviewRate = hasSummary ? goodReviewRate : '--'
  const overviewDefaultRate = hasSummary ? defaultRate : '--'
  const overviewRiskRecords = hasSummary ? riskRecords : '--'

  return (
    <div className="pp-main credit-detail-page">
      <div className="pp-crumb">
        <span><strong>信用分</strong> / 用户 {targetUserId}</span>
        <button className="secondary-btn" type="button" onClick={() => navigate(-1)}>返回</button>
      </div>

      {notice && (
        <div className="pp-empty credit-notice">
          <h3>暂时看不到信用分</h3>
          <p>{notice}</p>
        </div>
      )}

      <section className="profile-hero credit-hero-surface">
        <div className="credit-hero-watermark" aria-hidden="true">CREDIT</div>

        <div className="profile-photo-wrap">
          <div className="credit-stamp-ring" aria-hidden="true" />
          <div className="credit-score-plain">
            <b>{displayScore}</b>
            <span>信用评分</span>
          </div>
        </div>

        <div className="hero-info">
          <div className="ticket-kicker">信用分</div>
          <div className="hero-name-row">
            <h1 className="hero-name">{displayLevel}</h1>
            <span className="role-badge">用户 {targetUserId}</span>
          </div>
          <p className="profile-uid">最近更新：{formatUpdatedTime(lastUpdated)}</p>
          <p className="profile-signature">
            信用分会参考完成合作后的评价、是否按约以及争议处理情况，近期表现越稳定，分数通常也越稳。
          </p>
          <div className="profile-meta-line">
            <span>计分合作 {effectiveOrders}</span>
            <span>完成合作 {completedOrders}</span>
            <span>收到评价 {reviewCount}</span>
            <span>分数变化 {displayRecordCount}</span>
          </div>
          <Button
            type="button"
            className="credit-rules-entry"
            variant="outlined"
            size="small"
            onClick={() => setRulesOpen(true)}
          >
            评分说明
          </Button>
        </div>

        <div className="hero-side">
          <div>
            <div className="id-label">当前信用分</div>
            <div className="id-number">{displayScore}</div>
          </div>
          <div className="metric-grid">
            <div className="metric"><b>{overviewEffectiveOrders}</b><span>计分合作</span></div>
            <div className="metric"><b>{overviewGoodReviewRate}</b><span>好评率</span></div>
            <div className="metric"><b>{overviewDefaultRate}</b><span>未按约占比</span></div>
            <div className="metric"><b>{overviewRiskRecords}</b><span>争议记录</span></div>
          </div>
        </div>
      </section>

      {!isSelf && (
        <section className="panel-card credit-records-panel">
          <div className="section-head">
            <div>
              <h2>历史评价</h2>
              <p>这些评价来自真实合作，能帮助你了解对方平时的合作表现。</p>
            </div>
            <div className="section-mark">{reviews.length || '暂无'}</div>
          </div>
          {loading ? (
            <div className="pp-empty"><h3>加载中...</h3></div>
          ) : reviews.length > 0 ? (
            <Stack spacing={1.2} style={{ marginTop: 8 }}>
              {reviews.map((review, index) => (
                <ReviewArchiveCard
                  key={review.reviewId || index}
                  review={{
                    ...review,
                    replyTime: review.replyTime ? formatTime(review.replyTime) : ''
                  }}
                  timeText={formatTime(review.createdAt)}
                  actionLabel="查看本次约拍评价区"
                  onAction={item => {
                    const target = getReviewJumpTarget(item)
                    if (target) navigate(target.to, { state: target.state })
                  }}
                />
              ))}
            </Stack>
          ) : (
            <div className="pp-empty"><h3>暂无评价</h3><p>该用户尚未收到任何评价。</p></div>
          )}
        </section>
      )}

      {isSelf && (
        <section className="panel-card credit-records-panel">
          <div className="section-head">
            <div>
              <h2>分数变化</h2>
              <p>按时间查看每一次分数变化，只保留你一眼能看懂的原因。</p>
            </div>
            <div className="section-mark">{hasRecords ? recordCount : '暂无'}</div>
          </div>

          {loading ? (
            <div className="pp-empty">
              <h3>正在整理信用分</h3>
              <p>请稍等，这里马上显示最新情况。</p>
            </div>
          ) : hasRecords ? (
            <Stack spacing={1.35} className="credit-note-stack">
              {records.map((record, index) => {
                const delta = Number(record.appliedScoreChange ?? record.scoreChange ?? record.deltaScore ?? 0)
                const positive = delta > 0
                const negative = delta < 0
                const orderId = getRecordOrderId(record)
                const beforeScore = record.beforeScore != null ? formatScore(record.beforeScore) : '暂无'
                const afterScore = record.scoreAfter != null ? formatScore(record.scoreAfter) : '暂无'
                const title = recordTitle(record, delta)
                const detail = recordDetail(record, delta)
                const metaLabel = recordMetaLabel(record, orderId)
                const toneClass = negative ? 'credit-note--negative' : positive ? 'credit-note--positive' : 'credit-note--neutral'
                const reviewTarget = getRecordReviewJumpTarget(record)

                return (
                  <Paper
                    key={record.recordId || record.id || `${title}-${record.createdAt}-${index}`}
                    elevation={0}
                    className={`credit-note ${toneClass}`}
                    style={{ '--credit-note-index': index }}
                    role={reviewTarget ? 'button' : undefined}
                    tabIndex={reviewTarget ? 0 : undefined}
                    onClick={reviewTarget ? () => navigate(reviewTarget.to, { state: reviewTarget.state }) : undefined}
                    onKeyDown={reviewTarget ? event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        navigate(reviewTarget.to, { state: reviewTarget.state })
                      }
                    } : undefined}
                  >
                    <div className="credit-note-delta">
                      <strong>{positive ? '+' : ''}{delta.toFixed(1)}</strong>
                      <span>分数变化</span>
                    </div>
                    <div className="credit-note-body">
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography className="credit-note-title">{title}</Typography>
                        <Chip
                          size="small"
                          label={positive ? '加分' : negative ? '减分' : '记录'}
                          sx={{
                            height: 26,
                            fontWeight: 800,
                            bgcolor: negative ? 'rgba(248,81,4,.08)' : positive ? 'rgba(13,47,178,.08)' : 'rgba(91,96,106,.08)',
                            color: negative ? '#c53b05' : positive ? 'primary.main' : '#5f6670'
                          }}
                        />
                      </Stack>
                      <Typography className="credit-note-detail">{detail}</Typography>
                      <Typography className="credit-note-detail">
                        变更前 {beforeScore} · 变更后 {afterScore}
                      </Typography>
                      {reviewTarget ? (
                        <Button
                          variant="text"
                          size="small"
                          onClick={event => {
                            event.stopPropagation()
                            navigate(reviewTarget.to, { state: reviewTarget.state })
                          }}
                          sx={{
                            mt: 0.35,
                            alignSelf: 'flex-start',
                            minHeight: 30,
                            px: 0.35,
                            color: '#1d4ed8',
                            fontWeight: 900,
                            borderRadius: 999,
                            '&:hover': { bgcolor: 'rgba(29, 78, 216, .06)' }
                          }}
                        >
                          {String(record.sourceType || '').toUpperCase().includes('ARBITRATION') ? '查看处理记录' : '查看相关评价'}
                        </Button>
                      ) : null}
                    </div>
                    <div className="credit-note-meta">
                      <div>{formatTime(record.createdAt)}</div>
                      <div>{metaLabel}</div>
                    </div>
                  </Paper>
                )
              })}
            </Stack>
          ) : (
            <div className="pp-empty">
              <h3>还没有分数变化</h3>
              <p>完成合作或收到评价后，这里会出现变化说明。</p>
            </div>
          )}
        </section>
      )}

      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>评分说明</DialogTitle>
        <DialogContent>
          <div className="credit-rules-copy">
            <p>信用分主要参考完成合作后的评价、是否按约以及争议处理结果。拍摄前取消、没有评价的合作，一般不会直接影响信用分。</p>
            <p>如果合作里出现争议，并确认责任在你，这里会留下提醒；之后稳定完成合作、持续收到好评，分数也会慢慢回升。</p>
            <p>评价越稳定、好评越多，信用分通常越高。</p>
            <p><strong>信用优秀：</strong>90-100，评价稳定，基本都能按约完成。</p>
            <p><strong>信用良好：</strong>75-89，整体表现稳定，偶尔有波动。</p>
            <p><strong>待提升：</strong>60-74，还需要更多稳定合作和真实好评。</p>
            <p><strong>信用较差：</strong>60 以下，近期低分评价或争议情况偏多。</p>
            <p><strong>新用户 / 待积累：</strong>合作和评价还不够多时，会先显示积累状态。</p>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRulesOpen(false)}>知道了</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
