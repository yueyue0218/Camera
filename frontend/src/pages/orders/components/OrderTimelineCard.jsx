import { Box, Paper, Stack, Typography } from '@mui/material'

export function OrderTimelineCard({ items = [] }) {
  return (
    <Paper variant="outlined" sx={cardSx}>
      <Stack spacing={2}>
        <Typography sx={{ color: '#9a948a', fontWeight: 950 }}>订单进度</Typography>
        <Stack spacing={0}>
          {items.map((item, index) => (
            <Box
              key={item.id || item.title}
              className={`order-timeline-item order-timeline-item-${item.state || 'upcoming'}`}
              sx={timelineItemSx}
            >
              <Box sx={dotSx(item.state)} />
              {index < items.length - 1 ? <Box sx={lineSx(item.state)} /> : null}
              <Box
                className="order-timeline-copy"
                sx={{
                  minWidth: 0,
                  pb: index < items.length - 1 ? 1.6 : 0,
                  bgcolor: 'transparent !important',
                  backgroundImage: 'none !important',
                  boxShadow: 'none !important'
                }}
              >
                <Stack direction="row" spacing={0.9} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <Typography sx={timelineTitleSx(item.state)}>
                    {item.title}
                  </Typography>
                  {item.state === 'current' && <Box sx={currentTagSx}>当前状态</Box>}
                </Stack>
                <Typography sx={timelineTimeSx(item.state)}>
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
  p: { xs: 2.2, md: 2.7 },
  bgcolor: '#fffcf6',
  borderColor: 'rgba(79, 70, 60, .10)',
  borderRadius: '22px',
  boxShadow: 'none'
}

const timelineItemSx = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr)',
  columnGap: 1.45,
  minHeight: 54,
  bgcolor: 'transparent !important',
  backgroundImage: 'none !important',
  boxShadow: 'none !important',
  '&::before': { display: 'none' },
  '&::after': { display: 'none' }
}

function dotSx(state) {
  return {
    width: 12,
    height: 12,
    mt: 0.48,
    ml: 0.55,
    borderRadius: '50%',
    bgcolor: state === 'current' ? '#f97316' : state === 'upcoming' ? '#d8d2c8' : '#2563eb',
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
    bgcolor: state === 'upcoming' ? 'rgba(154, 148, 138, .22)' : 'rgba(37, 99, 235, .20)'
  }
}

function timelineTitleSx(state) {
  return {
    color: state === 'current' ? '#f97316' : state === 'upcoming' ? '#9a948a' : '#171717',
    fontWeight: 950,
    fontSize: 16,
    lineHeight: 1.35,
    minWidth: 0
  }
}

function timelineTimeSx(state) {
  return {
    mt: 0.2,
    color: state === 'current' ? '#f97316' : '#9a948a',
    fontSize: 14
  }
}

const currentTagSx = {
  px: 0.65,
  py: 0.22,
  borderRadius: 999,
  bgcolor: '#fff4e5',
  color: '#f97316',
  fontSize: 12,
  fontWeight: 900,
  flexShrink: 0
}
