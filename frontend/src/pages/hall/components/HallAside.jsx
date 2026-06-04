import { cityName, firstText, moneyRange, shortDateTime, splitTags } from './hallUtils.js'

const tips = [
  '保持自然微笑，眼神放松，不要一直盯镜头。',
  '衣服尽量选择低饱和色，和场景留出呼吸感。',
  '拍摄前和摄影师确认精修张数、交付时间和参考风格。'
]

function demandTags(demand) {
  const serviceTypes = splitTags(demand?.serviceTypes)
  return serviceTypes.length ? serviceTypes : splitTags(demand?.styleTags)
}

export function DemandAside({ selectedDemand, error, currentUser, onRespond }) {
  return (
    <aside className="aside">
      <div className="aside-card">
        <h3>热门风格</h3>
        <div className="aside-item"><strong>暂无统计</strong><span>等待后端大厅统计 / 热门风格接口补充后展示真实热度。</span></div>
      </div>
      <div className="aside-card">
        <h3>上镜Tips</h3>
        <p className="note-strip">{error ? '后端启动后，这里会保留大厅布局并加载真实需求。' : tips[0]}</p>
      </div>
      {selectedDemand && (
        <div className="aside-card">
          <h3>{firstText(selectedDemand.title, selectedDemand.scene) || '需求详情'}</h3>
          <div className="detail-publish-time">发布 {shortDateTime(selectedDemand.createdAt)}</div>
          <div className="aside-item"><strong>发布者</strong><span>{firstText(selectedDemand.customerNickname, selectedDemand.customerName) || '暂无'}</span></div>
          <div className="aside-item"><strong>地点</strong><span>{[cityName(selectedDemand.cityName || selectedDemand.cityCode), selectedDemand.location].filter(Boolean).join(' · ') || '暂无'}</span></div>
          <div className="aside-item"><strong>预算</strong><span>{moneyRange(selectedDemand.budgetMinCent, selectedDemand.budgetMaxCent)}</span></div>
          <div className="aside-item"><strong>标签</strong><span>{demandTags(selectedDemand).join(' / ') || '暂无'}</span></div>
        </div>
      )}
      {selectedDemand && (
        <div className="photographer-only aside-card">
          <h3>操作</h3>
          <div className="side-actions">
            <button className="primary-btn photographer-only" type="button" onClick={() => onRespond(selectedDemand)}>我要响应</button>
          </div>
        </div>
      )}
    </aside>
  )
}

export function ShowcaseAside({ selectedService, currentUser, interests }) {
  const credit = selectedService?.photographerCreditScore ?? selectedService?.providerCreditScore ?? selectedService?.creditScore

  return (
    <aside className="aside">
      {selectedService ? (
        <div className="aside-card photographer-mini-card">
          <h3>摄影师信息</h3>
          <div className="profile-mini detail-provider-link">
            <div
              className="mini-avatar"
              style={{ '--avatar-art': selectedService.photographerAvatarUrl ? `url(${selectedService.photographerAvatarUrl})` : undefined }}
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
