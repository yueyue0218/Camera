import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { demandApi } from '../../api/demandApi.js'
import { servicePackageApi } from '../../api/servicePackageApi.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, ErrorState, LoadingState } from './components/HallState.jsx'
import { cityName, firstText, gradientFor, money, moneyRange, readableDate, shortDateTime, splitTags, timeTagLabel } from './components/hallUtils.js'
import { promptAndRespondDemand } from './utils/respondDemand.js'
import '../portraHall.css'

function createStatus() {
  return { loading: true, error: '' }
}

function normalizeError(error) {
  return error?.message || '请求失败，启动后端服务后会显示真实数据。'
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

function referenceSlots(referenceFileIds) {
  const count = Math.max(3, Math.min(4, Number(referenceFileIds?.length) || 0))
  const slots = Array.from({ length: count }, (_, index) => `参考图 ${String(index + 1).padStart(2, '0')}`)
  while (slots.length < 4) slots.push('暂未上传')
  return slots.slice(0, 4)
}

export function DemandDetailPage() {
  const { demandId } = useParams()
  const { currentUser } = useAuth()
  const [demand, setDemand] = useState(null)
  const [status, setStatus] = useState(createStatus)
  useBodyRole(currentUser.role)

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

  if (status.loading) return <DetailShell backLabel="← 返回订单大厅"><LoadingState text="正在加载真实需求详情" /></DetailShell>
  if (status.error) return <DetailShell backLabel="← 返回订单大厅"><ErrorState message={status.error} /></DetailShell>
  if (!demand) return <DetailShell backLabel="← 返回订单大厅"><EmptyState text="暂无需求详情" /></DetailShell>

  const styles = tagList(demand.styleTags, demand.serviceTypes)
  const timeTags = splitTags(demand.timeTags)
  const title = firstText(demand.title, demand.scene) || '暂无标题'
  const place = [cityName(demand.cityName || demand.cityCode), demand.location].filter(Boolean).join(' · ') || '暂无地点'
  const timeText = demand.timeDescription || demand.timeSlot || readableDate(demand.expectedDate) || '暂无'

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

  return (
    <DetailShell backLabel="← 返回订单大厅">
      <div className="detail-grid">
        <article className="panel-card">
          <h1 className="detail-title">{title}</h1>
          <div className="tag-row">
            <span className="tag">{timeTags[0] ? timeTagLabel(timeTags[0]) : '周末'}</span>
            {(styles.length ? styles : ['校园', '清透']).slice(0, 3).map(tag => <span className="tag gray" key={tag}>{tag}</span>)}
            <span className="tag blue">已实名</span>
          </div>
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
            <div className="ref-grid">
              {referenceSlots(demand.referenceFileIds).map((label, index) => <div className="ref-img" key={`${label}-${index}`}>{label}</div>)}
            </div>
          </div>
        </article>
        <aside className="aside">
          <div className="aside-card">
            <h3>发布者信息</h3>
            <div className="profile-mini detail-provider-link">
              <div className="mini-avatar" aria-hidden="true" />
              <div>
                <strong>{firstText(demand.customerNickname, demand.customerName) || '单主'}</strong><br />
                <span className="micro">响应 {demand.responseCount ?? 0} 次 · 发布 {shortDateTime(demand.createdAt)}</span>
              </div>
            </div>
            <div className="aside-item"><strong>完成约拍</strong><span>后端暂无发布者历史统计接口，当前展示需求响应数据。</span></div>
          </div>
          <div className="photographer-only aside-card">
            <h3>操作</h3>
            <div className="side-actions">
              <button className="primary-btn photographer-only" type="button" onClick={respondDemand}>我要响应</button>
            </div>
          </div>
          <div className="photographer-only aside-card">
            <h3>安全提示</h3>
            <p className="note-strip">响应前建议确认地点、精修张数、交付时间和是否需要妆造。</p>
          </div>
        </aside>
      </div>
    </DetailShell>
  )
}

function galleryItems(service) {
  const images = splitTags(service.images)
  const items = images.length ? images.slice(0, 5).map(image => `url(${image})`) : []
  while (items.length < 5) items.push(gradientFor((service.serviceId || 0) + items.length))
  return items
}

export function ServicePackageDetailPage() {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [service, setService] = useState(null)
  const [interested, setInterested] = useState(false)
  const [status, setStatus] = useState(createStatus)
  useBodyRole(currentUser.role)

  useEffect(() => {
    let ignored = false
    async function loadService() {
      setStatus({ loading: true, error: '' })
      try {
        const [detail, interestPage] = await Promise.all([
          servicePackageApi.detail(serviceId, currentUser),
          currentUser.role === 'CUSTOMER'
            ? servicePackageApi.myInterests({ page: 1, size: 100 }, currentUser).catch(() => null)
            : Promise.resolve(null)
        ])
        if (!ignored) {
          setService(detail)
          setInterested(Boolean(interestPage?.records?.some(item => Number(item.serviceId) === Number(serviceId))))
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
  const city = cityName(service.cityName || service.cityCode) || service.serviceArea || '暂无城市'
  const price = service.priceRange || `${money(service.basePriceCent)} 起`

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

  function followProvider() {
    window.alert('后端暂无关注摄影师接口，当前按钮只能按 HTML 复刻展示。')
  }

  return (
    <DetailShell backLabel="← 返回橱窗大厅">
      <div className="detail-grid">
        <article className="panel-card">
          <h1 className="detail-title">{service.title || '暂无标题'}</h1>
          <div className="tag-row">
            <span className="tag blue">摄影师</span>
            <span className="tag gray">{city}</span>
            {(styleTags.length ? styleTags : ['清透日常', '校园毕业']).slice(0, 3).map(tag => <span className="tag gray" key={tag}>{tag}</span>)}
            <span className="tag">{timeTags[0] ? timeTagLabel(timeTags[0]) : '时间可协商'}</span>
          </div>
          <div className="detail-publish-time">发布时间：{shortDateTime(service.createdAt)}</div>
          <div className="gallery">
            {galleryItems(service).map((art, index) => (
              <div className="photo" data-no={String(index + 1).padStart(2, '0')} style={{ '--art': art }} key={`${art}-${index}`} />
            ))}
          </div>
          <div className="text-block">
            <h3>价格区间</h3>
            <div className="price-range-panel">
              <strong>{price}</strong>
              <span>{service.durationMinutes ? `${service.durationMinutes} 分钟` : '时长沟通确认'} · {service.refinedCount ? `${service.refinedCount} 张精修` : '精修张数沟通'} · {service.deliveryDays ? `${service.deliveryDays} 天交付` : '交付时间沟通'}</span>
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
            <div className="profile-mini detail-provider-link">
              <div
                className="mini-avatar"
                style={{ '--avatar-art': service.photographerAvatarUrl ? `url(${service.photographerAvatarUrl})` : gradientFor(service.photographerId || service.providerId) }}
                aria-hidden="true"
              />
              <div className="photographer-card-info">
                <strong className="photographer-card-name">{service.photographerNickname || '暂无昵称'}</strong>
                <div className="photographer-card-location"><span>{city}</span></div>
                <div className="photographer-card-credit">{credit ? `信用评分：${credit}` : '暂无信用评分'}</div>
              </div>
            </div>
            <button className="secondary-btn" style={{ width: '100%' }} type="button" onClick={followProvider}>关注摄影师</button>
          </div>
          <div className="aside-card">
            <h3>操作</h3>
            <div className="detail-op-actions side-actions">
              <button className="secondary-btn owner-only" type="button" onClick={toggleInterest}>{interested ? '取消意向' : '加入意向'}</button>
              <button className="primary-btn owner-only" type="button" onClick={() => startChat()}>现在预定</button>
            </div>
          </div>
        </aside>
      </div>
    </DetailShell>
  )
}
