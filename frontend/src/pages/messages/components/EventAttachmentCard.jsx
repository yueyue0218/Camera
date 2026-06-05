import { Box, Paper, Stack, Typography } from '@mui/material'
import { PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'

export function EventAttachmentCard({ side, actorRole, label, title, summary, timestamp, children, actions }) {
  const provider = actorRole === 'PROVIDER'
  const accent = provider ? PORTRA_COLORS.blue : PORTRA_COLORS.orange

  return (
    <Box sx={{ display: 'flex', justifyContent: side === 'self' ? 'flex-end' : 'flex-start' }}>
      <Paper
        variant="outlined"
        sx={{
          width: 'min(78%, 500px)',
          px: 1.4,
          py: 1.2,
          bgcolor: PORTRA_COLORS.paper,
          borderColor: PORTRA_COLORS.border,
          borderLeft: `3px solid ${accent}`,
          borderRadius: PORTRA_RADII.panel,
          boxShadow: PORTRA_SHADOWS.subtle
        }}
      >
        <Stack spacing={0.8}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="caption" sx={{ color: accent, fontWeight: 900 }}>{label}</Typography>
            <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk, fontSize: 11 }}>{timestamp}</Typography>
          </Stack>
          <Typography sx={{ color: PORTRA_COLORS.ink, fontWeight: 900, lineHeight: 1.4 }}>{title}</Typography>
          {summary && <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk, lineHeight: 1.55 }}>{summary}</Typography>}
          {children}
          {actions}
        </Stack>
      </Paper>
    </Box>
  )
}
