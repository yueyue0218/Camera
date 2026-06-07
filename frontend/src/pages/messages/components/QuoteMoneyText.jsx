import { Box } from '@mui/material'

export function QuoteMoneyText({ amountText, sx }) {
  const text = String(amountText || '').trim()
  const match = text.match(/^([¥￥])\s*(.+)$/)
  if (!match) {
    return <Box component="span" sx={sx}>{text || '报价待确认'}</Box>
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '3px',
        lineHeight: 1,
        ...sx
      }}
    >
      <Box component="span" sx={{ fontSize: '0.78em', fontWeight: 900, lineHeight: 1 }}>
        {match[1]}
      </Box>
      <Box component="span" sx={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {match[2]}
      </Box>
    </Box>
  )
}
