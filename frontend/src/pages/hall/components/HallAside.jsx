import { useEffect, useState } from 'react'
import { cityName, firstText, latestTimeText, moneyRange, splitTags } from './hallUtils.js'
import { publicImageUrls, useFileObjectUrl } from '../utils/fileObjectUrls.js'

export const PORTRA_TIPS = [
  '拍摄前先确定主光方向，让脸微微转向光源，肤色会更干净。',
  '下巴轻轻向前再微收，比单纯低头更容易让脸部线条清晰。',
  '肩膀不要平端着，一高一低或微微侧身会更自然。',
  '手不知道放哪时，可以整理头发、扶包带、摸袖口或轻触衣领。',
  '眼神先看远处再回到镜头，表情会比一直盯镜头更松弛。',
  '选择低饱和、少大 Logo 的衣服，人物会更耐看。',
  '拍毕业照时保留校园建筑和路牌信息，照片更有纪念点。',
  '拍摄前和摄影师确认精修张数、交付时间、调色倾向和使用授权。',
  '自然光人像优先选清晨、傍晚或阴天，正午强光尽量进阴影里拍。',
  '站姿可以把重心放在后脚，前脚轻点地，身体不会僵。',
  '坐姿不要完全塌腰，腰背微微离开椅背会更有精神。',
  '多人合照用三角构图和高低错落，比排成直线更有层次。',
  '拍摄时多走动、回头、转身，动态连拍更容易抓到自然瞬间。',
  '近景人像避免广角贴脸，稍微拉开距离会减少面部变形。',
  '妆面在镜头里会被吃掉一点，底妆干净和眼神重点比浓妆更重要。',
  '道具保持少而具体，比如书、花、相机、毕业证，别让道具抢人。',
  '参考图最好带上喜欢和不喜欢的例子，沟通效率会高很多。',
  '拍摄前一天少熬夜，服装提前熨平，现场状态会稳定很多。',
  '如果紧张，可以先拍背影、侧脸、走路，再逐步面对镜头。',
  '每组场景至少保留远景、半身、特写三种景别，成片更完整。'
]

const HOT_STYLES = [
  { label: '清透毕业照', filter: '毕业照', note: '毕业季稳定高频，校园场景和自然光最容易出片。' },
  { label: '自然光写真', filter: '写真', note: '低饱和穿搭、松弛动作和生活化场景更受欢迎。' },
  { label: '二次元 Cosplay', filter: '二次元', note: '角色妆造、棚拍布光和后期氛围需求增长明显。' }
]

function demandTags(demand) {
  const serviceTypes = splitTags(demand?.serviceTypes)
  return serviceTypes.length ? serviceTypes : splitTags(demand?.styleTags)
}

function sameId(a, b) {
  return a !== undefined && a !== null && b !== undefined && b !== null && Number(a) === Number(b)
}

export function DemandAside({ selectedDemand, error, currentUser, onRespond, onHotStyleClick, onEditDemand, onCloseDemand, onOpenPublisher, responded = false, responding = false }) {
  const [tipIndex, setTipIndex] = useState(0)
  const isDemandOwner = selectedDemand && currentUser.role === 'CUSTOMER' && sameId(selectedDemand.customerId, currentUser.userId)
  const publisherName = firstText(selectedDemand?.customerNickname, selectedDemand?.customerName) || '暂无'
  const uploadedPublisherAvatar = useFileObjectUrl(
    [selectedDemand?.customerAvatarFileId, selectedDemand?.avatarFileId],
    currentUser,
    `demand ${selectedDemand?.demandId || 'selected'} aside publisher avatar`
  )
  const fallbackPublisherAvatar = publicImageUrls(selectedDemand?.customerAvatarUrl, selectedDemand?.customerAvatar)[0] || ''
  const publisherAvatar = uploadedPublisherAvatar || fallbackPublisherAvatar

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTipIndex(current => (current + 1) % PORTRA_TIPS.length)
    }, 30000)
    return () => window.clearInterval(timer)
  }, [])

  function nextTip() {
    setTipIndex(current => (current + 1) % PORTRA_TIPS.length)
  }

  return (
    <aside className="aside">
      <div className="aside-card">
        <h3>热门风格</h3>
        {HOT_STYLES.map(style => (
          <button className="aside-item hot-style-item" key={style.label} type="button" onClick={() => onHotStyleClick?.(style.filter)}>
            <strong>{style.label}</strong>
            <span>{style.note}</span>
          </button>
        ))}
      </div>
      <button className="aside-card tips-card" type="button" onClick={nextTip}>
        <h3>上镜Tips</h3>
        <p className="note-strip">{error ? '后端启动后，这里会保留大厅布局并加载真实需求。' : PORTRA_TIPS[tipIndex]}</p>
      </button>
      {selectedDemand && (
        <div className="aside-card">
          <h3>{firstText(selectedDemand.title, selectedDemand.scene) || '需求详情'}</h3>
          <div className="detail-publish-time">{latestTimeText(selectedDemand)}</div>
          <button className="aside-item aside-item-button" type="button" onClick={onOpenPublisher} disabled={!onOpenPublisher}>
            <strong>发布者</strong>
            <span className="aside-publisher-brief">
              {publisherAvatar && <span className="publisher-avatar" style={{ '--avatar-art': `url(${publisherAvatar})` }} aria-hidden="true" />}
              {publisherName}
            </span>
          </button>
          <div className="aside-item"><strong>地点</strong><span>{[cityName(selectedDemand.cityName || selectedDemand.cityCode), selectedDemand.location].filter(Boolean).join(' · ') || '暂无'}</span></div>
          <div className="aside-item"><strong>预算</strong><span>{moneyRange(selectedDemand.budgetMinCent, selectedDemand.budgetMaxCent)}</span></div>
          <div className="aside-item"><strong>标签</strong><span>{demandTags(selectedDemand).join(' / ') || '暂无'}</span></div>
        </div>
      )}
      {isDemandOwner && (
        <div className="aside-card">
          <h3>管理需求</h3>
          <div className="side-actions">
            <button className="secondary-btn" type="button" onClick={() => onEditDemand?.(selectedDemand)}>编辑需求</button>
            <button className="secondary-btn danger-action-btn" type="button" onClick={() => onCloseDemand?.(selectedDemand)}>下架需求</button>
          </div>
        </div>
      )}
      {selectedDemand && (
        <div className="photographer-only aside-card">
          <h3>操作</h3>
          <div className="side-actions">
            <button className="primary-btn photographer-only" type="button" disabled={responded || responding} onClick={() => onRespond(selectedDemand)}>
              {responding ? '提交中' : responded ? '已响应' : '我要响应'}
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

export function ShowcaseAside({ selectedService, currentUser, interests }) {
  const credit = selectedService?.photographerCreditScore ?? selectedService?.providerCreditScore ?? selectedService?.creditScore
  const uploadedAvatar = useFileObjectUrl(
    [selectedService?.photographerAvatarFileId, selectedService?.avatarFileId],
    currentUser,
    `service package ${selectedService?.serviceId || 'selected'} aside avatar`
  )
  const fallbackAvatar = publicImageUrls(selectedService?.photographerAvatarUrl, selectedService?.photographerAvatar)[0] || ''
  const avatar = uploadedAvatar || fallbackAvatar

  return (
    <aside className="aside">
      {selectedService ? (
        <div className="aside-card photographer-mini-card">
          <h3>摄影师信息</h3>
          <div className="profile-mini detail-provider-link">
            <div
              className="mini-avatar"
              style={avatar ? { '--avatar-art': `url(${avatar})` } : undefined}
              aria-hidden="true"
            />
            <div className="photographer-card-info">
              <strong className="photographer-card-name">{selectedService.photographerNickname || '暂无昵称'}</strong>
              <div className="photographer-card-location">{cityName(selectedService.cityName || selectedService.cityCode) || selectedService.serviceArea || '暂无城市'}</div>
              <div className="photographer-card-credit">{credit ? `信用 ${credit}` : '暂无信用评分'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="aside-card">
          <h3>橱窗说明</h3>
          <p className="note-strip">选择一个橱窗后，可在这里查看摄影师和服务摘要。</p>
        </div>
      )}
      {currentUser.role === 'CUSTOMER' && (
        <div className="aside-card">
          <h3>我的意向</h3>
          {interests.length
            ? interests.slice(0, 4).map(item => <div className="aside-item" key={item.serviceId}><strong>{item.title || '暂无标题'}</strong><span>{item.priceRange || '暂无价格'}</span></div>)
            : <span className="micro">还没有加入意向的橱窗</span>}
        </div>
      )}
    </aside>
  )
}
