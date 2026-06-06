import { Box, Stack, Typography } from '@mui/material'
import { PortraTicketCard } from '../../../components/portra/index.js'
import { PORTRA_COLORS } from '../MessageVisualTokens.js'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'

export function EventAttachmentCard({ side, actor, title, summary, timestamp, children, actions }) {
  const provider = actor?.role === 'PROVIDER'
  const self = side === 'self'
  const accent = /拒绝|返修|争议|异常/.test(`${title || ''}${summary || ''}`) ? PORTRA_COLORS.orange : PORTRA_COLORS.blue

  return (
    <Box sx={{ display: 'flex', justifyContent: self ? 'flex-end' : 'flex-start' }}>
      <Stack
        direction="row"
        spacing={1.05}
        sx={{
          alignItems: 'flex-start',
          maxWidth: { xs: '100%', md: 'min(82%, 620px)' },
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
        <PortraTicketCard
          accent={accent}
          sx={{
            width: { xs: 'min(100%, 540px)', md: 'min(560px, 100%)' },
            maxWidth: '100%',
            px: 1.5,
            py: 1.22,
            pl: 2.2,
            bgcolor: PORTRA_COLORS.paper,
            borderColor: PORTRA_COLORS.borderMuted,
            borderRadius: self ? '10px 10px 4px 10px' : '10px 10px 10px 4px',
            boxShadow: '0 2px 12px rgba(21,19,24,.07)',
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
              <Typography sx={{ color: PORTRA_COLORS.ink, fontWeight: 950, lineHeight: 1.38 }}>{title}</Typography>
              <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk, fontSize: 11 }}>{timestamp}</Typography>
            </Stack>
            {summary && <Typography variant="body2" sx={{ color: PORTRA_COLORS.mutedInk, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{summary}</Typography>}
            {children}
            {actions}
          </Stack>
        </PortraTicketCard>
      </Stack>
    </Box>
  )
}
