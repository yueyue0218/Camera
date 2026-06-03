import { demandStatusText, moneyRange, readableDate, shortDateTime, splitTags, timeTagLabel } from './hallUtils.js'

export function DemandCard({ demand, currentUser, onOpen, onRespond }) {
  const tags = splitTags(demand.styleTags)
  const timeTags = splitTags(demand.timeTags)
  const canRespond = currentUser.role === 'PROVIDER'
    && demand.status === 'OPEN'
    && Number(demand.customerId) !== Number(currentUser.userId)

  return (
    <article className="ticket-card" onClick={onOpen}>
      <div className="ticket-top">
        <div>
          <h3 className="ticket-title">{demand.scene || '暂无标题'}</h3>
          <div className="ticket-place">
            {[demand.cityCode, demand.location].filter(Boolean).join(' · ') || '暂无地点'}
          </div>
        </div>
        <span className={`tag ${demand.status !== 'OPEN' ? 'blue' : ''}`}>
          {timeTags[0] ? timeTagLabel(timeTags[0]) : (demandStatusText[demand.status] || demand.status || '暂无')}
        </span>
      </div>
      <div className="ticket-meta">
        <div className="meta-item"><span>预算</span><b>{moneyRange(demand.budgetMinCent, demand.budgetMaxCent)}</b></div>
        <div className="meta-item"><span>时间</span><b>{demand.timeDescription || demand.timeSlot || readableDate(demand.expectedDate) || '暂无'}</b></div>
        <div className="meta-item"><span>需求</span><b>{tags.slice(0, 2).join(' / ') || '暂无'}</b></div>
        <div className="meta-item"><span>发布时间</span><b>{shortDateTime(demand.createdAt)}</b></div>
      </div>
      <p className="ticket-desc">{demand.description || '暂无说明'}</p>
      <div className="publish-brief">
        <b>响应</b>
        <span>{Number.isFinite(Number(demand.responseCount)) ? `${demand.responseCount} 人` : '暂无'}</span>
      </div>
      <div className="card-actions">
        <button className="ghost-btn" type="button" onClick={(event) => { event.stopPropagation(); onOpen() }}>查看详情</button>
        {canRespond && (
          <button className="solid-btn photographer-only" type="button" onClick={(event) => { event.stopPropagation(); onRespond() }}>
            我来响应
          </button>
        )}
      </div>
    </article>
  )
}
