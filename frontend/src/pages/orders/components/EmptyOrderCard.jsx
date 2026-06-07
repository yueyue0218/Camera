import { Paper } from '@mui/material'

export function EmptyOrderCard({ text }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
      {text}
    </Paper>
  )
}
