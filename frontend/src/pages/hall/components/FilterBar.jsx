import { BUDGET_OPTIONS, CITY_OPTIONS, TIME_TAG_OPTIONS, TYPE_OPTIONS } from './hallUtils.js'

export function FilterBar({ filters, onChange, onApplyFilters, onPublishClick, currentUserRole }) {
  const handleSearchKeyDown = event => {
    if (event.key === 'Enter') onApplyFilters()
  }

  return (
    <section className="toolbar" aria-label="大厅筛选">
      <label className="search">
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.2-3.2" />
        </svg>
        <input
          value={filters.keyword}
          onChange={event => onChange({ keyword: event.target.value })}
          onKeyDown={handleSearchKeyDown}
          placeholder="搜索摄影师、约拍需求、地点或风格"
        />
      </label>
      <select className="filter-select" value={filters.cityCode} onChange={event => onChange({ cityCode: event.target.value })}>
        <option value="NJU">南京大学</option>
        {CITY_OPTIONS.map(option => <option key={`${option.label}-${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
      <select className="filter-select" value={filters.type} onChange={event => onChange({ type: event.target.value })}>
        <option value="GRADUATION">毕业照橱窗</option>
        {TYPE_OPTIONS.map(option => <option key={option.label} value={option.value}>{option.label}</option>)}
      </select>
      <select className="filter-select" value={filters.budget} onChange={event => onChange({ budget: event.target.value })}>
        {BUDGET_OPTIONS.map(option => <option key={option.label} value={option.value}>{option.label}</option>)}
      </select>
      <select className="filter-select" value={filters.timeTag} onChange={event => onChange({ timeTag: event.target.value })}>
        {TIME_TAG_OPTIONS.map((option, index) => <option key={`${option.label}-${index}`} value={option.value}>{option.label}</option>)}
      </select>
      <button className="secondary-btn filter-apply-btn" type="button" onClick={onApplyFilters}>搜索/筛选</button>
      <button className="primary-btn" type="button" onClick={onPublishClick}>
        {currentUserRole === 'PROVIDER' ? '发布橱窗' : '发布需求'}
      </button>
    </section>
  )
}
