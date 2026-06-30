import { Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { ReviewStarsDisplay } from './ReviewStarsDisplay.jsx'

export function reviewRoleLabel(direction) {
  const value = String(direction || '').trim().toUpperCase()
  if (value === 'CUSTOMER_TO_PROVIDER') return '客户评价摄影师'
  if (value === 'PROVIDER_TO_CUSTOMER') return '摄影师评价客户'
  return '本次约拍评价'
}

export function reviewDisplayName(value) {
  const text = String(value || '').trim()
  return text || 'Portra 用户'
}

export function reviewInitial(value) {
  const text = reviewDisplayName(value)
  return text.slice(0, 1).toUpperCase()
}

export function ReviewArchiveCard({
  review,
  timeText,
  actionLabel = '查看相关评价',
  onAction,
  actionDisabled = false,
  sx
}) {
  const reviewerName = reviewDisplayName(review?.reviewerNickname)
  const targetName = reviewDisplayName(review?.targetUserNickname)
  const roleLabel = reviewRoleLabel(review?.direction)

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.55,
        borderRadius: 3,
        bgcolor: '#fffdf8',
        borderColor: 'rgba(22, 52, 118, .10)',
        boxShadow: '0 8px 20px rgba(28, 38, 64, .045)',
        ...sx
      }}
    >
      <Stack spacing={1.2}>
        <Stack direction="row" spacing={1.1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.2 }}>
          <Stack direction="row" spacing={1.05} sx={{ minWidth: 0, alignItems: 'flex-start' }}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                bgcolor: '#e8f0ff',
                color: '#1d4ed8',
                fontSize: 14,
                fontWeight: 900,
                boxShadow: 'inset 0 0 0 1px rgba(29, 78, 216, .10)'
              }}
            >
              {reviewInitial(reviewerName)}
            </Avatar>
            <Stack spacing={0.45} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.6 }}>
                <Typography sx={{ fontWeight: 900, color: '#1f2937', lineHeight: 1.2 }}>
                  {reviewerName}
                </Typography>
                <Chip
                  size="small"
                  label={roleLabel}
                  sx={{
                    height: 24,
                    borderRadius: 999,
                    fontWeight: 800,
                    bgcolor: 'rgba(29, 78, 216, .08)',
                    color: '#1d4ed8',
                    '& .MuiChip-label': { px: 1.05 }
                  }}
                />
              </Stack>
              <Typography variant="body2" sx={{ color: '#7b8391', lineHeight: 1.35 }}>
                {timeText}
              </Typography>
            </Stack>
          </Stack>

          <ReviewStarsDisplay value={review?.rating} emphasize sx={{ flexShrink: 0, pt: 0.25 }} />
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: 1.15,
            bgcolor: '#fffaf0',
            borderColor: 'rgba(191, 167, 122, .18)',
            borderRadius: 2.4
          }}
        >
          <Typography sx={{ color: '#2a3240', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontWeight: 600 }}>
            {review?.content || '对方没有留下文字评价'}
          </Typography>
        </Paper>

        <Stack direction="row" spacing={1.4} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
          <Box>
            <Typography variant="body2" sx={{ color: '#8a92a0' }}>评价对象</Typography>
            <Typography sx={{ mt: 0.15, color: '#243041', fontWeight: 800 }}>
              {targetName}
            </Typography>
          </Box>
        </Stack>

        {review?.replyContent ? (
          <Paper
            variant="outlined"
            sx={{
              p: 1.05,
              bgcolor: '#f4f8ff',
              borderColor: 'rgba(29, 78, 216, .14)',
              borderRadius: 2.3
            }}
          >
            <Stack spacing={0.45}>
              <Typography sx={{ fontSize: 12, color: '#1d4ed8', fontWeight: 900 }}>
                追加追评
              </Typography>
              <Typography sx={{ color: '#2a3240', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                {review.replyContent}
              </Typography>
              {review.replyTime ? (
                <Typography variant="body2" sx={{ color: '#7b8391' }}>
                  {review.replyTime}
                </Typography>
              ) : null}
            </Stack>
          </Paper>
        ) : null}

        {onAction ? (
          <Button
            variant="text"
            size="small"
            disableElevation
            onClick={() => onAction(review)}
            disabled={actionDisabled}
            sx={{
              alignSelf: 'flex-start',
              minHeight: 30,
              px: 0.35,
              color: '#1d4ed8',
              fontWeight: 900,
              borderRadius: 999,
              '&:hover': { bgcolor: 'rgba(29, 78, 216, .06)' }
            }}
          >
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  )
}
