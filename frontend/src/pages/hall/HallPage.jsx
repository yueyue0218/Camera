import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { demandApi } from '../../api/demandApi.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { useAuth } from '../../AuthContext.jsx'
import { DemandCard } from './components/DemandCard.jsx'
import { FilterBar } from './components/FilterBar.jsx'
import { DemandAside } from './components/HallAside.jsx'
import { EmptyState, ErrorState, LoadingState } from './components/HallState.jsx'
import { HallTabs } from './components/HallTabs.jsx'
import { ServicePackageCard } from './components/ServicePackageCard.jsx'
import { TIME_STYLE_OPTIONS, priceParamsFromBudget } from './components/hallUtils.js'
import { promptAndRespondDemand } from './utils/respondDemand.js'
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

  const interestedIds = useMemo(() => new Set(interests.map(item => item.serviceId)), [interests])

  useEffect(() => {
    loadDemands()
    loadServices()
    loadInterests()
  }, [currentUser.userId, currentUser.role])

  useEffect(() => {
    const role = currentUser.role === 'CUSTOMER' ? 'owner' : 'photographer'
    document.body.setAttribute('data-role', role)
    return () => document.body.removeAttribute('data-role')
  }, [currentUser.role])

  useEffect(() => {
    setActivePanel(panelFromSearch(location.search))
  }, [location.search])

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
      setDemands((page?.records || []).filter(record => matchesKeyword(record, nextFilters.keyword)))
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
      setServices((page?.records || []).filter(record => matchesKeyword(record, nextFilters.keyword)))
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
    setSelectedDemand(demand)
    try {
      const detail = await demandApi.detail(demand.demandId, currentUser)
      setSelectedDemand(detail || demand)
    } catch {
      setSelectedDemand(demand)
    }
  }

  async function openService(service) {
    setSelectedService(service)
    try {
      const detail = await servicePackageApi.detail(service.serviceId, currentUser)
      setSelectedService(detail || service)
    } catch {
      setSelectedService(service)
    }
  }

  async function respondDemand(demand) {
    return promptAndRespondDemand({
      demand,
      currentUser,
      demandApi,
      normalizeError,
      onSuccess: async () => {
        await loadDemands(filters)
        if (selectedDemand?.demandId === demand.demandId) {
          const detail = await demandApi.detail(demand.demandId, currentUser)
          setSelectedDemand(detail || demand)
        }
      }
    })
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
