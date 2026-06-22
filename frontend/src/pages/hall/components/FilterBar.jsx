import { useState } from 'react'
import { Popover } from '@mui/material'
import { CITY_OPTIONS, TIME_TAG_OPTIONS, TYPE_OPTIONS } from './hallUtils.js'

function FilterMenu({ label, value, options, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const selected = options.find(option => String(option.value) === String(value))
  const open = Boolean(anchorEl)

  function choose(nextValue) {
    onChange(nextValue)
    setAnchorEl(null)
  }

  return (
    <>
      <button
        className={`filter-select filter-menu-trigger ${value ? 'has-value' : ''}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={event => setAnchorEl(event.currentTarget)}
      >
        <span>{value ? selected?.label : label}</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.8,
              minWidth: Math.max(anchorEl?.offsetWidth || 0, 156),
              maxWidth: 280,
              maxHeight: 320,
              p: 0.8,
              borderRadius: '18px',
              bgcolor: '#f8f3eb',
              border: '1px solid rgba(21,19,24,.12)',
              boxShadow: '0 20px 48px rgba(21,19,24,.16)',
              backgroundImage: 'linear-gradient(145deg, rgba(255,250,242,.98), rgba(244,239,232,.98))'
            }
          }
        }}
      >
        <div className="hall-filter-menu" role="listbox" aria-label={label}>
          <div className="hall-filter-menu-title">{label}</div>
          {options.map((option, index) => {
            const isSelected = String(option.value) === String(value)
            return (
              <button
                className={`hall-filter-option ${isSelected ? 'is-selected' : ''}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                key={`${option.label}-${option.value}-${index}`}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {isSelected && <span className="hall-filter-check" aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      </Popover>
    </>
  )
}

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
      <div className="filter-control">
        <FilterMenu label="地区" value={filters.cityCode} options={[{ label: '不限地区', value: '' }, ...CITY_OPTIONS]} onChange={value => updateAndApply({ cityCode: value })} />
        {filters.cityCode && <button className="filter-clear" type="button" onClick={() => updateAndApply({ cityCode: '' })}>清空</button>}
      </div>
      <div className="filter-control">
        <FilterMenu label="类型" value={filters.type} options={[{ label: '不限类型', value: '' }, ...TYPE_OPTIONS]} onChange={value => updateAndApply({ type: value })} />
        {filters.type && <button className="filter-clear" type="button" onClick={() => updateAndApply({ type: '' })}>清空</button>}
      </div>
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
      <div className="filter-control">
        <FilterMenu label="时间标签" value={filters.timeTag} options={TIME_TAG_OPTIONS.slice(1)} onChange={value => updateAndApply({ timeTag: value })} />
        {filters.timeTag && <button className="filter-clear" type="button" onClick={() => updateAndApply({ timeTag: '' })}>清空</button>}
      </div>
      <button className="primary-btn" type="button" onClick={onPublishClick}>
        {currentUserRole === 'PROVIDER' ? '发布橱窗' : '发布需求'}
      </button>
    </section>
  )
}
