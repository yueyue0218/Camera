import { Paper, Rating, Stack, Typography } from '@mui/material'
import { directionLabel, formatTime } from '../utils/profileUtils.js'
import { EmptyCard } from './EmptyCard.jsx'

export function ReviewList({ reviews, emptyText = '暂无历史评价' }) {
  return reviews.length ? (
    <Stack spacing={1.2}>
      {reviews.map(review => (
        <Paper key={review.reviewId || `${review.orderId}-${review.direction}-${review.createdAt}`} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
          <Stack spacing={0.8}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Typography fontWeight={800}>{directionLabel(review.direction)} · 订单 {review.orderId}</Typography>
              <Typography color="text.secondary" variant="body2">{formatTime(review.createdAt)}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Rating value={Number(review.rating || 0)} readOnly size="small" />
              <Typography fontWeight={800}>{Number(review.rating || 0).toFixed(1)}</Typography>
            </Stack>
            <Typography>{review.content || '对方没有留下文字评价'}</Typography>
            <Typography color="text.secondary" variant="body2">
              评价人 {review.reviewerId} · 被评价人 {review.targetUserId}
            </Typography>
          </Stack>
        </Paper>
      ))}
    </Stack>
  ) : <EmptyCard text={emptyText} />
}
