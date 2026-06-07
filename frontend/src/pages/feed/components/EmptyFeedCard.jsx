import { Paper } from '@mui/material'

export function EmptyFeedCard({ text }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
      {text}
    </Paper>
  )
}
