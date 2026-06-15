import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { creditApi } from '../../api/index.js'
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
  if (record.orderId) return record.orderId
  const sourceType = String(record.sourceType || '').toUpperCase()
  return sourceType.includes('ORDER') ? record.sourceId : null
}

function recordMetaLabel(record, orderId) {
  if (orderId) return '关联订单'
  const sourceType = String(record.sourceType || '').toUpperCase()
  const eventType = String(record.eventType || '').toUpperCase()
  if (sourceType.includes('REVIEW') || eventType.includes('REVIEW')) return '评价记录'
  if (sourceType.includes('ORDER') || eventType.includes('ORDER')) return '订单记录'
  if (sourceType.includes('REFUND') || eventType.includes('REFUND')) return '退款记录'
  return '信用记录'
}

function recordTitle(record, delta) {
  const text = `${record.eventType || ''} ${record.reason || ''} ${record.sourceType || ''}`.toUpperCase()
  if (text.includes('REVIEW')) return delta < 0 ? '收到低分评价' : '收到订单评价'
  if (text.includes('REFUND')) return '退款责任记录'
  if (text.includes('CANCEL')) return '订单取消记录'
  if (text.includes('ORDER')) return delta < 0 ? '订单履约异常' : '订单履约记录'
  if (delta < 0) return '信用扣分'
  if (delta > 0) return '信用加分'
  return '信用记录更新'
}

function recordDetail(record, delta) {
  const text = `${record.eventType || ''} ${record.reason || ''} ${record.sourceType || ''}`.toUpperCase()
  if (text.includes('REVIEW')) {
    if (delta < 0) return '低分评价会拉低信用表现，后续稳定履约和好评会逐步修复。'
    if (delta > 0) return '评价表现较好，已计入信用表现。'
    return '评价已记录，本次未造成分数变化。'
  }
  if (text.includes('REFUND')) return '该退款记录已计入风险记录。'
  if (text.includes('CANCEL')) return '该订单取消记录已计入履约表现。'
  if (text.includes('ORDER')) return '该订单结果已计入履约表现。'
  if (delta < 0) return '该记录会影响信用分，请留意后续履约和评价。'
  if (delta > 0) return '该记录提升了信用表现。'
  return '该记录已纳入信用档案。'
}

export function CreditDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const targetUserId = Number(userId || currentUser.userId)
  const isSelf = targetUserId === currentUser.userId
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState([])
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
        const failed = [summaryResult, recordsResult].find(r => r.status === 'rejected')
        setNotice(failed ? failed.reason?.message || '信用数据暂时不可用' : null)
      } else {
        const summaryResult = await creditApi.summary(targetUserId, currentUser).catch(e => ({ _err: e.message }))
        if (cancelled) return
        if (summaryResult?._err) {
          setNotice(summaryResult._err)
        } else {
          setSummary(summaryResult)
        }
        setRecords([])
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [targetUserId, isSelf])

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
  const fulfillmentRate = formatPercent(summary?.fulfillmentRate)
  const riskRecords = formatMetric(summary?.riskRecordCount)
  const recordCount = records.length
  const hasRecords = records.length > 0
  const hasSummary = summary != null
  const lastUpdated = summary?.lastUpdatedAt || records[0]?.createdAt || null
  const displayScore = hasSummary ? score : '暂无'
  const displayLevel = hasSummary ? level : '新用户'
  const displayRecordCount = isSelf ? (hasRecords ? recordCount : '暂无') : '不公开'
  const overviewEffectiveOrders = hasSummary ? effectiveOrders : '--'
  const overviewGoodReviewRate = hasSummary ? goodReviewRate : '--'
  const overviewFulfillmentRate = hasSummary ? fulfillmentRate : '--'
  const overviewRiskRecords = hasSummary ? riskRecords : '--'

  return (
    <div className="pp-main credit-detail-page">
      <div className="pp-crumb">
        <span><strong>信用</strong> / UID {targetUserId}</span>
        <button className="secondary-btn" type="button" onClick={() => navigate(-1)}>返回</button>
      </div>

      {notice && (
        <div className="pp-empty credit-notice">
          <h3>信用数据暂时不可用</h3>
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
          <div className="ticket-kicker">Credit File</div>
          <div className="hero-name-row">
            <h1 className="hero-name">{displayLevel}</h1>
            <span className="role-badge">UID {targetUserId}</span>
          </div>
          <p className="profile-uid">最近更新：{formatUpdatedTime(lastUpdated)}</p>
          <p className="profile-signature">
            信用分参考有效订单、好评率、履约率和风险记录；新用户需要完成订单或收到评价后开始积累。
          </p>
          <div className="profile-meta-line">
            <span>有效订单 {effectiveOrders}</span>
            <span>完成订单 {completedOrders}</span>
            <span>收到评价 {reviewCount}</span>
            <span>信用记录 {displayRecordCount}</span>
          </div>
          <Button
            type="button"
            className="credit-rules-entry"
            variant="outlined"
            size="small"
            onClick={() => setRulesOpen(true)}
          >
            信用规则说明
          </Button>
        </div>

        <div className="hero-side">
          <div>
            <div className="id-label">信用概览</div>
            <div className="id-number">{displayScore}</div>
          </div>
          <div className="metric-grid">
            <div className="metric"><b>{overviewEffectiveOrders}</b><span>有效订单</span></div>
            <div className="metric"><b>{overviewGoodReviewRate}</b><span>好评率</span></div>
            <div className="metric"><b>{overviewFulfillmentRate}</b><span>履约率</span></div>
            <div className="metric"><b>{overviewRiskRecords}</b><span>风险记录</span></div>
          </div>
        </div>
      </section>

      <section className="panel-card credit-records-panel">
        <div className="section-head">
          <div>
            <h2>信用记录</h2>
            <p>按时间倒序查看每一次信用变化，记录只展示用户能理解的原因。</p>
          </div>
          <div className="section-mark">{hasRecords ? recordCount : '暂无'}</div>
        </div>

        {loading ? (
          <div className="pp-empty">
            <h3>正在加载信用记录</h3>
            <p>正在更新信用分和记录。</p>
          </div>
        ) : !isSelf ? (
          <div className="pp-empty">
            <h3>详细记录不公开</h3>
            <p>信用记录属于个人隐私，仅本人可见。</p>
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

              return (
                <Paper
                  key={record.recordId || record.id || `${title}-${record.createdAt}-${index}`}
                  elevation={0}
                  className={`credit-note ${toneClass}`}
                  style={{ '--credit-note-index': index }}
                  role={orderId ? 'button' : undefined}
                  tabIndex={orderId ? 0 : undefined}
                  onClick={orderId ? () => navigate(`/orders?orderId=${orderId}`) : undefined}
                  onKeyDown={orderId ? event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(`/orders?orderId=${orderId}`)
                    }
                  } : undefined}
                >
                  <span className="credit-note-thread" aria-hidden="true" />
                  <span className="credit-note-pin" aria-hidden="true" />
                  <div className="credit-note-delta">
                    <strong>{positive ? '+' : ''}{delta.toFixed(1)}</strong>
                    <span>分变化</span>
                  </div>
                  <div className="credit-note-body">
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography className="credit-note-title">{title}</Typography>
                      <Chip
                        size="small"
                        label={positive ? '加分' : negative ? '扣分' : '记录'}
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
            <h3>暂无信用记录</h3>
            <p>完成订单或收到评价后，这里会更新记录。</p>
          </div>
        )}
      </section>

      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>信用规则说明</DialogTitle>
        <DialogContent>
          <div className="credit-rules-copy">
            <p>信用分参考有效订单、好评率、履约率和风险记录。新用户不会直接显示 100 分，需要完成订单或收到评价后开始积累。</p>
            <p><strong>信用优秀：</strong>90-100，样本充足且履约稳定。</p>
            <p><strong>信用良好：</strong>75-89，整体可靠，近期记录正常。</p>
            <p><strong>待提升：</strong>60-74，仍需积累更多好评或改善履约表现。</p>
            <p><strong>信用较差：</strong>60 以下，存在较多风险记录、低分评价或履约问题。</p>
            <p><strong>新用户 / 待积累：</strong>记录不足时会先展示积累状态，分数会随着真实订单和评价逐步稳定。</p>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRulesOpen(false)}>知道了</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
