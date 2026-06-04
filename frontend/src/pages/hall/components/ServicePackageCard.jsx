import { useEffect, useState } from 'react'
import { fileApi } from '../../../api/fileApi.js'
import { cityName, countText, gradientFor, latestTimeText, money, splitTags, timeTagLabel } from './hallUtils.js'

function sameId(a, b) {
  return a !== undefined && a !== null && b !== undefined && b !== null && Number(a) === Number(b)
}

export function ServicePackageCard({ service, currentUser, onOpen, onDetail, onReserve, onEdit, onOffline }) {
  const styleTags = splitTags(service.styleTags)
  const timeTags = splitTags(service.timeTags)
  const firstPortfolioId = Array.isArray(service.portfolioIds) ? service.portfolioIds[0] : null
  const fallbackCover = service.coverImage || splitTags(service.images)[0]
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState('')
  const cover = uploadedCoverUrl || fallbackCover
  const isCustomer = currentUser.role === 'CUSTOMER'
  const isProviderOwner = currentUser.role === 'PROVIDER' && (
    sameId(service.providerId, currentUser.userId) ||
    sameId(service.photographerId, currentUser.userId)
  )
  const usage = [
    countText(service.bookingCount, ' 次预约'),
    countText(service.orderCount, ' 单成交')
  ].filter(Boolean).join(' · ')
  const credit = service.photographerCreditScore ?? service.providerCreditScore ?? service.creditScore

  useEffect(() => {
    let objectUrl = ''
    let ignored = false
    async function loadCover() {
      if (!firstPortfolioId) {
        setUploadedCoverUrl('')
        return
      }
      try {
        objectUrl = await fileApi.downloadObjectUrl(firstPortfolioId, currentUser)
        if (!ignored) setUploadedCoverUrl(objectUrl)
      } catch {
        if (!ignored) setUploadedCoverUrl('')
      }
    }
    loadCover()
    return () => {
      ignored = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [currentUser, firstPortfolioId])

  return (
    <article className="showcase-card" data-time={timeTags.join(',')} onClick={onOpen}>
      <div className="work-cover" style={{ '--art': cover ? `url(${cover})` : gradientFor(service.serviceId) }}>
        <span className="price-tag">{service.priceRange || `${money(service.basePriceCent)} 起`}</span>
        <span className="city-tag">{cityName(service.cityName || service.cityCode) || '暂无城市'}</span>
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
        <div className="package-stats">
          <span>{usage || '暂无预约统计'}</span>
          <span>{credit ? `信用 ${credit}` : '暂无信用评分'}</span>
        </div>
        <div className="time-brief"><b>时间</b><span>{service.timeDescription || '暂无时间说明'}</span></div>
        <div className="time-tag-row">
          {timeTags.length ? timeTags.map(tag => <span className="time-chip" key={tag}>{timeTagLabel(tag)}</span>) : <span className="chip">未选择时间标签</span>}
        </div>
        <div className="publish-brief"><b>时间</b><span>{latestTimeText(service)}</span></div>
        <div className={`show-actions ${isProviderOwner ? 'three-actions' : 'two-actions'}`}>
          <button className="ghost-btn" type="button" onClick={(event) => { event.stopPropagation(); onDetail() }}>查看橱窗</button>
          {isCustomer && (
            <button className="solid-btn owner-only" type="button" onClick={(event) => { event.stopPropagation(); onReserve() }}>
              现在预订
            </button>
          )}
          {isProviderOwner && (
            <>
              <button className="ghost-btn provider-action-btn" type="button" onClick={(event) => { event.stopPropagation(); onEdit?.() }}>编辑</button>
              <button className="ghost-btn danger-action-btn" type="button" onClick={(event) => { event.stopPropagation(); onOffline?.() }}>下架</button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
