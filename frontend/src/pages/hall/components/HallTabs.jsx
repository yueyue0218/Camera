export function HallTabs({ activePanel, demandCount, serviceCount, onChange }) {
  return (
    <section className="hall-head">
      <div className="tabs">
        <button className={`tab ${activePanel === 'demands' ? 'active' : ''}`} type="button" onClick={() => onChange('demands')}>
          <strong>订单大厅</strong>
          <span>看看谁正在寻找镜头</span>
        </button>
        <button className={`tab ${activePanel === 'showcases' ? 'active' : ''}`} type="button" onClick={() => onChange('showcases')}>
          <strong>橱窗大厅</strong>
          <span>看看谁值得被预约</span>
        </button>
      </div>
      <div className="stats">
        今日新增 <b>{demandCount}</b> 个需求 · <b>{serviceCount}</b> 个服务橱窗在线
      </div>
    </section>
  )
}
