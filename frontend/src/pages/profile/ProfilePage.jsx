import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import {
  creditApi, demandApi, fileApi, momentApi, orderApi, reviewApi, userApi, conversationApi
} from '../../api.js'
import {
  formatShortTime, formatTime,
  getLocalReviewsByTarget, getOrderSnapshotsForUser,
  isApiUnavailable, mergeReviewLists,
  readFollows, readPortfolioItems, readSavedPhotos,
  saveConversationRecord, saveOrderSnapshots, saveUserProfile,
  addPortfolioItem, buildPortfolioWorks
} from './utils/profileUtils.js'
import './profile.css'

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
    img.src = url
  })
}

function orderStatusClass(status) {
  if (['PENDING_RESPONSE','PENDING_CUSTOMER_ACCEPT'].includes(status)) return 'yellow'
  if (['COMPLETED','REVIEWED'].includes(status)) return 'orange'
  return ''
}

function orderStatusLabel(status) {
  return { PENDING_RESPONSE:'待响应', PENDING_CUSTOMER_ACCEPT:'待确认', IN_PROGRESS:'进行中',
    DELIVERING:'交付中', COMPLETED:'已完成', REVIEWED:'已评价', CANCELLED:'已取消' }[status] || status
}

function formatCreditScore(value) {
  if (value === null || value === undefined) return '暂无'
  if (typeof value === 'string' && value.trim() === '') return '暂无'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '暂无'
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { currentUser, updateProfile, logout, switchRole } = useAuth()
  const isProvider = currentUser.role === 'PROVIDER'

  const [profileForm, setProfileForm] = useState({
    nickname: currentUser.nickname || currentUser.label || '',
    avatarData: currentUser.avatarData || '',
    bio: currentUser.bio || currentUser.description || '',
    availability: currentUser.availability || ''
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [activeTab, setActiveTab] = useState('photos')
  const [activeMonth, setActiveMonth] = useState(0)
  const [editOpen, setEditOpen] = useState(false)

  const [moments, setMoments] = useState([])
  const [invitations, setInvitations] = useState([])
  const [providerInfoMap, setProviderInfoMap] = useState({})
  const [profileOrders, setProfileOrders] = useState([])
  const [receivedReviews, setReceivedReviews] = useState([])
  const [creditSummary, setCreditSummary] = useState(null)
  const [portfolioItems, setPortfolioItems] = useState([])
  const [actioningId, setActioningId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [myFollowers, setMyFollowers] = useState([])

  const dashboardRowRef = useRef(null)
  const frameNavRef = useRef(null)
  const archiveSectionRef = useRef(null)

  // Sync body class for CSS role switching
  useEffect(() => {
    if (isProvider) document.body.classList.add('provider')
    else document.body.classList.remove('provider')
    return () => document.body.classList.remove('provider')
  }, [isProvider])

  // Sync profile form when currentUser changes
  useEffect(() => {
    setProfileForm({
      nickname: currentUser.nickname || currentUser.label || '',
      avatarData: currentUser.avatarData || '',
      bio: currentUser.bio || currentUser.description || '',
      availability: currentUser.availability || ''
    })
  }, [currentUser.userId, currentUser.nickname, currentUser.avatarData, currentUser.bio])

  // syncBackCardHeight
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

  // 3D hover effects
  useEffect(() => {
    const targets = dashboardRowRef.current?.querySelectorAll('.mini-ticket,.film-frame,.order-slip') || []
    const cleanup = []
    targets.forEach(el => {
      const move = e => {
        const r = el.getBoundingClientRect()
        const x = ((e.clientX - r.left) / r.width - .5) * 8
        const y = ((e.clientY - r.top) / r.height - .5) * -8
        el.style.transform = `translateY(-4px) rotateX(${y}deg) rotateY(${x}deg)`
      }
      const leave = () => { el.style.transform = '' }
      el.addEventListener('mousemove', move)
      el.addEventListener('mouseleave', leave)
      cleanup.push(() => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave) })
    })
    return () => cleanup.forEach(fn => fn())
  }, [activeTab, moments, profileOrders, receivedReviews])

  useEffect(() => { loadProfileData() }, [currentUser.userId, currentUser.role])

  useEffect(() => {
    async function detectIpLocation() {
      try {
        const amapKey = import.meta.env.VITE_AMAP_KEY
        let city = ''
        if (amapKey) {
          const res = await fetch(`https://restapi.amap.com/v3/ip?key=${amapKey}&output=json`)
          const data = await res.json()
          if (data.status === '1' && data.city && typeof data.city === 'string') {
            city = data.city.replace(/市$/, '').trim()
          }
        }
        if (!city) {
          // 无高德 Key 时降级用 ip-api.com（省级）
          const res = await fetch('http://ip-api.com/json/?lang=zh-CN&fields=status,regionName')
          const data = await res.json()
          if (data.status === 'success' && data.regionName) {
            city = data.regionName.replace(/(省|市|自治区|特别行政区)$/, '').trim()
          }
        }
        if (!city || city === currentUser.cityCode) return
        updateProfile({ cityCode: city })
        await userApi.updateMe({ cityCode: city }, currentUser)
      } catch { /* ignore */ }
    }
    detectIpLocation()
  }, [currentUser.userId])

  async function loadProfileData() {
    const [myProfileRes, momRes, revRes, credRes, ordRes, followersRes] = await Promise.allSettled([
      userApi.me(currentUser),
      momentApi.list({}, currentUser),
      reviewApi.listByUser(currentUser.userId, currentUser),
      creditApi.summary(currentUser.userId, currentUser),
      orderApi.list({ role: isProvider ? 'provider' : 'customer' }, currentUser),
      userApi.followers(currentUser.userId, currentUser)
    ])
    if (myProfileRes.status === 'fulfilled' && myProfileRes.value) {
      const role = myProfileRes.value.currentRole || myProfileRes.value.role || currentUser.role
      const nickname = myProfileRes.value.nickname || currentUser.nickname
      const bio = myProfileRes.value.bio || currentUser.bio || currentUser.description || ''
      const avatarFileId = role === 'PROVIDER'
        ? (myProfileRes.value.providerAvatarFileId || myProfileRes.value.avatarFileId)
        : (myProfileRes.value.customerAvatarFileId || myProfileRes.value.avatarFileId)
      let avatarData = currentUser.avatarData || ''
      if (avatarFileId) {
        try {
          avatarData = await fileApi.downloadObjectUrl(avatarFileId, currentUser)
        } catch {
          // ignore avatar download fallback
          avatarData = currentUser.avatarData || ''
        }
      }
      updateProfile({
        userId: myProfileRes.value.userId || myProfileRes.value.id || currentUser.userId,
        id: myProfileRes.value.userId || myProfileRes.value.id || currentUser.userId,
        role,
        nickname,
        avatarFileId,
        avatarData,
        bio,
        description: bio,
        creditScore: myProfileRes.value.creditScore ?? null,
        customerNickname: myProfileRes.value.customerNickname ?? (role === 'CUSTOMER' ? nickname : currentUser.customerNickname),
        customerBio: myProfileRes.value.customerBio ?? (role === 'CUSTOMER' ? bio : currentUser.customerBio),
        providerNickname: myProfileRes.value.providerNickname ?? (role === 'PROVIDER' ? nickname : currentUser.providerNickname),
        providerBio: myProfileRes.value.providerBio ?? (role === 'PROVIDER' ? bio : currentUser.providerBio)
      })
    }
    setMoments(momRes.status === 'fulfilled' ? momRes.value : [])
    setReceivedReviews(mergeReviewLists(
      revRes.status === 'fulfilled' ? revRes.value : [],
      getLocalReviewsByTarget(currentUser.userId)
    ))
    setCreditSummary(credRes.status === 'fulfilled' ? credRes.value : null)
    const orders = ordRes.status === 'fulfilled' ? ordRes.value : getOrderSnapshotsForUser(currentUser.userId)
    setProfileOrders(orders)
    saveOrderSnapshots(orders)
    setPortfolioItems(readPortfolioItems(currentUser.userId))
    setMyFollowers(followersRes.status === 'fulfilled' ? followersRes.value : [])
    if (!isProvider) {
      try {
        const invs = await demandApi.responsesReceived(currentUser)
        setInvitations(invs)
        const uniqueProviderIds = [...new Set(invs.map(i => i.providerId).filter(Boolean))]
        const infoEntries = await Promise.all(uniqueProviderIds.map(async pid => {
          try {
            const brief = await userApi.brief(pid, currentUser)
            let avatarData = ''
            if (brief?.avatarFileId) {
              try { avatarData = await fileApi.downloadObjectUrl(brief.avatarFileId, currentUser) } catch { /**/ }
            }
            return [pid, { nickname: brief?.nickname || `摄影师${pid}`, avatarData }]
          } catch { return [pid, { nickname: `摄影师${pid}`, avatarData: '' }] }
        }))
        setProviderInfoMap(Object.fromEntries(infoEntries))
      } catch { setInvitations([]) }
    }
  }

  async function chooseAvatar(e) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const avatarData = await imageFileToDataUrl(file)
      setAvatarFile(file)
      setProfileForm(p => ({ ...p, avatarData }))
      setNotice({ type: 'ok', text: '头像已选择，保存资料后生效' })
    } catch (err) { setNotice({ type: 'err', text: err.message }) }
  }

  async function saveProfile() {
    const next = {
      nickname: profileForm.nickname.trim() || currentUser.label,
      avatarData: profileForm.avatarData,
      bio: profileForm.bio.trim(),
      description: profileForm.bio.trim(),
      availability: profileForm.availability.trim(),
      role: currentUser.role
    }
    let avatarFileId = currentUser.avatarFileId || null
    try {
      if (avatarFile) {
        const uploaded = await fileApi.upload(avatarFile, { bizType: 'AVATAR', visibility: 'PUBLIC' }, currentUser)
        if (!uploaded?.fileId) {
          throw new Error('Avatar upload failed')
        }
        avatarFileId = uploaded.fileId
      }
      await userApi.updateMe({ nickname: next.nickname, bio: next.bio, role: currentUser.role, avatarFileId }, currentUser)
    } catch (err) {
      setNotice({ type: 'err', text: err.message || 'Profile save failed' })
      return false
    }
    saveUserProfile(currentUser.userId, next)
    setAvatarFile(null)
    updateProfile({ ...next, avatarFileId })
    setNotice({ type: 'ok', text: '个人资料已更新' })
    return true
  }

  async function handleSwitchRole(newRole) {
    try {
      await userApi.switchRole(newRole, currentUser)
      switchRole(newRole)
      setNotice({ type: 'ok', text: `已切换到${newRole === 'PROVIDER' ? '摄影师' : '单主'}账号` })
    } catch (err) {
      setNotice({ type: 'err', text: err.message || '切换身份失败' })
    }
  }

  async function choosePortfolioImage(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
    try {
      const imageData = await imageFileToDataUrl(file)
      const nextItems = addPortfolioItem(currentUser.userId, { title: file.name.replace(/\.[^.]+$/, '') || '作品', imageData })
      setPortfolioItems(nextItems)
    } catch {
      // ignore portfolio image additions that fail validation or readback
    }
  }

  async function acceptInvitation(inv) {
    setActioningId(inv.responseId)
    try {
      const accepted = await demandApi.accept(inv.demandId, inv.responseId, currentUser)
      saveConversationRecord(
        { conversationId: accepted.conversationId },
        { customerId: accepted.customerId, providerId: accepted.providerId, demandId: accepted.demandId }
      )
      window.location.href = `/messages/${accepted.conversationId}`
    } catch (err) { setNotice({ type: 'err', text: err.message }) }
    finally { setActioningId(null) }
  }

  async function rejectInvitation(inv) {
    setActioningId(inv.responseId)
    try { await demandApi.reject(inv.demandId, inv.responseId, currentUser); await loadProfileData() }
    catch (err) { setNotice({ type: 'err', text: err.message }) }
    finally { setActioningId(null) }
  }

  const myMoments = useMemo(
    () => moments.filter(m => Number(m.authorId) === currentUser.userId && m.authorRole === currentUser.role),
    [moments, currentUser.userId, currentUser.role]
  )
  const favoriteMoments = useMemo(() => moments.filter(m => m.favoritedByCurrentUser), [moments])
  const follows = readFollows().filter(f => Number(f.authorId) !== currentUser.userId)
  const savedPhotos = readSavedPhotos()
  const mutualFollowIds = useMemo(
    () => new Set(myFollowers.filter(f => f.followedByCurrentUser).map(f => Number(f.userId))),
    [myFollowers]
  )

  const TERMINAL_STATUSES = ['COMPLETED','REVIEWED','CANCELLED','REFUNDED','APPEALING']
  const historicalOrders = profileOrders.filter(o => ['COMPLETED','REVIEWED'].includes(o.status)).length
  const ongoingOrders = profileOrders.filter(o => !TERMINAL_STATUSES.includes(o.status)).length
  const pendingInvitations = invitations.filter(i => (i.status || 'PENDING_CUSTOMER_ACCEPT') === 'PENDING_CUSTOMER_ACCEPT').length
  const creditScore = creditSummary?.creditScore ?? null
  const billableOrders = profileOrders.filter(o => o.status !== 'REFUNDED').length
  const completionRate = billableOrders > 0 ? Math.round((historicalOrders / billableOrders) * 100) : 100
  const genderText = currentUser.gender === 'MALE' ? '男' : currentUser.gender === 'FEMALE' ? '女' : '保密'
  const displayName = profileForm.nickname || currentUser.label || `用户${currentUser.userId}`
  const schoolPin = currentUser.school || 'Portra'

  const momentsByMonth = useMemo(() => {
    const grouped = {}
    myMoments.forEach(m => {
      const d = new Date(m.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!grouped[key]) grouped[key] = { year: d.getFullYear(), month: d.getMonth(), moments: [] }
      grouped[key].moments.push(m)
    })
    return Object.values(grouped).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
  }, [myMoments])

  const currentMonthData = momentsByMonth[activeMonth]
  const currentMonthMoments = currentMonthData?.moments || []
  const featuredMoment = currentMonthMoments[0]
  const slimMoments = currentMonthMoments.slice(1, 4)

  const works = buildPortfolioWorks(currentUser.userId, myMoments, portfolioItems)

  // frameImageUrls: reserved for future file-based images; moments use imageData directly

  function handleTabClick(id) {
    setActiveTab(id)
    requestAnimationFrame(syncHeight)
  }

  const tabs = [
    { id: 'photos', labelC: '我的照片', labelP: '我的作品', num: '01' },
    { id: 'intent', labelC: '我的意向', labelP: '橱窗管理', num: '02' },
    { id: 'orders', label: '我的订单', num: '03' },
    { id: 'reviews', label: '历史评价', num: '04' },
    { id: 'following', label: '我的关注', num: '05' },
    { id: 'collections', label: '我的收藏', num: '06' },
  ]

  return (
    <div className="pp-main">
      {notice && (
        <div style={{marginBottom:14,padding:'10px 16px',borderRadius:12,background:notice.type==='ok'?'rgba(13,47,178,.07)':'rgba(248,81,4,.08)',color:notice.type==='ok'?'var(--blue)':'#c13a05',fontSize:13,letterSpacing:'.06em',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          {notice.text}
          <button onClick={() => setNotice(null)} style={{border:0,background:'transparent',fontSize:16,cursor:'pointer',color:'inherit',lineHeight:1}}>×</button>
        </div>
      )}

      <div className="pp-crumb">
        <span><strong>PROFILE</strong> / PORTRA ID / 个人摄影档案</span>
        <span>FRAME {String(currentUser.userId).padStart(2,'0')} · Portra</span>
      </div>

      {/* ── HERO ── */}
      <section className="profile-hero">
        <div className="hero-bg-word">PROFILE</div>

        <div className="profile-photo-wrap">
          <div className="profile-photo-card">
            <div className="profile-photo">
              {profileForm.avatarData && <img src={profileForm.avatarData} alt="" />}
            </div>
            <div className="photo-pin">{schoolPin}</div>
          </div>
        </div>

        <div className="hero-info">
          <div className="ticket-kicker">Portra Profile Ticket</div>
          <div className="hero-name-row">
            <h1 className="hero-name">{displayName}</h1>
            <span className="role-badge">{isProvider ? '摄影师' : '单主'}</span>
          </div>
          <p className="profile-uid">UID：{currentUser.userId} · Portra ID</p>
          <div className="profile-meta-line">
            <span>IP属地：{currentUser.cityCode || '未知'}</span>
          </div>
          <p className="profile-signature">{profileForm.bio || '这个人还没有写简介。'}</p>
        </div>

        <aside className="hero-side">
          <div>
            <div className="id-number">No.{currentUser.userId}</div>
            <div className="id-label">Portra Credit File</div>
          </div>
          <div className="metric-grid">
            <button className="metric metric-button" type="button" onClick={() => navigate('/profile/credit')}><b>{formatCreditScore(creditScore)}</b><span>信用评分</span></button>
            <div className="metric"><b>{completionRate}%</b><span>完成率</span></div>
            <div className="metric"><b>{historicalOrders}</b><span>历史约拍</span></div>
            <div className="metric"><b>{ongoingOrders}</b><span>进行中</span></div>
          </div>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => setEditOpen(true)}>编辑资料</button>
            {isProvider
              ? <button className="secondary-btn" onClick={() => navigate('/publish/service-package')}>发布新橱窗</button>
              : <button className="secondary-btn" onClick={() => navigate('/feed?view=mine')}>管理我的动态</button>
            }
            {isProvider ? (
              <button className="secondary-btn" onClick={() => handleSwitchRole('CUSTOMER')}>
                🎯 切换到我的单主账号
              </button>
            ) : (
              <>
                <button className="secondary-btn" onClick={() => handleSwitchRole('PROVIDER')}>
                  📷 切换到我的摄影师账号
                </button>
                <p style={{fontSize:11, color:'#8a8d92', letterSpacing:'.1em', margin:'6px 0 0', textAlign:'center'}}>
                  切换后昵称、头像和动态将独立展示
                </p>
              </>
            )}
          </div>
        </aside>
      </section>

      {/* ── DASHBOARD ── */}
      <section className="pp-dashboard">
        <div className="dashboard-card-row" ref={dashboardRowRef}>

          {/* Left: Tab Nav */}
          <aside className="panel-card frame-nav" ref={frameNavRef}>
            <p className="frame-title">Frame Navigation</p>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`frame-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
              >
                <span>{tab.labelC ? (isProvider ? tab.labelP : tab.labelC) : tab.label}</span>
                <small>{tab.num}</small>
              </button>
            ))}
          </aside>

          {/* Middle: Tab Panels */}
          <div className="content-stack" style={{height:'auto'}}>

            {/* PHOTOS */}
            <section className={`panel-card tab-panel${activeTab === 'photos' ? ' active' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>{isProvider ? '我的作品集' : '我的动态'}</h2>
                  <p>{isProvider ? '作品不是普通九宫格，而是属于摄影师的胶片接触印相。' : '被快门留下的时刻，会在这里成为自己的 contact sheet。'}</p>
                </div>
                <div className="section-mark">01</div>
              </div>
              <div className="contact-sheet">
                {(() => {
                  const items = isProvider ? works : myMoments
                  const scrollable = items.length > 6
                  return (
                    <div className={`photo-grid${scrollable ? ' photo-grid-scroll' : ''}`}>
                      {scrollable
                        ? items.map((m, i) => (
                          <div key={i} className="film-frame">
                            {m?.imageData && <div style={{position:'absolute',inset:0,zIndex:1,backgroundImage:`url(${m.imageData})`,backgroundSize:'cover',backgroundPosition:'center'}} />}
                            <span className="cap">FRAME {String(i+1).padStart(2,'0')}</span>
                          </div>
                        ))
                        : Array.from({length:6}).map((_, i) => {
                          const m = items[i]
                          return (
                            <div key={i} className="film-frame">
                              {m?.imageData && <div style={{position:'absolute',inset:0,zIndex:1,backgroundImage:`url(${m.imageData})`,backgroundSize:'cover',backgroundPosition:'center'}} />}
                              <span className="cap">FRAME {String(i+1).padStart(2,'0')}</span>
                            </div>
                          )
                        })
                      }
                    </div>
                  )
                })()}
              </div>
            </section>

            {/* INTENT */}
            <section className={`panel-card tab-panel${activeTab === 'intent' ? ' active' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>{isProvider ? '橱窗管理' : '我的意向'}</h2>
                  <p>{isProvider ? '管理正在展示的约拍服务，保持时间、价格和风格清晰。' : '意向只是收藏感兴趣的橱窗，不自动下单、不锁定时间。'}</p>
                </div>
                <div className="section-mark">02</div>
              </div>
              {isProvider ? (
                <div className="ticket-grid">
                  <article className="mini-ticket" onClick={() => navigate('/publish/service-package')}>
                    <span className="price">+</span>
                    <h3>发布新橱窗</h3>
                    <p>创建约拍服务包，设定价格、风格和档期。</p>
                    <div className="ticket-meta"><span className="tag blue">立即创建</span></div>
                  </article>
                  <article className="mini-ticket" onClick={() => navigate('/hall?tab=showcases')}>
                    <span className="price">→</span>
                    <h3>查看我的橱窗</h3>
                    <p>前往大厅查看已发布的服务包。</p>
                    <div className="ticket-meta"><span className="tag">前往大厅</span></div>
                  </article>
                </div>
              ) : invitations.length ? (
                <div className="order-list">
                  {invitations.map(inv => {
                    const status = inv.status || 'PENDING_CUSTOMER_ACCEPT'
                    const isPending = status === 'PENDING_CUSTOMER_ACCEPT'
                    const busy = actioningId === inv.responseId
                    return (
                      <div key={inv.responseId} className="order-slip" style={{cursor:'default'}}>
                        <div
                          style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',flexShrink:0,cursor:'pointer',border:'2px solid var(--line)'}}
                          onClick={() => navigate(`/users/${inv.providerId}`)}
                          title="查看摄影师主页"
                        >
                          {providerInfoMap[inv.providerId]?.avatarData
                            ? <img src={providerInfoMap[inv.providerId].avatarData} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                            : <div style={{width:'100%',height:'100%',background:'var(--line)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'var(--ink-sub)'}}>P</div>
                          }
                        </div>
                        <div>
                          <h4>需求 #{inv.demandId}</h4>
                          <p>
                            <span
                              style={{cursor:'pointer',textDecoration:'underline',textDecorationColor:'var(--line)'}}
                              onClick={() => navigate(`/users/${inv.providerId}`)}
                            >
                              {providerInfoMap[inv.providerId]?.nickname || `摄影师${inv.providerId}`}
                            </span>
                            {' · '}{formatShortTime(inv.responseTime)}
                          </p>
                        </div>
                        {isPending ? (
                          <div style={{display:'flex',gap:6}}>
                            <button className="primary-btn" style={{height:34,fontSize:12,padding:'0 12px'}} onClick={() => acceptInvitation(inv)} disabled={busy}>接受</button>
                            <button className="secondary-btn" style={{height:34,fontSize:12,padding:'0 10px'}} onClick={() => rejectInvitation(inv)} disabled={busy}>婉拒</button>
                          </div>
                        ) : (
                          <span className={`status ${status === 'ACCEPTED' ? '' : 'orange'}`}>{status === 'ACCEPTED' ? '已接受' : status === 'REJECTED' ? '已婉拒' : status}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="pp-empty"><h3>暂无邀请</h3><p>当摄影师对你的需求发起邀请后会在这里显示。</p></div>
              )}
            </section>

            {/* ORDERS */}
            <section className={`panel-card tab-panel${activeTab === 'orders' ? ' active' : ''}`}>
              <div className="section-head">
                <div><h2>我的订单</h2><p>订单像票根一样被保存，每一步状态都能回到会话。</p></div>
                <div className="section-mark">03</div>
              </div>
              {profileOrders.length ? (
                <div className="order-list">
                  {profileOrders.slice(0, 5).map((order, i) => (
                    <div key={order.orderId} className="order-slip" onClick={() => navigate('/orders')}>
                      <div className="order-num">{String(i+1).padStart(2,'0')}</div>
                      <div>
                        <h4>{order.scene || order.demandTitle || `订单 ${order.orderId}`}</h4>
                        <p>对方：{order.otherPartyNickname || order.customerId || order.providerUserId} · {formatShortTime(order.updatedAt || order.createdAt)}</p>
                      </div>
                      <span className={`status ${orderStatusClass(order.status)}`}>{orderStatusLabel(order.status)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pp-empty"><h3>暂无订单</h3><p>约拍成单后会在这里显示。</p></div>
              )}
            </section>

            {/* REVIEWS */}
            <section className={`panel-card tab-panel${activeTab === 'reviews' ? ' active' : ''}`}>
              <div className="section-head">
                <div><h2>历史评价</h2><p>用评价建立信任，但不要把页面做成冰冷的信用后台。</p></div>
                <div className="section-mark">04</div>
              </div>
              {receivedReviews.length ? receivedReviews.slice(0, 4).map(r => (
                <div key={r.reviewId || `${r.orderId}-${r.direction}`} className="review-card">
                  <blockquote>"{r.content || '对方没有留下文字评价'}"</blockquote>
                  <footer>来自 用户 {r.reviewerId} · ★{Number(r.rating||0).toFixed(1)} · {formatShortTime(r.createdAt)}</footer>
                </div>
              )) : (
                <div className="pp-empty"><h3>暂无评价</h3><p>完成约拍后会收到对方的评价。</p></div>
              )}
            </section>

            {/* FOLLOWING */}
            <section className={`panel-card tab-panel${activeTab === 'following' ? ' active' : ''}`}>
              <div className="section-head">
                <div><h2>我的关注</h2><p>关注喜欢的摄影师或单主，把之后可能发生的约拍关系先保存下来。</p></div>
                <div className="section-mark">05</div>
              </div>
              {follows.length ? (
                <div className="order-list">
                  {follows.map(f => {
                    const isMutual = mutualFollowIds.has(Number(f.authorId))
                    return (
                      <div key={f.authorId} className="order-slip" onClick={() => navigate(`/users/${f.authorId}`)}>
                        <div className="order-num" style={{fontSize:20}}>★</div>
                        <div>
                          <h4>用户 {f.authorId}</h4>
                          <p>{formatShortTime(f.followedAt)} 开始关注</p>
                        </div>
                        {isMutual && <span className="status">互相关注</span>}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="pp-empty"><h3>还没有关注任何人</h3><p>在动态或大厅页面关注感兴趣的用户。</p></div>
              )}
            </section>

            {/* COLLECTIONS */}
            <section className={`panel-card tab-panel${activeTab === 'collections' ? ' active' : ''}`}>
              <div className="section-head">
                <div><h2>我的收藏</h2><p>收藏喜欢的橱窗、动态和风格，下一次约拍不用重新开始。</p></div>
                <div className="section-mark">06</div>
              </div>
              {favoriteMoments.length ? (
                <div className="ticket-grid">
                  {favoriteMoments.slice(0, 4).map(m => (
                    <article key={m.momentId} className="mini-ticket" onClick={() => navigate(`/moments/${m.momentId}`)}>
                      <span className="price">POST</span>
                      <h3>{m.title || '收藏的动态'}</h3>
                      <p>{m.content || '分享了一张照片'}</p>
                      <div className="ticket-meta"><span className="tag blue">查看动态</span></div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="pp-empty"><h3>还没有收藏</h3><p>收藏喜欢的动态，方便下次查看。</p></div>
              )}
            </section>
          </div>

          {/* Right: Side stack */}
          <aside className="side-stack" style={{height:'auto',minHeight:'var(--dashboard-left-card-height)',overflow:'visible'}}>
            <section className="panel-card">
              <button className="credit-stamp credit-stamp-button" type="button" onClick={() => navigate('/profile/credit')}>
                <b>{formatCreditScore(creditScore)}</b>
                <span>Portra Credit</span>
              </button>
              <div className="todo-list">
                <div className="todo" style={{cursor:'pointer'}} onClick={() => handleTabClick('intent')}>
                  <div>
                    <strong>{isProvider ? '待响应需求' : '待确认邀请'}</strong>
                    <br /><small>今天需要处理</small>
                  </div>
                  <span className="status yellow">{pendingInvitations || 0}</span>
                </div>
                <div className="todo">
                  <div><strong>进行中订单</strong><br /><small>可进入会话</small></div>
                  <span className="status">{ongoingOrders}</span>
                </div>
                <div className="todo">
                  <div><strong>历史评价</strong><br /><small>最近新增</small></div>
                  <span className="status orange">{receivedReviews.length}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>

        {/* ── ARCHIVE ── */}
        <section className="posted-section archive-drawer-section">
          <div className="archive-head">
            <div>
              <p className="archive-eyebrow">PORTRA POST ARCHIVE</p>
              <h2>{isProvider ? '我的作品集' : '我的动态'}</h2>
              <p>{isProvider ? '这里只展示摄影师本人发布过的作品动态、拍摄花絮和档期说明。' : '这里只收纳我自己发布过的帖子：想拍记录、拍摄日记、成片分享。'}</p>
            </div>
            <button
              className="archive-all"
              onClick={() => navigate('/feed?view=mine')}
            >
              全部帖子 →
            </button>
          </div>

          <div ref={archiveSectionRef}>
            {momentsByMonth.length === 0 ? (
            <div className="pp-empty"><h3>还没有发布过动态</h3><p>去动态页发布你的第一条帖子吧。</p></div>
          ) : (
            <div className="archive-drawer-layout">
              <aside className="archive-index" aria-label="月份索引">
                {momentsByMonth.map((md, idx) => (
                  <button key={idx} className={`archive-month${activeMonth === idx ? ' active' : ''}`}
                    onClick={() => setActiveMonth(idx)}>
                    <b>{MONTH_ABBR[md.month]}</b>
                    <span>{md.year} / {md.moments.length} POSTS</span>
                  </button>
                ))}
              </aside>
              <div className="archive-stack">
                {featuredMoment ? (
                  <article className="archive-card featured" onClick={() => navigate(`/moments/${featuredMoment.momentId}`)}>
                    <div className="archive-card-code">POST {String(featuredMoment.momentId).padStart(3,'0')} / LATEST</div>
                    <div className="archive-paper-photo">
                      {featuredMoment.imageData && <img src={featuredMoment.imageData} alt="" />}
                    </div>
                    <div className="archive-card-copy">
                      <h3>{featuredMoment.title || '未命名动态'}</h3>
                      <p>{featuredMoment.content || '分享了一张照片'}</p>
                      <div className="archive-tags">
                        <span>我发布的帖子</span>
                        {(featuredMoment.mentions || []).slice(0,2).map(m => <span key={m}>{m}</span>)}
                      </div>
                    </div>
                    <div className="archive-card-footer">
                      <span>{formatShortTime(featuredMoment.createdAt)}</span>
                      <span>♡{featuredMoment.likeCount||0} · 收藏{featuredMoment.favoriteCount||0}</span>
                    </div>
                  </article>
                ) : (
                  <div className="pp-empty" style={{gridColumn:'1/-1'}}><h3>本月暂无动态</h3><p>在动态页发布你的第一条帖子。</p></div>
                )}
                {slimMoments.map(m => (
                  <article key={m.momentId} className="archive-card slim" onClick={() => navigate(`/moments/${m.momentId}`)}>
                    <div className="archive-card-code">POST {String(m.momentId).padStart(3,'0')}</div>
                    <div>
                      <h4>{m.title || '未命名动态'}</h4>
                      <p>{m.content || '分享了一张照片'}</p>
                    </div>
                    <span className="archive-pin">{formatShortTime(m.createdAt).slice(5,10)}</span>
                  </article>
                ))}
              </div>
            </div>
          )}
          </div>
        </section>
      </section>

      {/* ── EDIT MODAL ── */}
      {editOpen && (
        <div className="pp-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setEditOpen(false) }}>
          <div className="pp-modal">
            <h2>编辑资料</h2>
            <div className="pp-form-grid">
              <div>
                <label className="pp-label">昵称</label>
                <input className="pp-input" value={profileForm.nickname}
                  onChange={e => setProfileForm(p => ({...p, nickname: e.target.value}))} />
              </div>
              <div>
                <label className="pp-label">简介</label>
                <textarea className="pp-textarea" value={profileForm.bio}
                  onChange={e => setProfileForm(p => ({...p, bio: e.target.value}))} />
              </div>
              <div>
                <label className="pp-label">档期</label>
                <input className="pp-input" value={profileForm.availability}
                  onChange={e => setProfileForm(p => ({...p, availability: e.target.value}))} />
              </div>
              <div>
                <label className="pp-label">头像</label>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <label className="secondary-btn" style={{cursor:'pointer',fontSize:13}}>
                    更换头像
                    <input type="file" accept="image/*" hidden onChange={chooseAvatar} />
                  </label>
                  {profileForm.avatarData && (
                    <img src={profileForm.avatarData} alt=""
                      style={{width:42,height:42,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--line)'}} />
                  )}
                </div>
              </div>
            </div>
            <div className="pp-modal-actions">
              <button className="primary-btn" onClick={async () => { if (await saveProfile()) setEditOpen(false) }}>保存资料</button>
              <button className="secondary-btn" onClick={() => setEditOpen(false)}>取消</button>
              <button className="danger-btn" onClick={() => { logout(); navigate('/login', {replace:true}) }}>退出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
