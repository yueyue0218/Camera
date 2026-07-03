import { Box, Stack } from '@mui/material'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'

export function ConversationEventFrame({
  self = false,
  actor,
  accent = PORTRA_SURFACE.portraBlue,
  dataKind = 'event',
  fallbackText,
  children
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: self ? 'flex-end' : 'flex-start', px: { xs: 0.25, sm: 0.5 } }}>
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          alignItems: 'flex-start',
          maxWidth: { xs: '100%', md: 'min(82%, 488px)' },
          width: { xs: '100%', sm: 'auto' },
          flexDirection: self ? 'row-reverse' : 'row'
        }}
      >
        <MessageActorAvatar
          actor={actor}
          dataKind={dataKind}
          accent={accent}
          fallbackText={fallbackText || (self ? '我' : '对')}
          sx={{ mt: 0.35, fontWeight: 950, flexShrink: 0 }}
        />
        <Box sx={{ width: { xs: 'min(calc(100vw - 104px), 420px)', sm: 420 }, maxWidth: '100%', minWidth: 0 }}>
          {children}
        </Box>
      </Stack>
    </Box>
  )
}

export function conversationEventSurfaceSx({ self = false, accent = PORTRA_SURFACE.portraBlue } = {}) {
  return {
    width: '100%',
    maxWidth: 420,
    bgcolor: self ? 'rgba(239, 243, 255, .88)' : '#fffaf2',
    borderColor: self ? 'rgba(29, 78, 216, .24)' : 'rgba(79, 70, 60, .12)',
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
      borderColor: self ? 'rgba(29, 78, 216, .30)' : 'rgba(79, 70, 60, .16)'
    }
  }
}
