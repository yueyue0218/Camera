import { Chip, Rating, Stack, Typography } from '@mui/material'
import StarRoundedIcon from '@mui/icons-material/StarRounded'

export function ProfileMetrics({ stats, compact = false }) {
  const rating = stats?.rating
  const completionRate = stats?.completionRate
  return (
    <Stack spacing={0.8} alignItems={compact ? 'center' : 'flex-start'} sx={{ minWidth: compact ? 120 : 0 }}>
      <Stack direction="row" spacing={0.7} alignItems="center">
        <StarRoundedIcon fontSize="small" color="warning" />
        <Typography fontWeight={800}>
          {rating ? rating.toFixed(1) : '暂无评分'}
        </Typography>
      </Stack>
      {rating ? (
        <Rating value={rating} precision={0.1} readOnly size="small" />
      ) : (
        <Typography color="text.secondary" variant="body2">等待首条评价</Typography>
      )}
      <Chip
        size="small"
        color={completionRate === null ? 'default' : completionRate >= 80 ? 'success' : 'warning'}
        label={`完成率 ${completionRate === null ? '暂无' : `${completionRate}%`}`}
      />
    </Stack>
  )
}
