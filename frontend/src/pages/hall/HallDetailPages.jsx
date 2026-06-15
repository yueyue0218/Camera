import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { demandApi } from '../../api/demandApi.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { userApi } from '../../api/userApi.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, ErrorState, LoadingState } from './components/HallState.jsx'
import { cityName, firstText, gradientFor, latestTimeText, money, moneyRange, readableDate, splitTags, timeTagLabel } from './components/hallUtils.js'
import { publicImageUrls, useFileObjectUrl, useFileObjectUrls } from './utils/fileObjectUrls.js'
import { submitDemandResponse } from './utils/respondDemand.js'
import '../portraHall.css'

function createStatus() {
  return { loading: true, error: '' }
}

function normalizeError(error) {
  return error?.message || '请求失败，启动后端服务后会显示真实数据。'
}

const demandStatusLabel = {
  OPEN: '开放中',
  MATCHED: '已匹配',
  CLOSED: '已下架',
  PENDING_CUSTOMER_ACCEPT: '待接约拍方确认',
  ACCEPTED: '已接受',
  REJECTED: '已拒绝'
}

const serviceStatusLabel = {
  ONLINE: '在线',
  OFFLINE: '已下架',
  HIDDEN: '已隐藏'
}

function useBodyRole(role) {
  useEffect(() => {
    const bodyRole = role === 'CUSTOMER' ? 'owner' : 'photographer'
    document.body.setAttribute('data-role', bodyRole)
    return () => document.body.removeAttribute('data-role')
  }, [role])
}

function DetailShell({ backTo = '/hall', backLabel, children }) {
  const navigate = useNavigate()
  return (
    <main className="portra-page">
      <div className="crumb">
        <button className="back" type="button" onClick={() => navigate(backTo)}>{backLabel}</button>
      </div>
      {children}
    </main>
  )
}

function tagList(...groups) {
  return groups.flatMap(group => splitTags(group)).filter(Boolean)
}

function normalizeId(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function collectUserIds(currentUser) {
  return [
    currentUser?.userId,
    currentUser?.id,
    currentUser?.customerId,
    currentUser?.providerId,
    currentUser?.photographerId
  ].map(normalizeId).filter(Boolean)
}

function collectDemandOwnerIds(demand) {
  return [
    demand?.customerId,
    demand?.publisherId,
    demand?.ownerId,
    demand?.userId,
    demand?.customer?.id,
    demand?.publisher?.id,
    demand?.owner?.id,
    demand?.user?.id
  ].map(normalizeId).filter(Boolean)
}

function collectServiceOwnerIds(service) {
  return [
    service?.providerId,
    service?.photographerId,
    service?.creatorId,
    service?.ownerId,
    service?.userId,
    service?.provider?.id,
    service?.photographer?.id,
    service?.creator?.id,
    service?.owner?.id,
    service?.user?.id
  ].map(normalizeId).filter(Boolean)
}

function isSameOwner(currentUser, ownerIds) {
  const userIds = collectUserIds(currentUser)
  return userIds.some(userId => ownerIds.includes(userId))
}

async function enrichDemandPublisher(demand, currentUser) {
  if (!demand?.customerId) return demand
  try {
    const brief = await userApi.brief(demand.customerId, currentUser, 'CUSTOMER')
    const avatarFileId = demand.customerAvatarFileId ?? brief?.avatarFileId
    return {
      ...demand,
      customerNickname: brief?.nickname || demand.customerNickname,
      customerName: brief?.nickname || demand.customerName,
      customerAvatarFileId: avatarFileId,
      customerAvatarUrl: demand.customerAvatarUrl,
      customerAvatar: demand.customerAvatar
    }
  } catch (error) {
    console.warn('demand detail publisher brief load failed', { demandId: demand.demandId, customerId: demand.customerId, error })
    return demand
  }
}

async function enrichServiceProvider(service, currentUser) {
  const providerId = service?.photographerId || service?.providerId
  if (!providerId) return service
  try {
    const brief = await userApi.brief(providerId, currentUser, 'PROVIDER')
    const avatarFileId = service.photographerAvatarFileId ?? brief?.avatarFileId
    return {
      ...service,
      photographerId: brief?.userId || service.photographerId || service.providerId,
      photographerNickname: brief?.nickname || service.photographerNickname,
      photographerAvatarFileId: avatarFileId,
      photographerAvatarUrl: service.photographerAvatarUrl,
      photographerAvatar: service.photographerAvatar
    }
  } catch (error) {
    console.warn('service detail provider brief load failed', { serviceId: service.serviceId, providerId, error })
    return service
  }
}

function referenceSlots(referenceFileIds) {
  const count = Math.max(3, Math.min(4, Number(referenceFileIds?.length) || 0))
  const slots = Array.from({ length: count }, (_, index) => `参考图 ${String(index + 1).padStart(2, '0')}`)
  while (slots.length < 4) slots.push('暂未上传')
  return slots.slice(0, 4)
}

function UploadedGallery({ urls, emptyLabels }) {
  if (!urls.length) {
    return (
      <div className="ref-grid">
        {emptyLabels.map((label, index) => <div className="ref-img" key={`${label}-${index}`}>{label}</div>)}
      </div>
    )
  }
  return (
    <div className={`uploaded-gallery ${urls.length > 5 ? 'is-scrollable' : ''}`}>
      {urls.map((url, index) => (
        <figure className="uploaded-photo" key={`${url}-${index}`}>
          <img src={url} alt={`上传照片 ${index + 1}`} />
          <figcaption>{String(index + 1).padStart(2, '0')}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export function DemandDetailPage() {
  const { demandId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [demand, setDemand] = useState(null)
  const [status, setStatus] = useState(createStatus)
  const [notice, setNotice] = useState(null)
  const [responded, setResponded] = useState(false)
  const [responding, setResponding] = useState(false)
  const referenceUrls = useFileObjectUrls(
    demand?.referenceFileIds,
    currentUser,
    `demand ${demandId} reference`
  )
  const uploadedPublisherAvatar = useFileObjectUrl(
    [demand?.customerAvatarFileId, demand?.avatarFileId],
    currentUser,
    `demand ${demandId} publisher avatar`
  )
  const fallbackPublisherAvatar = publicImageUrls(demand?.customerAvatarUrl, demand?.customerAvatar)[0] || ''
  const publisherAvatar = uploadedPublisherAvatar || fallbackPublisherAvatar
  useBodyRole(currentUser.role)

  useEffect(() => {
    let ignored = false
    async function loadDemand() {
      setStatus({ loading: true, error: '' })
      try {
        const detail = await demandApi.detail(demandId, currentUser)
        const enrichedDetail = await enrichDemandPublisher(detail, currentUser)
        if (!ignored) {
          setDemand(enrichedDetail)
          setStatus({ loading: false, error: '' })
        }
      } catch (error) {
        if (!ignored) {
          setDemand(null)
          setStatus({ loading: false, error: normalizeError(error) })
        }
      }
    }
    loadDemand()
    return () => { ignored = true }
  }, [currentUser, demandId])

  useEffect(() => {
    if (currentUser.role !== 'PROVIDER') {
      setResponded(false)
      return
    }
    let ignored = false
    demandApi.myResponses(currentUser)
      .then(responses => {
        if (!ignored) setResponded((responses || []).some(item => Number(item.demandId) === Number(demandId)))
      })
      .catch(() => {
        if (!ignored) setResponded(false)
      })
    return () => { ignored = true }
  }, [currentUser, demandId])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (status.loading) return <DetailShell backLabel="← 返回订单大厅"><LoadingState text="正在加载真实需求详情" /></DetailShell>
  if (status.error) return <DetailShell backLabel="← 返回订单大厅"><ErrorState message={status.error} /></DetailShell>
  if (!demand) return <DetailShell backLabel="← 返回订单大厅"><EmptyState text="暂无需求详情" /></DetailShell>

  const styles = tagList(demand.styleTags, demand.serviceTypes)
  const timeTags = splitTags(demand.timeTags)
  const title = firstText(demand.title, demand.scene) || '暂无标题'
  const place = [cityName(demand.cityName || demand.cityCode), demand.location].filter(Boolean).join(' · ') || '暂无地点'
  const timeText = demand.timeDescription || demand.timeSlot || readableDate(demand.expectedDate) || '暂无'
  const isDemandOwner = isSameOwner(currentUser, collectDemandOwnerIds(demand))
  const canRespond = currentUser.role === 'PROVIDER' && demand.status === 'OPEN'
  const publisherName = firstText(demand.customerNickname, demand.customerName) || '约拍方'

  async function respondDemand() {
    if (responded || responding) return
    setResponding(true)
    await submitDemandResponse({
      demand,
      currentUser,
      demandApi,
      normalizeError,
      onSuccess: async () => {
        setResponded(true)
        setNotice({ type: 'success', text: '响应已提交，等待约拍方确认后会开启会话。' })
        const detail = await demandApi.detail(demandId, currentUser)
        setDemand(await enrichDemandPublisher(detail || demand, currentUser))
      },
      onError: message => {
        setNotice({ type: 'error', text: message })
      }
    })
    setResponding(false)
  }

  async function closeDemand() {
    if (!window.confirm('确认下架这个需求吗？下架后不会继续作为开放需求展示。')) return
    try {
      const result = await demandApi.close(demand.demandId, currentUser)
      const detail = await demandApi.detail(demand.demandId, currentUser).catch(() => result)
      setDemand(await enrichDemandPublisher(detail || result || demand, currentUser))
      window.alert('需求已下架')
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  return (
    <DetailShell backLabel="← 返回订单大厅">
      {notice && (
        <div className={`hall-notice ${notice.type === 'error' ? 'error' : 'success'}`} role="status">
          {notice.text}
        </div>
      )}
      <div className="detail-grid">
        <article className="panel-card">
          <div className="detail-heading">
            <h1 className="detail-title">{title}</h1>
            {isDemandOwner && (
              <div className="detail-top-actions" aria-label="需求管理">
                <button className="detail-mini-action" type="button" onClick={() => navigate(`/demands/${demand.demandId}/edit`)}>编辑</button>
                <button className="detail-mini-action danger" type="button" onClick={closeDemand}>下架</button>
              </div>
            )}
          </div>
          <div className="tag-row">
            <span className="tag">{timeTags[0] ? timeTagLabel(timeTags[0]) : '周末'}</span>
            {(styles.length ? styles : ['校园', '清透']).slice(0, 3).map(tag => <span className="tag gray" key={tag}>{tag}</span>)}
            <span className="tag blue">已实名</span>
            <span className={`tag ${demand.status !== 'OPEN' ? 'blue' : 'gray'}`}>{demandStatusLabel[demand.status] || demand.status || '开放中'}</span>
          </div>
          <div className="detail-publish-time">{latestTimeText(demand, true)}</div>
          <div className="info-grid">
            <div className="info-cell"><span>预算</span><b>{moneyRange(demand.budgetMinCent, demand.budgetMaxCent)}</b></div>
            <div className="info-cell"><span>拍摄时间</span><b>{timeText}</b></div>
            <div className="info-cell"><span>地点</span><b>{place}</b></div>
            <div className="info-cell"><span>需求类型</span><b>{styles[0] || demand.scene || '摄影师'}</b></div>
            <div className="info-cell"><span>出片需求</span><b>{demand.refinedCount ? `${demand.refinedCount} 张精修` : '沟通确认'}</b></div>
          </div>
          <div className="text-block">
            <h3>需求描述</h3>
            <p>{demand.description || '暂无需求描述。'}</p>
          </div>
          <div className="text-block">
            <h3>拍摄偏好</h3>
            <div className="tag-row">
              {(styles.length ? styles : ['不夸张修图', '可引导动作', '自然光']).slice(0, 4).map(tag => <span className="tag gray" key={tag}>{tag}</span>)}
            </div>
          </div>
          <div className="text-block">
            <h3>参考风格</h3>
            <UploadedGallery urls={referenceUrls} emptyLabels={referenceSlots(demand.referenceFileIds)} />
          </div>
        </article>
        <aside className="aside">
          <div className="aside-card">
            <h3>发布者信息</h3>
            <button
              className="profile-mini detail-provider-link profile-link-button"
              type="button"
              onClick={() => demand.customerId && navigate(`/users/${demand.customerId}?role=CUSTOMER`)}
              disabled={!demand.customerId}
            >
              <div className="mini-avatar" style={publisherAvatar ? { '--avatar-art': `url(${publisherAvatar})` } : undefined} aria-hidden="true" />
              <div>
                <strong>{publisherName}</strong><br />
                <span className="micro">响应 {demand.responseCount ?? 0} 次 · {latestTimeText(demand)}</span>
              </div>
            </button>
          </div>
          {canRespond && (
          <div className="photographer-only aside-card">
            <h3>操作</h3>
            <div className="side-actions">
              <button className="primary-btn photographer-only" type="button" disabled={responded || responding} onClick={respondDemand}>
                {responding ? '提交中' : responded ? '已响应' : '我要响应'}
              </button>
            </div>
          </div>
          )}
          <div className="photographer-only aside-card">
            <h3>安全提示</h3>
            <p className="note-strip">响应前建议确认地点、精修张数、交付时间和是否需要妆造。</p>
          </div>
        </aside>
      </div>
    </DetailShell>
  )
}

function galleryItems(service, uploadedUrls = []) {
  const images = publicImageUrls(service.images)
  const items = uploadedUrls.length
    ? uploadedUrls.map(image => `url(${image})`)
    : (images.length ? images.slice(0, 5).map(image => `url(${image})`) : [])
  while (items.length < 5) items.push(gradientFor((service.serviceId || 0) + items.length))
  return items
}

export function ServicePackageDetailPage() {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [service, setService] = useState(null)
  const [interested, setInterested] = useState(false)
  const [followingProvider, setFollowingProvider] = useState(false)
  const [status, setStatus] = useState(createStatus)
  const uploadedPortfolioUrls = useFileObjectUrls(
    [service?.portfolioIds, service?.images],
    currentUser,
    `service package ${serviceId} portfolio`
  )
  const uploadedProviderAvatar = useFileObjectUrl(
    [service?.photographerAvatarFileId, service?.avatarFileId],
    currentUser,
    `service package ${serviceId} avatar`
  )
  const fallbackProviderAvatar = publicImageUrls(service?.photographerAvatarUrl, service?.photographerAvatar)[0] || ''
  const providerAvatar = uploadedProviderAvatar || fallbackProviderAvatar
  useBodyRole(currentUser.role)

  useEffect(() => {
    let ignored = false
    async function loadService() {
      setStatus({ loading: true, error: '' })
      try {
        const [detail, interestPage, providerFollowing] = await Promise.all([
          servicePackageApi.detail(serviceId, currentUser),
          currentUser.role === 'CUSTOMER'
            ? servicePackageApi.myInterests({ page: 1, size: 100 }, currentUser).catch(() => null)
            : Promise.resolve(null),
          userApi.following(currentUser.userId, currentUser, 'PROVIDER').catch(() => [])
        ])
        if (!ignored) {
          const enriched = await enrichServiceProvider(detail, currentUser)
          setService(enriched)
          setInterested(Boolean(interestPage?.records?.some(item => Number(item.serviceId) === Number(serviceId))))
          const pid = enriched.photographerId || enriched.providerId
          setFollowingProvider(Array.isArray(providerFollowing) && providerFollowing.some(f => Number(f.userId ?? f.authorId) === Number(pid)))
          setStatus({ loading: false, error: '' })
        }
      } catch (error) {
        if (!ignored) {
          setService(null)
          setStatus({ loading: false, error: normalizeError(error) })
        }
      }
    }
    loadService()
    return () => { ignored = true }
  }, [currentUser, serviceId])

  if (status.loading) return <DetailShell backLabel="← 返回橱窗大厅"><LoadingState text="正在加载真实橱窗详情" /></DetailShell>
  if (status.error) return <DetailShell backLabel="← 返回橱窗大厅"><ErrorState message={status.error} /></DetailShell>
  if (!service) return <DetailShell backLabel="← 返回橱窗大厅"><EmptyState text="暂无橱窗详情" /></DetailShell>

  const styleTags = splitTags(service.styleTags)
  const timeTags = splitTags(service.timeTags)
  const credit = service.photographerCreditScore ?? service.providerCreditScore ?? service.creditScore
  const hasCreditScore = credit !== null && credit !== undefined && !(typeof credit === 'string' && credit.trim() === '')
  const city = cityName(service.cityName || service.cityCode) || service.serviceArea || '暂无城市'
  const price = service.priceRange || `${money(service.basePriceCent)} 起`
  const isServiceOwner = isSameOwner(currentUser, collectServiceOwnerIds(service))
  const isCustomerViewer = currentUser.role === 'CUSTOMER'
  const providerProfileId = service.photographerId || service.providerId

  async function startChat(message = `我想预约「${service.title || '这个橱窗'}」，想进一步确认时间与服务内容。`) {
    try {
      const result = await servicePackageApi.startChat(service.serviceId, { initialMessage: message }, currentUser)
      if (result?.conversationId) {
        navigate(`/messages/${result.conversationId}`)
      } else {
        window.alert('会话已创建')
      }
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  async function toggleInterest() {
    try {
      if (interested) {
        await servicePackageApi.cancelInterest(service.serviceId, currentUser)
        setInterested(false)
        window.alert('已取消意向')
      } else {
        await servicePackageApi.addInterest(service.serviceId, currentUser)
        setInterested(true)
        window.alert('已加入意向')
      }
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  async function toggleFollowProvider() {
    if (!providerProfileId) return
    try {
      if (followingProvider) {
        await userApi.unfollow(providerProfileId, currentUser, 'PROVIDER')
        setFollowingProvider(false)
      } else {
        await userApi.follow(providerProfileId, currentUser, 'PROVIDER')
        setFollowingProvider(true)
      }
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  async function offlineService() {
    if (!window.confirm('确认下架这个橱窗吗？下架后不会继续作为在线橱窗展示。')) return
    try {
      const result = await servicePackageApi.offline(service.serviceId, currentUser)
      const detail = await servicePackageApi.detail(service.serviceId, currentUser).catch(() => result)
      setService(detail || result || service)
      window.alert('橱窗已下架')
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  return (
    <DetailShell backLabel="← 返回橱窗大厅">
      <div className="detail-grid">
        <article className="panel-card">
          <div className="detail-heading">
            <h1 className="detail-title">{service.title || '暂无标题'}</h1>
            {isServiceOwner && (
              <div className="detail-top-actions" aria-label="橱窗管理">
                <button className="detail-mini-action" type="button" onClick={() => navigate(`/service-packages/${service.serviceId}/edit`)}>编辑</button>
                <button className="detail-mini-action danger" type="button" onClick={offlineService}>下架</button>
              </div>
            )}
          </div>
          <div className="tag-row">
            <span className="tag blue">摄影师</span>
            <span className="tag gray">{city}</span>
            {(styleTags.length ? styleTags : ['清透日常', '校园毕业']).slice(0, 3).map(tag => <span className="tag gray" key={tag}>{tag}</span>)}
            <span className="tag">{timeTags[0] ? timeTagLabel(timeTags[0]) : '时间可协商'}</span>
            <span className={`tag ${service.status !== 'ONLINE' ? 'blue' : 'gray'}`}>{serviceStatusLabel[service.status] || service.status || '在线'}</span>
          </div>
          <div className="detail-publish-time">{latestTimeText(service, true)}</div>
          <div className={`gallery ${uploadedPortfolioUrls.length > 5 ? 'is-scrollable' : ''}`}>
            {galleryItems(service, uploadedPortfolioUrls).map((art, index) => (
              <div className="photo" data-no={String(index + 1).padStart(2, '0')} style={{ '--art': art }} key={`${art}-${index}`} />
            ))}
          </div>
          <div className="text-block">
            <h3>价格区间</h3>
            <div className="price-range-panel">
              <strong>{price}</strong>
            </div>
          </div>
          <div className="text-block">
            <h3>服务说明</h3>
            <p>{service.description || '暂无服务说明。'}</p>
          </div>
          <div className="text-block">
            <h3>拍摄流程</h3>
            <div className="process">
              {['沟通需求', '确认时间', '会话沟通', '完成拍摄', '交付成片', '评价'].map((step, index) => (
                <div className="step" key={step}><b>{String(index + 1).padStart(2, '0')}</b><span>{step}</span></div>
              ))}
            </div>
          </div>
        </article>
        <aside className="aside">
          <div className="aside-card">
            <h3>{price}</h3>
            <p className="note-strip">时间：{service.timeDescription || '具体拍摄时间通过会话确认，不再锁定系统档期。'}</p>
          </div>
          <div className="aside-card photographer-mini-card">
            <h3>摄影师信息</h3>
            <button
              className="profile-mini detail-provider-link profile-link-button"
              type="button"
              onClick={() => providerProfileId && navigate(`/users/${providerProfileId}?role=PROVIDER`)}
              disabled={!providerProfileId}
            >
              <div
                className="mini-avatar"
                style={{ '--avatar-art': providerAvatar ? `url(${providerAvatar})` : gradientFor(providerProfileId) }}
                aria-hidden="true"
              />
              <div className="photographer-card-info">
                <strong className="photographer-card-name">{service.photographerNickname || '暂无昵称'}</strong>
                <div className="photographer-card-location"><span>{city}</span></div>
                <div className="photographer-card-credit">{hasCreditScore ? `信用评分：${credit}` : '暂无信用评分'}</div>
              </div>
            </button>
            <button className="secondary-btn" style={{ width: '100%' }} type="button" onClick={toggleFollowProvider}>{followingProvider ? '已关注' : '关注摄影师'}</button>
          </div>
          {isCustomerViewer && (
            <div className="aside-card">
              <h3>操作</h3>
              <div className="detail-op-actions side-actions">
                <button className="secondary-btn owner-only" type="button" onClick={toggleInterest}>{interested ? '取消意向' : '加入意向'}</button>
                <button className="primary-btn owner-only" type="button" onClick={() => startChat()}>现在预定</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </DetailShell>
  )
}
