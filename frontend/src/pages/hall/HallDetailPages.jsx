import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { demandApi } from '../../api/demandApi.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, ErrorState, LoadingState } from './components/HallState.jsx'
import { cityName, firstText, money, moneyRange, readableDate, shortDateTime, splitTags, timeTagLabel } from './components/hallUtils.js'
import { promptAndRespondDemand } from './utils/respondDemand.js'
import '../portraHall.css'

function createStatus() {
  return { loading: true, error: '' }
}

function normalizeError(error) {
  return error?.message || '请求失败，启动后端服务后会显示真实数据。'
}

function DetailShell({ children }) {
  const navigate = useNavigate()
  return (
    <main className="portra-page">
      <div className="crumb">
        <button className="back" type="button" onClick={() => navigate('/hall')}>← 返回大厅</button>
      </div>
      {children}
    </main>
  )
}

export function DemandDetailPage() {
  const { demandId } = useParams()
  const { currentUser } = useAuth()
  const [demand, setDemand] = useState(null)
  const [status, setStatus] = useState(createStatus)

  useEffect(() => {
    let ignored = false
    async function loadDemand() {
      setStatus({ loading: true, error: '' })
      try {
        const detail = await demandApi.detail(demandId, currentUser)
        if (!ignored) {
          setDemand(detail)
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

  if (status.loading) return <DetailShell><LoadingState text="正在加载真实需求详情" /></DetailShell>
  if (status.error) return <DetailShell><ErrorState message={status.error} /></DetailShell>
  if (!demand) return <DetailShell><EmptyState text="暂无需求详情" /></DetailShell>

  const tags = splitTags(demand.serviceTypes).length ? splitTags(demand.serviceTypes) : splitTags(demand.styleTags)
  const canRespond = currentUser.role === 'PROVIDER' &&
    demand.status === 'OPEN' &&
    Number(demand.customerId) !== Number(currentUser.userId)

  async function respondDemand() {
    await promptAndRespondDemand({
      demand,
      currentUser,
      demandApi,
      normalizeError,
      onSuccess: async () => {
        const detail = await demandApi.detail(demandId, currentUser)
        setDemand(detail || demand)
      }
    })
  }
  const title = firstText(demand.title, demand.scene) || '暂无标题'

  return (
    <DetailShell>
      <section className="detail-layout">
        <article className="panel-card detail-main-card">
          <div className="section-title">
            <h2>{title}</h2>
            <span className="tag">{demand.status || '暂无状态'}</span>
          </div>
          <p className="ticket-desc">{demand.description || '暂无说明'}</p>
          <div className="ticket-meta detail-meta">
            <div className="meta-item"><span>发布者</span><b>{firstText(demand.customerNickname, demand.customerName) || '暂无'}</b></div>
            <div className="meta-item"><span>地点</span><b>{[cityName(demand.cityName || demand.cityCode), demand.location].filter(Boolean).join(' · ') || '暂无'}</b></div>
            <div className="meta-item"><span>预算</span><b>{moneyRange(demand.budgetMinCent, demand.budgetMaxCent)}</b></div>
            <div className="meta-item"><span>时间</span><b>{demand.timeDescription || demand.timeSlot || readableDate(demand.expectedDate) || '暂无'}</b></div>
            <div className="meta-item"><span>服务类型</span><b>{tags.join(' / ') || '暂无'}</b></div>
            <div className="meta-item"><span>响应</span><b>{Number.isFinite(Number(demand.responseCount)) ? `${demand.responseCount} 人` : '暂无'}</b></div>
          </div>
        </article>
        <aside className="aside">
          <div className="aside-card">
            <h3>时间标签</h3>
            {(splitTags(demand.timeTags).length ? splitTags(demand.timeTags) : ['']).map(tag => (
              <span className="time-chip" key={tag || 'empty'}>{tag ? timeTagLabel(tag) : '暂无时间标签'}</span>
            ))}
          </div>
          <div className="aside-card">
            <h3>发布信息</h3>
            <div className="detail-publish-time">发布 {shortDateTime(demand.createdAt)}</div>
          </div>
          {canRespond && (
            <div className="photographer-only aside-card">
              <h3>操作</h3>
              <div className="side-actions">
                <button className="primary-btn photographer-only" type="button" onClick={respondDemand}>我要响应</button>
              </div>
            </div>
          )}
        </aside>
      </section>
    </DetailShell>
  )
}

export function ServicePackageDetailPage() {
  const { serviceId } = useParams()
  const { currentUser } = useAuth()
  const [service, setService] = useState(null)
  const [status, setStatus] = useState(createStatus)

  useEffect(() => {
    let ignored = false
    async function loadService() {
      setStatus({ loading: true, error: '' })
      try {
        const detail = await servicePackageApi.detail(serviceId, currentUser)
        if (!ignored) {
          setService(detail)
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

  if (status.loading) return <DetailShell><LoadingState text="正在加载真实橱窗详情" /></DetailShell>
  if (status.error) return <DetailShell><ErrorState message={status.error} /></DetailShell>
  if (!service) return <DetailShell><EmptyState text="暂无橱窗详情" /></DetailShell>

  const tags = splitTags(service.styleTags)
  const stats = [
    Number.isFinite(Number(service.bookingCount)) ? `${service.bookingCount} 次预约` : '',
    Number.isFinite(Number(service.orderCount)) ? `${service.orderCount} 单成交` : ''
  ].filter(Boolean).join(' · ')
  const credit = service.photographerCreditScore ?? service.providerCreditScore ?? service.creditScore
  const canReserve = currentUser.role === 'CUSTOMER' &&
    Number(service.photographerId ?? service.providerId) !== Number(currentUser.userId)

  async function reserveService() {
    const selectedDate = window.prompt('预约日期（YYYY-MM-DD，可留空先沟通）', '')
    if (selectedDate === null) return
    const initialMessage = window.prompt('预约留言', '')
    if (initialMessage === null) return
    try {
      const result = await servicePackageApi.reserve(service.serviceId, {
        selectedDate: selectedDate || null,
        initialMessage
      }, currentUser)
      if (result?.conversationId) {
        window.location.href = `/messages/${result.conversationId}`
      } else {
        window.alert('预约已提交')
      }
    } catch (error) {
      window.alert(normalizeError(error))
    }
  }

  return (
    <DetailShell>
      <section className="detail-layout">
        <article className="panel-card detail-main-card">
          <div className="section-title">
            <h2>{service.title || '暂无标题'}</h2>
            <span className="tag">{service.status || '暂无状态'}</span>
          </div>
          <p className="ticket-desc">{service.description || '暂无说明'}</p>
          <div className="ticket-meta detail-meta">
            <div className="meta-item"><span>摄影师</span><b>{service.photographerNickname || '暂无昵称'}</b></div>
            <div className="meta-item"><span>城市</span><b>{cityName(service.cityName || service.cityCode) || service.serviceArea || '暂无'}</b></div>
            <div className="meta-item"><span>价格</span><b>{service.priceRange || `${money(service.basePriceCent)} 起`}</b></div>
            <div className="meta-item"><span>时长</span><b>{service.durationMinutes ? `${service.durationMinutes} 分钟` : '暂无'}</b></div>
            <div className="meta-item"><span>风格</span><b>{tags.join(' / ') || '暂无'}</b></div>
            <div className="meta-item"><span>预约统计</span><b>{stats || '暂无'}</b></div>
          </div>
        </article>
        <aside className="aside">
          <div className="aside-card photographer-mini-card">
            <h3>摄影师信用</h3>
            <div className="profile-mini detail-provider-link">
              <div
                className="mini-avatar"
                style={{ '--avatar-art': service.photographerAvatarUrl ? `url(${service.photographerAvatarUrl})` : undefined }}
                aria-hidden="true"
              />
              <div className="photographer-card-info">
                <strong className="photographer-card-name">{service.photographerNickname || '暂无昵称'}</strong>
                <div className="photographer-card-location">{cityName(service.cityName || service.cityCode) || '暂无城市'}</div>
                <div className="photographer-card-credit">{credit ? `信用 ${credit}` : '暂无信用评分'}</div>
              </div>
            </div>
          </div>
          <div className="aside-card">
            <h3>时间标签</h3>
            {(splitTags(service.timeTags).length ? splitTags(service.timeTags) : ['']).map(tag => (
              <span className="time-chip" key={tag || 'empty'}>{tag ? timeTagLabel(tag) : '暂无时间标签'}</span>
            ))}
          </div>
          {canReserve && (
            <div className="aside-card">
              <h3>操作</h3>
              <div className="side-actions">
                <button className="primary-btn owner-only" type="button" onClick={reserveService}>现在预定</button>
              </div>
            </div>
          )}
        </aside>
      </section>
    </DetailShell>
  )
}
