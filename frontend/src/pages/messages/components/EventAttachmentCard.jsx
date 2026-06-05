import { Avatar, Box, Paper, Stack, Typography } from '@mui/material'
import { PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'

export function EventAttachmentCard({ side, actor, title, summary, timestamp, children, actions, onOpenUserProfile }) {
  const provider = actor?.role === 'PROVIDER'
  const self = side === 'self'
  const accent = provider ? PORTRA_COLORS.blue : PORTRA_COLORS.orange
  const canOpenProfile = Boolean(actor?.userId && typeof onOpenUserProfile === 'function')
  const openProfile = event => {
    event.stopPropagation()
    if (canOpenProfile) {
      onOpenUserProfile(actor.userId, event)
      return
    }
    console.debug('[messages] event actor missing userId', { title, actor })
  }
  const avatarSx = {
    width: 32,
    height: 32,
    mt: 0.25,
    flexShrink: 0,
    bgcolor: accent,
    color: PORTRA_COLORS.paper,
    fontSize: 13,
    fontWeight: 950,
    cursor: canOpenProfile ? 'pointer' : 'default'
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: self ? 'flex-end' : 'flex-start' }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'flex-start',
          maxWidth: { xs: '100%', md: 'min(72%, 608px)' },
          flexDirection: self ? 'row-reverse' : 'row'
        }}
      >
        <Avatar
          data-message-avatar="event"
          data-avatar-user-id={actor?.userId || ''}
          src={actor?.avatarData || undefined}
          onClick={openProfile}
          sx={avatarSx}
        >
          {actor?.avatarText || '对'}
        </Avatar>
        <Paper
          variant="outlined"
          sx={{
            width: { xs: 'min(100%, 520px)', md: 'clamp(460px, 58vw, 560px)' },
            maxWidth: '100%',
            px: 1.45,
            py: 1.2,
            bgcolor: PORTRA_COLORS.paper,
            borderColor: PORTRA_COLORS.border,
            borderTop: `3px solid ${accent}`,
            borderRadius: self ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
            boxShadow: PORTRA_SHADOWS.subtle
          }}
        >
          <Stack spacing={0.8}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ color: PORTRA_COLORS.ink, fontWeight: 900, lineHeight: 1.4 }}>{title}</Typography>
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
