import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'

const reportFields = [
  ['举报编号', '接口返回后显示'],
  ['内容类型', '动态 / 需求 / 服务橱窗 / 用户'],
  ['举报对象', '内容编号与发布者'],
  ['举报原因', '后端原始原因'],
  ['举报时间', '后端创建时间'],
  ['处理状态', '待处理 / 已处理']
]

export function AdminReportsPage() {
  return (
    <main className="admin-page">
      <AdminModeBanner
        title="举报处理"
        description="当前展示举报处理工作区结构；举报列表、详情与处理接口尚未接入。"
      />

      <section className="admin-report-toolbar" aria-label="举报筛选">
        <label>
          <span>搜索举报</span>
          <input
            name="admin-report-search"
            type="search"
            autoComplete="off"
            placeholder="举报编号、内容编号或用户 ID…"
            disabled
          />
          <small>接口待接入</small>
        </label>
        <label>
          <span>内容类型</span>
          <select name="admin-report-type" defaultValue="" disabled>
            <option value="">全部类型</option>
          </select>
          <small>接口待接入</small>
        </label>
        <label>
          <span>处理状态</span>
          <select name="admin-report-status" defaultValue="" disabled>
            <option value="">全部状态</option>
          </select>
          <small>接口待接入</small>
        </label>
      </section>

      <section className="admin-report-legend" aria-labelledby="admin-report-legend-title">
        <header>
          <div>
            <span className="admin-user-section-kicker">举报卡片字段</span>
            <h2 id="admin-report-legend-title">待接入数据结构</h2>
          </div>
          <span className="admin-mode-badge">接口待接入</span>
        </header>
        <dl>
          {reportFields.map(([label, description]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
        <div className="admin-report-disabled-actions" aria-label="举报操作预览">
          <button className="admin-button" type="button" disabled>查看举报</button>
          <span>接口待接入</span>
          <button className="admin-button admin-button--danger" type="button" disabled>处理举报</button>
          <span>接口待接入</span>
        </div>
      </section>

      <AdminEmptyState
        title="举报接口待接入，当前仅完成前端页面结构。"
        description="未生成 demo 举报数据，也未请求管理员举报列表。"
        pending
      />
    </main>
  )
}
