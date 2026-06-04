import { cityName, demandStatusText, firstText, moneyRange, readableDate, shortDateTime, splitTags, timeTagLabel } from './hallUtils.js'

export function DemandCard({ demand, currentUser, onOpen, onDetail, onRespond }) {
  const tags = splitTags(demand.serviceTypes).length ? splitTags(demand.serviceTypes) : splitTags(demand.styleTags)
  const timeTags = splitTags(demand.timeTags)
  const title = firstText(demand.title, demand.scene)
  const customerName = firstText(demand.customerNickname, demand.customerName)
  const customerAvatar = firstText(demand.customerAvatar, demand.customerAvatarUrl)
  const place = [cityName(demand.cityName || demand.cityCode), demand.location].filter(Boolean).join(' · ')

  return (
    <article className="ticket-card" onClick={onOpen}>
      <div className="ticket-top">
        <div>
          <h3 className="ticket-title">{title || '暂无标题'}</h3>
          <div className="ticket-place">
            {place || '暂无地点'}
          </div>
        </div>
        <span className={`tag ${demand.status !== 'OPEN' ? 'blue' : ''}`}>
          {timeTags[0] ? timeTagLabel(timeTags[0]) : (demandStatusText[demand.status] || demand.status || '暂无')}
        </span>
      </div>
      <div className="publisher-row">
        {customerAvatar && <span className="publisher-avatar" style={{ '--avatar-art': `url(${customerAvatar})` }} aria-hidden="true" />}
        <span>{customerName || '暂无发布者'}</span>
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
        <button className="ghost-btn" type="button" onClick={(event) => { event.stopPropagation(); onDetail() }}>查看详情</button>
        <button className="solid-btn photographer-only" type="button" onClick={(event) => { event.stopPropagation(); onRespond() }}>
          我来响应
        </button>
      </div>
    </article>
  )
}
