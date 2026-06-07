import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { creditApi, notificationApi, reviewApi, reviewComplaintApi } from '../../api/index.js'
import { demoCreditRecords, demoCreditSummary } from '../../mocks/dline/creditFixtures.js'
import { demoNotifications } from '../../mocks/dline/notificationFixtures.js'
import { demoReviewComplaints, demoReviews } from '../../mocks/dline/reviewFixtures.js'

export const DND_KEY = 'portra-preview-message-dnd'
export const PORTRA_STATE_EVENT = 'portra-preview-state'

const initialOrders = {
  completed: {
    title: '校园毕业照',
    status: '已完成',
    tag: 'green',
    place: '南京大学仙林校区',
    budget: '¥499',
    time: '6 月 1 日',
    need: '18 张精修',
    desc: '双方已完成确认，订单记录已归档。'
  },
  confirmed: {
    title: '社团宣传照',
    status: '已确认',
    tag: 'blue',
    place: '鼓楼校区',
    budget: '¥699',
    time: '6 月 4 日',
    need: '宣传照',
    desc: '订单正在进行中，双方可继续在消息中确认细节。'
  },
  pending: {
    title: '个人写真试拍',
    status: '待确认',
    tag: '',
    place: '新街口',
    budget: '互勉',
    time: '6 月 6 日',
    need: '自然光',
    desc: '等待摄影师确认时间。'
  }
}

const messages = [
  { id: 'm1', unread: true, name: '阿岚', body: '成片已经确认，后续内容可以在订单页查看。', target: 'review' },
  { id: 'm2', unread: false, name: '周屿', body: '社团宣传照明天下午拍摄，地点保持不变。', target: 'order' }
]

const showcaseItems = [
  ['阿屿', '摄影师', '南京', '¥299 起', '★ 4.9 · 36 条评价', '清透,校园,自然引导'],
  ['南枝', '摄影师', '上海', '¥499 起', '★ 4.8 · 22 条评价', '胶片,情侣,街拍']
]

const reviewTags = ['沟通顺畅', '交付及时', '引导自然', '成片稳定', '守时可靠']

function asArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.records)) return value.records
  if (Array.isArray(value?.content)) return value.content
  return []
}

function useDLineDemoMode() {
  const [params] = useSearchParams()
  return import.meta.env.DEV && params.get('demo') === '1'
}

function DemoBadge() {
  return <span className="portra-demo-badge">开发预览数据</span>
}

function ErrorCard({ title, message = '请稍后重试', detail, onRetry }) {
  return (
    <div className="portra-error-card">
      <strong>{title}</strong>
      <span>{message}</span>
      {onRetry ? <button className="portra-secondary-btn" type="button" onClick={onRetry}>重新加载</button> : null}
      {import.meta.env.DEV && detail ? <small>{detail}</small> : null}
    </div>
  )
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatNoticeDay(value) {
  if (!value) return '较早'
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return '今天'
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  return date.toLocaleDateString('zh-CN')
}

function formatNoticeTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function creditLevel(score) {
  const numeric = Number(score)
  if (Number.isNaN(numeric)) return '信用未知'
  if (numeric >= 90) return '信用优秀'
  if (numeric >= 70) return '信用良好'
  return '信用较差'
}

function Tag({ children, tone = '' }) {
  return <span className={`portra-tag ${tone}`}>{children}</span>
}

function Toast({ feedback, onClose }) {
  if (!feedback?.message) return null
  return (
    <div className={`portra-toast ${feedback.type || 'success'}`} role="status">
      <span>{feedback.message}</span>
      <button type="button" onClick={onClose} aria-label="关闭提示">×</button>
    </div>
  )
}

function PortraModal({ title, children, onClose, footer }) {
  return (
    <div className="portra-modal-mask" onClick={event => event.target === event.currentTarget && onClose()}>
      <section className="portra-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="portra-modal-head">
          <h2>{title}</h2>
          <button className="portra-icon-btn" type="button" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="portra-modal-body">{children}</div>
        {footer ? <div className="portra-modal-footer">{footer}</div> : null}
      </section>
    </div>
  )
}

function CreditCard({ userId, completedOrders, publicView = false }) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const demoMode = useDLineDemoMode()
  const targetUserId = userId || currentUser?.userId
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      if (!targetUserId) return
      setLoading(true)
      setError('')
      try {
        const [summaryData, recordData, reviewData] = demoMode
          ? [demoCreditSummary, demoCreditRecords, demoReviews]
          : await Promise.all([
            creditApi.summary(targetUserId, currentUser),
            creditApi.records(targetUserId, currentUser),
            reviewApi.listByUser(targetUserId, currentUser)
          ])
        if (!alive) return
        setSummary(summaryData)
        setRecords(asArray(recordData))
        setReviews(asArray(reviewData))
      } catch (loadError) {
        if (!alive) return
        setError(loadError.message || '??????????')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [currentUser, demoMode, targetUserId])

  const reviewCount = summary?.receivedReviewCount ?? reviews.length
  const avgRating = reviewCount
    ? (summary?.averageRating ?? (reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviewCount).toFixed(1))
    : null
  const score = summary?.creditScore
  const resolvedCompletedOrders = summary?.completedOrderCount ?? completedOrders
  const resolvedLevel = summary?.creditLevel || creditLevel(score)
  const detailPath = publicView
    ? `/users/${targetUserId}/credit${demoMode ? '?demo=1' : ''}`
    : `/profile/credit${demoMode ? '?demo=1' : ''}`
  const recentChange = publicView ? null : records[0]
  const recentChangeLabel = recentChange
    ? `${recentChange.scoreChange > 0 ? '+' : ''}${recentChange.scoreChange} ? ${recentChange.reason || '????'}`
    : summary?.lastUpdatedAt
      ? `?????${formatDateTime(summary.lastUpdatedAt)}`
      : '????????'

  return (
    <button className="credit-preview-card" type="button" onClick={() => targetUserId && navigate(detailPath)} disabled={!targetUserId}>
      <div className="credit-preview-visual" style={{ '--credit-progress': `${Number.isFinite(Number(score)) ? score : 0}%` }}>
        <div className="credit-preview-ring">
          <span>{loading ? '...' : (score ?? '--')}</span>
        </div>
      </div>
      <div className="credit-preview-body">
        <div className="credit-preview-head">
          <div>
            <strong>{resolvedLevel}</strong>
            <p>{publicView ? '????????' : '??????????'}</p>
          </div>
          {demoMode ? <span className="credit-demo-badge">??????</span> : null}
        </div>
        <div className="credit-preview-stats">
          <span>????? <b>{resolvedCompletedOrders ?? '??'}</b></span>
          <span>???? <b>{reviewCount ?? '??'}</b></span>
          <span>???? <b>{avgRating || '??'}</b></span>
        </div>
        <p className="credit-preview-change">{recentChangeLabel}</p>
        {error ? <p className="credit-preview-error">??????????</p> : null}
      </div>
    </button>
  )
}

function OrderCard({ id, order }) {
  const navigate = useNavigate()
  return (
    <button className="portra-ticket-card" type="button" onClick={() => navigate(`/orders?orderId=${id}`)}>
      <div className="portra-ticket-top">
        <div>
          <h3 className="portra-ticket-title">{order.title}</h3>
          <div className="portra-ticket-place">{order.place}</div>
        </div>
        <Tag tone={order.tag}>{order.status}</Tag>
      </div>
      <div className="portra-ticket-meta">
        <div className="portra-meta-item"><span>预算</span><b>{order.budget}</b></div>
        <div className="portra-meta-item"><span>时间</span><b>{order.time}</b></div>
        <div className="portra-meta-item"><span>需求</span><b>{order.need}</b></div>
        <div className="portra-meta-item"><span>地点</span><b>{order.place}</b></div>
      </div>
      <p className="portra-ticket-desc">{order.desc}</p>
    </button>
  )
}

export function HallPage() {
  const [tab, setTab] = useState('orders')
  const navigate = useNavigate()
  return (
    <section>
      <section className="portra-toolbar">
        <label className="portra-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>
          <input placeholder="搜索摄影师、风格、地点或订单" />
        </label>
        <select className="portra-filter-select"><option>南京</option><option>上海</option></select>
        <select className="portra-filter-select"><option>本周</option><option>下周</option></select>
        <select className="portra-filter-select"><option>清透日常</option><option>校园毕业</option></select>
        <button className="portra-primary-btn" type="button" onClick={() => navigate('/messages')}>发起沟通</button>
      </section>
      <div className="portra-hall-head">
        <div className="portra-tabs">
          <button className={`portra-tab ${tab === 'orders' ? 'active' : ''}`} type="button" onClick={() => setTab('orders')}>
            <strong>订单大厅</strong><span>看需求、进详情、联系对方</span>
          </button>
          <button className={`portra-tab ${tab === 'showcase' ? 'active' : ''}`} type="button" onClick={() => setTab('showcase')}>
            <strong>橱窗大厅</strong><span>看作品、联系摄影师</span>
          </button>
        </div>
        <div className="portra-stats">今日新增 <b>18</b> 条需求<br />本周活跃摄影师 <b>42</b> 位</div>
      </div>
      {tab === 'orders' ? (
        <div>
          <div className="portra-section-title"><h2>近期订单</h2><span className="portra-micro">按更新时间排序</span></div>
          <div className="portra-order-grid">
            {Object.entries(initialOrders).map(([id, order]) => <OrderCard key={id} id={id} order={order} />)}
          </div>
        </div>
      ) : (
        <div>
          <div className="portra-section-title"><h2>橱窗大厅</h2><span className="portra-micro">按评价与活跃度综合排序</span></div>
          <div className="portra-order-grid">
            {showcaseItems.map(item => (
              <article className="portra-ticket-card" key={item[0]}>
                <div className="portra-ticket-top"><div><h3 className="portra-ticket-title">{item[0]}</h3><div className="portra-ticket-place">{item[2]} · {item[1]}</div></div><Tag tone="blue">{item[3]}</Tag></div>
                <div className="portra-chips">{item[5].split(',').map(chip => <span className="portra-chip" key={chip}>{chip}</span>)}</div>
                <p className="portra-ticket-desc">{item[4]}</p>
                <div className="portra-card-actions"><button className="portra-ghost-btn" type="button" onClick={() => navigate('/messages')}>私信沟通</button></div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function FeedPage() {
  return (
    <div className="portra-feed-layout">
      <div>
        <article className="portra-post-card">
          <div className="portra-post-head">
            <div className="portra-post-user"><div className="portra-mini-avatar" /><div><strong>阿屿</strong><span>摄影师 · 南京 · 18:30</span></div></div>
            <button className="portra-mini-btn" type="button">关注</button>
          </div>
          <p className="portra-post-text">今天在仙林拍到一组很舒服的毕业照。傍晚的光刚好落在教学楼外墙上，人物不用太用力，画面就已经很柔和。</p>
          <div className="portra-tag-row"><Tag tone="gray">#校园毕业</Tag><Tag tone="gray">#清透日常</Tag></div>
        </article>
      </div>
      <aside className="portra-aside">
        <div className="portra-aside-card"><h3>推荐关注</h3><div className="portra-aside-item"><strong>阿屿｜摄影师</strong><span>清透日常 · 校园毕业</span></div></div>
      </aside>
    </div>
  )
}

export function MomentDetailPage() {
  return <FeedPage />
}

export function OrdersPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const orderId = params.get('orderId') || 'completed'
  const order = initialOrders[orderId] || initialOrders.completed
  return (
    <section>
      <div className="portra-crumb"><button className="portra-back" type="button" onClick={() => navigate('/hall')}>← 返回约拍大厅</button><span>订单 #P20260603-018</span></div>
      <div className="portra-detail-grid">
        <article className="portra-panel-card">
          <h1 className="portra-detail-title">{order.title}</h1>
          <div className="portra-tag-row"><Tag tone={order.tag}>{order.status}</Tag><Tag tone="gray">校园</Tag><Tag tone="blue">已实名</Tag></div>
          <div className="portra-info-grid">
            <div className="portra-info-cell"><span>预算</span><b>{order.budget}</b></div>
            <div className="portra-info-cell"><span>拍摄时间</span><b>{order.time}</b></div>
            <div className="portra-info-cell"><span>地点</span><b>{order.place}</b></div>
            <div className="portra-info-cell"><span>需求</span><b>{order.need}</b></div>
            <div className="portra-info-cell"><span>状态</span><b>{order.status}</b></div>
          </div>
          <div className="portra-text-block"><h3>订单记录</h3><p>{order.desc}</p></div>
          {orderId === 'completed' ? (
            <div className="portra-text-block">
              <h3>评价</h3>
              <button className="portra-secondary-btn" type="button" onClick={() => navigate('/orders/8106/reviews')}>进入评价</button>
            </div>
          ) : null}
        </article>
        <aside className="portra-aside">
          <div className="portra-aside-card"><h3>摄影师</h3><div className="portra-profile-mini"><div className="portra-mini-avatar" /><div><strong>阿岚</strong><br /><span className="portra-micro">清透日常 · 校园毕业</span></div></div></div>
          <div className="portra-aside-card"><h3>操作</h3><div className="portra-side-actions"><button className="portra-secondary-btn" type="button" onClick={() => navigate('/messages')}>进入消息</button></div></div>
        </aside>
      </div>
    </section>
  )
}

export function MessagesPage() {
  const navigate = useNavigate()
  const [dnd, setDnd] = useState(localStorage.getItem(DND_KEY) === '1')
  const toggleDnd = () => {
    const next = !dnd
    setDnd(next)
    localStorage.setItem(DND_KEY, next ? '1' : '0')
    window.dispatchEvent(new Event(PORTRA_STATE_EVENT))
  }
  return (
    <div className="portra-detail-grid">
      <article className="portra-panel-card">
        <div className="portra-section-title"><h2>消息</h2><button className={`portra-secondary-btn ${dnd ? 'active' : ''}`} type="button" onClick={toggleDnd}>消息免打扰</button></div>
        <div className="portra-message-list">
          {messages.map(message => (
            <button className={`portra-message-row ${message.unread ? 'unread' : ''}`} key={message.id} type="button" onClick={() => navigate(message.target === 'review' ? '/orders/8106/reviews' : '/orders?orderId=confirmed')}>
              <strong>{message.name}</strong>
              <p>{message.body}</p>
              <span className="portra-micro">{message.target === 'review' ? '查看评价' : '查看订单'}</span>
            </button>
          ))}
        </div>
      </article>
      <aside className="portra-aside">
        <div className="portra-aside-card"><h3>消息设置</h3><p className="portra-note-strip">{dnd ? '已开启消息免打扰，新消息不再触发通知红点。' : '当前会接收新消息通知。'}</p></div>
      </aside>
    </div>
  )
}

export function ConversationDetailPage() {
  return <MessagesPage />
}

function shouldHideByDnd(notice, dnd) {
  if (!dnd) return false
  const type = String(notice.type || '').toUpperCase()
  const relatedType = String(notice.relatedType || '').toUpperCase()
  return type.includes('MESSAGE') || relatedType.includes('MESSAGE') || relatedType.includes('CONVERSATION')
}

function noticeTarget(notice) {
  const type = String(notice.type || '').toUpperCase()
  const relatedType = String(notice.relatedType || '').toUpperCase()
  const relatedId = notice.relatedId
  if (relatedType.includes('REVIEW_COMPLAINT')) return `/review-complaints/${relatedId}`
  if (relatedType.includes('ORDER') || type.includes('ORDER')) return `/orders?orderId=${relatedId || 'completed'}`
  if (relatedType.includes('REVIEW') || type.includes('REVIEW')) return relatedId ? `/orders/${relatedId}/reviews` : '/orders/8106/reviews'
  if (relatedType.includes('MESSAGE') || relatedType.includes('CONVERSATION') || type.includes('MESSAGE')) return '/messages'
  return ''
}

export function NotificationListPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const demoMode = useDLineDemoMode()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [dnd, setDnd] = useState(localStorage.getItem(DND_KEY) === '1')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = demoMode ? demoNotifications : await notificationApi.listMine(currentUser)
      setItems(asArray(data))
    } catch (loadError) {
      setError(loadError.message || '通知加载失败')
    } finally {
      setLoading(false)
    }
  }, [currentUser, demoMode])

  useEffect(() => { load() }, [load])

  const visibleItems = useMemo(() => items.filter(item => !shouldHideByDnd(item, dnd)), [items, dnd])
  const days = [...new Set(visibleItems.map(item => formatNoticeDay(item.createdAt)))]

  const markAllRead = async () => {
    try {
      const data = demoMode
        ? items.map(item => ({ ...item, isRead: true }))
        : await notificationApi.markAllRead(currentUser)
      setItems(asArray(data))
      setFeedback({ type: 'success', message: '已全部标记为已读' })
      window.dispatchEvent(new Event(PORTRA_STATE_EVENT))
    } catch (markError) {
      setFeedback({ type: 'error', message: markError.message || '操作失败，请稍后重试' })
    }
  }

  const toggleDnd = () => {
    const next = !dnd
    setDnd(next)
    localStorage.setItem(DND_KEY, next ? '1' : '0')
    setFeedback({ type: 'success', message: next ? '消息免打扰已开启' : '消息免打扰已关闭' })
    window.dispatchEvent(new Event(PORTRA_STATE_EVENT))
  }

  const openNotice = async notice => {
    try {
      if (!notice.isRead) {
        const updated = demoMode
          ? { ...notice, isRead: true }
          : await notificationApi.markRead(notice.notificationId, currentUser)
        setItems(current => current.map(item => item.notificationId === notice.notificationId ? updated : item))
        setFeedback({ type: 'success', message: '已标记为已读' })
        window.dispatchEvent(new Event(PORTRA_STATE_EVENT))
      }
      const target = noticeTarget(notice)
      if (target) navigate(target)
    } catch (noticeError) {
      setFeedback({ type: 'error', message: noticeError.message || '通知操作失败' })
    }
  }

  return (
    <section>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />
      <article className="portra-panel-card">
        <div className="portra-section-title"><h2>通知</h2><span className="portra-micro">{dnd ? '消息免打扰已开启' : '按时间分组'} {demoMode ? <DemoBadge /> : null}</span></div>
        <div className="portra-side-actions horizontal"><button className="portra-secondary-btn" type="button" onClick={markAllRead} disabled={!items.length}>全部已读</button><button className={`portra-secondary-btn ${dnd ? 'active' : ''}`} type="button" onClick={toggleDnd}>消息免打扰</button></div>
        {loading ? <div className="portra-empty">通知加载中...</div> : null}
        {error ? <ErrorCard title="暂时无法加载通知" detail={error} onRetry={load} /> : null}
        {!loading && !error && visibleItems.length ? days.map(day => (
          <section key={day}>
            <h3 className="portra-notice-day">{day}</h3>
            {visibleItems.filter(item => formatNoticeDay(item.createdAt) === day).map(item => (
              <button key={item.notificationId} type="button" className={`portra-notice ${item.isRead ? 'read' : 'unread'}`} onClick={() => openNotice(item)}>
                <div className="portra-notice-title"><strong>{item.title}</strong><time>{formatNoticeTime(item.createdAt)}</time></div>
                <p>{item.content}</p>
                {noticeTarget(item) ? <span className="link">打开相关内容</span> : null}
              </button>
            ))}
          </section>
        )) : null}
        {!loading && !error && !visibleItems.length ? <div className="portra-empty">暂时没有新通知。</div> : null}
      </article>
    </section>
  )
}

export function ProfilePage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const isProvider = currentUser?.role === 'PROVIDER'
  return (
    <div className="portra-profile-grid">
      <article className="portra-panel-card">
        <div className="portra-section-title"><h2>{isProvider ? '我的服务与评价' : '我的订单与评价'}</h2></div>
        <CreditCard userId={currentUser?.userId} completedOrders={currentUser?.completedOrders} />
        <div className="portra-order-grid profile-actions">
          <button className="portra-ticket-card" type="button" onClick={() => navigate('/orders?orderId=completed')}>
            <div className="portra-ticket-top"><div><h3 className="portra-ticket-title">校园毕业照</h3><div className="portra-ticket-place">订单记录</div></div><Tag tone="green">已完成</Tag></div>
            <p className="portra-ticket-desc">查看订单详情，并从订单进入相关评价。</p>
          </button>
          <button className="portra-ticket-card" type="button" onClick={() => navigate(`/users/${currentUser?.userId}/reviews`)}>
            <div className="portra-ticket-top"><div><h3 className="portra-ticket-title">收到的评价</h3><div className="portra-ticket-place">首评与追评</div></div><Tag tone="blue">可查看</Tag></div>
            <p className="portra-ticket-desc">查看评价内容、追评状态和可发起的申诉。</p>
          </button>
        </div>
      </article>
      <aside className="portra-aside">
        <div className="portra-aside-card"><div className="portra-profile-mini"><div className="portra-mini-avatar" /><div><strong>{isProvider ? '阿屿' : '林同学'}</strong><br /><span className="portra-micro">{isProvider ? '摄影师 · 已实名' : '单主 · 已实名'}</span></div></div><p className="portra-note-strip">{isProvider ? '清透日常、校园毕业和自然引导。' : '偏好清透自然的校园拍摄，最近关注毕业照和社团宣传照。'}</p></div>
      </aside>
    </div>
  )
}

export function PublicProfilePage() {
  const { userId } = useParams()
  const targetUserId = Number(userId)
  return (
    <div className="portra-profile-grid">
      <article className="portra-panel-card">
        <div className="portra-section-title"><h2>公开主页</h2><span className="portra-micro">用户 #{targetUserId}</span></div>
        <CreditCard userId={targetUserId} publicView />
      </article>
      <aside className="portra-aside">
        <div className="portra-aside-card"><div className="portra-profile-mini"><div className="portra-mini-avatar" /><div><strong>Portra 用户</strong><br /><span className="portra-micro">公开资料</span></div></div><p className="portra-note-strip">公开主页只展示可见的信用概览和评价，不展示内部备注。</p></div>
      </aside>
    </div>
  )
}

function ReviewCard({ review, onFollowUp, onAppeal, showActions = true }) {
  const reviewerLabel = review.reviewerId ? `?? #${review.reviewerId}` : '????'
  const reviewerAvatar = review.reviewerId ? String(review.reviewerId).slice(-2) : 'U'
  const hasReply = Boolean(review.replyContent)
  return (
    <article className="review-item">
      <div className="review-item-head">
        <div className="review-user">
          <div className="review-avatar" aria-hidden="true">{reviewerAvatar}</div>
          <div>
            <strong>{reviewerLabel}</strong>
            <span>{review.direction || '??'}</span>
          </div>
        </div>
        <div className="review-meta">
          <span className="review-rating">{review.rating || '-'} ?</span>
          <time>{formatDateTime(review.createdAt)}</time>
        </div>
      </div>
      <p className="review-content">{review.content || '??????'}</p>
      <div className="review-order-line">?? #{review.orderId}</div>
      {hasReply ? (
        <div className="review-reply">
          <span>??</span>
          <p>{review.replyContent}</p>
        </div>
      ) : (
        <div className="review-reply empty">????</div>
      )}
      {showActions ? (
        <div className="review-actions">
          {!hasReply ? <button className="portra-secondary-btn" type="button" onClick={() => onFollowUp(review)}>????</button> : null}
          <button className="portra-danger-btn" type="button" onClick={() => onAppeal(review)}>????</button>
        </div>
      ) : null}
    </article>
  )
}


function ReviewSubmitForm({ orderId, demoMode = false, onCreated }) {
  const { currentUser } = useAuth()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!rating) {
      setError('请选择星级')
      return
    }
    if (!content.trim()) {
      setError('请填写评价内容')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const taggedContent = tags.length ? `${content.trim()}\n标签：${tags.join('、')}` : content.trim()
      const created = demoMode
        ? {
          reviewId: Date.now(),
          orderId,
          reviewerId: currentUser?.userId,
          targetUserId: 2001,
          direction: 'CUSTOMER_TO_PROVIDER',
          rating,
          content: taggedContent,
          isVisible: true,
          createdAt: new Date().toISOString(),
          replyContent: null,
          replyTime: null
        }
        : await reviewApi.create(orderId, { rating, content: taggedContent, tags }, currentUser)
      setContent('')
      setRating(0)
      setTags([])
      onCreated(created, '评价提交成功')
    } catch (submitError) {
      setError(submitError.message || '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="portra-review-form">
      <h3>提交评价</h3>
      <div className="portra-stars" aria-label="星级选择">
        {[1, 2, 3, 4, 5].map(star => (
          <button className={star <= rating ? 'active' : ''} key={star} type="button" onClick={() => setRating(star)}>★</button>
        ))}
      </div>
      <div className="portra-chips selectable">
        {reviewTags.map(tag => (
          <button className={`portra-chip ${tags.includes(tag) ? 'active' : ''}`} key={tag} type="button" onClick={() => setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])}>{tag}</button>
        ))}
      </div>
      <div className="portra-field">
        <label>评价内容 <span>{content.length}/300</span></label>
        <textarea maxLength={300} value={content} onChange={event => setContent(event.target.value)} />
      </div>
      {error ? <div className="portra-inline-error">{error}</div> : null}
      <button className="portra-primary-btn" type="button" disabled={submitting} onClick={submit}>{submitting ? '提交中...' : '提交评价'}</button>
    </div>
  )
}

export function ReviewPage() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { currentUser } = useAuth()
  const demoMode = useDLineDemoMode()
  const resolvedOrderId = orderId || '8106'
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [modal, setModal] = useState(null)
  const [modalText, setModalText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = demoMode ? demoReviews : await reviewApi.listByOrder(resolvedOrderId, currentUser)
      setReviews(asArray(data))
    } catch (loadError) {
      setError(loadError.message || '评价加载失败')
    } finally {
      setLoading(false)
    }
  }, [currentUser, demoMode, resolvedOrderId])

  useEffect(() => { load() }, [load])

  const closeModal = () => {
    setModal(null)
    setModalText('')
    setSubmitting(false)
  }

  const submitFollowUp = async () => {
    if (!modalText.trim()) return
    setSubmitting(true)
    try {
      const updated = demoMode
        ? { ...modal, replyContent: modalText.trim(), replyTime: new Date().toISOString() }
        : await reviewApi.followUp(modal.reviewId, { content: modalText.trim() }, currentUser)
      setReviews(current => current.map(item => item.reviewId === updated.reviewId ? updated : item))
      setFeedback({ type: 'success', message: '追评已提交' })
      closeModal()
    } catch (submitError) {
      setFeedback({ type: 'error', message: submitError.message || '追评提交失败' })
      setSubmitting(false)
    }
  }

  const submitAppeal = async () => {
    if (!modalText.trim()) return
    setSubmitting(true)
    try {
      if (!demoMode) await reviewComplaintApi.create(modal.reviewId, { reason: modalText.trim() }, currentUser)
      setFeedback({ type: 'success', message: '申诉已提交' })
      closeModal()
    } catch (submitError) {
      setFeedback({ type: 'error', message: submitError.message || '申诉提交失败' })
      setSubmitting(false)
    }
  }

  return (
    <section>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />
      <div className="portra-crumb"><button className="portra-back" type="button" onClick={() => navigate('/orders?orderId=completed')}>← 返回订单</button><span>订单 #{resolvedOrderId} 的评价 {demoMode ? <DemoBadge /> : null}</span></div>
      <div className="portra-detail-grid">
        <article className="portra-panel-card">
          <h1 className="portra-detail-title">评价</h1>
          {loading ? <div className="portra-empty">评价加载中...</div> : null}
          {error ? <ErrorCard title="暂时无法加载评价" detail={error} onRetry={load} /> : null}
          {!loading && !error && reviews.length ? reviews.map(review => (
            <ReviewCard
              key={review.reviewId}
              review={review}
              onFollowUp={item => { setModal({ ...item, type: 'followUp' }); setModalText('') }}
              onAppeal={item => { setModal({ ...item, type: 'appeal' }); setModalText('') }}
            />
          )) : null}
          {!loading && !error && !reviews.length ? <div className="portra-empty">当前订单暂无评价。</div> : null}
          <ReviewSubmitForm orderId={resolvedOrderId} demoMode={demoMode} onCreated={(created, message) => { setReviews(current => [created, ...current]); setFeedback({ type: 'success', message }) }} />
        </article>
        <aside className="portra-aside">
          <div className="portra-aside-card"><h3>相关内容</h3><div className="portra-side-actions"><button className="portra-secondary-btn" type="button" onClick={() => navigate('/orders?orderId=completed')}>查看订单</button><button className="portra-secondary-btn" type="button" onClick={() => navigate('/messages')}>查看消息</button></div></div>
        </aside>
      </div>
      {modal ? (
        <PortraModal
          title={modal.type === 'followUp' ? '追加评价' : '评价申诉'}
          onClose={closeModal}
          footer={<><button className="portra-secondary-btn" type="button" onClick={closeModal}>取消</button><button className={modal.type === 'followUp' ? 'portra-primary-btn' : 'portra-danger-btn'} type="button" disabled={submitting || !modalText.trim()} onClick={modal.type === 'followUp' ? submitFollowUp : submitAppeal}>{submitting ? '提交中...' : '提交'}</button></>}
        >
          <div className="portra-field">
            <label>{modal.type === 'followUp' ? '追评内容' : '申诉原因'} <span>{modalText.length}/300</span></label>
            <textarea maxLength={300} value={modalText} onChange={event => setModalText(event.target.value)} />
          </div>
        </PortraModal>
      ) : null}
    </section>
  )
}

export function UserReviewsPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const demoMode = useDLineDemoMode()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = demoMode ? demoReviews : await reviewApi.listByUser(userId, currentUser)
        if (alive) setReviews(asArray(data))
      } catch (loadError) {
        if (alive) setError(loadError.message || '??????')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [currentUser, demoMode, userId])

  return (
    <section>
      <div className="portra-crumb"><button className="portra-back" type="button" onClick={() => navigate(-1)}>? ?????</button><span>?? #{userId || '2001'} ??? {demoMode ? <DemoBadge /> : null}</span></div>
      <article className="portra-panel-card">
        <h1 className="portra-detail-title">?????</h1>
        {loading ? <div className="portra-empty">?????...</div> : null}
        {error ? <ErrorCard title="????????" detail={error} onRetry={() => window.location.reload()} /> : null}
        {!loading && !error && reviews.length ? reviews.map(review => (
          <ReviewCard key={review.reviewId} review={review} showActions={false} />
        )) : null}
        {!loading && !error && !reviews.length ? <div className="portra-empty">????????</div> : null}
      </article>
    </section>
  )
}


export function ReviewComplaintDetailPage() {
  const { complaintId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const demoMode = useDLineDemoMode()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = demoMode ? demoReviewComplaints[0] : await reviewComplaintApi.detail(complaintId, currentUser)
        if (alive) setDetail(data)
      } catch (loadError) {
        if (alive) setError(loadError.message || '申诉详情加载失败')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [complaintId, currentUser, demoMode])

  return (
    <section>
      <div className="portra-crumb"><button className="portra-back" type="button" onClick={() => navigate(-1)}>← 返回上一页</button><span>申诉 #{complaintId || '9001'} {demoMode ? <DemoBadge /> : null}</span></div>
      <article className="portra-panel-card">
        <h1 className="portra-detail-title">评价申诉详情</h1>
        {loading ? <div className="portra-empty">申诉详情加载中...</div> : null}
        {error ? <ErrorCard title="暂时无法加载申诉详情" detail={error} onRetry={() => window.location.reload()} /> : null}
        {detail ? (
          <>
            <div className="portra-tag-row"><Tag tone={detail.status === 'REJECTED' ? 'orange' : 'blue'}>{detail.status}</Tag></div>
            <div className="portra-info-grid">
              <button className="portra-info-cell as-button" type="button" onClick={() => navigate(`/orders?orderId=${detail.orderId}`)}><span>关联订单</span><b>#{detail.orderId}</b></button>
              <div className="portra-info-cell"><span>关联评价</span><b>#{detail.reviewId}</b></div>
              <div className="portra-info-cell"><span>提交时间</span><b>{formatDateTime(detail.createdAt)}</b></div>
            </div>
            <div className="portra-text-block"><h3>申诉原因</h3><p>{detail.reason}</p></div>
            <div className="portra-text-block"><h3>处理结果</h3><p>{detail.arbitrationResult || '暂未处理'}{detail.arbitrationComment ? `：${detail.arbitrationComment}` : ''}</p></div>
          </>
        ) : null}
      </article>
    </section>
  )
}
