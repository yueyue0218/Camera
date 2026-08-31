import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { adminApi } from '../../api/index.js'
import {
  demoAdminComplaints,
  demoAdminDashboard,
  demoCertifications
} from '../../mocks/dline/adminFixtures.js'
import { buildAdminDashboardStats, loadPendingCertificationOverview } from './adminData.js'
import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'
import { AdminStatCard } from './components/AdminStatCard.jsx'
import { AdminStatusTag } from './components/AdminStatusTag.jsx'

const quickLinks = [
  { key: 'hall', label: '浏览大厅', description: '查看公开需求与服务', path: '/admin/hall' },
  { key: 'feed', label: '浏览动态', description: '查看平台公开动态', path: '/admin/feed' },
  { key: 'reports', label: '举报处理', description: '结构已预留，接口待接入', path: '/admin/reports', pending: true },
  { key: 'certifications', label: '认证审核', description: '进入真实待审队列', path: '/admin/certifications' },
  { key: 'complaints', label: '评价申诉', description: '进入真实申诉队列', path: '/admin/complaints' }
]

function toList(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.records)) return value.records
  if (Array.isArray(value?.content)) return value.content
  return []
}

function formatRecordTime(value) {
  if (!value) return '时间未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function certificationLabel(type) {
  return type === 'STUDENT' ? '学生认证' : type === 'REAL_NAME' ? '实名认证' : '认证申请'
}

export function AdminHomePage() {
  const { currentUser } = useAuth()
  const [searchParams] = useSearchParams()
  const demoMode = import.meta.env.DEV && searchParams.get('demo') === '1'
  const [retryKey, setRetryKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [certifications, setCertifications] = useState([])
  const [complaints, setComplaints] = useState([])

  useEffect(() => {
    let active = true

    async function loadOverview() {
      setLoading(true)
      setError('')
      try {
        const [dashboardData, certificationData, complaintData] = demoMode
          ? [demoAdminDashboard, demoCertifications, demoAdminComplaints]
          : await Promise.all([
            adminApi.dashboard(currentUser),
            loadPendingCertificationOverview(adminApi.listCertifications, currentUser),
            adminApi.listReviewComplaints({ status: 'PENDING' }, currentUser)
          ])

        if (!active) return
        setDashboard(dashboardData || {})
        setCertifications(toList(certificationData))
        setComplaints(toList(complaintData))
      } catch (loadError) {
        if (!active) return
        setDashboard(null)
        setCertifications([])
        setComplaints([])
        setError(loadError?.message || '管理概览加载失败，请稍后重试。')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOverview()
    return () => { active = false }
  }, [currentUser, demoMode, retryKey])

  const stats = buildAdminDashboardStats(dashboard || {})

  return (
    <main className="admin-page">
      <AdminModeBanner
        title="管理概览"
        description="以平台视角浏览公开内容，并处理已接入的认证与评价申诉队列。"
      />

      {demoMode ? (
        <div className="admin-demo-notice" role="note">
          当前内容仅供参考，数据来自开发环境演示夹具。
        </div>
      ) : null}

      {error ? (
        <section className="admin-error-panel" role="alert">
          <div>
            <strong>概览数据未能加载</strong>
            <p>{error}</p>
          </div>
          <button className="admin-button" type="button" onClick={() => setRetryKey(value => value + 1)}>
            重新加载
          </button>
        </section>
      ) : null}

      {loading ? (
        <AdminEmptyState title="正在同步管理概览…" description="正在读取真实平台统计与待处理队列。" />
      ) : null}

      {!loading && !error ? (
        <>
          <section className="admin-section" aria-labelledby="admin-stats-heading">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">TODAY AT PORTRA</p>
                <h2 id="admin-stats-heading">平台状态</h2>
              </div>
              <p>真实数值来自管理员接口；未知数据不会按 0 展示。</p>
            </div>
            <div className="admin-stat-grid">
              {stats.map(stat => (
                <AdminStatCard key={stat.key} stat={stat} to={stat.path} />
              ))}
            </div>
          </section>

          <section className="admin-section" aria-labelledby="admin-shortcuts-heading">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">PLATFORM SURFACES</p>
                <h2 id="admin-shortcuts-heading">管理员快捷入口</h2>
              </div>
            </div>
            <div className="admin-quick-grid">
              {quickLinks.map(link => (
                <Link className="admin-quick-link" key={link.key} to={link.path}>
                  <span>{link.label}</span>
                  <small>{link.description}</small>
                  {link.pending ? <em>接口待接入</em> : <em>进入页面 →</em>}
                </Link>
              ))}
            </div>
          </section>

          <section className="admin-overview-grid" aria-label="最近管理记录">
            <article className="admin-overview-panel">
              <header className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">RECENT AUDITS</p>
                  <h2>最近待审认证</h2>
                </div>
                <Link to="/admin/certifications">查看全部</Link>
              </header>
              {!certifications.length ? (
                <AdminEmptyState title="当前没有待审核认证" description="新的认证申请会出现在这里。" />
              ) : (
                <div className="admin-record-list">
                  {certifications.slice(0, 3).map(item => (
                    <Link
                      className="admin-record"
                      key={`${item.type}-${item.id}`}
                      to={`/admin/certifications?focus=certification-${item.type}-${item.id}`}
                    >
                      <span>
                        <strong>{certificationLabel(item.type)} · 用户 #{item.userId}</strong>
                        <small>{item.realNameMasked || item.university || '待核验资料'}</small>
                      </span>
                      <span className="admin-record-meta">
                        <AdminStatusTag status={item.status} />
                        <time>{formatRecordTime(item.appliedAt)}</time>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </article>

            <article className="admin-overview-panel">
              <header className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">RECENT APPEALS</p>
                  <h2>最近评价申诉</h2>
                </div>
                <Link to="/admin/complaints">查看全部</Link>
              </header>
              {!complaints.length ? (
                <AdminEmptyState title="当前没有待处理申诉" description="新的评价申诉会出现在这里。" />
              ) : (
                <div className="admin-record-list">
                  {complaints.slice(0, 3).map(item => (
                    <Link
                      className="admin-record"
                      key={item.complaintId}
                      to={`/admin/complaints?focus=complaint-${item.complaintId}`}
                    >
                      <span>
                        <strong>评价 #{item.reviewId}</strong>
                        <small>{item.reason || '等待管理员核验申诉材料'}</small>
                      </span>
                      <span className="admin-record-meta">
                        <AdminStatusTag status={item.status} />
                        <time>{formatRecordTime(item.createdAt)}</time>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </article>

            <article className="admin-overview-panel admin-overview-panel--pending">
              <header className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">RECENT REPORTS</p>
                  <h2>最近举报</h2>
                </div>
                <AdminStatusTag status="PENDING_API" />
              </header>
              <AdminEmptyState
                pending
                title="举报列表接口待接入"
                description="当前不会生成模拟举报记录，也不会显示伪造的处理结果。"
              />
            </article>
          </section>
        </>
      ) : null}
    </main>
  )
}
