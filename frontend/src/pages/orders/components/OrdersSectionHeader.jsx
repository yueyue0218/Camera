import { Stack, Typography } from '@mui/material'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function OrdersSectionHeader({ title, subtitle }) {
  return (
    <Stack spacing={0.65} sx={{ position: 'relative', pb: 0.4 }}>
      <Typography variant="h5" sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950 }}>{title}</Typography>
      <Typography sx={{ color: PORTRA_SURFACE.muted }}>{subtitle}</Typography>
      <Stack sx={{ width: 48, height: 4, borderRadius: 999, bgcolor: PORTRA_SURFACE.portraBlue }} />
    </Stack>
  )
}
