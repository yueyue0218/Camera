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
import '../portraHall.css'

const initialFilters = {
  keyword: '',
  cityCode: '',
  type: '',
  budget: '',
  timeTag: ''
}

function yuanToCent(value) {
  if (value === '' || value === null || value === undefined) return null
  return Math.round(Number(value) * 100)
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
    setActivePanel(panelFromSearch(location.search))
  }, [location.search])

  function updateFilters(partial) {
    setFilters(current => ({ ...current, ...partial }))
  }

  function demandParams(nextFilters = filters) {
    const price = priceParamsFromBudget(nextFilters.budget)
    return {
      page: 1,
      size: 20,
      status: 'OPEN',
      keyword: nextFilters.keyword,
      scene: nextFilters.keyword,
      cityCode: nextFilters.cityCode,
      styleTag: nextFilters.type,
      timeTag: nextFilters.timeTag,
      minBudgetCent: price.minCent,
      maxBudgetCent: price.maxCent
    }
  }

  function serviceParams(nextFilters = filters) {
    const price = priceParamsFromBudget(nextFilters.budget)
    return {
      page: 1,
      size: 20,
      cityCode: nextFilters.cityCode,
      keyword: nextFilters.keyword,
      scene: nextFilters.keyword,
      style: nextFilters.type,
      timeTag: nextFilters.timeTag,
      minPriceCent: price.minCent,
      maxPriceCent: price.maxCent,
      sort: 'latest'
    }
  }

  async function loadDemands(nextFilters = filters) {
    setDemandStatus({ loading: true, error: '' })
    try {
      const page = await demandApi.list(demandParams(nextFilters), currentUser)
      setDemands(page?.records || [])
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
      setServices(page?.records || [])
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

  function applyFilters() {
    if (activePanel === 'demands') {
      loadDemands(filters)
    } else {
      loadServices(filters)
      loadInterests(filters)
    }
  }

  function changePanel(nextPanel) {
    setActivePanel(nextPanel)
    navigate(`/hall?tab=${nextPanel === 'demands' ? 'demand' : 'showcase'}`, { replace: true })
  }

  function applyTimeFilter(timeTag) {
    const nextFilters = { ...filters, timeTag }
    setFilters(nextFilters)
    loadServices(nextFilters)
    loadInterests(nextFilters)
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
    const expectedPrice = window.prompt('请输入响应报价（元）', '')
    if (expectedPrice === null) return
    const message = window.prompt('给单主留一句话', '')
    if (message === null) return
    try {
      await demandApi.respond(demand.demandId, {
        expectedPriceCent: yuanToCent(expectedPrice),
        message
      }, currentUser)
      await loadDemands(filters)
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  async function reserveService(service) {
    const selectedDate = window.prompt('预约日期（YYYY-MM-DD，可留空先沟通）', '')
    if (selectedDate === null) return
    const initialMessage = window.prompt('预约留言', '')
    if (initialMessage === null) return
    try {
      const result = await servicePackageApi.reserve(service.serviceId, {
        selectedDate: selectedDate || null,
        initialMessage
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
        interested={interestedIds.has(service.serviceId)}
        onOpen={() => openService(service)}
        onDetail={() => navigate(`/service-packages/${service.serviceId}`)}
        onReserve={() => reserveService(service)}
      />
    ))
  }

  return (
    <main className="portra-page" data-role={currentUser.role === 'CUSTOMER' ? 'owner' : 'photographer'}>
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        onSubmit={applyFilters}
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
            <DemandAside selectedDemand={selectedDemand} error={demandStatus.error} />
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
