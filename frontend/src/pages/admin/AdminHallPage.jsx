import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { demandApi } from '../../api/demandApi.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { userApi } from '../../api/userApi.js'
import { buildAdminHallRequestParams, normalizeAdminHallItems } from './adminData.js'
import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminHallCard } from './components/AdminHallCard.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'

const typeFilters = [
  { key: 'all', label: '全部' },
  { key: 'demand', label: '约拍需求' },
  { key: 'service', label: '服务橱窗' }
]

const statusFilters = [
  { key: 'PUBLIC', label: '正常展示' },
  { key: 'REMOVED', label: '已下架', disabled: true, hint: '接口待接入' },
  { key: 'REPORTED', label: '被举报', disabled: true, hint: '接口待接入' }
]

function recordsFromPage(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.records)) return value.records
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.content)) return value.content
  return []
}

function demandPublisherId(record) {
  return record?.customerId || record?.publisherId || record?.userId || null
}

function servicePublisherId(record) {
  return record?.photographerId || record?.providerId || record?.userId || null
}

async function hydrateDemandPublishers(records, currentUser) {
  const cache = new Map()
  return Promise.all(records.map(async record => {
    const publisherId = demandPublisherId(record)
    if (!publisherId || String(record.customerNickname || record.customerName || '').trim()) return record
    if (!cache.has(publisherId)) {
      cache.set(publisherId, userApi.brief(publisherId, currentUser, 'CUSTOMER').catch(() => null))
    }
    const brief = await cache.get(publisherId)
    if (!brief) return record
    return {
      ...record,
      customerId: record.customerId || publisherId,
      customerNickname: brief.nickname || record.customerNickname,
      customerName: brief.nickname || record.customerName,
      customerAvatarFileId: record.customerAvatarFileId ?? brief.avatarFileId
    }
  }))
}

async function hydrateServicePublishers(records, currentUser) {
  const cache = new Map()
  return Promise.all(records.map(async record => {
    const publisherId = servicePublisherId(record)
    if (!publisherId || String(record.photographerNickname || '').trim()) return record
    if (!cache.has(publisherId)) {
      cache.set(publisherId, userApi.brief(publisherId, currentUser, 'PROVIDER').catch(() => null))
    }
    const brief = await cache.get(publisherId)
    if (!brief) return record
    return {
      ...record,
      photographerId: record.photographerId || publisherId,
      photographerNickname: brief.nickname || record.photographerNickname,
      photographerAvatarFileId: record.photographerAvatarFileId ?? brief.avatarFileId
    }
  }))
}

export function AdminHallPage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [demands, setDemands] = useState([])
  const [services, setServices] = useState([])
  const [demandError, setDemandError] = useState('')
  const [serviceError, setServiceError] = useState('')
  const [loadingDemands, setLoadingDemands] = useState(true)
  const [loadingServices, setLoadingServices] = useState(true)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    const params = buildAdminHallRequestParams(keyword)
    setLoadingDemands(true)
    setLoadingServices(true)
    setDemandError('')
    setServiceError('')

    const demandRequest = demandApi.list(params.demands, currentUser)
      .then(result => hydrateDemandPublishers(recordsFromPage(result), currentUser))
    const serviceRequest = servicePackageApi.list(params.services, currentUser)
      .then(result => hydrateServicePublishers(recordsFromPage(result), currentUser))

    Promise.allSettled([demandRequest, serviceRequest]).then(([demandResult, serviceResult]) => {
      if (!active) return
      if (demandResult.status === 'fulfilled') setDemands(demandResult.value)
      else {
        setDemands([])
        setDemandError(demandResult.reason?.message || '公开需求加载失败，请重试。')
      }
      if (serviceResult.status === 'fulfilled') setServices(serviceResult.value)
      else {
        setServices([])
        setServiceError(serviceResult.reason?.message || '公开服务橱窗加载失败，请重试。')
      }
      setLoadingDemands(false)
      setLoadingServices(false)
    })

    return () => { active = false }
  }, [currentUser, keyword, retryKey])

  const items = useMemo(() => normalizeAdminHallItems(demands, services), [demands, services])
  const visibleItems = useMemo(() => (
    typeFilter === 'all' ? items : items.filter(item => item.type === typeFilter)
  ), [items, typeFilter])
  const loading = loadingDemands || loadingServices

  function openItem(item) {
    navigate(item.type === 'demand' ? `/demands/${item.id}` : `/service-packages/${item.id}`)
  }

  function openPublisher(item) {
    const publisherId = item.type === 'demand'
      ? demandPublisherId(item.record)
      : servicePublisherId(item.record)
    if (!publisherId) return
    const role = item.type === 'demand' ? 'CUSTOMER' : 'PROVIDER'
    navigate(`/admin/users/${publisherId}?role=${role}`)
  }

  return (
    <main className="admin-page">
      <AdminModeBanner
        title="大厅管理"
        description="以管理员模式浏览平台当前公开的约拍需求与服务橱窗；所有内容保持只读。"
      />

      <section className="admin-hall-toolbar" aria-label="大厅筛选">
        <form
          className="admin-hall-search"
          onSubmit={event => {
            event.preventDefault()
            setKeyword(searchValue.trim())
          }}
        >
          <label htmlFor="admin-hall-keyword">搜索公开内容</label>
          <div>
            <input
              id="admin-hall-keyword"
              name="admin-hall-keyword"
              type="search"
              value={searchValue}
              autoComplete="off"
              placeholder="标题、内容或发布者…"
              onChange={event => setSearchValue(event.target.value)}
            />
            <button className="admin-button" type="submit">搜索</button>
          </div>
        </form>

        <div className="admin-filter-group" aria-label="内容类型">
          <span>内容类型</span>
          <div>
            {typeFilters.map(filter => (
              <button
                className={typeFilter === filter.key ? 'admin-filter-button is-active' : 'admin-filter-button'}
                type="button"
                key={filter.key}
                aria-pressed={typeFilter === filter.key}
                onClick={() => setTypeFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-filter-group" aria-label="管理状态">
          <span>管理状态</span>
          <div>
            {statusFilters.map(filter => (
              <span className="admin-filter-option" key={filter.key}>
                <button
                  className={filter.key === 'PUBLIC' ? 'admin-filter-button is-active' : 'admin-filter-button'}
                  type="button"
                  disabled={filter.disabled}
                  aria-pressed={filter.key === 'PUBLIC'}
                >
                  {filter.label}
                </button>
                {filter.hint ? <small>{filter.hint}</small> : null}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-hall-summary" aria-live="polite">
        <p>
          当前展示 <strong>{visibleItems.length}</strong> 条公开内容
          {keyword ? <span> · 关键词“{keyword}”</span> : null}
        </p>
        <span>每类最多读取 20 条公开记录</span>
      </section>

      {demandError ? (
        <div className="admin-inline-error" role="alert">
          <span>约拍需求：{demandError}</span>
          <button type="button" onClick={() => setRetryKey(value => value + 1)}>重试公开列表</button>
        </div>
      ) : null}
      {serviceError ? (
        <div className="admin-inline-error" role="alert">
          <span>服务橱窗：{serviceError}</span>
          <button type="button" onClick={() => setRetryKey(value => value + 1)}>重试公开列表</button>
        </div>
      ) : null}

      {loading && !items.length ? (
        <AdminEmptyState title="正在读取公开大厅…" description="只调用公开需求与服务橱窗列表接口。" />
      ) : null}

      {!loading && !visibleItems.length && !demandError && !serviceError ? (
        <AdminEmptyState title="暂无符合条件的公开内容" description="可以调整内容类型或搜索关键词。" />
      ) : null}

      {visibleItems.length ? (
        <section className="admin-hall-grid" aria-label="公开大厅内容">
          {visibleItems.map(item => {
            const publisherId = item.type === 'demand'
              ? demandPublisherId(item.record)
              : servicePublisherId(item.record)
            return (
              <AdminHallCard
                key={`${item.type}-${item.id}`}
                item={item}
                currentUser={currentUser}
                onOpen={() => openItem(item)}
                onOpenPublisher={publisherId ? () => openPublisher(item) : undefined}
              />
            )
          })}
        </section>
      ) : null}
    </main>
  )
}
