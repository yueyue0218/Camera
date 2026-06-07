import { IconButton, Tooltip } from '@mui/material'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'

export function MessageToolbarButton({ title, children, active = false, unavailable = false, ...buttonProps }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          aria-label={title}
          {...buttonProps}
          sx={{
            width: 34,
            height: 34,
            borderRadius: PORTRA_RADII.control,
            color: active ? PORTRA_COLORS.paper : unavailable ? PORTRA_COLORS.faintInk : PORTRA_COLORS.mutedInk,
            bgcolor: active ? PORTRA_COLORS.blue : 'transparent',
            border: active ? `1px solid ${PORTRA_COLORS.blue}` : unavailable ? `1px dashed ${PORTRA_COLORS.border}` : '1px solid transparent',
            opacity: unavailable ? 0.62 : 1,
            '&:hover': {
              bgcolor: active ? PORTRA_COLORS.blueDark : unavailable ? 'transparent' : PORTRA_COLORS.paperMuted,
              borderColor: active ? PORTRA_COLORS.blueDark : PORTRA_COLORS.border
            },
            '&.Mui-disabled': { color: PORTRA_COLORS.faintInk, opacity: 0.45 }
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}
