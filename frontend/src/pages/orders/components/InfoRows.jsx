import { Box, Typography } from '@mui/material'

export function InfoRows({ rows }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px 1fr' }, gap: 1.2 }}>
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: 'contents' }}>
          <Typography color="text.secondary">{label}</Typography>
          <Typography>{value}</Typography>
        </Box>
      ))}
    </Box>
  )
}
