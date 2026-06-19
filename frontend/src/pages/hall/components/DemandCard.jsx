import { cityName, firstText, readableDate, splitTags } from './hallUtils.js'
import { publicImageUrls, useFileObjectUrl } from '../utils/fileObjectUrls.js'

function firstValue(...values) {
  return values.find(value => value !== null && value !== undefined && String(value).trim() !== '')
}

function firstArrayItem(value) {
  return Array.isArray(value) ? value[0] : undefined
}

function imageFileValues(demand) {
  return [
    demand.thumbnailFileId,
    demand.coverFileId,
    demand.imageFileId,
    demand.referenceFileId,
    demand.referenceFileIds,
    demand.imageUrl,
    demand.coverUrl,
    demand.thumbnailUrl,
    demand.referenceImageUrl,
    firstArrayItem(demand.referenceImages),
    firstArrayItem(demand.images),
    demand.photoUrl,
    firstArrayItem(demand.attachmentUrls),
    firstArrayItem(demand.referencePreviewUrls)
  ]
}

function publicImageValues(demand) {
  return [
    demand.imageUrl,
    demand.coverUrl,
    demand.thumbnailUrl,
    demand.referenceImageUrl,
    firstArrayItem(demand.referenceImages),
    firstArrayItem(demand.images),
    demand.photoUrl,
    firstArrayItem(demand.attachmentUrls),
    firstArrayItem(demand.referencePreviewUrls)
  ]
}

function truncateText(value, max = 15) {
  const text = String(value || '').trim()
  if (!text) return '暂无说明'
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function yuanFromCent(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number / 100) : null
}

function budgetText(demand) {
  const explicit = firstText(
    demand.budget,
    demand.budgetRange,
    demand.price,
    demand.expectedBudget
  )
  if (explicit) return explicit
  const min = yuanFromCent(demand.budgetMinCent)
  const max = yuanFromCent(demand.budgetMaxCent)
  if (min !== null && max !== null) return `¥${min}-${max}`
  if (min !== null) return `¥${min}起`
  if (max !== null) return `¥${max}以内`
  return '预算待定'
}

function responseCountText(demand) {
  const value = firstValue(
    demand.responseCount,
    demand.respondCount,
    demand.responses,
    demand.applicantCount
  )
  if (Array.isArray(value)) return `${value.length}人`
  const number = Number(value)
  return Number.isFinite(number) ? `${number}人` : '暂无'
}

function demandCopy(demand) {
  const explicitTitle = firstText(demand.title, demand.demandTitle, demand.name)
  const rawDescription = String(demand.description || '').trim()
  const descriptionLines = rawDescription.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

  if (explicitTitle) {
    return {
      title: explicitTitle,
      description: rawDescription
    }
  }

  if (descriptionLines.length > 1) {
    return {
      title: descriptionLines[0],
      description: descriptionLines.slice(1).join(' ')
    }
  }

  return {
    title: firstText(demand.scene, descriptionLines[0]),
    description: rawDescription
  }
}

export function DemandCard({
  demand,
  currentUser,
  onOpen,
  onRespond,
  responded = false,
  responding = false
}) {
  const tags = splitTags(demand.serviceTypes).length ? splitTags(demand.serviceTypes) : splitTags(demand.styleTags)
  const copy = demandCopy(demand)
  const title = copy.title
  const sceneStyleText = [
    firstText(demand.scene),
    tags.find(tag => tag && tag !== demand.scene)
  ].filter(Boolean).join(' / ')
  const place = [
    cityName(demand.cityName || demand.cityCode || demand.city || demand.place),
    firstText(demand.location, demand.address, demand.shootingLocation),
    sceneStyleText
  ].filter(Boolean).join(' · ')
  const budget = budgetText(demand)
  const shootTime = firstText(
    demand.shootTime,
    demand.time,
    demand.availableTime,
    demand.expectedTime,
    demand.timeDescription,
    demand.timeSlot
  ) || readableDate(demand.expectedDate) || '暂无'
  const coverUrl = useFileObjectUrl(
    imageFileValues(demand),
    currentUser,
    `demand ${demand.demandId} reference`
  )
  const fallbackCoverUrl = publicImageUrls(publicImageValues(demand))[0] || ''
  const imageUrl = coverUrl || fallbackCoverUrl

  return (
    <article className={`ticket-card has-cover ${imageUrl ? 'with-cover' : 'without-cover'}`} onClick={onOpen}>
      <div className="ticket-top">
        <div className="ticket-heading">
          <div className="ticket-title-line">
            <h3 className="ticket-title">{title || '暂无标题'}</h3>
            <span className="tag ticket-budget-tag">{budget}</span>
          </div>
          <div className="ticket-place">{place || '暂无地点'}</div>
        </div>
      </div>
      <p className="ticket-desc">{truncateText(copy.description)}</p>
      <div className="ticket-meta" aria-label="需求关键信息">
        <div className="meta-item"><span>时间</span><b>{shootTime}</b></div>
        <div className="meta-item"><span>已有响应人数</span><b>{responseCountText(demand)}</b></div>
      </div>
      <div className="card-actions">
        <button
          className={`solid-btn photographer-only ${responded ? 'is-responded' : ''}`}
          type="button"
          disabled={responded || responding}
          onClick={(event) => { event.stopPropagation(); onRespond() }}
        >
          {responding ? '提交中...' : responded ? '已响应' : '我来响应'}
        </button>
      </div>
      <div className={`ticket-cover ${imageUrl ? '' : 'is-placeholder'}`}>
        {imageUrl ? (
          <img src={imageUrl} alt={`${title || '需求'}参考图`} loading="lazy" />
        ) : (
          <span>参考图</span>
        )}
      </div>
    </article>
  )
}
