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
  if (value === null || value === undefined) return '鏆傛棤'
  if (typeof value === 'string' && value.trim() === '') return '鏆傛棤'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '鏆傛棤'
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
        setNotice({ type: 'warn', text: '鏃犳硶鍔犺浇瀹屾暣璧勬枡锛屽綋鍓嶅厛灞曠ず宸茶幏鍙栫殑淇℃伅' })
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
              <div className="photo-pin">鈥?/div>
            </div>
          </div>
          <div className="hero-info">
            <div className="ticket-kicker">鍏紑涓婚〉</div>
            <p style={{ color: '#888', fontSize: 14, letterSpacing: '.1em', margin: 0 }}>鍔犺浇涓?..</p>
          </div>
          <aside className="hero-side">
            <div>
              <div className="id-number">No.{profileUserId}</div>
              <div className="id-label">淇＄敤姒傝</div>
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
  const nickname = publicProfile?.nickname || storedProfile.nickname || `鐢ㄦ埛${profileUserId}`
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
        { id: 'portfolio', label: '浣滃搧闆?, num: '01' },
        { id: 'reviews', label: '鍘嗗彶璇勪环', num: '02' },
        { id: 'moments', label: 'TA鐨勫姩鎬?, num: '03' },
      ]
    : [
        { id: 'moments', label: 'TA鐨勭収鐗?, num: '01' },
        { id: 'reviews', label: '鏀跺埌鐨勮瘎浠?, num: '02' },
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
            鏉ヨ嚜 {r.reviewerNickname || `鐢ㄦ埛 ${r.reviewerId}`} 路 {formatShortTime(r.createdAt)}
          </span>
          <ReviewScore value={r.rating} />
        </div>
        <blockquote style={{ margin: 0 }}>"{r.content || '瀵规柟娌℃湁鐣欎笅鏂囧瓧璇勪环'}"</blockquote>
        {r.replyContent && (
          <div className="review-reply"><span>杩借瘎</span><p>{r.replyContent}</p></div>
        )}
      </div>
    )
  }

  return (
    <div className="pp-main">
      {notice && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 12, background: notice.type === 'err' ? 'rgba(248,81,4,.08)' : 'rgba(13,47,178,.07)', color: notice.type === 'err' ? '#c13a05' : 'var(--blue)', fontSize: 13, letterSpacing: '.06em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {notice.text}
          <button onClick={() => setNotice(null)} style={{ border: 0, background: 'transparent', fontSize: 16, cursor: 'pointer', color: 'inherit', lineHeight: 1 }}>脳</button>
        </div>
      )}

        <span><strong>个人档案</strong> / {nickname} / 公开主页</span>
        <span>{isProvider ? 约拍  ·  : 信用  · Portra}</span>
      </div>

      {/* 鈹€鈹€ HERO 鈹€鈹€ */}
      <section className="profile-hero">
        <div className="hero-bg-word">PROFILE</div>

        <div className="profile-photo-wrap">
          <div className="profile-photo-card">
            <div className="profile-photo">{avatarUrl && <img src={avatarUrl} alt="" />}</div>
            <div className="photo-pin">{cityPin}</div>
          </div>
        </div>

        <div className="hero-info">
          <div className="ticket-kicker">鍏紑涓婚〉</div>
          <div className="hero-name-row">
            <h1 className="hero-name">{nickname}</h1>
            <span className="role-badge">{isProvider ? '鎽勫奖甯? : '绾︽媿鏂?}</span>
          </div>
          <p className="profile-uid">鐢ㄦ埛缂栧彿锛歿profileUserId}</p>
          <div className="profile-meta-line">
            <span>IP灞炲湴锛歿ipLocation || '鏈煡'}</span>
          </div>
          {(() => {
            const chips = []
            if (gender === 'FEMALE') chips.push('鈾€ 濂?)
            else if (gender === 'MALE') chips.push('鈾?鐢?)
            if (pp?.cityCode) chips.push(`馃搷 ${pp.cityCode}`)
            return chips.length ? (
              <div className="profile-tag-row">
                {chips.map((c, i) => <span key={i} className="profile-tag">{c}</span>)}
              </div>
            ) : null
          })()}
          <p className="profile-signature">{bio || '杩欎釜浜鸿繕娌℃湁鍐欑畝浠嬨€?}</p>
          <div className="social-stats-row">
            <div className="social-stat"><b>{publicProfile?.followingCount ?? '鈥?}</b><span>鍏虫敞</span></div>
            <div className="social-stat"><b>{publicProfile?.followerCount ?? '鈥?}</b><span>绮変笣</span></div>
            <div className="social-stat"><b>{publicProfile?.momentCount ?? moments.length}</b><span>鍔ㄦ€?/span></div>
          </div>
        </div>

        <aside className="hero-side">
          <div>
            <div className="id-number">No.{profileUserId}</div>
            <div className="id-label">淇＄敤姒傝</div>
          </div>
          <div className="metric-grid">
            <button className="metric metric-button" type="button" onClick={() => navigate(`/users/${profileUserId}/credit`)}>
              <b>{displayCreditScore}</b><span>淇＄敤璇勫垎</span>
            </button>
            {isProvider ? (
              <>
                <div className="metric"><b>{pp?.avgRating != null ? Number(pp.avgRating).toFixed(1) : '鈥?}</b><span>骞冲潎璇勫垎</span></div>
                <div className="metric"><b>{pp?.completedOrders ?? '鈥?}</b><span>鍘嗗彶绾︽媿</span></div>
                <div className="metric"><b>{reviews.length}</b><span>鏀跺埌璇勪环</span></div>
              </>
            ) : (
              <>
                <div className="metric"><b>{reviews.length}</b><span>鏀跺埌璇勪环</span></div>
                <div className="metric"><b>{publicProfile?.momentCount ?? moments.length}</b><span>鍔ㄦ€佹暟</span></div>
              </>
            )}
          </div>
          <div className="hero-actions">
            {isProvider && pp?.priceMin != null && (
              <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 700, marginBottom: 4 }}>
                {`楼${pp.priceMin}鈥撀?{pp.priceMax} / 娆}
              </div>
            )}
            <button className="primary-btn" onClick={() => navigate('/messages', { state: { targetUserId: profileUserId } })}>鍙戞秷鎭?/button>
            <button className="secondary-btn" onClick={toggleFollow} disabled={followLoading}>
              {followedByMe && followsMe ? '浜掔浉鍏虫敞' : followedByMe ? '宸插叧娉? : '鍏虫敞'}
            </button>
            <button className="secondary-btn" onClick={() => navigate(`/users/${profileUserId}?role=${isProvider ? 'CUSTOMER' : 'PROVIDER'}`)}>
              {isProvider ? '鏌ョ湅 TA 鐨勭害鎷嶆柟涓婚〉 鈫? : '鏌ョ湅 TA 鐨勬憚褰卞笀涓婚〉 鈫?}
            </button>
          </div>
        </aside>
      </section>

      {/* 鈹€鈹€ DASHBOARD 鈹€鈹€ */}
      <section className="pp-dashboard">
        <div className="dashboard-card-row" ref={dashboardRowRef}>

<<<<<<< HEAD
          <aside className="panel-card frame-nav" ref={frameNavRef}>
            <p className="frame-title">Frame Navigation</p>
            {allTabs.map(tab => (
              <button key={tab.id} className={`frame-tab${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <span>{tab.label}</span><small>{tab.num}</small>
              </button>
            ))}
          </aside>
=======
            <aside className="panel-card frame-nav" ref={frameNavRef}>
              <p className="frame-title">鍐呭瀵艰埅</p>
              {providerTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`frame-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                  <small>{tab.num}</small>
                </button>
              ))}
            </aside>
>>>>>>> 8b02cbe (fix: unify frontend credit displays and copy)

          <div className="content-stack" style={{ height: 'auto' }}>

            {/* 浣滃搧闆?/ TA鐨勭収鐗?*/}
            <section className={`panel-card tab-panel${activeTab === 'portfolio' || activeTab === 'moments' ? ' active' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>{isProvider ? '浣滃搧闆? : 'TA鐨勭収鐗?}</h2>
                  <p>{isProvider ? '鎽勫奖甯堢殑鑳剁墖鎺ヨЕ鍗扮浉锛岃褰曟瘡涓€娆℃寜蹇棬鐨勭灛闂淬€? : '琚揩闂ㄧ暀涓嬬殑鏃跺埢銆?}</p>
                </div>
<<<<<<< HEAD
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
=======
                <div className="contact-sheet">
                  <div className="photo-grid">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const m = momentImages[i]
                      return (
                        <div
                          key={i}
                          className="film-frame"
                          onClick={() => m && navigate(`/moments/${m.momentId}`)}
                          style={m ? { cursor: 'pointer' } : {}}
                        >
                          {m?.imageData && <img src={m.imageData} alt="" />}
                          <span className="cap">浣滃搧 {String(i + 1).padStart(2, '0')}</span>
                        </div>
                      )
                    })}
                  </div>
>>>>>>> 8b02cbe (fix: unify frontend credit displays and copy)
                </div>
              </div>
              {!isProvider && moments.length > 0 && (
                <div className="order-list" style={{ marginTop: 16 }}>
                  {moments.slice(0, 5).map((m, i) => (
                    <div key={m.momentId} className="order-slip" onClick={() => navigate(`/moments/${m.momentId}`)}>
                      <div className="order-num">{String(i + 1).padStart(2, '0')}</div>
                      <div><h4>{m.title || '鏈懡鍚嶅姩鎬?}</h4><p>{(m.content || '').slice(0, 50)} 路 {formatShortTime(m.createdAt)}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 鍘嗗彶璇勪环 / 鏀跺埌鐨勮瘎浠?*/}
            <section className={`panel-card tab-panel${activeTab === 'reviews' ? ' active' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>{isProvider ? '鍘嗗彶璇勪环' : '鏀跺埌鐨勮瘎浠?}</h2>
                  <p>{isProvider ? '鏉ヨ嚜绾︽媿鏂圭殑鐪熷疄鍙嶉锛岃璇佹瘡涓€娆＄害鎷嶃€? : '鎽勫奖甯堝 TA 鐨勭湡瀹炲弽棣堬紝浜嗚В鍚堜綔浣撻獙銆?}</p>
                </div>
                <div className="section-mark">02</div>
              </div>
              {(isProvider ? providerReviews : customerReviews).length
                ? (isProvider ? providerReviews : customerReviews).slice(0, 6).map(r => (
                    <ReviewCard key={r.reviewId || `${r.orderId}-${r.direction}`} r={r} />
                  ))
                : <div className="pp-empty"><h3>鏆傛棤璇勪环</h3><p>瀹屾垚绾︽媿鍚庡弻鏂逛細浜掔浉鐣欎笅璇勪环銆?/p></div>
              }
            </section>

            {/* TA鐨勫姩鎬侊紙浠呮憚褰卞笀锛?*/}
            {isProvider && (
              <section className={`panel-card tab-panel${activeTab === 'moments' ? ' active' : ''}`}>
                <div className="section-head">
                  <div><h2>TA鐨勫姩鎬?/h2><p>鎽勫奖甯堟渶杩戝彂甯冪殑甯栧瓙銆?/p></div>
                  <div className="section-mark">03</div>
                </div>
                {moments.length ? (
                  <div className="order-list">
                    {moments.slice(0, 5).map((m, i) => (
                      <div key={m.momentId} className="order-slip" onClick={() => navigate(`/moments/${m.momentId}`)}>
                        <div className="order-num">{String(i + 1).padStart(2, '0')}</div>
                        <div><h4>{m.title || '鏈懡鍚嶅姩鎬?}</h4><p>{(m.content || '').slice(0, 50)} 路 {formatShortTime(m.createdAt)}</p></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pp-empty"><h3>鏆傛棤鍔ㄦ€?/h3><p>璇ユ憚褰卞笀杩樻病鏈夊彂甯冨姩鎬併€?/p></div>
                )}
              </section>
            )}

          </div>

          {/* 鍙充晶淇℃伅鏍忥紙浠呮憚褰卞笀锛?*/}
          {isProvider && (
            <aside className="side-stack" style={{ height: 'auto', minHeight: 'var(--dashboard-left-card-height)', overflow: 'visible' }}>
              <section className="panel-card">
                <p className="frame-title">鎽勫奖甯堜俊鎭?/p>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, letterSpacing: '.14em', color: '#6e737b', marginBottom: 8 }}>椋庢牸鏍囩</div>
                  {styleTags.length
                    ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{styleTags.map(tag => <span key={tag} className="tag blue">{tag}</span>)}</div>
                    : <span style={{ fontSize: 13, color: '#999' }}>鏆傛湭璁剧疆</span>
                  }
                </div>
                {pp?.equipment && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, letterSpacing: '.14em', color: '#6e737b', marginBottom: 6 }}>璁惧</div>
                    <p style={{ margin: 0, fontSize: 13, color: '#30343a', lineHeight: 1.7 }}>{pp.equipment}</p>
                  </div>
                )}
              </section>
            </aside>
          )}

<<<<<<< HEAD
        </div>
      </section>
=======
          </div>
        </section>
      )}

      {/* 鈹€鈹€ CUSTOMER: Simplified layout 鈹€鈹€ */}
      {!isProvider && (
        <section className="pp-dashboard">

          <section className="panel-card">
            <div className="section-head">
              <div>
                <h2>TA鐨勭収鐗?/h2>
                <p>琚揩闂ㄧ暀涓嬬殑鏃跺埢锛屼細鍦ㄨ繖閲屾垚涓?contact sheet銆?/p>
              </div>
              <div className="section-mark">01</div>
            </div>
            <div className="contact-sheet">
              <div className="photo-grid">
                {Array.from({ length: 6 }).map((_, i) => {
                  const m = momentImages[i]
                  return (
                    <div
                      key={i}
                      className="film-frame"
                      onClick={() => m && navigate(`/moments/${m.momentId}`)}
                      style={m ? { cursor: 'pointer' } : {}}
                    >
                      {m?.imageData && <img src={m.imageData} alt="" />}
                      <span className="cap">浣滃搧 {String(i + 1).padStart(2, '0')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="panel-card">
            <div className="section-head">
              <div>
                <h2>鎽勫奖甯堝TA鐨勮瘎浠?/h2>
                <p>鏈嶅姟鏂圭殑鐪熷疄鍙嶉銆?/p>
              </div>
              <div className="section-mark">02</div>
            </div>
            {customerReviews.length ? customerReviews.slice(0, 4).map(r => (
              <div
                key={r.reviewId || `${r.orderId}-${r.direction}`}
                className="review-card"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => openReviewCard(r)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openReviewCard(r)
                  }
                }}
              >
                <blockquote>"{r.content || '瀵规柟娌℃湁鐣欎笅鏂囧瓧璇勪环'}"</blockquote>
                <footer>
                  鏉ヨ嚜 {r.reviewerNickname || `鐢ㄦ埛 ${r.reviewerId}`} 路 鈽厈Number(r.rating || 0).toFixed(1)} 路 {formatShortTime(r.createdAt)}
                </footer>
              </div>
            )) : (
              <div className="pp-empty"><h3>杩樻病鏈夋敹鍒拌瘎浠?/h3><p>瀹屾垚绾︽媿鍚庢憚褰卞笀浼氱暀涓嬭瘎浠枫€?/p></div>
            )}
          </section>

        </section>
      )}
>>>>>>> 8b02cbe (fix: unify frontend credit displays and copy)
    </div>
  )
}
