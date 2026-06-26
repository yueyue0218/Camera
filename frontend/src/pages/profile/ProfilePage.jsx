import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import {
  creditApi, demandApi, fileApi, momentApi, orderApi, reviewApi, userApi, conversationApi
} from '../../api.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { ReviewStarsDisplay } from '../../components/reviews/ReviewStarsDisplay.jsx'
import { buildOrderNavigationTarget } from '../../utils/orderNavigation.js'
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

function calcAge(birthday) {
  if (!birthday) return null
  const [year, month, day] = birthday.split('-').map(Number)
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--
  return age > 0 ? age : null
}

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
    gender: currentUser.gender || '',
    genderVisible: currentUser.genderVisible ?? true,
    birthday: currentUser.birthday || '',
    birthdayVisible: currentUser.birthdayVisible ?? true,
    locationDisplay: currentUser.locationDisplay || '',
    locationVisible: currentUser.locationVisible ?? false,
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [activeTab, setActiveTab] = useState('photos')
  const [activeMonth, setActiveMonth] = useState(0)
  const [editOpen, setEditOpen] = useState(false)

  const [moments, setMoments] = useState([])
  const [myDemands, setMyDemands] = useState([])
  const [myInterests, setMyInterests] = useState([])
  const [myShowcases, setMyShowcases] = useState([])
  const [profileOrders, setProfileOrders] = useState([])
  const [receivedReviews, setReceivedReviews] = useState([])
  const [creditSummary, setCreditSummary] = useState(null)
  const [portfolioItems, setPortfolioItems] = useState([])
  const [notice, setNotice] = useState(null)
  const [myFollowers, setMyFollowers] = useState([])
  const [myFollowing, setMyFollowing] = useState([])
  const [followListOpen, setFollowListOpen] = useState(null) // null | 'following' | 'followers'

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
    const roleBio = isProvider
      ? (currentUser.providerBio || currentUser.bio || currentUser.description || '')
      : (currentUser.customerBio || currentUser.bio || currentUser.description || '')
    setProfileForm({
      nickname: currentUser.nickname || currentUser.label || '',
      avatarData: currentUser.avatarData || '',
      bio: roleBio,
      gender: currentUser.gender || '',
      genderVisible: currentUser.genderVisible ?? true,
      birthday: currentUser.birthday || '',
      birthdayVisible: currentUser.birthdayVisible ?? true,
      locationDisplay: currentUser.locationDisplay || '',
      locationVisible: currentUser.locationVisible ?? false,
    })
  }, [currentUser.userId, currentUser.role, currentUser.nickname, currentUser.avatarData,
      currentUser.bio, currentUser.providerBio, currentUser.customerBio,
      currentUser.gender, currentUser.birthday, currentUser.genderVisible,
      currentUser.birthdayVisible, currentUser.locationDisplay, currentUser.locationVisible,
      isProvider])

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
    const IP_CACHE_KEY = `camera-ip-${currentUser.userId}`
    const cached = (() => { try { return JSON.parse(localStorage.getItem(IP_CACHE_KEY)) } catch { return null } })()
    if (cached?.location && Date.now() - (cached.ts || 0) < 24 * 3600 * 1000) {
      if (cached.location !== currentUser.cityCode) updateProfile({ cityCode: cached.location })
      return
    }
    async function detectIpLocation() {
      try {
        const amapKey = import.meta.env.VITE_AMAP_KEY
        let location = ''
        if (amapKey) {
          const res = await fetch(`https://restapi.amap.com/v3/ip?key=${amapKey}&output=json`)
          const data = await res.json()
          if (data.status === '1') {
            const province = typeof data.province === 'string'
              ? data.province.replace(/(省|市|自治区|特别行政区)$/, '').trim() : ''
            if (province) location = province
          }
        }
        if (!location) {
          const res = await fetch('http://ip-api.com/json/?lang=zh-CN&fields=status,regionName')
          const data = await res.json()
          if (data.status === 'success' && data.regionName) {
            location = data.regionName.replace(/(省|市|自治区|特别行政区)$/, '').trim()
          }
        }
        if (!location) return
        try { localStorage.setItem(IP_CACHE_KEY, JSON.stringify({ location, ts: Date.now() })) } catch { /**/ }
        if (location === currentUser.cityCode) return
        updateProfile({ cityCode: location })
        await userApi.updateMe({ cityCode: location }, currentUser)
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
      const apiGenericBio = myProfileRes.value.bio || ''
      // Prefer role-specific bio from API; fall back to locally stored role bio; last resort: generic bio
      const resolvedProviderBio = myProfileRes.value.providerBio ?? currentUser.providerBio ?? (role === 'PROVIDER' ? apiGenericBio : '')
      const resolvedCustomerBio = myProfileRes.value.customerBio ?? currentUser.customerBio ?? (role === 'CUSTOMER' ? apiGenericBio : '')
      const bio = role === 'PROVIDER' ? resolvedProviderBio : resolvedCustomerBio
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
        customerBio: resolvedCustomerBio,
        providerNickname: myProfileRes.value.providerNickname ?? (role === 'PROVIDER' ? nickname : currentUser.providerNickname),
        providerBio: resolvedProviderBio,
        gender: myProfileRes.value.gender ?? currentUser.gender ?? '',
        genderVisible: myProfileRes.value.genderVisible ?? currentUser.genderVisible ?? true,
        birthday: myProfileRes.value.birthday ?? currentUser.birthday ?? '',
        birthdayVisible: myProfileRes.value.birthdayVisible ?? currentUser.birthdayVisible ?? true,
        locationDisplay: myProfileRes.value.locationDisplay ?? currentUser.locationDisplay ?? '',
        locationVisible: myProfileRes.value.locationVisible ?? currentUser.locationVisible ?? false,
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
    const rawFollowers = followersRes.status === 'fulfilled' ? followersRes.value : []
    try {
      const enrichedFollowers = await Promise.all(rawFollowers.map(async f => {
        const uid = f.userId ?? f.authorId
        if (f.avatarData || f.avatarUrl) return f
        try {
          const brief = await userApi.brief(uid, currentUser)
          let avatarData = brief?.avatarData || brief?.avatarUrl || ''
          if (!avatarData && brief?.avatarFileId) {
            try { avatarData = await fileApi.downloadObjectUrl(brief.avatarFileId, currentUser) } catch { /**/ }
          }
          return { ...f, nickname: f.nickname || brief?.nickname, bio: f.bio || brief?.bio || brief?.description || '', avatarData, role: f.role || brief?.currentRole || brief?.role }
        } catch { return f }
      }))
      setMyFollowers(enrichedFollowers)
    } catch { setMyFollowers(rawFollowers) }
    try {
      const [followingCustomer, followingProvider] = await Promise.all([
        userApi.following(currentUser.userId, currentUser, 'CUSTOMER').catch(() => []),
        userApi.following(currentUser.userId, currentUser, 'PROVIDER').catch(() => [])
      ])
      const combined = [
        ...(followingCustomer || []).map(f => ({ ...f, role: f.role || 'CUSTOMER' })),
        ...(followingProvider || []).map(f => ({ ...f, role: f.role || 'PROVIDER' })),
      ]
      // Enrich with avatar data
      const enriched = await Promise.all(combined.map(async f => {
        const uid = f.userId ?? f.authorId
        if (f.avatarData || f.avatarUrl) return f
        try {
          const brief = await userApi.brief(uid, currentUser)
          let avatarData = brief?.avatarData || brief?.avatarUrl || ''
          if (!avatarData && brief?.avatarFileId) {
            try { avatarData = await fileApi.downloadObjectUrl(brief.avatarFileId, currentUser) } catch { /**/ }
          }
          return { ...f, nickname: f.nickname || brief?.nickname, avatarData }
        } catch { return f }
      }))
      setMyFollowing(enriched)
    } catch { setMyFollowing([]) }
    if (!isProvider) {
      try {
        const interestsPage = await servicePackageApi.myInterests({ page: 1, size: 50 }, currentUser).catch(() => null)
        setMyInterests(interestsPage?.records || interestsPage?.content || (Array.isArray(interestsPage) ? interestsPage : []))
      } catch { setMyInterests([]) }
      try {
        const demandsRes = await demandApi.myDemands(currentUser).catch(() => null)
        setMyDemands(Array.isArray(demandsRes) ? demandsRes : (demandsRes?.records || demandsRes?.content || []))
      } catch { setMyDemands([]) }
    } else {
      try {
        const showcasesRes = await servicePackageApi.myHistory(currentUser).catch(() => null)
        const all = Array.isArray(showcasesRes) ? showcasesRes : (showcasesRes?.records || showcasesRes?.content || [])
        setMyShowcases(all.filter(s => s.status === 'ONLINE'))
      } catch { setMyShowcases([]) }
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
      role: currentUser.role,
      gender: profileForm.gender,
      genderVisible: profileForm.genderVisible,
      birthday: profileForm.birthday,
      birthdayVisible: profileForm.birthdayVisible,
      locationDisplay: profileForm.locationDisplay.trim(),
      locationVisible: profileForm.locationVisible,
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
      await userApi.updateMe({
        nickname: next.nickname,
        bio: next.bio,
        ...(isProvider ? { providerBio: next.bio } : { customerBio: next.bio }),
        role: currentUser.role,
        avatarFileId,
        gender: next.gender,
        genderVisible: next.genderVisible,
        birthday: next.birthday,
        birthdayVisible: next.birthdayVisible,
        locationDisplay: next.locationDisplay,
        locationVisible: next.locationVisible,
      }, currentUser)
    } catch (err) {
      setNotice({ type: 'err', text: err.message || '个人资料保存失败' })
      return false
    }
    const roleSpecificBio = isProvider ? { providerBio: next.bio } : { customerBio: next.bio }
    saveUserProfile(currentUser.userId, { ...next, ...roleSpecificBio })
    setAvatarFile(null)
    updateProfile({ ...next, ...roleSpecificBio, avatarFileId })
    setNotice({ type: 'ok', text: '个人资料已更新' })
    return true
  }

  async function handleSwitchRole(newRole) {
    try {
      await userApi.switchRole(newRole, currentUser)
      switchRole(newRole)
      setNotice({ type: 'ok', text: `已切换到${newRole === 'PROVIDER' ? '摄影师' : '约拍方'}账号` })
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

  const myMoments = useMemo(
    () => moments.filter(m => Number(m.authorId) === currentUser.userId && m.authorRole === currentUser.role),
    [moments, currentUser.userId, currentUser.role]
  )
  const favoriteMoments = useMemo(() => moments.filter(m => m.favoritedByCurrentUser), [moments])
  const likedMoments = useMemo(() => moments.filter(m => m.likedByCurrentUser), [moments])
  const totalLikesAndFavorites = useMemo(
    () => myMoments.reduce((sum, m) => sum + (m.likeCount || 0) + (m.favoriteCount || 0), 0),
    [myMoments]
  )
  const follows = myFollowing.map(f => ({ ...f, authorId: f.userId ?? f.authorId })).filter(f => Number(f.authorId) !== currentUser.userId)
  const savedPhotos = readSavedPhotos()
  const TERMINAL_STATUSES = ['COMPLETED','REVIEWED','CANCELLED','REFUNDED','APPEALING']
  const historicalOrders = profileOrders.filter(o => ['COMPLETED','REVIEWED'].includes(o.status)).length
  const ongoingOrders = profileOrders.filter(o => !TERMINAL_STATUSES.includes(o.status)).length
  const openDemandsCount = myDemands.filter(d => d.status === 'OPEN' || !d.status).length
  const creditScore = creditSummary?.creditScore ?? null
  const billableOrders = profileOrders.filter(o => o.status !== 'REFUNDED').length
  const completionRate = billableOrders > 0 ? Math.round((historicalOrders / billableOrders) * 100) : null
  const genderText = currentUser.gender === 'MALE' ? '男' : currentUser.gender === 'FEMALE' ? '女' : '保密'
  const displayName = profileForm.nickname || currentUser.label || currentUser.username || 'Portra 用户'
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

  function openReviewCard(review) {
    if (review?.orderId) {
      const target = buildOrderNavigationTarget(review.orderId, { section: 'reviews' })
      if (target) {
        navigate(target.to, { state: target.state })
        return
      }
      return
    }
    navigate('/reviews')
  }

  const tabs = [
    { id: 'photos', labelC: '我的照片', labelP: '我的作品', num: '01' },
    ...(!isProvider ? [{ id: 'demands', label: '我的需求', num: '02' }] : []),
    { id: 'intent', labelC: '我的意向', labelP: '橱窗管理', num: isProvider ? '02' : '03' },
    { id: 'orders', label: '我的订单', num: isProvider ? '03' : '04' },
    { id: 'likes', label: '我的点赞', num: isProvider ? '04' : '05' },
    { id: 'collections', label: '我的收藏', num: isProvider ? '05' : '06' },
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
        <span><strong>个人档案</strong> / 我的主页 / 个人摄影档案</span>
        <span>编号 {String(currentUser.userId).padStart(2,'0')} · Portra</span>
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
          <div className="ticket-kicker">我的主页</div>
          <div className="hero-name-row">
            <h1 className="hero-name">{displayName}</h1>
            <span className="role-badge">{isProvider ? '摄影师' : '约拍方'}</span>
          </div>
          <p className="profile-uid">用户编号：{currentUser.userId}</p>
          <div className="profile-meta-line">
            <span>IP属地：{currentUser.cityCode || '未知'}</span>
          </div>
          {(() => {
            const chips = []
            if (currentUser.genderVisible && currentUser.gender) {
              const sym = currentUser.gender === 'FEMALE' ? '♀' : '♂'
              const age = currentUser.birthdayVisible && currentUser.birthday ? ` ${calcAge(currentUser.birthday)}岁` : ''
              chips.push(sym + age)
            } else if (currentUser.birthdayVisible && currentUser.birthday) {
              chips.push(`${calcAge(currentUser.birthday)}岁`)
            }
            if (currentUser.locationVisible && currentUser.locationDisplay) chips.push(`📍 ${currentUser.locationDisplay}`)
            return chips.length ? (
              <div className="profile-tag-row">
                {chips.map((c, i) => <span key={i} className="profile-tag">{c}</span>)}
              </div>
            ) : null
          })()}
          <p className="profile-signature">{profileForm.bio || '这个人还没有写简介。'}</p>
          <div className="social-stats-row">
            <button className="social-stat-btn" type="button" onClick={() => setFollowListOpen('following')}>
              <b>{follows.length}</b><span>关注</span>
            </button>
            <button className="social-stat-btn" type="button" onClick={() => setFollowListOpen('followers')}>
              <b>{myFollowers.length}</b><span>粉丝</span>
            </button>
            <div className="social-stat">
              <b>{totalLikesAndFavorites}</b><span>获赞与收藏</span>
            </div>
          </div>
        </div>

        <aside className="hero-side">
          <div>
            <div className="id-number">No.{currentUser.userId}</div>
            <div className="id-label">信用概览</div>
          </div>
          <div className="metric-grid">
            <button className="metric metric-button" type="button" onClick={() => navigate('/profile/credit')}><b>{formatCreditScore(creditScore)}</b><span>信用评分</span></button>
            <div className="metric"><b>{completionRate !== null ? `${completionRate}%` : '暂无'}</b><span>完成率</span></div>
            <div className="metric"><b>{historicalOrders}</b><span>历史约拍</span></div>
            <div className="metric"><b>{ongoingOrders}</b><span>进行中</span></div>
          </div>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => setEditOpen(true)}>编辑资料</button>
            {isProvider
              ? <button className="secondary-btn" onClick={() => navigate('/publish/service-package')}>发布新橱窗</button>
              : <button className="secondary-btn" onClick={() => navigate('/publish')}>发布新需求</button>
            }
            <button className="secondary-btn" onClick={() => navigate('/feed?compose=true')}>{isProvider ? '发布新作品' : '发布新动态'}</button>
            {isProvider ? (
              <button className="secondary-btn" onClick={() => handleSwitchRole('CUSTOMER')}>
                🎯 切换到我的约拍方账号
              </button>
            ) : (
              <>
                <button className="secondary-btn" onClick={() => handleSwitchRole('PROVIDER')}>
                  📷 切换到我的摄影师账号
                </button>
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
            <p className="frame-title">内容导航</p>
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
                            <span className="cap">作品 {String(i+1).padStart(2,'0')}</span>
                          </div>
                        ))
                        : Array.from({length:6}).map((_, i) => {
                          const m = items[i]
                          return (
                            <div key={i} className="film-frame">
                              {m?.imageData && <div style={{position:'absolute',inset:0,zIndex:1,backgroundImage:`url(${m.imageData})`,backgroundSize:'cover',backgroundPosition:'center'}} />}
                              <span className="cap">作品 {String(i+1).padStart(2,'0')}</span>
                            </div>
                          )
                        })
                      }
                    </div>
                  )
                })()}
              </div>
            </section>

            {/* DEMANDS — customer only */}
            {!isProvider && (
              <section className={`panel-card tab-panel${activeTab === 'demands' ? ' active' : ''}`}>
                <div className="section-head">
                  <div>
                    <h2>我的需求</h2>
                    <p>我发布过的约拍需求，点击详情可查看谁响应了你。</p>
                  </div>
                  <div className="section-mark">02</div>
                </div>
                {myDemands.length ? (
                  <div className="ticket-grid">
                    {myDemands.slice(0, 6).map(d => {
                      const budget = d.budgetMinCent && d.budgetMaxCent
                        ? `¥${Math.round(d.budgetMinCent/100)}–¥${Math.round(d.budgetMaxCent/100)}`
                        : d.budgetMinCent ? `¥${Math.round(d.budgetMinCent/100)} 起` : '预算面议'
                      return (
                        <article key={d.demandId} className="mini-ticket" onClick={() => navigate(`/demands/${d.demandId}`)}>
                          <span className="price">{budget}</span>
                          <h3>{d.title || d.scene || '未命名需求'}</h3>
                          <p>{d.description || d.serviceTypes || '点击查看需求详情'}</p>
                          <div className="ticket-meta">
                            <span className="tag blue">查看详情</span>
                            {d.responseCount > 0 && <span className="tag">{d.responseCount} 人响应</span>}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="pp-empty">
                    <h3>还没有发布需求</h3>
                    <p>发布约拍需求，等待摄影师响应。</p>
                    <button className="primary-btn" style={{marginTop:14}} onClick={() => navigate('/publish')}>发布新需求</button>
                  </div>
                )}
              </section>
            )}

            {/* INTENT */}
            <section className={`panel-card tab-panel${activeTab === 'intent' ? ' active' : ''}`}>
              <div className="section-head">
                <div>
                  <h2>{isProvider ? '橱窗管理' : '我的意向'}</h2>
                  <p>{isProvider ? '管理正在展示的约拍服务，保持时间、价格和风格清晰。' : '意向只是收藏感兴趣的橱窗，不自动下单、不锁定时间。'}</p>
                </div>
                <div className="section-mark">{isProvider ? '02' : '03'}</div>
              </div>
              {isProvider ? (
                <div className="ticket-grid">
                  <article className="mini-ticket" onClick={() => navigate('/publish/service-package')}>
                    <span className="price">+</span>
                    <h3>发布新橱窗</h3>
                    <p>创建约拍服务包，设定价格、风格和档期。</p>
                    <div className="ticket-meta"><span className="tag blue">立即创建</span></div>
                  </article>
                  {myShowcases.length ? myShowcases.slice(0, 3).map(s => (
                    <article key={s.serviceId} className="mini-ticket" onClick={() => navigate(`/service-packages/${s.serviceId}`)}>
                      <span className="price">{s.priceRange || '价格面议'}</span>
                      <h3>{s.title || '橱窗'}</h3>
                      <p>{s.scene || s.timeDescription || '查看橱窗详情'}</p>
                      <div className="ticket-meta"><span className="tag blue">上线中</span></div>
                    </article>
                  )) : (
                    <article className="mini-ticket" style={{ cursor: 'default', opacity: 0.6 }}>
                      <span className="price">—</span>
                      <h3>暂无上线橱窗</h3>
                      <p>发布后将在这里显示有效期内的服务包。</p>
                      <div className="ticket-meta"><span className="tag">待发布</span></div>
                    </article>
                  )}
                </div>
              ) : (
                <>
                  {myInterests.length ? (
                    <div className="ticket-grid">
                      {myInterests.slice(0, 4).map(item => (
                        <article key={item.serviceId} className="mini-ticket" onClick={() => navigate(`/service-packages/${item.serviceId}`)}>
                          <span className="price">{item.priceRange || '价格面议'}</span>
                          <h3>{item.title || '意向橱窗'}</h3>
                          <p>{item.description || item.serviceArea || '查看橱窗详情'}</p>
                          <div className="ticket-meta"><span className="tag blue">查看橱窗</span></div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="pp-empty"><h3>还没有意向橱窗</h3><p>在大厅浏览橱窗，点击「加入意向」收藏感兴趣的摄影师。</p></div>
                  )}
                </>
              )}
            </section>

            {/* ORDERS */}
            <section className={`panel-card tab-panel${activeTab === 'orders' ? ' active' : ''}`}>
              <div className="section-head">
                <div><h2>我的订单</h2><p>订单像票根一样被保存，每一步状态都能回到会话。</p></div>
                <div className="section-mark">{isProvider ? '03' : '04'}</div>
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

            {/* LIKES */}
            <section className={`panel-card tab-panel${activeTab === 'likes' ? ' active' : ''}`}>
              <div className="section-head">
                <div><h2>我的点赞</h2><p>点过赞的动态都在这里，随时回顾曾经喜欢的瞬间。</p></div>
                <div className="section-mark">04</div>
              </div>
              {likedMoments.length ? (
                <div className="ticket-grid">
                  {likedMoments.slice(0, 4).map(m => (
                    <article key={m.momentId} className="mini-ticket" onClick={() => navigate(`/moments/${m.momentId}`)}>
                      <span className="price">POST</span>
                      <h3>{m.title || '点赞的动态'}</h3>
                      <p>{m.content || '分享了一张照片'}</p>
                      <div className="ticket-meta"><span className="tag blue">查看动态</span></div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="pp-empty"><h3>还没有点赞</h3><p>给喜欢的动态点个赞，就会出现在这里。</p></div>
              )}
            </section>

            {/* COLLECTIONS */}
            <section className={`panel-card tab-panel${activeTab === 'collections' ? ' active' : ''}`}>
              <div className="section-head">
                <div><h2>我的收藏</h2><p>收藏喜欢的橱窗、动态和风格，下一次约拍不用重新开始。</p></div>
                <div className="section-mark">05</div>
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
                <div className="todo" style={{cursor:'pointer'}} onClick={() => handleTabClick(isProvider ? 'intent' : 'demands')}>
                  <div>
                    <strong>{isProvider ? '橱窗管理' : '我的需求'}</strong>
                    <br /><small>{isProvider ? '管理约拍服务包' : '等待摄影师响应'}</small>
                  </div>
                  <span className="status yellow">{isProvider ? 0 : openDemandsCount}</span>
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
            <section className="panel-card">
              <div className="section-head" style={{ marginBottom: 14 }}>
                <div>
                  <h2 style={{ fontSize: 18 }}>历史评价预览</h2>
                  <p>最近收到的评价会先显示在这里。</p>
                </div>
                <button className="archive-all" type="button" onClick={() => navigate('/reviews')}>
                  查看全部 →
                </button>
              </div>
              {receivedReviews.length ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {receivedReviews.slice(0, 2).map(review => (
                    <button
                      key={review.reviewId || `${review.orderId}-${review.createdAt}`}
                      type="button"
                      onClick={() => openReviewCard(review)}
                      style={{
                        textAlign: 'left',
                        border: '1px solid rgba(13,47,178,.12)',
                        borderRadius: 18,
                        padding: '14px 15px',
                        background: '#fffdf8',
                        boxShadow: '0 10px 22px rgba(25,30,45,.05)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 900, color: '#1d2530' }}>{review.direction === 'CUSTOMER_TO_PROVIDER' ? '客户评价摄影师' : '摄影师评价客户'}</div>
                          <div style={{ fontSize: 12, color: '#6e737b', marginTop: 4 }}>订单 #{review.orderId || '-'}</div>
                        </div>
                        <ReviewStarsDisplay value={review.rating} emphasize />
                      </div>
                      <div style={{ fontSize: 13, color: '#6e737b', marginBottom: 8 }}>
                        {review.reviewerNickname || 'Portra 用户'} → {review.targetUserNickname || 'Portra 用户'}
                      </div>
                      <div style={{ color: '#30343a', lineHeight: 1.75 }}>
                        {review.content || '对方没有留下文字评价'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pp-empty"><h3>暂无评价</h3><p>完成合作后，这里会显示最近收到的评价。</p></div>
              )}
            </section>
          </aside>
        </div>

        {/* ── ARCHIVE ── */}
        <section className="posted-section archive-drawer-section">
          <div className="archive-head">
            <div>
              <p className="archive-eyebrow">动态归档</p>
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

      {/* ── FOLLOW LIST DRAWER ── */}
      {followListOpen && (
        <div className="pp-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setFollowListOpen(null) }}>
          <div className="pp-modal" style={{maxWidth:500,maxHeight:'75vh',overflow:'hidden',display:'flex',flexDirection:'column',padding:'24px 24px 20px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
              <h2 style={{margin:0,fontSize:18,letterSpacing:'.12em'}}>{followListOpen === 'following' ? '我的关注' : '我的粉丝'}</h2>
              <button type="button" onClick={() => setFollowListOpen(null)} style={{border:0,background:'transparent',fontSize:22,cursor:'pointer',color:'var(--muted)',lineHeight:1}}>×</button>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {(() => {
                const list = followListOpen === 'following' ? follows : myFollowers
                if (!list.length) return (
                  <div className="pp-empty">
                    <h3>{followListOpen === 'following' ? '还没有关注任何人' : '还没有粉丝'}</h3>
                    <p>{followListOpen === 'following' ? '在动态或大厅页面关注感兴趣的用户。' : '发布作品或需求，吸引更多人关注你。'}</p>
                  </div>
                )
                return (
                  <div className="order-list">
                    {list.map(f => {
                      const uid = f.userId ?? f.authorId
                      const avatar = f.avatarData || f.avatarUrl || ''
                      const roleLabel = f.role === 'PROVIDER' ? '摄影师' : '约拍方'
                      const roleUrl = f.role ? `?role=${f.role}` : ''
                      return (
                        <div key={uid} className="order-slip" style={{cursor:'pointer'}}
                          onClick={() => { setFollowListOpen(null); navigate(`/users/${uid}${roleUrl}`) }}>
                          <div className="follow-avatar"
                            style={avatar
                              ? { backgroundImage: `url(${avatar})` }
                              : { background: `hsl(${(Number(uid) * 67) % 360},45%,68%)` }} />
                          <div>
                            <h4 style={{display:'flex',alignItems:'center',gap:8}}>
                              {f.nickname || 'Portra 用户'}
                              <span className="role-badge" style={{fontSize:11,height:22,padding:'0 8px'}}>{roleLabel}</span>
                            </h4>
                            <p>{f.bio || f.description || (followListOpen === 'following' ? '已关注' : '关注了你')}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

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
                <label className="pp-label">性别</label>
                <div className="pp-option-group">
                  {[['MALE','男'],['FEMALE','女'],['','不填']].map(([val, label]) => (
                    <button key={val} type="button"
                      className={`pp-option${profileForm.gender === val ? ' active' : ''}`}
                      onClick={() => setProfileForm(p => ({...p, gender: val}))}>
                      {label}{profileForm.gender === val && val && ' ✓'}
                    </button>
                  ))}
                </div>
                <div className="pp-toggle-row">
                  <span>展示性别标签</span>
                  <label className="pp-toggle">
                    <input type="checkbox" checked={!!profileForm.genderVisible}
                      onChange={e => setProfileForm(p => ({...p, genderVisible: e.target.checked}))} />
                    <span className="pp-toggle-slider" />
                  </label>
                </div>
              </div>
              <div>
                <label className="pp-label">生日</label>
                <input type="date" className="pp-input" value={profileForm.birthday}
                  max={new Date().toISOString().slice(0,10)}
                  onChange={e => setProfileForm(p => ({...p, birthday: e.target.value}))} />
                <div className="pp-toggle-row" style={{marginTop:8}}>
                  <span>展示生日标签（年龄）</span>
                  <label className="pp-toggle">
                    <input type="checkbox" checked={!!profileForm.birthdayVisible}
                      onChange={e => setProfileForm(p => ({...p, birthdayVisible: e.target.checked}))} />
                    <span className="pp-toggle-slider" />
                  </label>
                </div>
              </div>
              <div>
                <label className="pp-label">地区</label>
                <input className="pp-input" placeholder="填写所在地区，如：苏州" value={profileForm.locationDisplay}
                  onChange={e => setProfileForm(p => ({...p, locationDisplay: e.target.value}))} />
                <div className="pp-toggle-row" style={{marginTop:8}}>
                  <span>展示地区标签</span>
                  <label className="pp-toggle">
                    <input type="checkbox" checked={!!profileForm.locationVisible}
                      onChange={e => setProfileForm(p => ({...p, locationVisible: e.target.checked}))} />
                    <span className="pp-toggle-slider" />
                  </label>
                </div>
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
