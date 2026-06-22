import { cityName, gradientFor, money, splitTags } from './hallUtils.js'
import { publicImageUrls, useFileObjectUrl } from '../utils/fileObjectUrls.js'

export function ServicePackageCard({ service, currentUser, onDetail }) {
  const timeTags = splitTags(service.timeTags)
  const uploadedCoverUrl = useFileObjectUrl(
    [service.portfolioIds, service.coverPortfolioId, service.coverImage, service.images],
    currentUser,
    `service package ${service.serviceId} cover`
  )
  const fallbackCover = publicImageUrls(service.coverImage, service.images)[0] || ''
  const cover = uploadedCoverUrl || fallbackCover
  const uploadedAvatarUrl = useFileObjectUrl(
    [service.photographerAvatarFileId, service.avatarFileId],
    currentUser,
    `service package ${service.serviceId} avatar`
  )
  const fallbackAvatar = publicImageUrls(service.photographerAvatarUrl, service.photographerAvatar)[0] || ''
  const avatar = uploadedAvatarUrl || fallbackAvatar
  return (
    <article className="showcase-card" data-time={timeTags.join(',')} onClick={onDetail}>
      <div className="work-cover" style={{ '--art': cover ? `url(${cover})` : gradientFor(service.serviceId) }}>
        <span className="price-tag">{service.priceRange || `${money(service.basePriceCent)} 起`}</span>
        <span className="city-tag">{cityName(service.cityName || service.cityCode) || '暂无城市'}</span>
      </div>
      <div className="show-info">
        <div className="provider-card-row">
          <div
            className="provider-avatar"
            style={{ '--avatar-art': avatar ? `url(${avatar})` : gradientFor(service.photographerId || service.providerId) }}
            aria-hidden="true"
          />
          <div className="provider-text">
            <span className="provider-name">{service.photographerNickname || '暂无昵称'}</span>
            <h3 className="showcase-title">{service.title || '暂无标题'}</h3>
          </div>
        </div>
      </div>
    </article>
  )
}
