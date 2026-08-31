import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { adminApi } from '../../api/adminApi.js'
import {
  buildCertificationListQueries,
  buildCertificationReviewBody,
  loadCertificationSource,
  shouldUseAdminDemoFixtures,
} from './adminData.js'
import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'
import { AdminStatusTag } from './components/AdminStatusTag.jsx'
import { ModerationReasonDialog } from './components/ModerationReasonDialog.jsx'

const certificationTypes = [
  { value: 'ALL', label: '全部类型' },
  { value: 'REAL_NAME', label: '实名认证' },
  { value: 'STUDENT', label: '学生认证' },
]

const certificationStatuses = [
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
]

const statusLabels = {
  PENDING: '待审核',
  PENDING_REVIEW: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}

const typeLabels = {
  REAL_NAME: '实名认证',
  STUDENT: '学生认证',
}

function normalizeList(response) {
  if (Array.isArray(response)) return response
  for (const key of ['items', 'records', 'content', 'list']) {
    if (Array.isArray(response?.[key])) return response[key]
  }
  return []
}

function isPending(item) {
  return ['PENDING', 'PENDING_REVIEW'].includes(String(item?.status || '').toUpperCase())
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

function filterDemoCertifications(items, type, status) {
  return items.filter(item => {
    const matchesType = type === 'ALL' || item.type === type
    const matchesStatus = status === 'PENDING'
      ? isPending(item)
      : item.status === status
    return matchesType && matchesStatus
  })
}

function CertificationDetailsDialog({ item, onClose }) {
  if (!item) return null

  const fields = [
    ['认证记录 ID', item.id],
    ['用户 ID', item.userId],
    ['认证类型', typeLabels[item.type] || item.type],
    ['状态', statusLabels[item.status] || item.status],
    ['脱敏姓名', item.realNameMasked],
    ['脱敏证件号', item.idCardNoMasked],
    ['学校', item.university],
    ['人脸核验结果', item.faceVerifyResult],
    ['正面材料文件 ID', item.evidenceFrontFileId],
    ['背面材料文件 ID', item.evidenceBackFileId],
    ['学生证文件 ID', item.studentCardFileId],
    ['驳回原因', item.rejectReason],
    ['申请时间', item.appliedAt ? formatDateTime(item.appliedAt) : null],
    ['审核时间', item.reviewedAt ? formatDateTime(item.reviewedAt) : null],
    ['审核人 ID', item.reviewerId],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')

  return (
    <div className="admin-certification-detail-backdrop">
      <section
        className="admin-certification-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-certification-detail-title"
        tabIndex={-1}
        autoFocus
        onKeyDown={event => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <header>
          <div>
            <span>APPLICATION RESPONSE</span>
            <h2 id="admin-certification-detail-title">认证申请详情</h2>
          </div>
          <button className="admin-button admin-button--quiet" type="button" onClick={onClose}>关闭</button>
        </header>
        <dl>
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

export function AdminCertificationPage() {
  const { currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [detailsItem, setDetailsItem] = useState(null)
  const [approvingKey, setApprovingKey] = useState('')
  const [rejectState, setRejectState] = useState({ item: null, reason: '', submitting: false, error: '' })

  const searchString = searchParams.toString()
  const requestedType = String(searchParams.get('type') || 'ALL').toUpperCase()
  const requestedStatus = String(searchParams.get('status') || 'PENDING').toUpperCase()
  const type = certificationTypes.some(option => option.value === requestedType) ? requestedType : 'ALL'
  const status = certificationStatuses.some(option => option.value === requestedStatus) ? requestedStatus : 'PENDING'
  const demoMode = shouldUseAdminDemoFixtures(import.meta.env.DEV, searchString)
  const queries = useMemo(() => buildCertificationListQueries(type, status), [type, status])

  function updateFilter(key, value) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set(key, value)
    setSearchParams(nextParams, { replace: true })
  }

  const requestItems = useCallback(async () => loadCertificationSource({
    demoMode,
    loadReal: async () => {
      const responses = await Promise.all(
        queries.map(query => adminApi.listCertifications(query, currentUser)),
      )
      return responses.flatMap(normalizeList)
    },
    loadDemo: async () => {
      if (!(import.meta.env.DEV && new URLSearchParams(searchString).get('demo') === '1')) {
        throw new Error('演示数据仅限开发模式')
      }
      const { demoCertifications } = await import('../../mocks/dline/adminFixtures.js')
      return filterDemoCertifications(demoCertifications, type, status)
    },
  }), [currentUser, demoMode, queries, searchString, status, type])

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
        setError(requestError?.message || '认证审核列表加载失败。')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [requestItems, retryKey])

  async function approveCertification(item) {
    const key = `${item.type}-${item.id}`
    setApprovingKey(key)
    setError('')
    setSuccess('')
    try {
      const body = buildCertificationReviewBody('APPROVED', '')
      await adminApi.reviewCertification(item.type, item.id, body, currentUser)
      const refreshedItems = await requestItems()
      setItems(refreshedItems)
      setSuccess(`认证申请 #${item.id} 已通过，列表已刷新。`)
    } catch (requestError) {
      setError(requestError?.message || '认证通过操作失败。')
    } finally {
      setApprovingKey('')
    }
  }

  async function rejectCertification() {
    const item = rejectState.item
    if (!item) return

    let body
    try {
      body = buildCertificationReviewBody('REJECTED', rejectState.reason)
    } catch (validationError) {
      setRejectState(current => ({ ...current, error: validationError.message }))
      return
    }

    setRejectState(current => ({ ...current, submitting: true, error: '' }))
    setError('')
    setSuccess('')
    try {
      await adminApi.reviewCertification(item.type, item.id, body, currentUser)
      const refreshedItems = await requestItems()
      setItems(refreshedItems)
      setRejectState({ item: null, reason: '', submitting: false, error: '' })
      setSuccess(`认证申请 #${item.id} 已驳回，列表已刷新。`)
    } catch (requestError) {
      setRejectState(current => ({
        ...current,
        submitting: false,
        error: requestError?.message || '认证驳回操作失败。',
      }))
    }
  }

  return (
    <main className="admin-page">
      <AdminModeBanner
        title="认证审核"
        description="读取真实认证申请队列，并通过认证审核接口提交通过或驳回结果。"
      />

      {demoMode ? (
        <div className="admin-demo-notice" role="status">
          当前为开发演示数据，只读展示；审核操作不会调用真实接口。
        </div>
      ) : null}

      <section className="admin-certification-toolbar" aria-label="认证申请筛选">
        <label>
          <span>认证类型</span>
          <select value={type} onChange={event => updateFilter('type', event.target.value)}>
            {certificationTypes.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>审核状态</span>
          <select value={status} onChange={event => updateFilter('status', event.target.value)}>
            {certificationStatuses.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="admin-certification-summary" aria-live="polite">
          <span>当前结果</span>
          <strong>{loading ? '读取中…' : `${items.length} 条`}</strong>
        </div>
      </section>

      {error ? (
        <div className="admin-inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryKey(value => value + 1)}>重新加载</button>
        </div>
      ) : null}

      {success ? <div className="admin-certification-success" role="status">{success}</div> : null}

      {loading ? (
        <AdminEmptyState title="正在读取认证申请" description="正在调用认证审核列表接口。" />
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState title="当前筛选下暂无认证申请" description="列表由认证审核接口返回，未使用占位记录。" />
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="admin-certification-grid" aria-label="认证申请列表">
          {items.map(item => {
            const itemKey = `${item.type}-${item.id}`
            const pending = isPending(item)
            const actionsDisabled = demoMode || !pending
            return (
              <article className="admin-certification-card" key={itemKey}>
                <header>
                  <span>{typeLabels[item.type] || item.type || '认证申请'}</span>
                  <AdminStatusTag status={item.status} label={statusLabels[item.status] || item.status} />
                </header>
                <div className="admin-certification-card-body">
                  <p className="admin-certification-id">APPLICATION #{item.id}</p>
                  <h2>{item.realNameMasked || '—'}</h2>
                  <dl>
                    <div>
                      <dt>用户 ID</dt>
                      <dd>{item.userId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>学校</dt>
                      <dd>{item.university || '—'}</dd>
                    </div>
                    <div>
                      <dt>申请时间</dt>
                      <dd>{formatDateTime(item.appliedAt)}</dd>
                    </div>
                  </dl>
                </div>
                <footer>
                  <button className="admin-button admin-button--quiet" type="button" onClick={() => setDetailsItem(item)}>
                    查看详情
                  </button>
                  <button
                    className="admin-button"
                    type="button"
                    disabled={actionsDisabled || approvingKey === itemKey}
                    title={demoMode ? '演示数据只读' : (!pending ? '该申请已处理' : undefined)}
                    onClick={() => approveCertification(item)}
                  >
                    {approvingKey === itemKey ? '提交中…' : '通过认证'}
                  </button>
                  <button
                    className="admin-button admin-button--danger"
                    type="button"
                    disabled={actionsDisabled || Boolean(approvingKey)}
                    title={demoMode ? '演示数据只读' : (!pending ? '该申请已处理' : undefined)}
                    onClick={() => setRejectState({ item, reason: '', submitting: false, error: '' })}
                  >
                    驳回认证
                  </button>
                  {demoMode ? <small>演示数据只读</small> : null}
                </footer>
              </article>
            )
          })}
        </section>
      ) : null}

      <CertificationDetailsDialog item={detailsItem} onClose={() => setDetailsItem(null)} />

      <ModerationReasonDialog
        open={Boolean(rejectState.item)}
        title="驳回认证申请"
        description="这段说明会展示给提交者，请写得清楚一点。"
        value={rejectState.reason}
        required
        submitting={rejectState.submitting}
        onChange={reason => setRejectState(current => ({ ...current, reason, error: '' }))}
        onCancel={() => setRejectState({ item: null, reason: '', submitting: false, error: '' })}
        onConfirm={rejectCertification}
      />
      {rejectState.error ? (
        <div className="admin-certification-dialog-error" role="alert">{rejectState.error}</div>
      ) : null}
    </main>
  )
}
