import { Box } from '@mui/material'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { ConversationMessageRow } from './ConversationMessageRow.jsx'

export function ConversationEventFrame({
  self = false,
  actor,
  accent = PORTRA_SURFACE.portraBlue,
  dataKind = 'event',
  fallbackText,
  children
}) {
  return (
    <ConversationMessageRow
      direction={self ? 'self' : 'peer'}
      actor={actor}
      variant="event"
      accent={accent}
      dataKind={dataKind}
      fallbackText={fallbackText || (self ? '我' : '对')}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0
        }}
      >
        {children}
      </Box>
    </ConversationMessageRow>
  )
}

export function conversationEventSurfaceSx({ self = false, accent = PORTRA_SURFACE.portraBlue } = {}) {
  return {
    width: '100%',
    maxWidth: '100%',
    bgcolor: '#fffaf2',
    borderColor: self ? 'rgba(29, 78, 216, .16)' : 'rgba(79, 70, 60, .12)',
    borderRadius: '18px',
    boxShadow: '0 8px 22px rgba(43, 35, 24, .07)',
    '&::before': {
      inset: self ? '0 0 0 auto' : '0 auto 0 0',
      width: 3,
      bgcolor: accent
    },
    '&::after': { display: 'none' },
    '&:hover': {
      transform: 'none',
      boxShadow: '0 10px 24px rgba(43, 35, 24, .085)',
      borderColor: self ? 'rgba(29, 78, 216, .22)' : 'rgba(79, 70, 60, .16)'
    }
  }
}
