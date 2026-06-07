import { useEffect, useMemo, useState } from 'react'
import { Chip, Paper, Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { creditApi } from '../../api/index.js'
import '../profile/profile.css'
import './credit.css'

function formatTime(value) {
  if (!value) return '刚刚'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '刚刚' : date.toLocaleString('zh-CN', { hour12: false })
}

function formatScore(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '--'
}

function formatMetric(value) {
  return value === null || value === undefined || value === '' ? '--' : value
}

function creditLevel(score, summaryLevel) {
  if (summaryLevel) return String(summaryLevel).startsWith('信用') ? summaryLevel : `信用${summaryLevel}`
  const numeric = Number(score)
  if (!Number.isFinite(numeric)) return '信用概览'
  if (numeric >= 90) return '信用优秀'
  if (numeric >= 70) return '信用良好'
  return '信用较差'
}

function normalizeRecords(value) {
  if (Array.isArray(value)) return value
  return Array.isArray(value?.items) ? value.items : []
}

export function CreditDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const targetUserId = Number(userId || currentUser.userId)
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState([])
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [summaryResult, recordsResult] = await Promise.allSettled([
        creditApi.summary(targetUserId, currentUser),
        creditApi.records(targetUserId, currentUser)
      ])

      if (cancelled) return

      setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null)
      setRecords(recordsResult.status === 'fulfilled' ? normalizeRecords(recordsResult.value) : [])
      const failed = [summaryResult, recordsResult].find(result => result.status === 'rejected')
      setNotice(failed ? failed.reason?.message || '信用数据暂时不可用' : null)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [targetUserId, currentUser])

  const score = useMemo(
    () => formatScore(summary?.creditScore ?? currentUser.creditScore),
    [summary?.creditScore, currentUser.creditScore]
  )
  const level = useMemo(
    () => creditLevel(summary?.creditScore ?? currentUser.creditScore, summary?.creditLevel),
    [summary?.creditScore, currentUser.creditScore, summary?.creditLevel]
  )

  const completedOrders = formatMetric(summary?.completedOrderCount ?? summary?.completedOrders)
  const reviewCount = formatMetric(summary?.receivedReviewCount ?? summary?.reviewCount)
  const averageRating = formatMetric(summary?.averageRating)
  const recordCount = records.length
  const lastUpdated = summary?.lastUpdatedAt || records[0]?.createdAt || null

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
            <b>{score}</b>
            <span>信用评分</span>
          </div>
        </div>

        <div className="hero-info">
          <div className="ticket-kicker">Credit File</div>
          <div className="hero-name-row">
            <h1 className="hero-name">{level}</h1>
            <span className="role-badge">UID {targetUserId}</span>
          </div>
          <p className="profile-uid">最近更新：{formatTime(lastUpdated)}</p>
          <p className="profile-signature">
            保留与你个人主页一致的视觉语言，集中展示信用评分、履约概览和信用变化记录。
          </p>
          <div className="profile-meta-line">
            <span>记录 {recordCount}</span>
            <span>完成订单 {completedOrders}</span>
            <span>收到评价 {reviewCount}</span>
            <span>平均评价 {averageRating}</span>
          </div>
        </div>

        <div className="hero-side">
          <div>
            <div className="id-label">信用概览</div>
            <div className="id-number">{score}</div>
          </div>
          <div className="metric-grid">
            <div className="metric"><b>{completedOrders}</b><span>完成订单</span></div>
            <div className="metric"><b>{reviewCount}</b><span>收到评价</span></div>
            <div className="metric"><b>{averageRating}</b><span>平均评价</span></div>
            <div className="metric"><b>{recordCount}</b><span>信用记录</span></div>
          </div>
        </div>
      </section>

      <section className="panel-card credit-records-panel">
        <div className="section-head">
          <div>
            <h2>信用记录</h2>
            <p>按时间倒序排列，保留每一次信用变化的来源和结果。</p>
          </div>
          <div className="section-mark">{recordCount}</div>
        </div>

        {loading ? (
          <div className="pp-empty">
            <h3>正在加载信用记录</h3>
            <p>请稍等，系统正在拉取最新的信用摘要和变更历史。</p>
          </div>
        ) : recordCount ? (
          <Stack spacing={1.35} className="credit-note-stack">
            {records.map((record, index) => {
              const delta = Number(record.appliedScoreChange ?? record.scoreChange ?? record.deltaScore ?? 0)
              const positive = delta >= 0
              const beforeScore = record.beforeScore != null ? formatScore(record.beforeScore) : '--'
              const afterScore = record.scoreAfter != null ? formatScore(record.scoreAfter) : '--'
              const title = record.reason || record.eventType || '信用变更'
              const detail = record.sourceType || record.sourceId
                ? `来源：${record.sourceType || '系统'}${record.sourceId ? ` · ${record.sourceId}` : ''}`
                : record.description || record.remark || '系统记录'

              return (
                <Paper
                  key={record.recordId || record.id || `${title}-${record.createdAt}`}
                  elevation={0}
                  className={`credit-note ${positive ? 'credit-note--positive' : 'credit-note--negative'}`}
                  style={{ animationDelay: `${index * 48}ms` }}
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
                        label={positive ? '加分' : '扣分'}
                        sx={{
                          height: 26,
                          fontWeight: 800,
                          bgcolor: positive ? 'rgba(13,47,178,.08)' : 'rgba(248,81,4,.08)',
                          color: positive ? 'primary.main' : '#c53b05'
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
                    <div>{record.sourceType || '系统事件'}</div>
                  </div>
                </Paper>
              )
            })}
          </Stack>
        ) : (
          <div className="pp-empty">
            <h3>暂无信用记录</h3>
            <p>订单完成、评价变化或平台规则更新后，这里会显示最新记录。</p>
          </div>
        )}
      </section>
    </div>
  )
}
