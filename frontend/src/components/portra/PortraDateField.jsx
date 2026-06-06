import { FormHelperText, Stack, Typography } from '@mui/material'
import { PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import { PortraCompactSelect } from './PortraCompactSelect.jsx'

export function PortraDateField({
  label,
  value,
  onChange,
  error = '',
  required = false,
  minYear = new Date().getFullYear() - 1,
  maxYear = new Date().getFullYear() + 3,
  helperText = '请选择日期',
  hideLabel = false,
  showHelper = true
}) {
  const parsed = normalizeDateParts(parseDateValue(value), minYear, maxYear)
  const years = buildNumberRange(minYear, maxYear)
  const months = buildNumberRange(1, 12)
  const days = buildNumberRange(1, getDaysInMonth(parsed.year || minYear, parsed.month || 1))

  const update = next => {
    const fallback = getFallbackDateParts(minYear, maxYear)
    const year = next.year || parsed.year || fallback.year
    const month = next.month || parsed.month || fallback.month
    const day = next.day || parsed.day || fallback.day
    if (!year || !month || !day) {
      onChange('')
      return
    }
    const maxDay = getDaysInMonth(year, month)
    onChange(`${year}-${pad(month)}-${pad(Math.min(day, maxDay))}`)
  }

  return (
    <Stack spacing={0.65}>
      {!hideLabel && (
        <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 13, fontWeight: 850 }}>
          {label}{required ? ' *' : ''}
        </Typography>
      )}
      <Stack direction="row" spacing={0.85} sx={{ flexWrap: 'wrap', rowGap: 0.85 }}>
        <DateSelect label="年" value={parsed.year || ''} onChange={year => update({ year })} options={years} error={Boolean(error)} width={132} columns={1} />
        <DateSelect label="月" value={parsed.month || ''} onChange={month => update({ month })} options={months} error={Boolean(error)} format={pad} width={100} columns={3} />
        <DateSelect label="日" value={parsed.day || ''} onChange={day => update({ day })} options={days} error={Boolean(error)} format={pad} width={100} columns={3} />
      </Stack>
      {showHelper && (
        <FormHelperText error={Boolean(error)} sx={{ mx: 0, color: error ? undefined : PORTRA_SURFACE.muted }}>
          {error || (value ? value : helperText)}
        </FormHelperText>
      )}
    </Stack>
  )
}

function DateSelect({ label, value, onChange, options, error, width, columns, format = value => value }) {
  return (
    <PortraCompactSelect
      label={label}
      value={value}
      options={options}
      onChange={value => onChange(Number(value))}
      error={error}
      width={width}
      columns={columns}
      format={format}
    />
  )
}

function parseDateValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return { year: '', month: '', day: '' }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  }
}

function normalizeDateParts(parts, minYear, maxYear) {
  if (!parts.year || !parts.month || !parts.day) return parts
  const year = Math.min(maxYear, Math.max(minYear, parts.year))
  const month = Math.min(12, Math.max(1, parts.month))
  const day = Math.min(getDaysInMonth(year, month), Math.max(1, parts.day))
  return { year, month, day }
}

function getFallbackDateParts(minYear, maxYear) {
  const today = new Date()
  const year = Math.min(maxYear, Math.max(minYear, today.getFullYear()))
  return {
    year,
    month: today.getMonth() + 1,
    day: Math.min(today.getDate(), getDaysInMonth(year, today.getMonth() + 1))
  }
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function buildNumberRange(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function pad(value) {
  return String(value).padStart(2, '0')
}
