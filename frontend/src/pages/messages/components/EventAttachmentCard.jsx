import { Box, Stack, Typography } from '@mui/material'
import { PortraTicketCard } from '../../../components/portra/index.js'
import { PORTRA_COLORS } from '../MessageVisualTokens.js'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'

export function EventAttachmentCard({ side, direction, actor, title, summary, timestamp, children, actions }) {
  const self = (direction || side) === 'self'
  const peer = (direction || side) === 'peer' || side === 'other'
  const warning = /拒绝|返修|争议|异常/.test(`${title || ''}${summary || ''}`)
  const accent = self ? PORTRA_COLORS.blue : warning ? PORTRA_COLORS.orange : PORTRA_COLORS.subInk

  return (
    <Box sx={{ display: 'flex', justifyContent: self ? 'flex-end' : 'flex-start' }}>
      <Stack
        direction="row"
        spacing={1.05}
        sx={{
          alignItems: 'flex-start',
          maxWidth: { xs: '100%', md: 'min(78%, 580px)' },
          flexDirection: self ? 'row-reverse' : 'row'
        }}
      >
        <MessageActorAvatar
          actor={actor}
          dataKind="event"
          accent={accent}
          fallbackText={self ? '我' : '对'}
          sx={{ mt: 0.25, fontWeight: 950 }}
        />
        <PortraTicketCard
          accent={accent}
          sx={{
            width: { xs: 'min(100%, 540px)', md: 'min(560px, 100%)' },
            maxWidth: '100%',
            px: 1.5,
            py: 1.22,
            pl: self ? 1.5 : 2.2,
            pr: self ? 2.2 : 1.5,
            bgcolor: self ? 'rgba(231,235,250,.74)' : PORTRA_COLORS.paper,
            borderColor: self ? 'rgba(13,47,178,.28)' : peer ? 'rgba(248,81,4,.22)' : PORTRA_COLORS.borderMuted,
            borderRadius: self ? '10px 10px 4px 10px' : '10px 10px 10px 4px',
            boxShadow: '0 2px 12px rgba(21,19,24,.07)',
            '&::before': {
              inset: self ? '0 0 0 auto' : '0 auto 0 0',
              width: 4,
              bgcolor: accent
            },
            '& .MuiButton-root': {
              minHeight: 30,
              borderRadius: 999,
              textTransform: 'none',
              fontWeight: 850
            }
          }}
        >
          <Stack spacing={0.78}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography sx={{ color: PORTRA_COLORS.ink, fontSize: 16, fontWeight: 950, lineHeight: 1.38 }}>{title}</Typography>
              <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk, fontSize: 11 }}>{timestamp}</Typography>
            </Stack>
            {summary && <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk, fontSize: 14, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{summary}</Typography>}
            {children}
            {actions}
          </Stack>
        </PortraTicketCard>
      </Stack>
    </Box>
  )
}
