import { cityName, demandStatusText, firstText, fullDateTime, gradientFor, moneyRange, readableDate, splitTags, timeTagLabel } from './hallUtils.js'
import { publicImageUrls, useFileObjectUrl } from '../utils/fileObjectUrls.js'

export function DemandCard({
  demand,
  currentUser,
  onOpen,
  onDetail,
  onRespond,
  onOpenPublisher,
  responded = false,
  responding = false
}) {
  const tags = splitTags(demand.serviceTypes).length ? splitTags(demand.serviceTypes) : splitTags(demand.styleTags)
  const timeTags = splitTags(demand.timeTags)
  const title = firstText(demand.title, demand.scene)
  const customerName = firstText(demand.customerNickname, demand.customerName)
  const uploadedCustomerAvatar = useFileObjectUrl(
    [demand.customerAvatarFileId, demand.avatarFileId],
    currentUser,
    `demand ${demand.demandId} publisher avatar`
  )
  const fallbackCustomerAvatar = publicImageUrls(demand.customerAvatarUrl, demand.customerAvatar, demand.customerAvatarData)[0] || ''
  const customerAvatar = uploadedCustomerAvatar || fallbackCustomerAvatar
  const customerAvatarArt = customerAvatar ? `url(${customerAvatar})` : gradientFor(demand.customerId || demand.demandId)
  const place = [cityName(demand.cityName || demand.cityCode), demand.location].filter(Boolean).join(' · ')
  const coverUrl = useFileObjectUrl(
    demand.referenceFileIds,
    currentUser,
    `demand ${demand.demandId} reference`
  )
  const coverArt = coverUrl ? `url(${coverUrl})` : gradientFor(demand.demandId)

  return (
    <article className="ticket-card has-cover" onClick={onOpen}>
      <div className="ticket-cover" style={{ '--art': coverArt }} aria-hidden="true" />
      <div className="ticket-top">
        <div className="ticket-heading">
          <h3 className="ticket-title">{title || '暂无标题'}</h3>
          <div className="ticket-place">{place || '暂无地点'}</div>
        </div>
        <span className={`tag ${demand.status !== 'OPEN' ? 'blue' : ''}`}>
          {timeTags[0] ? timeTagLabel(timeTags[0]) : (demandStatusText[demand.status] || demand.status || '暂无')}
        </span>
      </div>
      <button
        className={`publisher-row ${onOpenPublisher ? 'publisher-link' : ''}`}
        type="button"
        disabled={!onOpenPublisher}
        onClick={onOpenPublisher ? e => { e.stopPropagation(); onOpenPublisher() } : undefined}
      >
        <span className="publisher-avatar" style={{ '--avatar-art': customerAvatarArt }} aria-hidden="true" />
        <span>{customerName || '暂无发布者'}</span>
      </button>
      <div className="ticket-meta" aria-label="需求关键信息">
        <div className="meta-item"><span>预算</span><b>{moneyRange(demand.budgetMinCent, demand.budgetMaxCent)}</b></div>
        <div className="meta-item"><span>时间</span><b>{demand.timeDescription || demand.timeSlot || readableDate(demand.expectedDate) || '暂无'}</b></div>
        <div className="meta-item"><span>需求</span><b>{tags.slice(0, 2).join(' / ') || '暂无'}</b></div>
        <div className="meta-item"><span>发布</span><b>{fullDateTime(demand.updatedAt || demand.createdAt)}</b></div>
      </div>
      <p className="ticket-desc">{demand.description || '暂无说明'}</p>
      <div className="card-actions">
        <button className="ghost-btn" type="button" onClick={(event) => { event.stopPropagation(); onDetail() }}>查看详情</button>
        <button
          className={`solid-btn photographer-only ${responded ? 'is-responded' : ''}`}
          type="button"
          disabled={responded || responding}
          onClick={(event) => { event.stopPropagation(); onRespond() }}
        >
          {responding ? '提交中' : responded ? '已响应' : '我来响应'}
        </button>
      </div>
    </article>
  )
}
