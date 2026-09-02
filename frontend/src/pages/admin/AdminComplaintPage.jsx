import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { adminApi } from '../../api/adminApi.js'
import { reviewApi } from '../../api/reviewApi.js'
import {
  buildComplaintArbitrationBody,
  complaintActionCopy,
  completeAdminMutation,
  enrichComplaintsWithReviewContext,
  loadComplaintSource,
  refreshComplaintSurfaces,
  shouldUseAdminDemoFixtures,
} from './adminData.js'
import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'
import { AdminStatusTag } from './components/AdminStatusTag.jsx'
import { ModerationReasonDialog } from './components/ModerationReasonDialog.jsx'

const complaintStatuses = [
  { value: 'PENDING', label: '待处理' },
  { value: 'RESOLVED', label: '已处理' },
  { value: 'ALL', label: '全部状态' },
]

const statusLabels = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  RESOLVED: '已处理',
  CANCELED: '已取消',
}

const arbitrationLabels = {
  REJECTED: '维持评价',
  REVIEW_HIDDEN: '隐藏评价',
}

function normalizeList(response) {
  if (Array.isArray(response)) return response
  for (const key of ['items', 'records', 'content', 'list']) {
    if (Array.isArray(response?.[key])) return response[key]
  }
  return []
}

function formatDateTime(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function personLabel(nickname, userId) {
  return nickname || (userId ? `用户 #${userId}` : '—')
}

function isPending(complaint) {
  return String(complaint?.status || '').toUpperCase() === 'PENDING'
}

function filterComplaints(complaints, keyword) {
  const normalizedKeyword = String(keyword || '').trim().toLocaleLowerCase('zh-CN')
  if (!normalizedKeyword) return complaints

  return complaints.filter(complaint => [
    complaint.complaintId,
    complaint.reviewId,
    complaint.complainantNickname,
    complaint.respondentNickname,
    complaint.reason,
    complaint.review?.content,
  ].some(value => String(value ?? '').toLocaleLowerCase('zh-CN').includes(normalizedKeyword)))
}

function ComplaintDetailsDialog({ complaint, onClose }) {
  if (!complaint) return null

  const review = complaint.review
  return (
    <div className="admin-complaint-detail-backdrop">
      <section
        className="admin-complaint-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-complaint-detail-title"
        tabIndex={-1}
        autoFocus
        onKeyDown={event => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <header>
          <div>
            <span>COMPLAINT #{complaint.complaintId}</span>
            <h2 id="admin-complaint-detail-title">评价与申诉详情</h2>
          </div>
          <button className="admin-button admin-button--quiet" type="button" onClick={onClose}>关闭</button>
        </header>
        <div className="admin-complaint-detail-grid">
          <section aria-labelledby="admin-original-review-title">
            <p className="admin-complaint-kicker">ORIGINAL REVIEW</p>
            <h3 id="admin-original-review-title">原评价</h3>
            {review ? (
              <dl>
                <div><dt>评价 ID</dt><dd>{review.reviewId}</dd></div>
                {review.rating !== null && review.rating !== undefined ? (
                  <div><dt>评分</dt><dd>{review.rating} / 5</dd></div>
                ) : null}
                {review.reviewerNickname ? <div><dt>评价人</dt><dd>{review.reviewerNickname}</dd></div> : null}
                {review.targetUserNickname ? <div><dt>被评价人</dt><dd>{review.targetUserNickname}</dd></div> : null}
                {review.content ? <div className="admin-complaint-detail-copy"><dt>评价内容</dt><dd>{review.content}</dd></div> : null}
                {review.createdAt ? <div><dt>评价时间</dt><dd>{formatDateTime(review.createdAt)}</dd></div> : null}
              </dl>
            ) : (
              <AdminEmptyState title="评价详情暂不可用" description="申诉记录仍保留，未补造评分或评价文本。" />
            )}
          </section>
          <section aria-labelledby="admin-complaint-reason-title">
            <p className="admin-complaint-kicker">COMPLAINT RECORD</p>
            <h3 id="admin-complaint-reason-title">申诉与处理</h3>
            <dl>
              <div><dt>申诉人</dt><dd>{personLabel(complaint.complainantNickname, complaint.complainantId)}</dd></div>
              <div><dt>被申诉人</dt><dd>{personLabel(complaint.respondentNickname, complaint.respondentId)}</dd></div>
              <div><dt>申诉时间</dt><dd>{formatDateTime(complaint.createdAt)}</dd></div>
              <div className="admin-complaint-detail-copy"><dt>申诉理由</dt><dd>{complaint.reason || '—'}</dd></div>
              {complaint.evidenceFileIds ? <div><dt>证据文件 ID</dt><dd>{complaint.evidenceFileIds}</dd></div> : null}
              {complaint.arbitrationResult ? (
                <div><dt>处理结果</dt><dd>{arbitrationLabels[complaint.arbitrationResult] || complaint.arbitrationResult}</dd></div>
              ) : null}
              {complaint.arbitrationComment ? (
                <div className="admin-complaint-detail-copy"><dt>处理说明</dt><dd>{complaint.arbitrationComment}</dd></div>
              ) : null}
              {complaint.handledAt ? <div><dt>处理时间</dt><dd>{formatDateTime(complaint.handledAt)}</dd></div> : null}
              {complaint.handledByNickname || complaint.handledBy ? (
                <div><dt>处理人</dt><dd>{personLabel(complaint.handledByNickname, complaint.handledBy)}</dd></div>
              ) : null}
            </dl>
          </section>
        </div>
      </section>
    </div>
  )
}

export function AdminComplaintPage() {
  const { currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [detailsItem, setDetailsItem] = useState(null)
  const [actionState, setActionState] = useState({
    item: null,
    result: '',
    comment: '',
    submitting: false,
    error: '',
  })

  const requestedStatus = String(searchParams.get('status') || 'PENDING').toUpperCase()
  const status = complaintStatuses.some(option => option.value === requestedStatus) ? requestedStatus : 'PENDING'
  const keyword = searchParams.get('q') || ''
  const demoParam = searchParams.get('demo') || ''
  const demoMode = shouldUseAdminDemoFixtures(import.meta.env.DEV, `demo=${demoParam}`)

  function updateSearchParam(key, value) {
    const nextParams = new URLSearchParams(searchParams)
    if (value) nextParams.set(key, value)
    else nextParams.delete(key)
    setSearchParams(nextParams, { replace: true })
  }

  const requestItems = useCallback(async () => {
    const complaints = await loadComplaintSource({
      demoMode,
      loadReal: async () => normalizeList(await adminApi.listReviewComplaints(
        status === 'ALL' ? {} : { status },
        currentUser,
      )),
      loadDemo: async () => {
        if (!(import.meta.env.DEV && demoParam === '1')) {
          throw new Error('演示数据仅限开发模式')
        }
        const { demoAdminComplaints } = await import('../../mocks/dline/adminFixtures.js')
        return status === 'ALL'
          ? demoAdminComplaints
          : demoAdminComplaints.filter(item => item.status === status)
      },
    })

    if (demoMode) return enrichComplaintsWithReviewContext(complaints, {})

    const reviewIds = [...new Set(complaints.map(item => item.reviewId).filter(Boolean))]
    const reviewResults = await Promise.allSettled(
      reviewIds.map(reviewId => reviewApi.detail(reviewId, currentUser)),
    )
    const contextByReviewId = Object.fromEntries(
      reviewIds.map((reviewId, index) => [reviewId, reviewResults[index]]),
    )
    return enrichComplaintsWithReviewContext(complaints, contextByReviewId)
  }, [currentUser, demoMode, demoParam, status])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setSuccess('')

    requestItems()
      .then(nextItems => {
        if (active) setItems(nextItems)
      })
      .catch(requestError => {
        if (!active) return
        setItems([])
        setError(requestError?.message || '评价申诉列表加载失败，请重试。')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [requestItems, retryKey])

  const visibleItems = useMemo(() => filterComplaints(items, keyword), [items, keyword])

  function openAction(item, result) {
    setDetailsItem(null)
    setActionState({ item, result, comment: '', submitting: false, error: '' })
  }

  async function submitArbitration() {
    const item = actionState.item
    if (!item) return

    let body
    try {
      body = buildComplaintArbitrationBody(actionState.result, actionState.comment)
    } catch (validationError) {
      setActionState(current => ({ ...current, error: validationError.message }))
      return
    }

    setActionState(current => ({ ...current, submitting: true, error: '' }))
    setError('')
    setSuccess('')
    try {
      const outcome = await completeAdminMutation(
        () => adminApi.arbitrateReviewComplaint(item.complaintId, body, currentUser),
        async () => {
          const refreshedItems = await refreshComplaintSurfaces({
            loadComplaints: requestItems,
            loadDashboard: () => adminApi.dashboard(currentUser),
          })
          setItems(refreshedItems)
        },
      )
      setActionState({ item: null, result: '', comment: '', submitting: false, error: '' })
      const resultLabel = arbitrationLabels[body.result] || body.result
      setSuccess(outcome.refreshed
        ? `申诉 #${item.complaintId} 已按“${resultLabel}”处理，列表已刷新。`
        : `申诉 #${item.complaintId} 已成功处理，但刷新失败；请刷新列表确认。`)
    } catch (requestError) {
      setActionState(current => ({
        ...current,
        submitting: false,
        error: requestError?.message || '评价申诉处理失败，请检查说明后重试。',
      }))
    }
  }

  const actionCopy = complaintActionCopy(actionState.result)

  return (
    <main className="admin-page">
      <AdminModeBanner
        title="评价申诉"
        description="读取真实评价申诉队列，以公开评价详情补充上下文，并通过仲裁接口提交处理结果。"
      />

      {demoMode ? (
        <div className="admin-demo-notice" role="status">
          当前为开发演示数据，只读展示；仲裁操作不会调用真实接口。
        </div>
      ) : null}

      <section className="admin-complaint-toolbar" aria-label="评价申诉筛选">
        <label>
          <span>处理状态</span>
          <select value={status} onChange={event => updateSearchParam('status', event.target.value)}>
            {complaintStatuses.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>搜索当前结果</span>
          <input
            name="admin-complaint-search"
            type="search"
            autoComplete="off"
            placeholder="申诉 ID、评价 ID、用户或理由…"
            value={keyword}
            onChange={event => updateSearchParam('q', event.target.value)}
          />
        </label>
        <div className="admin-complaint-summary" aria-live="polite">
          <span>当前结果</span>
          <strong>{loading ? '读取中…' : `${visibleItems.length} 条`}</strong>
        </div>
      </section>

      {error ? (
        <div className="admin-inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryKey(value => value + 1)}>重新加载</button>
        </div>
      ) : null}

      {success ? <div className="admin-complaint-success" role="status">{success}</div> : null}

      {loading ? (
        <AdminEmptyState title="正在读取评价申诉" description="正在调用真实评价申诉列表接口。" />
      ) : null}

      {!loading && !error && visibleItems.length === 0 ? (
        <AdminEmptyState
          title={keyword ? '没有匹配的评价申诉' : '当前状态下暂无评价申诉'}
          description={keyword ? '请调整搜索关键词。' : '列表由真实申诉接口返回，未使用占位记录。'}
        />
      ) : null}

      {!loading && visibleItems.length > 0 ? (
        <section className="admin-complaint-list" aria-label="评价申诉列表">
          {visibleItems.map(complaint => {
            const review = complaint.review
            const pending = isPending(complaint)
            const actionsDisabled = demoMode || !pending || actionState.submitting
            return (
              <article className="admin-complaint-card" key={complaint.complaintId}>
                <header>
                  <span>COMPLAINT #{complaint.complaintId}</span>
                  <AdminStatusTag
                    status={complaint.status}
                    label={statusLabels[complaint.status] || complaint.status}
                  />
                </header>
                <div className="admin-complaint-card-grid">
                  <section>
                    <p className="admin-complaint-kicker">REVIEW #{complaint.reviewId}</p>
                    {review ? (
                      <>
                        <strong className="admin-complaint-rating">{review.rating ?? '—'} <small>/ 5</small></strong>
                        <p className="admin-complaint-review-copy">{review.content || '评价接口未返回文字内容。'}</p>
                      </>
                    ) : (
                      <div className="admin-complaint-context-unavailable">
                        <strong>{complaint.reviewContextMessage}</strong>
                        <span>未补造评分或评价文本</span>
                      </div>
                    )}
                  </section>
                  <section>
                    <p className="admin-complaint-kicker">COMPLAINANT</p>
                    <h2>{personLabel(complaint.complainantNickname, complaint.complainantId)}</h2>
                    <p className="admin-complaint-reason">{complaint.reason || '—'}</p>
                    <time dateTime={complaint.createdAt || undefined}>{formatDateTime(complaint.createdAt)}</time>
                  </section>
                </div>
                <footer>
                  <button className="admin-button admin-button--quiet" type="button" onClick={() => setDetailsItem(complaint)}>
                    查看详情
                  </button>
                  <button
                    className="admin-button"
                    type="button"
                    disabled={actionsDisabled}
                    title={demoMode ? '演示数据只读' : (!pending ? '该申诉已处理' : undefined)}
                    onClick={() => openAction(complaint, 'REJECTED')}
                  >
                    维持评价
                  </button>
                  <button
                    className="admin-button admin-button--danger"
                    type="button"
                    disabled={actionsDisabled}
                    title={demoMode ? '演示数据只读' : (!pending ? '该申诉已处理' : undefined)}
                    onClick={() => openAction(complaint, 'REVIEW_HIDDEN')}
                  >
                    隐藏评价
                  </button>
                  {demoMode ? <small>演示数据只读</small> : null}
                </footer>
              </article>
            )
          })}
        </section>
      ) : null}

      <ComplaintDetailsDialog complaint={detailsItem} onClose={() => setDetailsItem(null)} />

      <ModerationReasonDialog
        open={Boolean(actionState.item)}
        title={actionCopy.title}
        description={actionCopy.description}
        value={actionState.comment}
        required={actionCopy.required}
        submitting={actionState.submitting}
        onChange={comment => setActionState(current => ({ ...current, comment, error: '' }))}
        onCancel={() => setActionState({ item: null, result: '', comment: '', submitting: false, error: '' })}
        onConfirm={submitArbitration}
      />
      {actionState.error ? (
        <div className="admin-complaint-dialog-error" role="alert">{actionState.error}</div>
      ) : null}
    </main>
  )
}
