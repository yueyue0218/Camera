import { Box, Paper, Stack, Typography } from '@mui/material'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function OrderSectionCard({
  title,
  description,
  trailing,
  children
}) {
  return (
    <Paper variant="outlined" sx={sectionCardSx}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', gap: 1.2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950 }}>{title}</Typography>
            {description && (
              <Typography sx={{ mt: 0.25, color: PORTRA_SURFACE.muted, lineHeight: 1.6 }}>
                {description}
              </Typography>
            )}
          </Box>
          {trailing ? (
            <Box sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}>
              {trailing}
            </Box>
          ) : null}
        </Stack>
        {children}
      </Stack>
    </Paper>
  )
}

const sectionCardSx = {
  p: { xs: 2, md: 2.35 },
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSoft,
  borderRadius: PORTRA_RADIUS.panel,
  boxShadow: '0 10px 26px rgba(25, 30, 45, 0.055)'
}
