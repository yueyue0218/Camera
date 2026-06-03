import { gradientFor, money, shortDateTime, splitTags, timeTagLabel } from './hallUtils.js'

export function ServicePackageCard({ service, currentUser, onOpen, onReserve }) {
  const styleTags = splitTags(service.styleTags)
  const timeTags = splitTags(service.timeTags)
  const cover = service.coverImage || splitTags(service.images)[0]
  const isCustomer = currentUser.role === 'CUSTOMER'

  return (
    <article className="showcase-card" data-time={timeTags.join(',')} onClick={onOpen}>
      <div className="work-cover" style={{ '--art': cover ? `url(${cover})` : gradientFor(service.serviceId) }}>
        <span className="price-tag">{service.priceRange || `${money(service.basePriceCent)} 起`}</span>
        <span className="city-tag">{service.cityCode || '暂无城市'}</span>
      </div>
      <div className="show-info">
        <div className="provider-card-row">
          <div
            className="provider-avatar"
            style={{ '--avatar-art': service.photographerAvatarUrl ? `url(${service.photographerAvatarUrl})` : gradientFor(service.photographerId || service.providerId) }}
            aria-hidden="true"
          />
          <div className="provider-text">
            <span className="provider-name">{service.photographerNickname || '暂无昵称'}</span>
          </div>
        </div>
        <h3 className="showcase-title">{service.title || '暂无标题'}</h3>
        <div className="chips">
          {styleTags.length ? styleTags.slice(0, 3).map(tag => <span className="chip" key={tag}>{tag}</span>) : <span className="chip">暂无标签</span>}
        </div>
        <div className="time-brief"><b>时间</b><span>{service.timeDescription || '暂无时间说明'}</span></div>
        <div className="time-tag-row">
          {timeTags.length ? timeTags.map(tag => <span className="time-chip" key={tag}>{timeTagLabel(tag)}</span>) : <span className="chip">未选择时间标签</span>}
        </div>
        <div className="publish-brief"><b>发布</b><span>{shortDateTime(service.createdAt)}</span></div>
        <div className="show-actions two-actions">
          <button className="ghost-btn" type="button" onClick={(event) => { event.stopPropagation(); onOpen() }}>查看橱窗</button>
          {isCustomer && (
            <button className="solid-btn owner-only" type="button" onClick={(event) => { event.stopPropagation(); onReserve() }}>
              现在预定
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
