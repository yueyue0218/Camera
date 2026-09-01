import { Stack, Typography } from '@mui/material'
import { PortraTicketCard } from '../../../components/portra/index.js'
import { PORTRA_COLORS } from '../MessageVisualTokens.js'
import { ConversationEventFrame, conversationEventSurfaceSx } from './ConversationEventFrame.jsx'

export function EventAttachmentCard({ side, direction, actor, title, summary, timestamp, children, actions }) {
  const self = (direction || side) === 'self'
  const warning = /拒绝|返修|争议|异常/.test(`${title || ''}${summary || ''}`)
  const accent = self ? PORTRA_COLORS.blue : warning ? PORTRA_COLORS.orange : PORTRA_COLORS.subInk
  const surfaceSx = conversationEventSurfaceSx({ self, accent })

  return (
    <ConversationEventFrame self={self} actor={actor} accent={accent} dataKind="event">
      <PortraTicketCard
        accent={accent}
        sx={{
          px: 1.5,
          py: 1.22,
          pl: 1.75,
          pr: 1.55,
          ...surfaceSx,
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
    </ConversationEventFrame>
  )
}
