import { Box, Typography } from '@mui/material'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function InfoRows({ rows }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '112px 1fr' }, columnGap: 1.4, rowGap: 1.1 }}>
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: 'contents' }}>
          <Typography sx={{ color: PORTRA_SURFACE.faint, fontSize: 12, fontWeight: 750 }}>{label}</Typography>
          <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 13.5, fontWeight: 700 }}>{value}</Typography>
        </Box>
      ))}
    </Box>
  )
}
