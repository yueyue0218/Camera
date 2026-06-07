import { IconButton, Tooltip } from '@mui/material'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'

export function MessageToolbarButton({ title, children, active = false, ...buttonProps }) {
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
            color: active ? PORTRA_COLORS.paper : PORTRA_COLORS.mutedInk,
            bgcolor: active ? PORTRA_COLORS.blue : 'transparent',
            border: active ? `1px solid ${PORTRA_COLORS.blue}` : '1px solid transparent',
            '&:hover': {
              bgcolor: active ? PORTRA_COLORS.blueDark : PORTRA_COLORS.paperMuted,
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
