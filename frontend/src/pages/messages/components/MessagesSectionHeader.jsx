import { Box, Stack, Typography } from '@mui/material'
import { PORTRA_COLORS } from '../MessageVisualTokens.js'

export function MessagesSectionHeader({ title, subtitle }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-end" spacing={2} sx={{ pt: 0.5, pb: 1 }}>
      <Box>
        <Typography variant="h4" sx={{ fontSize: 28, fontWeight: 950, color: PORTRA_COLORS.ink }}>{title}</Typography>
        <Typography sx={{ mt: 0.4, color: PORTRA_COLORS.mutedInk, fontSize: 14 }}>{subtitle}</Typography>
      </Box>
      <Box sx={{ width: 46, height: 5, bgcolor: PORTRA_COLORS.yellow }} />
    </Stack>
  )
}
