import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { creditApi, fileApi, momentApi, reviewApi, userApi } from '../../api.js'
import {
  formatShortTime,
  getLocalReviewsByTarget,
  isFollowing,
  isApiUnavailable,
  mergeReviewLists,
  readUserProfiles,
  toggleFollow as toggleFollowLocal,
} from './utils/profileUtils.js'
import { ReviewScore } from '../reviews/ReviewPage.jsx'
import './profile.css'

function formatCreditScore(value) {
  if (value === null || value === undefined) return '暂无'
  if (typeof value === 'string' && value.trim() === '') return '暂无'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '暂无'
}

export function PublicProfilePage() {
  const { userId } = useParams()
  const [searchParams] = useSearchParams()
  const profileRole = searchParams.get('role') || null
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const profileUserId = Number(userId)

  const [publicProfile, setPublicProfile] = useState(null)
  const [moments, setMoments] = useState([])
  const [reviews, setReviews] = useState([])
  const [creditSummary, setCreditSummary] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [followedByMe, setFollowedByMe] = useState(false)
  const [followsMe, setFollowsMe] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('portfolio')

  const dashboardRowRef = useRef(null)
  const frameNavRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [profileResult, briefResult, momentsResult, reviewsResult, creditResult, myFollowersResult] = await Promise.allSettled([
        userApi.publicProfile(profileUserId, currentUser, profileRole),
        userApi.brief(profileUserId, currentUser),
        momentApi.list({ authorId: profileUserId, authorRole: profileRole }, currentUser),
        reviewApi.listByUser(profileUserId, currentUser),
        creditApi.summary(profileUserId, currentUser),
        userApi.followers(currentUser.userId, currentUser),
      ])
      if (cancelled) return

      if (profileResult.status === 'fulfilled' && profileResult.value) {
        setPublicProfile(profileResult.value)
        setFollowedByMe(Boolean(profileResult.value.followedByCurrentUser))
      } else if (briefResult.status === 'fulfilled' && briefResult.value) {
        const storedProfile = readUserProfiles()[String(profileUserId)] || {}
        setPublicProfile({
          ...storedProfile,
          ...briefResult.value,
          userId: briefResult.value.userId || profileUserId,
          currentRole: profileRole || storedProfile.currentRole || storedProfile.role || 'CUSTOMER',
          followedByCurrentUser: isFollowing(profileUserId)
        })
        setFollowedByMe(isFollowing(profileUserId))
      } else if (profileResult.status === 'rejected' && !isApiUnavailable(profileResult.reason)) {
        setNotice({ type: 'warn', text: '无法加载完整资料，显示本地缓存数据' })
      }

      if (myFollowersResult.status === 'fulfilled') {
        setFollowsMe(myFollowersResult.value.some(f => Number(f.userId) === profileUserId))
      }

      const allMoments = momentsResult.status === 'fulfilled' ? momentsResult.value : []
      setMoments(allMoments)

      const remoteReviews = reviewsResult.status === 'fulfilled' ? reviewsResult.value : []
      setReviews(mergeReviewLists(remoteReviews, getLocalReviewsByTarget(profileUserId)))
      setCreditSummary(creditResult.status === 'fulfilled' ? creditResult.value : null)

      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [profileUserId, currentUser.userId, profileRole])

  useEffect(() => {
    const fileId = publicProfile?.avatarFileId
    if (!fileId) return
    let url = ''
    let cancelled = false
    fileApi.downloadObjectUrl(fileId, currentUser)
      .then(u => { if (!cancelled) { url = u; setAvatarUrl(u) } })
      .catch(() => {})
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [publicProfile?.avatarFileId])

  const syncHeight = () => {
    if (!dashboardRowRef.current || !frameNavRef.current) return
    const h = Math.ceil(frameNavRef.current.getBoundingClientRect().height)
    dashboardRowRef.current.style.setProperty('--dashboard-left-card-height', `${h}px`)
  }
  useEffect(() => {
    syncHeight()
    window.addEventListener('resize', syncHeight)
    const ro = new ResizeObserver(syncHeight)
    if (frameNavRef.current) ro.observe(frameNavRef.current)
    return () => { window.removeEventListener('resize', syncHeight); ro.disconnect() }
  }, [activeTab])

  async function toggleFollow() {
    const wasFollowed = followedByMe
    setFollowedByMe(!wasFollowed)
    setFollowLoading(true)
    try {
      if (wasFollowed) {
        await userApi.unfollow(profileUserId, currentUser, profileRole)
      } else {
        await userApi.follow(profileUserId, currentUser, profileRole)
      }
      if (isFollowing(profileUserId) === wasFollowed) {
        toggleFollowLocal(profileUserId, currentUser.userId)
      }
      setNotice(null)
    } catch (error) {
      if (isApiUnavailable(error)) {
        const nextFollowed = toggleFollowLocal(profileUserId, currentUser.userId)
        setFollowedByMe(nextFollowed)
        setNotice(null)
      } else {
        setFollowedByMe(wasFollowed)
        setNotice({ type: 'err', text: error.message })
      }
    }
    setFollowLoading(false)
  }

  if (profileUserId === currentUser.userId) return <Navigate to="/profile" replace />

  if (loading) {
    return (
      <div className="pp-main">
        <section className="profile-hero">
          <div className="hero-bg-word">PROFILE</div>
          <div className="profile-photo-wrap">
            <div className="profile-photo-card">
              <div className="profile-photo" />
              <div className="photo-pin">—</div>
            </div>
          </div>
          <div className="hero-info">
            <div className="ticket-kicker">Portra Profile Ticket</div>
            <p style={{ color: '#888', fontSize: 14, letterSpacing: '.1em', margin: 0 }}>加载中...</p>
          </div>
          <aside className="hero-side">
            <div>
              <div className="id-number">No.{profileUserId}</div>
              <div className="id-label">PORTRA CREDIT FILE</div>
            </div>
          </aside>
        </section>
      </div>
    )
  }

  const storedProfile = readUserProfiles()[String(profileUserId)] || {}
  const role = publicProfile?.currentRole || storedProfile.role || 'CUSTOMER'
  const isProvider = role === 'PROVIDER'
  const pp = publicProfile?.providerProfile || {}
  const nickname = publicProfile?.nickname || storedProfile.nickname || `用户${profileUserId}`
  const gender = publicProfile?.gender
  const bio = publicProfile?.bio || storedProfile.bio || ''
  const creditScore = creditSummary?.creditScore ?? null
  const displayCreditScore = formatCreditScore(creditScore)
  const cityPin = pp?.cityCode || publicProfile?.cityCode || publicProfile?.school || storedProfile.school || 'Portra'
  const ipLocation = publicProfile?.cityCode || storedProfile.cityCode || ''

  const momentImages = moments
    .filter(m => m.imageData)
    .slice(0, 6)
    .map(m => ({ imageData: m.imageData, momentId: m.momentId }))

  const providerReviews = reviews.filter(r =>
    r.direction === 'CUSTOMER_TO_PROVIDER' ||
    (!r.direction && isProvider && Number(r.targetUserId) === profileUserId)
  )
  const customerReviews = reviews.filter(r =>
    r.direction === 'PROVIDER_TO_CUSTOMER' ||
    (!r.direction && !isProvider && Number(r.targetUserId) === profileUserId)
  )

  function openReviewCard(review) {
    const reviewId = review?.reviewId
    if (reviewId != null && !String(reviewId).startsWith('local')) {
      navigate(`/reviews/${reviewId}`)
      return
    }
    if (review?.orderId) {
      navigate(`/orders?orderId=${review.orderId}`)
      return
    }
    navigate(`/users/${profileUserId}/reviews`)
  }

  const styleTags = (() => {
    const raw = pp?.styleTags
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    return String(raw).split(',').map(s => s.trim()).filter(Boolean)
  })()

  const allTabs = isProvider
    ? [
        { id: 'portfolio', label: '作品集', num: '01' },
        { id: 'reviews', label: '历史评价', num: '02' },
        { id: 'moments', label: 'TA的动态', num: '03' },
      ]
    : [
        { id: 'moments', label: 'TA的照片', num: '01' },
        { id: 'reviews', label: '收到的评价', num: '02' },
      ]

  function ReviewCard({ r }) {
    return (
      <div
        className="review-card"
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer', marginTop: 12 }}
        onClick={() => openReviewCard(r)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReviewCard(r) } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#6e737b', letterSpacing: '.08em' }}>
            来自 {r.reviewerNickname || `用户 ${r.reviewerId}`} · {formatShortTime(r.createdAt)}
          </span>
          <ReviewScore value={r.rating} />
        </div>
        <blockquote style={{ margin: 0 }}>"{r.content || '对方没有留下文字评价'}"</blockquote>
        {r.replyContent && (
          <div className="review-reply"><span>追评</span><p>{r.replyContent}</p></div>
        )}
      </div>
    )
  }

  return (
    <div className="pp-main">
      {notice && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 12, background: notice.type === 'err' ? 'rgba(248,81,4,.08)' : 'rgba(13,47,178,.07)', color: notice.type === 'err' ? '#c13a05' : 'var(--blue)', fontSize: 13, letterSpacing: '.06em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {notice.text}
          <button onClick={() => setNotice(null)} style={{ border: 0, background: 'transparent', fontSize: 16, cursor: 'pointer', color: 'inherit', lineHeight: 1 }}>×</button>
        </div>
      )}

      <div className="pp-crumb">
        <span><strong>PROFILE</strong> / {nickname} / 个人摄影档案</span>
        <span>{isProvider ? `FRAME ${pp?.completedOrders ?? 0} · ${pp?.cityCode || 'Portra'}` : `CREDIT ${displayCreditScore} · Portra`}</span>
      </div>

      {/* ── HERO ── */}
      <section className="profile-hero">
        <div className="hero-bg-word">PROFILE</div>

        <div className="profile-photo-wrap">
          <div className="profile-photo-card">
            <div className="profile-photo">{avatarUrl && <img src={avatarUrl} alt="" />}</div>
            <div className="photo-pin">{cityPin}</div>
          </div>
        </div>

        <div className="hero-info">
          <div className="ticket-kicker">Portra Profile Ticket</div>
          <div className="hero-name-row">
            <h1 className="hero-name">{nickname}</h1>
            <span className="role-badge">{isProvider ? '摄影师' : '约拍方'}</span>
          </div>
          <p className="profile-uid">UID：{profileUserId} · Portra ID</p>
          <div className="profile-meta-line">
            <span>IP属地：{ipLocation || '未知'}</span>
          </div>
          {(() => {
            const chips = []
            if (gender === 'FEMALE') chips.push('♀ 女')
            else if (gender === 'MALE') chips.push('♂ 男')
            if (pp?.cityCode) chips.push(`📍 ${pp.cityCode}`)
            return chips.length ? (
              <div className="profile-tag-row">
                {chips.map((c, i) => <span key={i} className="profile-tag">{c}</span>)}
              </div>
            ) : null
          })()}
          <p className="profile-signature">{bio || '这个人还没有写简介。'}</p>
          <div className="social-stats-row">
            <div className="social-stat"><b>{publicProfile?.followingCount ?? '—'}</b><span>关注</span></div>
            <div className="social-stat"><b>{publicProfile?.followerCount ?? '—'}</b><span>粉丝</span></div>
            <div className="social-stat"><b>{publicProfile?.momentCount ?? moments.length}</b><span>动态</span></div>
          </div>
        </div>

        <aside className="hero-side">
          <div>
            <div className="id-number">No.{profileUserId}</div>
            <div className="id-label">PORTRA CREDIT FILE</div>
          </div>
          <div className="metric-grid">
            <button className="metric metric-button" type="button" onClick={() => navigate(`/users/${profileUserId}/credit`)}>
              <b>{displayCreditScore}</b><span>信用评分</span>
            </button>
            {isProvider ? (
              <>
                <div className="metric"><b>{pp?.avgRating != null ? Number(pp.avgRating).toFixed(1) : '—'}</b><span>平均评分</span></div>
                <div className="metric"><b>{pp?.completedOrders ?? '—'}</b><span>历史约拍</span></div>
                <div className="metric"><b>{reviews.length}</b><span>收到评价</span></div>
              </>
            ) : (
              <>
                <div className="metric"><b>{reviews.length}</b><span>收到评价</span></div>
                <div className="metric"><b>{publicProfile?.momentCount ?? moments.length}</b><span>动态数</span></div>
              </>
            )}
          </div>
          <div className="hero-actions">
            {isProvider && pp?.priceMin != null && (
              <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 700, marginBottom: 4 }}>
                {`¥${pp.priceMin}–¥${pp.priceMax} / 次`}
              </div>
            )}
            <button className="primary-btn" onClick={() => navigate('/messages', { state: { targetUserId: profileUserId } })}>发消息</button>
            <button className="secondary-btn" onClick={toggleFollow} disabled={followLoading}>
              {followedByMe && followsMe ? '互相关注' : followedByMe ? '已关注' : '关注'}
            </button>
            <button className="secondary-btn" onClick={() => navigate(`/users/${profileUserId}?role=${isProvider ? 'CUSTOMER' : 'PROVIDER'}`)}>
              {isProvider ? '查看 TA 的约拍方主页 →' : '查看 TA 的摄影师主页 →'}
            </button>
          </div>
        </aside>
      </section>

      {/* ── DASHBOARD ── */}
      <section className="pp-dashboard">
        <div className="dashboard-card-row" ref={dashboardRowRef}>

          <aside className="panel-card frame-nav" ref={frameNavRef}>
            <p className="frame-title">Frame Navigation</p>
            {allTabs.map(tab => (
              <button key={tab.id} className={`frame-tab${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span>{tab.label}</span><small>{tab.num}</small>
              </button>
            ))}
          </aside>

          <div className="content-stack" style={{ height: 'auto' }}>

            {/* 作品集 / TA的照片 */}
            <section className={`panel-card tab-panel${activeTab === 'portfolio' || activeTab === 'moments' ? ' active' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>{isProvider ? '作品集' : 'TA的照片'}</h2>
                  <p>{isProvider ? '摄影师的胶片接触印相，记录每一次按快门的瞬间。' : '被快门留下的时刻。'}</p>
                </div>
                <div className="section-mark">01</div>
              </div>
              <div className="contact-sheet">
                <div className="photo-grid">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const m = momentImages[i]
                    return (
                      <div key={i} className="film-frame" onClick={() => m && navigate(`/moments/${m.momentId}`)} style={m ? { cursor: 'pointer' } : {}}>
                        {m?.imageData && <img src={m.imageData} alt="" />}
                        <span className="cap">FRAME {String(i + 1).padStart(2, '0')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {!isProvider && moments.length > 0 && (
                <div className="order-list" style={{ marginTop: 16 }}>
                  {moments.slice(0, 5).map((m, i) => (
                    <div key={m.momentId} className="order-slip" onClick={() => navigate(`/moments/${m.momentId}`)}>
                      <div className="order-num">{String(i + 1).padStart(2, '0')}</div>
                      <div><h4>{m.title || '未命名动态'}</h4><p>{(m.content || '').slice(0, 50)} · {formatShortTime(m.createdAt)}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 历史评价 / 收到的评价 */}
            <section className={`panel-card tab-panel${activeTab === 'reviews' ? ' active' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>{isProvider ? '历史评价' : '收到的评价'}</h2>
                  <p>{isProvider ? '来自约拍方的真实反馈，见证每一次约拍。' : '摄影师对 TA 的真实反馈，了解合作体验。'}</p>
                </div>
                <div className="section-mark">02</div>
              </div>
              {(isProvider ? providerReviews : customerReviews).length
                ? (isProvider ? providerReviews : customerReviews).slice(0, 6).map(r => (
                    <ReviewCard key={r.reviewId || `${r.orderId}-${r.direction}`} r={r} />
                  ))
                : <div className="pp-empty"><h3>暂无评价</h3><p>完成约拍后双方会互相留下评价。</p></div>
              }
            </section>

            {/* TA的动态（仅摄影师） */}
            {isProvider && (
              <section className={`panel-card tab-panel${activeTab === 'moments' ? ' active' : ''}`}>
                <div className="section-head">
                  <div><h2>TA的动态</h2><p>摄影师最近发布的帖子。</p></div>
                  <div className="section-mark">03</div>
                </div>
                {moments.length ? (
                  <div className="order-list">
                    {moments.slice(0, 5).map((m, i) => (
                      <div key={m.momentId} className="order-slip" onClick={() => navigate(`/moments/${m.momentId}`)}>
                        <div className="order-num">{String(i + 1).padStart(2, '0')}</div>
                        <div><h4>{m.title || '未命名动态'}</h4><p>{(m.content || '').slice(0, 50)} · {formatShortTime(m.createdAt)}</p></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pp-empty"><h3>暂无动态</h3><p>该摄影师还没有发布动态。</p></div>
                )}
              </section>
            )}

          </div>

          {/* 右侧信息栏（仅摄影师） */}
          {isProvider && (
            <aside className="side-stack" style={{ height: 'auto', minHeight: 'var(--dashboard-left-card-height)', overflow: 'visible' }}>
              <section className="panel-card">
                <p className="frame-title">摄影师信息</p>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, letterSpacing: '.14em', color: '#6e737b', marginBottom: 8 }}>风格标签</div>
                  {styleTags.length
                    ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{styleTags.map(tag => <span key={tag} className="tag blue">{tag}</span>)}</div>
                    : <span style={{ fontSize: 13, color: '#999' }}>暂未设置</span>
                  }
                </div>
                {pp?.equipment && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, letterSpacing: '.14em', color: '#6e737b', marginBottom: 6 }}>设备</div>
                    <p style={{ margin: 0, fontSize: 13, color: '#30343a', lineHeight: 1.7 }}>{pp.equipment}</p>
                  </div>
                )}
              </section>
            </aside>
          )}

        </div>
      </section>
    </div>
  )
}
