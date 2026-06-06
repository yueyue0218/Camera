import { FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack } from '@mui/material'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
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
  return (
    <Stack spacing={0.75}>
      <PortraDateField
        label={label}
        value={date}
        onChange={onDateChange}
        error={error}
        required={required}
        minYear={minYear}
        maxYear={maxYear}
        helperText="请选择日期"
      />
      <Stack direction="row" spacing={0.8}>
        <TimeSelect label="小时" value={hour || ''} options={HOUR_OPTIONS} onChange={onHourChange} error={Boolean(error)} />
        <TimeSelect label="分钟" value={minute || ''} options={MINUTE_OPTIONS} onChange={onMinuteChange} error={Boolean(error)} />
      </Stack>
      <FormHelperText sx={{ mx: 0, color: PORTRA_SURFACE.muted }}>
        24 小时制
      </FormHelperText>
    </Stack>
  )
}

function TimeSelect({ label, value, options, onChange, error }) {
  return (
    <FormControl size="small" sx={timeSelectSx} error={error}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => (
          <MenuItem key={option} value={option}>{option}</MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

const timeSelectSx = {
  flex: 1,
  '& .MuiOutlinedInput-root': {
    bgcolor: PORTRA_SURFACE.paper,
    borderRadius: PORTRA_RADIUS.control,
    '&.Mui-focused fieldset': {
      borderColor: PORTRA_SURFACE.portraBlue,
      boxShadow: '0 0 0 3px rgba(13,47,178,.12)'
    }
  }
}
