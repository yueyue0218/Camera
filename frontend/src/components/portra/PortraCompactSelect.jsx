import { useId, useState } from 'react'
import { Box, ButtonBase, Popover, Typography } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export function PortraCompactSelect({
  label,
  value,
  options = [],
  onChange,
  error = false,
  width = 120,
  columns = 3,
  format = option => option,
  getValue = option => option,
  getLabel = option => format(option)
}) {
  const labelId = useId()
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const selected = options.find(option => String(getValue(option)) === String(value))
  const displayValue = selected ? getLabel(selected) : ''

  const close = () => setAnchorEl(null)
  const choose = option => {
    onChange?.(getValue(option))
    close()
  }

  return (
    <>
      <ButtonBase
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : undefined}
        onClick={event => setAnchorEl(event.currentTarget)}
        sx={{
          width,
          minWidth: width,
          height: 46,
          px: 1.15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.8,
          borderRadius: PORTRA_RADIUS.control,
          border: `1px solid ${error ? '#d64545' : PORTRA_SURFACE.borderSubtle}`,
          bgcolor: PORTRA_SURFACE.paper,
          color: PORTRA_SURFACE.ink,
          textAlign: 'left',
          boxShadow: open ? '0 0 0 3px rgba(13,47,178,.12)' : 'none',
          '&:hover': {
            borderColor: error ? '#d64545' : PORTRA_SURFACE.portraBlue
          }
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={labelId} sx={{ color: PORTRA_SURFACE.muted, fontSize: 11, fontWeight: 800, lineHeight: 1 }}>
            {label}
          </Typography>
          <Typography noWrap sx={{ mt: 0.25, color: PORTRA_SURFACE.ink, fontSize: 15, fontWeight: 900, lineHeight: 1.2 }}>
            {displayValue || '--'}
          </Typography>
        </Box>
        <ExpandMoreRoundedIcon sx={{ color: PORTRA_SURFACE.muted, fontSize: 18, transform: open ? 'rotate(180deg)' : 'none' }} />
      </ButtonBase>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              width,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 252,
              p: 0.75,
              borderRadius: '16px',
              bgcolor: '#f8f3eb',
              border: '1px solid rgba(21,19,24,.12)',
              boxShadow: '0 18px 45px rgba(21,19,24,.16)',
              overflowY: 'auto'
            }
          }
        }}
      >
        <Box role="listbox" sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 0.45 }}>
          {options.map(option => {
            const optionValue = getValue(option)
            const selectedOption = String(optionValue) === String(value)
            return (
              <ButtonBase
                key={optionValue}
                role="option"
                aria-selected={selectedOption}
                onClick={() => choose(option)}
                sx={{
                  minHeight: 36,
                  px: 0.65,
                  borderRadius: '10px',
                  color: selectedOption ? PORTRA_SURFACE.portraBlue : PORTRA_SURFACE.ink,
                  bgcolor: selectedOption ? 'rgba(13,47,178,.1)' : 'transparent',
                  fontSize: 15,
                  fontWeight: selectedOption ? 950 : 800,
                  '&:hover': {
                    bgcolor: selectedOption ? 'rgba(13,47,178,.14)' : 'rgba(21,19,24,.06)'
                  }
                }}
              >
                {getLabel(option)}
              </ButtonBase>
            )
          })}
        </Box>
      </Popover>
    </>
  )
}
