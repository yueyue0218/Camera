import { Box, Stack, Typography } from '@mui/material'

const FILLED_STAR = '\u2605'
const EMPTY_STAR = '\u2606'

export function ReviewStarsDisplay({
  value,
  size = 'small',
  emphasize = false,
  prefix,
  sx
}) {
  const numeric = Number(value)
  const score = Number.isFinite(numeric) ? Math.max(0, Math.min(5, numeric)) : 0
  const rounded = Math.round(score)
  const stars = `${FILLED_STAR.repeat(rounded)}${EMPTY_STAR.repeat(5 - rounded)}`
  const textSize = size === 'large' ? 16 : 14
  const numberSize = size === 'large' ? 15 : 13

  return (
    <Stack direction="row" spacing={0.9} alignItems="center" sx={sx}>
      {prefix ? (
        <Typography sx={{ fontSize: numberSize, color: 'text.secondary', fontWeight: 700 }}>
          {prefix}
        </Typography>
      ) : null}
      <Box
        component="span"
        aria-label={`评分 ${score.toFixed(1)}`}
        sx={{
          color: emphasize ? '#0d2fb2' : '#1e3a8a',
          fontSize: textSize,
          fontWeight: 900,
          letterSpacing: '0.08em',
          lineHeight: 1
        }}
      >
        {stars}
      </Box>
      <Typography sx={{ fontSize: numberSize, fontWeight: 800, color: 'text.primary' }}>
        {score.toFixed(1)}
      </Typography>
    </Stack>
  )
}
