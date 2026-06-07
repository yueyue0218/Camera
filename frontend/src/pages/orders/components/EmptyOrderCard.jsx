import { Paper } from '@mui/material'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function EmptyOrderCard({ text }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        textAlign: 'center',
        color: PORTRA_SURFACE.muted,
        bgcolor: PORTRA_SURFACE.paper,
        borderColor: PORTRA_SURFACE.borderSoft,
        borderRadius: PORTRA_RADIUS.panel
      }}
    >
      {text}
    </Paper>
  )
}
