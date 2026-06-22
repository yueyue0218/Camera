import { useEffect, useMemo, useRef, useState } from 'react'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
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

const PAGE_SIZE = 20

const initialFilters = {
  keyword: '',
  cityCode: '',
  type: '',
  minBudgetYuan: '',
  maxBudgetYuan: '',
  timeTag: ''
}

function createInitialPageState() {
  return {
    page: 1,
    size: PAGE_SIZE,
    total: 0,
    hasNext: false,
    loading: false,
    loadingMore: false,
    refreshing: false,
    error: '',
    errorMode: ''
  }
}

function normalizeError(error) {
  return error?.message || '请求失败，请稍后重试。'
}

function hasOwn(record, field) {
  return Object.prototype.hasOwnProperty.call(record || {}, field)
}

function panelFromSearch(search) {
  const params = new URLSearchParams(search)
  const view = params.get('tab') || params.get('view')
  return view === 'demand' || view === 'demands' ? 'demands' : 'showcases'
}

function totalFromPage(page) {
  const total = Number(page?.total)
  return Number.isFinite(total) && total >= 0 ? total : 0
}

function pageInfoFromResult(page, fallbackPage, fallbackSize) {
  const nextPage = Number(page?.page) || fallbackPage
  const nextSize = Number(page?.size) || fallbackSize
  const total = totalFromPage(page)
  const hasNext = typeof page?.hasNext === 'boolean'
    ? page.hasNext
    : nextPage * nextSize < total
  return {
    page: nextPage,
    size: nextSize,
    total,
    hasNext
  }
}

async function enrichDemandPublisher(demand, currentUser) {
  if (!demand?.customerId) return demand
  const hasNickname = Boolean(String(demand.customerNickname || '').trim())
  const hasAvatarField = hasOwn(demand, 'customerAvatarFileId')
  if (hasNickname && hasAvatarField) return demand
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
    console.warn('demand publisher brief load failed', { demandId: demand.demandId, customerId: demand.customerId, error })
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
  const hasNickname = Boolean(String(service.photographerNickname || '').trim())
  const hasAvatarField = hasOwn(service, 'photographerAvatarFileId')
  if (hasNickname && hasAvatarField) return service
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
    console.warn('service provider brief load failed', { serviceId: service.serviceId, providerId, error })
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
  const [demandPagination, setDemandPagination] = useState(createInitialPageState)
  const [servicePagination, setServicePagination] = useState(createInitialPageState)
  const [notice, setNotice] = useState(null)
  const [respondedDemandIds, setRespondedDemandIds] = useState(() => new Set())
  const [respondingDemandIds, setRespondingDemandIds] = useState(() => new Set())
  const demandRequestSeq = useRef(0)
  const serviceRequestSeq = useRef(0)
  const demandAppendInFlight = useRef(false)
  const serviceAppendInFlight = useRef(false)
  const initialLoadSearchRef = useRef(null)

  const interestedIds = useMemo(() => new Set(interests.map(item => item.serviceId)), [interests])

  useEffect(() => {
    initialLoadSearchRef.current = location.search
    loadDemands({ page: 1, mode: 'replace' })
    loadServices({ page: 1, mode: 'replace' })
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
    const params = new URLSearchParams(location.search)
    const published = params.get('published')
    const id = params.get('id')
    const initialLoadAlreadyCoveredSearch = initialLoadSearchRef.current === location.search
    if (published === 'demand') {
      if (!initialLoadAlreadyCoveredSearch) loadDemands({ page: 1, mode: 'replace' })
      setNotice({
        type: 'success',
        text: '需求已发布',
        actionText: id ? '查看详情' : '',
        onAction: id ? () => navigate(`/demands/${id}`) : undefined
      })
    }
    if (published === 'showcase') {
      if (!initialLoadAlreadyCoveredSearch) {
        loadServices({ page: 1, mode: 'replace' })
        loadInterests()
      }
      setNotice({
        type: 'success',
        text: '橱窗已发布',
        actionText: id ? '查看详情' : '',
        onAction: id ? () => navigate(`/service-packages/${id}`) : undefined
      })
    }
  }, [location.search, navigate])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  function updateFilters(partial) {
    setFilters(current => ({ ...current, ...partial }))
  }

  function updateDemandLoading(mode, active, error = '') {
    setDemandPagination(current => ({
      ...current,
      loading: mode === 'replace' ? active : current.loading,
      loadingMore: mode === 'append' ? active : (active ? false : current.loadingMore),
      refreshing: mode === 'refresh' ? active : current.refreshing,
      error,
      errorMode: error ? mode : ''
    }))
  }

  function updateServiceLoading(mode, active, error = '') {
    setServicePagination(current => ({
      ...current,
      loading: mode === 'replace' ? active : current.loading,
      loadingMore: mode === 'append' ? active : (active ? false : current.loadingMore),
      refreshing: mode === 'refresh' ? active : current.refreshing,
      error,
      errorMode: error ? mode : ''
    }))
  }

  function demandParams(nextFilters = filters, page = 1, size = PAGE_SIZE, cacheBust = '') {
    const price = priceParamsFromBudget({
      minYuan: nextFilters.minBudgetYuan,
      maxYuan: nextFilters.maxBudgetYuan
    })
    return {
      page,
      size,
      status: 'OPEN',
      styleTag: nextFilters.type,
      cityCode: nextFilters.cityCode,
      timeTag: nextFilters.timeTag,
      minBudgetCent: price.minCent,
      maxBudgetCent: price.maxCent,
      _t: cacheBust
    }
  }

  function serviceParams(nextFilters = filters, page = 1, size = PAGE_SIZE, cacheBust = '') {
    const price = priceParamsFromBudget({
      minYuan: nextFilters.minBudgetYuan,
      maxYuan: nextFilters.maxBudgetYuan
    })
    return {
      page,
      size,
      cityCode: nextFilters.cityCode,
      style: nextFilters.type,
      timeTag: nextFilters.timeTag,
      minPriceCent: price.minCent,
      maxPriceCent: price.maxCent,
      sort: 'latest',
      _t: cacheBust
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

  async function loadDemands({ nextFilters = filters, page = 1, mode = 'replace', cacheBust = '' } = {}) {
    const size = demandPagination.size || PAGE_SIZE
    const requestId = ++demandRequestSeq.current
    if (mode !== 'append') demandAppendInFlight.current = false
    updateDemandLoading(mode, true)
    try {
      const result = await demandApi.list(demandParams(nextFilters, page, size, cacheBust), currentUser)
      const rawRecords = result?.records || []
      const enrichedRecords = await enrichDemandPublishers(rawRecords, currentUser)
      // Stage 1 keeps keyword filtering on the loaded page only; Stage 2 moves keyword search to the backend candidate set.
      const visibleRecords = enrichedRecords.filter(record => matchesKeyword(record, nextFilters.keyword))
      const pageInfo = pageInfoFromResult(result, page, size)
      if (requestId !== demandRequestSeq.current) return null
      setDemands(current => mode === 'append' ? [...current, ...visibleRecords] : visibleRecords)
      setDemandPagination(current => ({
        ...current,
        ...pageInfo,
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: '',
        errorMode: ''
      }))
      return { ...pageInfo, recordCount: rawRecords.length }
    } catch (error) {
      const message = normalizeError(error)
      if (requestId !== demandRequestSeq.current) return null
      if (mode === 'replace') setDemands([])
      setDemandPagination(current => ({
        ...current,
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: message,
        errorMode: mode
      }))
      if (mode === 'refresh') {
        setNotice({ type: 'error', text: message })
      }
      return null
    }
  }

  async function loadServices({ nextFilters = filters, page = 1, mode = 'replace', cacheBust = '' } = {}) {
    const size = servicePagination.size || PAGE_SIZE
    const requestId = ++serviceRequestSeq.current
    if (mode !== 'append') serviceAppendInFlight.current = false
    updateServiceLoading(mode, true)
    try {
      const result = await servicePackageApi.list(serviceParams(nextFilters, page, size, cacheBust), currentUser)
      const rawRecords = result?.records || []
      const enrichedRecords = await enrichServiceProviders(rawRecords, currentUser)
      // Stage 1 keeps keyword filtering on the loaded page only; Stage 2 moves keyword search to the backend candidate set.
      const visibleRecords = enrichedRecords.filter(record => matchesKeyword(record, nextFilters.keyword))
      const pageInfo = pageInfoFromResult(result, page, size)
      if (requestId !== serviceRequestSeq.current) return null
      setServices(current => mode === 'append' ? [...current, ...visibleRecords] : visibleRecords)
      setServicePagination(current => ({
        ...current,
        ...pageInfo,
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: '',
        errorMode: ''
      }))
      return { ...pageInfo, recordCount: rawRecords.length }
    } catch (error) {
      const message = normalizeError(error)
      if (requestId !== serviceRequestSeq.current) return null
      if (mode === 'replace') setServices([])
      setServicePagination(current => ({
        ...current,
        loading: false,
        loadingMore: false,
        refreshing: false,
        error: message,
        errorMode: mode
      }))
      if (mode === 'refresh') {
        setNotice({ type: 'error', text: message })
      }
      return null
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
      loadDemands({ nextFilters, page: 1, mode: 'replace' })
      return
    }
    loadServices({ nextFilters, page: 1, mode: 'replace' })
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
    setSelectedDemand(null)
    setSelectedService(null)
    navigate(`/hall?tab=${nextPanel === 'demands' ? 'demand' : 'showcase'}`, { replace: true })
    if (nextPanel === 'demands') {
      loadDemands({ nextFilters: initialFilters, page: 1, mode: 'replace' })
    } else {
      loadServices({ nextFilters: initialFilters, page: 1, mode: 'replace' })
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

  function refreshActivePanel() {
    const cacheBust = Date.now()
    if (activePanel === 'demands') {
      const nextPage = demandPagination.hasNext ? demandPagination.page + 1 : 1
      const listPromise = loadDemands({ page: nextPage, mode: 'refresh', cacheBust })
      loadMyResponses()
      return listPromise
    }
    const nextPage = servicePagination.hasNext ? servicePagination.page + 1 : 1
    const listPromise = loadServices({ page: nextPage, mode: 'refresh', cacheBust })
    loadInterests()
    return listPromise
  }

  function scrollHallToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function refreshAndScrollTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    await refreshActivePanel()
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  function loadMoreDemands() {
    if (!demandPagination.hasNext || demandPagination.loadingMore || demandAppendInFlight.current) return
    demandAppendInFlight.current = true
    loadDemands({ page: demandPagination.page + 1, mode: 'append' })
      .finally(() => { demandAppendInFlight.current = false })
  }

  function loadMoreServices() {
    if (!servicePagination.hasNext || servicePagination.loadingMore || serviceAppendInFlight.current) return
    serviceAppendInFlight.current = true
    loadServices({ page: servicePagination.page + 1, mode: 'append' })
      .finally(() => { serviceAppendInFlight.current = false })
  }

  async function reloadDemandsAfterRemoval() {
    const currentPage = Math.max(demandPagination.page, 1)
    const result = await loadDemands({ page: currentPage, mode: 'replace' })
    if (result && result.recordCount === 0 && result.total > 0 && currentPage > 1) {
      await loadDemands({ page: currentPage - 1, mode: 'replace' })
    }
  }

  async function reloadServicesAfterRemoval() {
    const currentPage = Math.max(servicePagination.page, 1)
    const result = await loadServices({ page: currentPage, mode: 'replace' })
    if (result && result.recordCount === 0 && result.total > 0 && currentPage > 1) {
      await loadServices({ page: currentPage - 1, mode: 'replace' })
    }
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
        setNotice({ type: 'success', text: '响应已提交，等待约拍方确认后会开启会话。' })
        await loadDemands({ page: 1, mode: 'replace' })
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
      await reloadDemandsAfterRemoval()
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
      await reloadServicesAfterRemoval()
      await loadInterests()
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
    if (demandPagination.loading) return <LoadingState text="正在加载真实需求" />
    if (demandPagination.error && !demands.length) return <ErrorState message={demandPagination.error} />
    if (!demands.length) return <EmptyState text="暂无符合条件的需求" />
    return demands.map(demand => (
      <DemandCard
        key={demand.demandId}
        demand={demand}
        currentUser={currentUser}
        onOpen={() => navigate(`/demands/${demand.demandId}`)}
        onOpenPublisher={demand.customerId ? () => navigate(`/users/${demand.customerId}?role=CUSTOMER`) : undefined}
      />
    ))
  }

  function renderServices() {
    if (servicePagination.loading) return <LoadingState text="正在加载真实橱窗" />
    if (servicePagination.error && !services.length) return <ErrorState message={servicePagination.error} />
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

  function renderDemandFooter() {
    if (demandPagination.loading || (!demands.length && !demandPagination.hasNext && !demandPagination.error)) return null
    return (
      <div className="hall-list-footer">
        {demandPagination.error && (
          <p className="hall-footer-error">{demandPagination.error}</p>
        )}
        {demandPagination.hasNext ? (
          <button
            className="secondary-btn"
            type="button"
            disabled={demandPagination.loadingMore}
            onClick={loadMoreDemands}
          >
            {demandPagination.loadingMore ? '加载中...' : '加载更多'}
          </button>
        ) : (
          <span className="micro">已展示全部符合条件的需求</span>
        )}
      </div>
    )
  }

  function renderServiceFooter() {
    if (servicePagination.loading || (!services.length && !servicePagination.hasNext && !servicePagination.error)) return null
    return (
      <div className="hall-list-footer">
        {servicePagination.error && (
          <p className="hall-footer-error">{servicePagination.error}</p>
        )}
        {servicePagination.hasNext ? (
          <button
            className="secondary-btn"
            type="button"
            disabled={servicePagination.loadingMore}
            onClick={loadMoreServices}
          >
            {servicePagination.loadingMore ? '加载中...' : '加载更多'}
          </button>
        ) : (
          <span className="micro">已展示全部符合条件的橱窗</span>
        )}
      </div>
    )
  }

  const activePagination = activePanel === 'demands' ? demandPagination : servicePagination
  const floatingRefreshDisabled = activePagination.refreshing

  return (
    <main className="portra-page" data-role={currentUser.role === 'CUSTOMER' ? 'owner' : 'photographer'}>
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        onApplyFilters={applyFilters}
        onPublishClick={handlePublishClick}
        currentUserRole={currentUser.role}
      />

      <div className="hall-refresh-row">
        <span className="micro">
          当前共 {activePagination.total} 条{activePanel === 'demands' ? '需求' : '橱窗'}
        </span>
        <button
          className="secondary-btn"
          type="button"
          onClick={refreshActivePanel}
          disabled={activePagination.refreshing}
        >
          {activePagination.refreshing ? '刷新中...' : '刷新'}
        </button>
      </div>

      {notice && (
        <div className={`hall-notice ${notice.type === 'error' ? 'error' : 'success'}`} role="status">
          <span>{notice.text}</span>
          {notice.actionText && notice.onAction && (
            <button className="hall-notice-action" type="button" onClick={notice.onAction}>
              {notice.actionText}
            </button>
          )}
        </div>
      )}

      <HallTabs
        activePanel={activePanel}
        demandCount={demandPagination.total}
        serviceCount={servicePagination.total}
        onChange={changePanel}
      />

      {activePanel === 'demands' ? (
        <section className="panel active">
          <div className="section-title">
            <h2>订单大厅</h2>
            <span className="micro">按当前筛选展示开放需求</span>
          </div>
          <div className="order-layout">
            <div>
              <div className="order-grid">{renderDemands()}</div>
              {renderDemandFooter()}
            </div>
            <DemandAside
              selectedDemand={selectedDemand}
              error={demandPagination.error}
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
          {renderServiceFooter()}
        </section>
      )}

      <div className="hall-floating-actions" aria-label="大厅快捷操作">
        <button
          className="hall-floating-btn"
          type="button"
          aria-label="回到顶部"
          title="回到顶部"
          onClick={scrollHallToTop}
        >
          <KeyboardArrowUpRoundedIcon fontSize="small" />
        </button>
        <button
          className={`hall-floating-btn ${activePagination.refreshing ? 'is-refreshing' : ''}`}
          type="button"
          aria-label="刷新大厅"
          title="刷新大厅"
          disabled={floatingRefreshDisabled}
          onClick={refreshAndScrollTop}
        >
          <RefreshRoundedIcon fontSize="small" />
        </button>
      </div>
    </main>
  )
}
