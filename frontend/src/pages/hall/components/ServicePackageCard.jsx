import { memo, useState } from 'react'
import { cityName, gradientFor, money, splitTags } from './hallUtils.js'
import { publicImageUrls, useFileObjectUrl, useFileObjectUrlState } from '../utils/fileObjectUrls.js'

function firstArrayItem(value) {
  return Array.isArray(value) ? value[0] : undefined
}

function firstValue(...values) {
  return values.find(value => value !== null && value !== undefined && String(value).trim() !== '')
}

export const ServicePackageCard = memo(function ServicePackageCard({ service, currentUser, onDetail }) {
  const timeTags = splitTags(service.timeTags)
  const coverFileValue = firstValue(
    service.coverPortfolioId,
    firstArrayItem(service.portfolioIds),
    service.coverImage,
    firstArrayItem(service.images)
  )
  const { url: uploadedCoverUrl, loading: coverDownloading, error: coverDownloadFailed } = useFileObjectUrlState(
    coverFileValue,
    currentUser,
    `service package ${service.serviceId} cover`
  )
  const fallbackCover = publicImageUrls(service.coverImage, service.images)[0] || ''
  const cover = uploadedCoverUrl || fallbackCover
  const avatarFileValue = firstValue(service.photographerAvatarFileId, service.avatarFileId)
  const uploadedAvatarUrl = useFileObjectUrl(
    avatarFileValue,
    currentUser,
    `service package ${service.serviceId} avatar`
  )
  const fallbackAvatar = publicImageUrls(service.photographerAvatarUrl, service.photographerAvatar)[0] || ''
  const avatar = uploadedAvatarUrl || fallbackAvatar
  const [loadedCoverUrl, setLoadedCoverUrl] = useState('')
  const [failedCoverUrl, setFailedCoverUrl] = useState('')
  const coverLoaded = Boolean(cover) && loadedCoverUrl === cover
  const coverFailed = Boolean(cover) && failedCoverUrl === cover

  const coverState = !cover
    ? coverDownloading
      ? 'is-loading'
      : coverDownloadFailed
        ? 'is-error'
        : 'is-placeholder'
    : coverFailed
      ? 'is-error'
      : coverLoaded
        ? 'is-loaded'
        : 'is-loading'

  return (
    <article className="showcase-card" data-time={timeTags.join(',')} onClick={onDetail}>
      <div className={`work-cover ${coverState}`} style={{ '--placeholder-art': gradientFor(service.serviceId) }}>
        {cover && !coverFailed && (
          <img
            className={`work-cover-image ${coverLoaded ? 'is-loaded' : ''}`}
            src={cover}
            alt={`${service.title || '橱窗'}封面`}
            loading="lazy"
            decoding="async"
            width="320"
            height="320"
            onLoad={() => setLoadedCoverUrl(cover)}
            onError={() => setFailedCoverUrl(cover)}
          />
        )}
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
})
