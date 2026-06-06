import { FormHelperText, Stack, Typography } from '@mui/material'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import { PortraCompactSelect } from './PortraCompactSelect.jsx'
import { PortraDateField } from './PortraDateField.jsx'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTE_OPTIONS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

export function PortraDateTimeField({
  label,
  date,
  hour,
  minute,
  onDateChange,
  onHourChange,
  onMinuteChange,
  error = '',
  required = false,
  minYear,
  maxYear
}) {
  const hint = date && hour && minute
    ? `${date} ${pad(hour)}:${pad(minute)} · 24 小时制`
    : '请选择完整时间 · 24 小时制'

  return (
    <Stack spacing={1} sx={dateTimeFieldSx}>
      <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 13, fontWeight: 850 }}>
        {label}{required ? ' *' : ''}
      </Typography>
      <PortraDateField
        label={label}
        value={date}
        onChange={onDateChange}
        error={error}
        required={required}
        minYear={minYear}
        maxYear={maxYear}
        hideLabel
        showHelper={false}
      />
      <Stack direction="row" spacing={0.85} sx={{ flexWrap: 'wrap', rowGap: 0.85 }}>
        <TimeSelect label="小时" value={hour || ''} options={HOUR_OPTIONS} onChange={onHourChange} error={Boolean(error)} />
        <TimeSelect label="分钟" value={minute || ''} options={MINUTE_OPTIONS} onChange={onMinuteChange} error={Boolean(error)} />
      </Stack>
      <FormHelperText error={Boolean(error)} sx={{ mx: 0, color: error ? undefined : PORTRA_SURFACE.muted }}>
        {error || hint}
      </FormHelperText>
    </Stack>
  )
}

function TimeSelect({ label, value, options, onChange, error }) {
  return (
    <PortraCompactSelect
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      error={error}
      width={118}
      columns={label === '小时' ? 4 : 3}
    />
  )
}

function pad(value) {
  return String(value).padStart(2, '0')
}

const dateTimeFieldSx = {
  width: '100%',
  minWidth: 0,
  p: 1.25,
  bgcolor: 'rgba(255,253,249,.78)',
  border: `1px solid ${PORTRA_SURFACE.borderSoft}`,
  borderRadius: PORTRA_RADIUS.control
}
