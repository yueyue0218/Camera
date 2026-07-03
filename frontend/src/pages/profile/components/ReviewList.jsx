import { Chip, Paper, Stack, Typography } from '@mui/material'
import { directionLabel, formatTime } from '../utils/profileUtils.js'
import { EmptyCard } from './EmptyCard.jsx'
import { ReviewStarsDisplay } from '../../../components/reviews/ReviewStarsDisplay.jsx'

export function ReviewList({ reviews, emptyText = '暂无历史评价' }) {
  return reviews.length ? (
    <Stack spacing={1.35}>
      {reviews.map(review => (
        <Paper
          key={review.reviewId || `${review.orderId}-${review.direction}-${review.createdAt}`}
          variant="outlined"
          sx={{
            p: 1.7,
            bgcolor: '#fffdf8',
            borderColor: 'rgba(13,47,178,.12)',
            borderRadius: 3,
            boxShadow: '0 10px 22px rgba(25,30,45,.05)'
          }}
        >
          <Stack spacing={1.15}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography fontWeight={900}>{directionLabel(review.direction)}</Typography>
                <Chip size="small" label={`订单 #${review.orderId || '-'}`} sx={{ height: 24, fontWeight: 800, bgcolor: 'rgba(13,47,178,.08)', color: '#0d2fb2' }} />
              </Stack>
              <Typography color="text.secondary" variant="body2">{formatTime(review.createdAt)}</Typography>
            </Stack>
            <ReviewStarsDisplay value={review.rating} emphasize />
            <Stack spacing={0.45}>
              <Typography variant="body2" color="text.secondary">评价人</Typography>
              <Typography fontWeight={800}>{review.reviewerNickname || 'Portra 用户'}</Typography>
            </Stack>
            <Stack spacing={0.45}>
              <Typography variant="body2" color="text.secondary">被评价人</Typography>
              <Typography fontWeight={800}>{review.targetUserNickname || 'Portra 用户'}</Typography>
            </Stack>
            <Stack spacing={0.45}>
              <Typography variant="body2" color="text.secondary">评价内容</Typography>
              <Typography sx={{ lineHeight: 1.85 }}>{review.content || '对方没有留下文字评价'}</Typography>
            </Stack>
            {review.replyContent ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.2,
                  bgcolor: '#f5f8ff',
                  borderColor: 'rgba(13,47,178,.14)',
                  borderRadius: 2.5
                }}
              >
                <Stack spacing={0.5}>
                  <Typography sx={{ color: '#0d2fb2', fontWeight: 900, fontSize: 13 }}>追加追评</Typography>
                  <Typography sx={{ lineHeight: 1.8 }}>{review.replyContent}</Typography>
                  {review.replyTime ? (
                    <Typography variant="body2" color="text.secondary">{formatTime(review.replyTime)}</Typography>
                  ) : null}
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </Paper>
      ))}
    </Stack>
  ) : <EmptyCard text={emptyText} />
}
