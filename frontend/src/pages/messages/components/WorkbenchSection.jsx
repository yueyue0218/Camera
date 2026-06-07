import { Box, Stack, Typography } from '@mui/material'
import { PORTRA_COLORS } from '../MessageVisualTokens.js'

export function WorkbenchSection({ title, action, children, divided = true }) {
  return (
    <Box sx={{ pt: divided ? 1.25 : 0, borderTop: divided ? `1px solid ${PORTRA_COLORS.borderMuted}` : 'none' }}>
      <Stack spacing={0.8}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: PORTRA_COLORS.faintInk, fontWeight: 900 }}>
            {title}
          </Typography>
          {action}
        </Stack>
        {children}
      </Stack>
    </Box>
  )
}
