import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { demandApi } from '../../api/demandApi.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { userApi } from '../../api/userApi.js'
import { useAuth } from '../../AuthContext.jsx'
import { DemandCard } from './components/DemandCard.jsx'
import { FilterBar } from './components/FilterBar.jsx'
import { DemandAside } from './components/HallAside.jsx'
import { EmptyState, ErrorState, LoadingState } from './components/HallState.jsx'
import { HallTabs } from './components/HallTabs.jsx'
import { ServicePackageCard } from './components/ServicePackageCard.jsx'
import { TIME_STYLE_OPTIONS, priceParamsFromBudget } from './components/hallUtils.js'
import { submitDemandResponse } from './utils/respondDemand.js'
import '../portraHall.css'

const initialFilters = {
  keyword: '',
  cityCode: '',
  type: '',
  minBudgetYuan: '',
  maxBudgetYuan: '',
  timeTag: ''
}

function createStatus() {
  return { loading: false, error: '' }
}

function normalizeError(error) {
  return error?.message || '请求失败，启动后端服务后会显示真实数据。'
}

function panelFromSearch(search) {
  const params = new URLSearchParams(search)
  const view = params.get('tab') || params.get('view')
  return view === 'demand' || view === 'demands' ? 'demands' : 'showcases'
}

async function enrichDemandPublisher(demand, currentUser) {
  if (!demand?.customerId) return demand
  try {
    const brief = await userApi.brief(demand.customerId, currentUser)
    const avatarFileId = brief?.avatarFileId ?? demand.customerAvatarFileId
    return {
      ...demand,
      customerNickname: brief?.nickname || demand.customerNickname,
      customerName: brief?.nickname || demand.customerName,
      customerAvatarFileId: avatarFileId,
      customerAvatarUrl: demand.customerAvatarUrl,
      customerAvatar: demand.customerAvatar
    }
  } catch {
    return demand
  }
}

async function enrichDemandPublishers(records, currentUser) {
  const publisherCache = new Map()
  return Promise.all((records || []).map(async demand => {
    const customerId = demand?.customerId
    if (!customerId) return demand
    if (!publisherCache.has(customerId)) {
      publisherCache.set(customerId, enrichDemandPublisher(demand, currentUser))
    }
    const enriched = await publisherCache.get(customerId)
    return {
      ...demand,
      customerNickname: enriched.customerNickname,
      customerName: enriched.customerName,
      customerAvatarFileId: enriched.customerAvatarFileId,
      customerAvatarUrl: enriched.customerAvatarUrl,
      customerAvatar: enriched.customerAvatar
    }
  }))
}

async function enrichServiceProvider(service, currentUser) {
  const providerId = service?.photographerId || service?.providerId
  if (!providerId) return service
  try {
    const brief = await userApi.brief(providerId, currentUser)
    const avatarFileId = brief?.avatarFileId ?? service.photographerAvatarFileId
    return {
      ...service,
      photographerId: brief?.userId || service.photographerId || service.providerId,
      photographerNickname: brief?.nickname || service.photographerNickname,
      photographerAvatarFileId: avatarFileId,
      photographerAvatarUrl: service.photographerAvatarUrl,
      photographerAvatar: service.photographerAvatar
    }
  } catch {
    return service
  }
}

async function enrichServiceProviders(records, currentUser) {
  const providerCache = new Map()
  return Promise.all((records || []).map(async service => {
    const providerId = service?.photographerId || service?.providerId
    if (!providerId) return service
    if (!providerCache.has(providerId)) {
      providerCache.set(providerId, enrichServiceProvider(service, currentUser))
    }
    const enriched = await providerCache.get(providerId)
    return {
      ...service,
      photographerId: enriched.photographerId,
      photographerNickname: enriched.photographerNickname,
      photographerAvatarFileId: enriched.photographerAvatarFileId,
      photographerAvatarUrl: enriched.photographerAvatarUrl,
      photographerAvatar: enriched.photographerAvatar
    }
  }))
}

export function HallPage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [activePanel, setActivePanel] = useState(() => panelFromSearch(location.search))
  const [filters, setFilters] = useState(initialFilters)
  const [demands, setDemands] = useState([])
  const [services, setServices] = useState([])
  const [interests, setInterests] = useState([])
  const [selectedDemand, setSelectedDemand] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [demandStatus, setDemandStatus] = useState(createStatus)
  const [serviceStatus, setServiceStatus] = useState(createStatus)
  const [notice, setNotice] = useState(null)
  const [respondedDemandIds, setRespondedDemandIds] = useState(() => new Set())
  const [respondingDemandIds, setRespondingDemandIds] = useState(() => new Set())

  const interestedIds = useMemo(() => new Set(interests.map(item => item.serviceId)), [interests])

  useEffect(() => {
    loadDemands()
    loadServices()
    loadInterests()
    loadMyResponses()
  }, [currentUser.userId, currentUser.role])

  useEffect(() => {
    const role = currentUser.role === 'CUSTOMER' ? 'owner' : 'photographer'
    document.body.setAttribute('data-role', role)
    return () => document.body.removeAttribute('data-role')
  }, [currentUser.role])

  useEffect(() => {
    setActivePanel(panelFromSearch(location.search))
  }, [location.search])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  function updateFilters(partial) {
    setFilters(current => ({ ...current, ...partial }))
  }

  function demandParams(nextFilters = filters) {
    const price = priceParamsFromBudget({
      minYuan: nextFilters.minBudgetYuan,
      maxYuan: nextFilters.maxBudgetYuan
    })
    return {
      page: 1,
      size: 20,
      status: 'OPEN',
      styleTag: nextFilters.type,
      cityCode: nextFilters.cityCode,
      timeTag: nextFilters.timeTag,
      minBudgetCent: price.minCent,
      maxBudgetCent: price.maxCent
    }
  }

  function serviceParams(nextFilters = filters) {
    const price = priceParamsFromBudget({
      minYuan: nextFilters.minBudgetYuan,
      maxYuan: nextFilters.maxBudgetYuan
    })
    return {
      page: 1,
      size: 20,
      cityCode: nextFilters.cityCode,
      style: nextFilters.type,
      timeTag: nextFilters.timeTag,
      minPriceCent: price.minCent,
      maxPriceCent: price.maxCent,
      sort: 'latest'
    }
  }

  function matchesKeyword(record, keyword) {
    const normalized = keyword?.trim().toLowerCase()
    if (!normalized) return true
    const haystack = [
      record.title,
      record.scene,
      record.description,
      record.remark,
      record.location,
      record.serviceArea,
      record.customerNickname,
      record.customerName,
      record.photographerNickname,
      ...(Array.isArray(record.styleTags) ? record.styleTags : []),
      ...(Array.isArray(record.timeTags) ? record.timeTags : [])
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(normalized)
  }

  async function loadDemands(nextFilters = filters) {
    setDemandStatus({ loading: true, error: '' })
    try {
      const page = await demandApi.list(demandParams(nextFilters), currentUser)
      const enrichedRecords = await enrichDemandPublishers(page?.records || [], currentUser)
      setDemands(enrichedRecords.filter(record => matchesKeyword(record, nextFilters.keyword)))
      setDemandStatus({ loading: false, error: '' })
    } catch (error) {
      setDemands([])
      setDemandStatus({ loading: false, error: normalizeError(error) })
    }
  }

  async function loadServices(nextFilters = filters) {
    setServiceStatus({ loading: true, error: '' })
    try {
      const page = await servicePackageApi.list(serviceParams(nextFilters), currentUser)
      const enrichedRecords = await enrichServiceProviders(page?.records || [], currentUser)
      setServices(enrichedRecords.filter(record => matchesKeyword(record, nextFilters.keyword)))
      setServiceStatus({ loading: false, error: '' })
    } catch (error) {
      setServices([])
      setServiceStatus({ loading: false, error: normalizeError(error) })
    }
  }

  async function loadInterests(nextFilters = filters) {
    if (currentUser.role !== 'CUSTOMER') {
      setInterests([])
      return
    }
    try {
      const page = await servicePackageApi.myInterests({ page: 1, size: 50, timeTag: nextFilters.timeTag }, currentUser)
      setInterests(page?.records || [])
    } catch {
      setInterests([])
    }
  }

  async function loadMyResponses() {
    if (currentUser.role !== 'PROVIDER') {
      setRespondedDemandIds(new Set())
      return
    }
    try {
      const responses = await demandApi.myResponses(currentUser)
      setRespondedDemandIds(new Set((responses || []).map(item => Number(item.demandId)).filter(Number.isFinite)))
    } catch {
      setRespondedDemandIds(new Set())
    }
  }

  function hasResponded(demandId) {
    return respondedDemandIds.has(Number(demandId))
  }

  function isResponding(demandId) {
    return respondingDemandIds.has(Number(demandId))
  }

  function updateResponding(demandId, active) {
    const id = Number(demandId)
    setRespondingDemandIds(current => {
      const next = new Set(current)
      if (active) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function applyFilters(nextFilters = filters) {
    if (activePanel === 'demands') {
      loadDemands(nextFilters)
      return
    }
    loadServices(nextFilters)
    loadInterests(nextFilters)
  }

  function handlePublishClick() {
    if (currentUser.role === 'PROVIDER') {
      navigate('/publish/service-package')
      return
    }
    navigate('/publish')
  }

  function changePanel(nextPanel) {
    setActivePanel(nextPanel)
    setFilters(initialFilters)
    navigate(`/hall?tab=${nextPanel === 'demands' ? 'demand' : 'showcase'}`, { replace: true })
    if (nextPanel === 'demands') {
      loadDemands(initialFilters)
    } else {
      loadServices(initialFilters)
      loadInterests(initialFilters)
    }
  }

  function applyTimeFilter(timeTag) {
    const nextFilters = { ...filters, timeTag }
    setFilters(nextFilters)
    applyFilters(nextFilters)
  }

  function applyHotStyle(type) {
    const nextFilters = { ...filters, type }
    setFilters(nextFilters)
    applyFilters(nextFilters)
  }

  async function openDemand(demand) {
    setSelectedDemand(await enrichDemandPublisher(demand, currentUser))
    try {
      const detail = await demandApi.detail(demand.demandId, currentUser)
      setSelectedDemand(await enrichDemandPublisher(detail || demand, currentUser))
    } catch {
      setSelectedDemand(await enrichDemandPublisher(demand, currentUser))
    }
  }

  async function openService(service) {
    setSelectedService(service)
    try {
      const detail = await servicePackageApi.detail(service.serviceId, currentUser)
      setSelectedService(await enrichServiceProvider(detail || service, currentUser))
    } catch {
      setSelectedService(await enrichServiceProvider(service, currentUser))
    }
  }

  async function respondDemand(demand) {
    if (hasResponded(demand.demandId) || isResponding(demand.demandId)) return null
    updateResponding(demand.demandId, true)
    return submitDemandResponse({
      demand,
      currentUser,
      demandApi,
      normalizeError,
      onSuccess: async () => {
        setRespondedDemandIds(current => new Set(current).add(Number(demand.demandId)))
        setNotice({ type: 'success', text: '响应已提交，等待单主确认后会开启会话。' })
        await loadDemands(filters)
        if (selectedDemand?.demandId === demand.demandId) {
          const detail = await demandApi.detail(demand.demandId, currentUser)
          setSelectedDemand(await enrichDemandPublisher(detail || demand, currentUser))
        }
      },
      onError: message => {
        setNotice({ type: 'error', text: message })
      }
    }).finally(() => updateResponding(demand.demandId, false))
  }

  function editDemand(demand) {
    navigate(`/demands/${demand.demandId}/edit`)
  }

  async function closeDemand(demand) {
    if (!window.confirm('确认下架这个需求吗？下架后不会继续作为开放需求展示。')) return
    try {
      await demandApi.close(demand.demandId, currentUser)
      await loadDemands(filters)
      setSelectedDemand(null)
      window.alert('需求已下架')
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  function editService(service) {
    navigate(`/service-packages/${service.serviceId}/edit`)
  }

  async function offlineService(service) {
    if (!window.confirm('确认下架这个橱窗吗？下架后不会继续作为在线橱窗展示。')) return
    try {
      await servicePackageApi.offline(service.serviceId, currentUser)
      await loadServices(filters)
      await loadInterests(filters)
      setSelectedService(null)
      window.alert('橱窗已下架')
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  async function startServiceChat(service) {
    try {
      const result = await servicePackageApi.startChat(service.serviceId, {
        initialMessage: `我想预约「${service.title || '这个橱窗'}」，想进一步确认时间与服务内容。`
      }, currentUser)
      if (result?.conversationId) navigate(`/messages/${result.conversationId}`)
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  function renderDemands() {
    if (demandStatus.loading) return <LoadingState text="正在加载真实需求" />
    if (demandStatus.error) return <ErrorState message={demandStatus.error} />
    if (!demands.length) return <EmptyState text="暂无符合条件的需求" />
    return demands.map(demand => (
      <DemandCard
        key={demand.demandId}
        demand={demand}
        currentUser={currentUser}
        onOpen={() => openDemand(demand)}
        onDetail={() => navigate(`/demands/${demand.demandId}`)}
        onRespond={() => respondDemand(demand)}
        responded={hasResponded(demand.demandId)}
        responding={isResponding(demand.demandId)}
        onOpenPublisher={demand.customerId ? () => navigate(`/users/${demand.customerId}?role=CUSTOMER`) : undefined}
      />
    ))
  }

  function renderServices() {
    if (serviceStatus.loading) return <LoadingState text="正在加载真实橱窗" />
    if (serviceStatus.error) return <ErrorState message={serviceStatus.error} />
    if (!services.length) return <EmptyState text="暂无符合条件的橱窗" />
    return services.map(service => (
      <ServicePackageCard
        key={service.serviceId}
        service={service}
        currentUser={currentUser}
        onOpenProvider={(service.photographerId || service.providerId) ? () => navigate(`/users/${service.photographerId || service.providerId}?role=PROVIDER`) : undefined}
        interested={interestedIds.has(service.serviceId)}
        onOpen={() => openService(service)}
        onDetail={() => navigate(`/service-packages/${service.serviceId}`)}
        onReserve={() => startServiceChat(service)}
        onEdit={() => editService(service)}
        onOffline={() => offlineService(service)}
      />
    ))
  }

  return (
    <main className="portra-page" data-role={currentUser.role === 'CUSTOMER' ? 'owner' : 'photographer'}>
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        onApplyFilters={applyFilters}
        onPublishClick={handlePublishClick}
        currentUserRole={currentUser.role}
      />

      {notice && (
        <div className={`hall-notice ${notice.type === 'error' ? 'error' : 'success'}`} role="status">
          {notice.text}
        </div>
      )}

      <HallTabs
        activePanel={activePanel}
        demandCount={demands.length}
        serviceCount={services.length}
        onChange={changePanel}
      />

      {activePanel === 'demands' ? (
        <section className="panel active">
          <div className="section-title">
            <h2>订单大厅</h2>
            <span className="micro">按匹配度排序 · 已过滤过期需求</span>
          </div>
          <div className="order-layout">
            <div className="order-grid">{renderDemands()}</div>
            <DemandAside
              selectedDemand={selectedDemand}
              error={demandStatus.error}
              currentUser={currentUser}
              onRespond={respondDemand}
              onHotStyleClick={applyHotStyle}
              onEditDemand={editDemand}
        onCloseDemand={closeDemand}
        onOpenPublisher={selectedDemand?.customerId ? () => navigate(`/users/${selectedDemand.customerId}?role=CUSTOMER`) : undefined}
        responded={selectedDemand ? hasResponded(selectedDemand.demandId) : false}
        responding={selectedDemand ? isResponding(selectedDemand.demandId) : false}
      />
          </div>
        </section>
      ) : (
        <section className="panel active">
          <div className="section-title">
            <h2>橱窗大厅</h2>
            <span className="micro">按时间标签与最新更新排序</span>
          </div>
          <div className="style-bar">
            {TIME_STYLE_OPTIONS.map(option => (
              <button
                className={`style-pill ${filters.timeTag === option.value ? 'active' : ''}`}
                key={option.label}
                type="button"
                onClick={() => applyTimeFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="showcase-grid">{renderServices()}</div>
        </section>
      )}
    </main>
  )
}
