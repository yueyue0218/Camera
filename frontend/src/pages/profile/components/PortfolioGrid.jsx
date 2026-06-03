import { Box, Paper, Stack, Typography } from '@mui/material'
import { EmptyCard } from './EmptyCard.jsx'

export function PortfolioGrid({ works, emptyText, onOpenMoment }) {
  return works.length ? (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
      {works.map(work => (
        <Paper
          key={work.key}
          variant="outlined"
          sx={{ p: 1, cursor: work.momentId ? 'pointer' : 'default' }}
          onClick={() => work.momentId && onOpenMoment(work.momentId)}
        >
          <Stack spacing={1}>
            <img className="feed-image" src={work.imageData} alt={work.title || '作品图片'} />
            <Typography fontWeight={800}>{work.title || '作品图片'}</Typography>
          </Stack>
        </Paper>
      ))}
    </Box>
  ) : <EmptyCard text={emptyText} />
}
