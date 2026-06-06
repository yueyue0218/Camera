import { FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export function PortraDateField({
  label,
  value,
  onChange,
  error = '',
  required = false,
  minYear = new Date().getFullYear() - 1,
  maxYear = new Date().getFullYear() + 3,
  helperText = '请选择日期'
}) {
  const parsed = parseDateValue(value)
  const years = buildNumberRange(minYear, maxYear)
  const months = buildNumberRange(1, 12)
  const days = buildNumberRange(1, getDaysInMonth(parsed.year || minYear, parsed.month || 1))

  const update = next => {
    const year = next.year || parsed.year
    const month = next.month || parsed.month
    const day = next.day || parsed.day
    if (!year || !month || !day) {
      onChange('')
      return
    }
    const maxDay = getDaysInMonth(year, month)
    onChange(`${year}-${pad(month)}-${pad(Math.min(day, maxDay))}`)
  }

  return (
    <Stack spacing={0.65}>
      <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 13, fontWeight: 850 }}>
        {label}{required ? ' *' : ''}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
        <DateSelect label="年" value={parsed.year || ''} onChange={year => update({ year })} options={years} error={Boolean(error)} />
        <DateSelect label="月" value={parsed.month || ''} onChange={month => update({ month })} options={months} error={Boolean(error)} format={pad} />
        <DateSelect label="日" value={parsed.day || ''} onChange={day => update({ day })} options={days} error={Boolean(error)} format={pad} />
      </Stack>
      <FormHelperText error={Boolean(error)} sx={{ mx: 0, color: error ? undefined : PORTRA_SURFACE.muted }}>
        {error || (value ? value : helperText)}
      </FormHelperText>
    </Stack>
  )
}

function DateSelect({ label, value, onChange, options, error, format = value => value }) {
  return (
    <FormControl size="small" sx={selectSx} error={error}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={event => onChange(Number(event.target.value))}>
        {options.map(option => (
          <MenuItem key={option} value={option}>{format(option)}</MenuItem>
        ))}
      </Select>
    </FormControl>
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

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function buildNumberRange(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

const selectSx = {
  flex: 1,
  minWidth: 88,
  '& .MuiOutlinedInput-root': {
    bgcolor: PORTRA_SURFACE.paper,
    borderRadius: PORTRA_RADIUS.control,
    '&.Mui-focused fieldset': {
      borderColor: PORTRA_SURFACE.portraBlue,
      boxShadow: '0 0 0 3px rgba(13,47,178,.12)'
    }
  }
}
