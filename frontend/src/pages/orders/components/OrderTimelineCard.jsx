import { Box, Paper, Stack, Typography } from '@mui/material'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function OrderTimelineCard({ items = [] }) {
  return (
    <Paper variant="outlined" sx={cardSx}>
      <Stack spacing={2}>
        <Typography sx={{ color: PORTRA_SURFACE.faint, fontWeight: 950 }}>订单进度</Typography>
        <Stack spacing={0}>
          {items.map((item, index) => (
            <Box key={item.id || item.title} sx={timelineItemSx}>
              <Box sx={dotSx(item.state)} />
              {index < items.length - 1 ? <Box sx={lineSx(item.state)} /> : null}
              <Box sx={{ minWidth: 0, pb: index < items.length - 1 ? 2.1 : 0 }}>
                <Typography sx={{
                  color: item.state === 'current' ? PORTRA_SURFACE.warmOrange : item.state === 'upcoming' ? PORTRA_SURFACE.faint : PORTRA_SURFACE.ink,
                  fontWeight: 950,
                  fontSize: 17,
                  lineHeight: 1.35
                }}>
                  {item.title}
                </Typography>
                <Typography sx={{ mt: 0.25, color: item.state === 'current' ? PORTRA_SURFACE.warmOrange : PORTRA_SURFACE.faint }}>
                  {item.time || '—'}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Paper>
  )
}

const cardSx = {
  p: { xs: 2.3, md: 3 },
  bgcolor: '#fff',
  borderColor: 'rgba(133, 148, 173, .16)',
  borderRadius: '22px',
  boxShadow: 'none'
}

const timelineItemSx = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr)',
  columnGap: 1.5
}

function dotSx(state) {
  return {
    width: 12,
    height: 12,
    mt: 0.48,
    ml: 0.55,
    borderRadius: '50%',
    bgcolor: state === 'current' ? PORTRA_SURFACE.warmOrange : state === 'upcoming' ? '#d6dfed' : '#3f7fdb',
    zIndex: 1
  }
}

function lineSx(state) {
  return {
    position: 'absolute',
    left: 10.5,
    top: 18,
    bottom: 0,
    width: 1,
    bgcolor: state === 'upcoming' ? '#e3e9f2' : '#d7e4f8'
  }
}
