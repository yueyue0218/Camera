import { Box, Paper, Stack, Typography } from '@mui/material'
import { ORDER_WORKFLOW_COLORS } from '../orderWorkflowTokens.js'

export function OrderTimelineCard({ items = [] }) {
  return (
    <Paper variant="outlined" sx={cardSx}>
      <Stack spacing={2}>
        <Typography sx={{ color: ORDER_WORKFLOW_COLORS.faint, fontWeight: 950 }}>订单进度</Typography>
        <Stack spacing={0}>
          {items.map((item, index) => (
            <Box
              key={item.id || item.title}
              sx={timelineItemSx}
            >
              <Box sx={dotSx(item.state)} />
              {index < items.length - 1 ? <Box sx={lineSx(item.state)} /> : null}
              <Box sx={contentSx(index < items.length - 1)}>
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
  bgcolor: ORDER_WORKFLOW_COLORS.paper,
  borderColor: ORDER_WORKFLOW_COLORS.border,
  borderRadius: '22px',
  boxShadow: 'none'
}

const timelineItemSx = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '20px minmax(0, 1fr)',
  columnGap: 1.25,
  minHeight: 50,
  background: 'none',
  backgroundColor: 'transparent',
  boxShadow: 'none',
  border: 0,
  '&::before': { display: 'none' },
  '&::after': { display: 'none' }
}

function contentSx(hasNext) {
  return {
    minWidth: 0,
    pb: hasNext ? 1.45 : 0,
    background: 'none',
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    border: 0,
    borderRadius: 0,
    boxShadow: 'none'
  }
}

function dotSx(state) {
  return {
    width: 12,
    height: 12,
    mt: 0.48,
    ml: 0.45,
    borderRadius: '50%',
    bgcolor: state === 'current'
      ? ORDER_WORKFLOW_COLORS.warning
      : state === 'upcoming'
        ? ORDER_WORKFLOW_COLORS.upcoming
        : ORDER_WORKFLOW_COLORS.timelineComplete,
    zIndex: 1
  }
}

function lineSx(state) {
  return {
    position: 'absolute',
    left: 9.5,
    top: 18,
    bottom: 0,
    width: 1,
    background: 'none',
    borderLeft: `1px solid ${state === 'upcoming' ? ORDER_WORKFLOW_COLORS.timelineUpcomingLine : ORDER_WORKFLOW_COLORS.timelineCompleteLine}`
  }
}

function timelineTitleSx(state) {
  return {
    color: state === 'current'
      ? ORDER_WORKFLOW_COLORS.warning
      : state === 'upcoming'
        ? ORDER_WORKFLOW_COLORS.faint
        : ORDER_WORKFLOW_COLORS.ink,
    fontWeight: 950,
    fontSize: 16,
    lineHeight: 1.35,
    minWidth: 0
  }
}

function timelineTimeSx(state) {
  return {
    mt: 0.2,
    color: state === 'current' ? ORDER_WORKFLOW_COLORS.warning : ORDER_WORKFLOW_COLORS.faint,
    fontSize: 14
  }
}

const currentTagSx = {
  px: 0.65,
  py: 0.22,
  borderRadius: 999,
  bgcolor: ORDER_WORKFLOW_COLORS.warningSoft,
  color: ORDER_WORKFLOW_COLORS.warning,
  fontSize: 12,
  fontWeight: 900,
  flexShrink: 0
}
