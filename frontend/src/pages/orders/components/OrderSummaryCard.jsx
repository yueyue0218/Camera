import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function OrderSummaryCard({
  title,
  amountText,
  metaText,
  badgeText,
  rows = []
}) {
  return (
    <Paper variant="outlined" sx={cardSx}>
      <Stack spacing={2.25}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: { xs: 22, md: 24 }, fontWeight: 950, lineHeight: 1.25 }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 0.75, color: PORTRA_SURFACE.faint, fontWeight: 750 }}>
              {metaText}
            </Typography>
          </Box>
          <Stack spacing={1} sx={{ alignItems: { xs: 'flex-start', sm: 'flex-end' }, flexShrink: 0 }}>
            <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: { xs: 28, md: 31 }, fontWeight: 950, lineHeight: 1 }}>
              {amountText}
            </Typography>
            {badgeText ? (
              <Chip
                size="small"
                icon={<CameraAltRoundedIcon />}
                label={badgeText}
                sx={{
                  bgcolor: PORTRA_SURFACE.portraBlueSoft,
                  color: PORTRA_SURFACE.portraBlue,
                  fontWeight: 900,
                  '& .MuiChip-icon': { color: PORTRA_SURFACE.portraBlue }
                }}
              />
            ) : null}
          </Stack>
        </Stack>
        <Divider sx={{ borderColor: PORTRA_SURFACE.borderSoft }} />
        <Box sx={infoGridSx}>
          {rows.map(row => (
            <Box key={row.label} sx={{ minWidth: 0 }}>
              <Typography sx={{ color: PORTRA_SURFACE.faint, fontSize: 13, fontWeight: 850 }}>
                {row.label}
              </Typography>
              <Typography sx={{ mt: 0.45, color: row.tone === 'warning' ? PORTRA_SURFACE.warmOrange : PORTRA_SURFACE.ink, fontSize: 18, fontWeight: 900, lineHeight: 1.35 }}>
                {row.value || '暂无'}
              </Typography>
            </Box>
          ))}
        </Box>
      </Stack>
    </Paper>
  )
}

const cardSx = {
  p: { xs: 2.3, md: 3 },
  bgcolor: '#fffdf8',
  borderColor: 'rgba(79, 70, 60, .10)',
  borderRadius: '22px',
  boxShadow: 'none'
}

const infoGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  columnGap: 5,
  rowGap: 2
}
