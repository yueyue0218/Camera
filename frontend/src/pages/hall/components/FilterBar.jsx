import { CITY_OPTIONS, TIME_TAG_OPTIONS, TYPE_OPTIONS } from './hallUtils.js'

export function FilterBar({ filters, onChange, onApplyFilters, onPublishClick, currentUserRole }) {
  const updateAndApply = partial => {
    const nextFilters = { ...filters, ...partial }
    onChange(partial)
    onApplyFilters(nextFilters)
  }

  const handleSearchKeyDown = event => {
    if (event.key === 'Enter') onApplyFilters({ ...filters, keyword: event.currentTarget.value })
  }

  return (
    <section className="toolbar" aria-label="大厅筛选">
      <label className="search">
        <button className="search-icon-btn" type="button" aria-label="搜索" onClick={() => onApplyFilters(filters)}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.2-3.2" />
          </svg>
        </button>
        <input
          value={filters.keyword}
          onChange={event => onChange({ keyword: event.target.value })}
          onKeyDown={handleSearchKeyDown}
          placeholder="搜索摄影师、约拍需求、地点或风格"
        />
      </label>
      <label className="filter-control">
        <select className="filter-select" value={filters.cityCode || '__placeholder'} onChange={event => updateAndApply({ cityCode: event.target.value === '__all' ? '' : event.target.value })}>
          <option value="__placeholder" hidden>地区</option>
          <option value="__all">不限</option>
          {CITY_OPTIONS.map(option => <option key={`${option.label}-${option.value}`} value={option.value}>{option.label}</option>)}
        </select>
        {filters.cityCode && <button className="filter-clear" type="button" onClick={() => updateAndApply({ cityCode: '' })}>清空</button>}
      </label>
      <label className="filter-control">
        <select className="filter-select" value={filters.type || '__placeholder'} onChange={event => updateAndApply({ type: event.target.value === '__all' ? '' : event.target.value })}>
          <option value="__placeholder" hidden>类型</option>
          <option value="__all">不限</option>
          {TYPE_OPTIONS.map(option => <option key={option.label} value={option.value}>{option.label}</option>)}
        </select>
        {filters.type && <button className="filter-clear" type="button" onClick={() => updateAndApply({ type: '' })}>清空</button>}
      </label>
      <div className="budget-range" aria-label="预算范围">
        <input
          inputMode="numeric"
          min="0"
          type="number"
          value={filters.minBudgetYuan}
          onChange={event => updateAndApply({ minBudgetYuan: event.target.value })}
          placeholder="最低价"
        />
        <span>-</span>
        <input
          inputMode="numeric"
          min="0"
          type="number"
          value={filters.maxBudgetYuan}
          onChange={event => updateAndApply({ maxBudgetYuan: event.target.value })}
          placeholder="最高价"
        />
        {(filters.minBudgetYuan || filters.maxBudgetYuan) && <button className="filter-clear" type="button" onClick={() => updateAndApply({ minBudgetYuan: '', maxBudgetYuan: '' })}>清空</button>}
      </div>
      <label className="filter-control">
        <select className="filter-select" value={filters.timeTag} onChange={event => updateAndApply({ timeTag: event.target.value })}>
          {TIME_TAG_OPTIONS.map((option, index) => <option key={`${option.label}-${index}`} value={option.value}>{option.label}</option>)}
        </select>
        {filters.timeTag && <button className="filter-clear" type="button" onClick={() => updateAndApply({ timeTag: '' })}>清空</button>}
      </label>
      <button className="primary-btn" type="button" onClick={onPublishClick}>
        {currentUserRole === 'PROVIDER' ? '发布橱窗' : '发布需求'}
      </button>
    </section>
  )
}
