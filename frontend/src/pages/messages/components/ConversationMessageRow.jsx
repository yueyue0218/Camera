import { Box, Stack } from '@mui/material'
import { PORTRA_COLORS } from '../MessageVisualTokens.js'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'

export function ConversationMessageRow({
  direction = 'peer',
  actor,
  variant = 'message',
  accent = PORTRA_COLORS.subInk,
  dataKind = 'message',
  fallbackText,
  children
}) {
  const self = direction === 'self'
  const system = direction === 'system'
  if (system || !actor) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', py: 0.35 }}>
        <Box sx={contentSx('system', false)}>{children}</Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: self ? 'flex-end' : 'flex-start', width: '100%', py: variant === 'event' ? 0.45 : 0.15 }}>
      <Stack
        direction="row"
        spacing={1.35}
        sx={{
          alignItems: 'flex-start',
          flexDirection: self ? 'row-reverse' : 'row',
          maxWidth: '100%',
          minWidth: 0
        }}
      >
        <MessageActorAvatar
          actor={actor}
          dataKind={dataKind}
          accent={accent}
          fallbackText={fallbackText || (self ? '我' : '对')}
          sx={{ width: 40, height: 40, mt: 0, fontWeight: 950 }}
        />
        <Box sx={contentSx(variant, self)}>
          {children}
        </Box>
      </Stack>
    </Box>
  )
}

function contentSx(variant, self) {
  if (variant === 'system') {
    return {
      width: '100%',
      maxWidth: 620,
      minWidth: 0
    }
  }

  if (variant === 'event') {
    return {
      width: { xs: 'min(calc(100vw - 108px), 100%)', sm: 'min(620px, calc(100vw - 136px))' },
      maxWidth: '100%',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: self ? 'flex-end' : 'flex-start'
    }
  }

  return {
    width: 'fit-content',
    maxWidth: { xs: 'min(calc(100vw - 108px), 72vw)', md: 'min(68%, 620px)' },
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: self ? 'flex-end' : 'flex-start'
  }
}
