import { Box, Paper, Stack, Typography } from '@mui/material'
import { PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'

export function EventAttachmentCard({ side, actor, title, summary, timestamp, children, actions }) {
  const provider = actor?.role === 'PROVIDER'
  const self = side === 'self'
  const accent = provider ? PORTRA_COLORS.blue : PORTRA_COLORS.orange

  return (
    <Box sx={{ display: 'flex', justifyContent: self ? 'flex-end' : 'flex-start' }}>
      <Stack
        direction="row"
        spacing={1.05}
        sx={{
          alignItems: 'flex-start',
          maxWidth: { xs: '100%', md: 'min(78%, 640px)' },
          flexDirection: self ? 'row-reverse' : 'row'
        }}
      >
        <MessageActorAvatar
          actor={actor}
          dataKind="event"
          accent={accent}
          fallbackText="对"
          sx={{ mt: 0.25, fontWeight: 950 }}
        />
        <Paper
          variant="outlined"
          sx={{
            width: { xs: 'min(100%, 520px)', md: 'clamp(460px, 54vw, 560px)' },
            maxWidth: '100%',
            px: 1.55,
            py: 1.3,
            bgcolor: PORTRA_COLORS.white,
            borderColor: PORTRA_COLORS.borderMuted,
            borderLeft: `3px solid ${accent}`,
            borderRadius: self ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
            boxShadow: PORTRA_SHADOWS.subtle
          }}
        >
          <Stack spacing={0.85}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography sx={{ color: PORTRA_COLORS.ink, fontWeight: 950, lineHeight: 1.38 }}>{title}</Typography>
              <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk, fontSize: 11 }}>{timestamp}</Typography>
            </Stack>
            {summary && <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk, lineHeight: 1.55 }}>{summary}</Typography>}
            {children}
            {actions}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}
