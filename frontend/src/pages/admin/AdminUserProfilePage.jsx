import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { creditApi } from '../../api/creditApi.js'
import { momentApi } from '../../api/momentApi.js'
import { reviewApi } from '../../api/reviewApi.js'
import { userApi } from '../../api/userApi.js'
import { buildAdminUserFacts, parseExactUserId } from './adminData.js'
import { AdminActionBar } from './components/AdminActionBar.jsx'
import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

function recordsFrom(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (Array.isArray(value?.records)) return value.records.filter(Boolean)
  if (Array.isArray(value?.items)) return value.items.filter(Boolean)
  if (Array.isArray(value?.content)) return value.content.filter(Boolean)
  return []
}

function roleLabel(role) {
  const normalizedRole = String(role || '').toUpperCase()
  if (normalizedRole === 'PROVIDER') return '摄影师'
  if (normalizedRole === 'ADMIN') return '管理员'
  return '客户'
}

function formatDate(value) {
  if (!value) return '时间未知'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '时间未知' : dateFormatter.format(date)
}

function errorMessage(result, fallback) {
  return result.status === 'rejected' ? result.reason?.message || fallback : ''
}

export function AdminUserProfilePage() {
  const { userId: userIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const userId = parseExactUserId(userIdParam)
  const requestedRole = searchParams.get('role') || null
  const [state, setState] = useState({
    loading: true,
    identity: null,
    moments: [],
    reviews: [],
    credit: null,
    availability: { moments: false, reviews: false, credit: false },
    errors: {},
    error: ''
  })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!userId) {
      setState(previous => ({ ...previous, loading: false, error: '用户 ID 无效。' }))
      return undefined
    }

    let active = true
    setState(previous => ({ ...previous, loading: true, error: '' }))

    Promise.allSettled([
      userApi.publicProfile(userId, currentUser, requestedRole),
      userApi.brief(userId, currentUser, requestedRole),
      momentApi.list({ authorId: userId, authorRole: requestedRole }, currentUser),
      reviewApi.listByUser(userId, currentUser),
      creditApi.summary(userId, currentUser)
    ]).then(([profileResult, briefResult, momentsResult, reviewsResult, creditResult]) => {
      if (!active) return
      const publicProfile = profileResult.status === 'fulfilled' ? profileResult.value : null
      const brief = briefResult.status === 'fulfilled' ? briefResult.value : null
      const identity = publicProfile || brief
      if (!identity) {
        setState({
          loading: false,
          identity: null,
          moments: [],
          reviews: [],
          credit: null,
          availability: { moments: false, reviews: false, credit: false },
          errors: {},
          error: profileResult.reason?.message || briefResult.reason?.message || `未能读取用户 #${userId} 的公开资料。`
        })
        return
      }

      const moments = momentsResult.status === 'fulfilled' ? recordsFrom(momentsResult.value) : []
      const reviews = reviewsResult.status === 'fulfilled' ? recordsFrom(reviewsResult.value) : []
      setState({
        loading: false,
        identity: { ...brief, ...publicProfile, userId: identity.userId || userId },
        moments,
        reviews,
        credit: creditResult.status === 'fulfilled' ? creditResult.value : null,
        availability: {
          moments: momentsResult.status === 'fulfilled',
          reviews: reviewsResult.status === 'fulfilled',
          credit: creditResult.status === 'fulfilled'
        },
        errors: {
          moments: errorMessage(momentsResult, '公开动态暂不可用。'),
          reviews: errorMessage(reviewsResult, '公开评价暂不可用。'),
          credit: errorMessage(creditResult, '公开信用暂不可用。')
        },
        error: ''
      })
    })

    return () => { active = false }
  }, [currentUser, requestedRole, retryKey, userId])

  const facts = useMemo(() => buildAdminUserFacts(
    state.identity || { userId },
    state.availability.credit ? state.credit : undefined,
    state.availability.moments ? state.moments.length : null
  ), [state.availability.credit, state.availability.moments, state.credit, state.identity, state.moments.length, userId])

  const identity = state.identity
  const role = identity?.currentRole || identity?.role || requestedRole || 'CUSTOMER'
  const nickname = identity?.nickname || identity?.username || identity?.displayName || `用户 ${userId}`
  const bio = identity?.bio || identity?.description || '暂未填写公开简介。'
  const location = identity?.providerProfile?.cityCode || identity?.cityCode || identity?.school || '未公开所在地'
  const avatar = identity?.avatarData || identity?.avatarUrl || ''
  const actions = [
    { key: 'moments', label: '查看 TA 的动态', onClick: () => navigate(`/admin/feed?authorId=${userId}`) },
    { key: 'hall', label: '查看 TA 的大厅发布', disabled: true, hint: '接口待接入' },
    { key: 'reports', label: '查看相关举报', disabled: true, hint: '接口待接入' },
    { key: 'restrict', label: '限制账号', disabled: true, hint: '接口待接入', danger: true },
    { key: 'restore', label: '解除限制', disabled: true, hint: '接口待接入' }
  ]

  return (
    <main className="admin-page">
      <AdminModeBanner
        title="用户主页"
        description="管理员模式下组合展示用户公开资料、动态、评价与信用；账号管理字段保持待接入状态。"
      />

      {state.loading ? (
        <AdminEmptyState title="正在读取公开用户资料…" description="并行读取公开主页、概要、动态、评价和信用接口。" />
      ) : null}

      {state.error ? (
        <div className="admin-error-panel" role="alert">
          <div>
            <strong>用户资料加载失败</strong>
            <p>{state.error}</p>
          </div>
          {userId ? <button className="admin-button" type="button" onClick={() => setRetryKey(value => value + 1)}>重试公开接口</button> : null}
        </div>
      ) : null}

      {!state.loading && identity ? (
        <>
          <section className="admin-user-profile-hero" aria-labelledby="admin-user-profile-name">
            <div className="admin-user-profile-photo" aria-hidden="true">
              {avatar ? (
                <img src={avatar} alt="" width="180" height="220" fetchPriority="high" />
              ) : <span>{nickname.slice(0, 1)}</span>}
            </div>
            <div className="admin-user-profile-copy">
              <span className="admin-user-section-kicker">PORTRA PUBLIC PROFILE</span>
              <h2 id="admin-user-profile-name">{nickname}</h2>
              <p>{bio}</p>
              <div className="admin-user-profile-meta">
                <span>用户 #{userId}</span>
                <span>{roleLabel(role)}</span>
                <span>{location}</span>
              </div>
            </div>
            <aside className="admin-user-facts" aria-label="管理员用户事实">
              <h3>管理侧栏</h3>
              <dl>
                {facts.map(fact => (
                  <div className={fact.available ? '' : 'is-pending'} key={fact.key}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.displayValue}</dd>
                    {!fact.available ? <small>{fact.helper}</small> : null}
                  </div>
                ))}
              </dl>
            </aside>
          </section>

          <section className="admin-user-profile-actions" aria-label="用户管理操作">
            <AdminActionBar actions={actions} />
          </section>

          <section className="admin-user-public-grid">
            <article className="admin-user-public-panel">
              <header>
                <div>
                  <span className="admin-user-section-kicker">公开动态</span>
                  <h2>{state.availability.moments ? `${state.moments.length} 条` : '—'}</h2>
                </div>
                {state.errors.moments ? <small>{state.errors.moments}</small> : null}
              </header>
              {state.availability.moments && state.moments.length ? (
                <div className="admin-user-content-list">
                  {state.moments.slice(0, 6).map(moment => (
                    <div key={moment.momentId || moment.id}>
                      <strong>{moment.title || '未命名动态'}</strong>
                      <p>{moment.content || '暂无文字内容。'}</p>
                      <time>{formatDate(moment.createdAt)}</time>
                    </div>
                  ))}
                </div>
              ) : null}
              {state.availability.moments && !state.moments.length ? (
                <AdminEmptyState title="暂无公开动态" description="公开接口返回 0 条记录。" />
              ) : null}
            </article>

            <article className="admin-user-public-panel">
              <header>
                <div>
                  <span className="admin-user-section-kicker">公开评价</span>
                  <h2>{state.availability.reviews ? `${state.reviews.length} 条` : '—'}</h2>
                </div>
                {state.errors.reviews ? <small>{state.errors.reviews}</small> : null}
              </header>
              {state.availability.reviews && state.reviews.length ? (
                <div className="admin-user-content-list">
                  {state.reviews.slice(0, 6).map(review => (
                    <div key={review.reviewId || review.id}>
                      <strong>{review.rating == null ? '评分未提供' : `${review.rating} 分`}</strong>
                      <p>{review.content || review.comment || '暂无文字评价。'}</p>
                      <time>{formatDate(review.createdAt)}</time>
                    </div>
                  ))}
                </div>
              ) : null}
              {state.availability.reviews && !state.reviews.length ? (
                <AdminEmptyState title="暂无公开评价" description="公开接口返回 0 条记录。" />
              ) : null}
            </article>

            <article className="admin-user-public-panel admin-user-credit-panel">
              <header>
                <div>
                  <span className="admin-user-section-kicker">公开信用</span>
                  <h2>{state.availability.credit ? (state.credit?.creditScore ?? state.credit?.score ?? '暂无分数') : '—'}</h2>
                </div>
                {state.errors.credit ? <small>{state.errors.credit}</small> : null}
              </header>
              <p>{state.availability.credit ? '数值来自公开信用摘要接口。' : '公开信用接口本次未返回可用数据。'}</p>
            </article>
          </section>
        </>
      ) : null}
    </main>
  )
}
