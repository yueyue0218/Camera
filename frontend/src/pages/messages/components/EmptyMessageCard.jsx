import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded'
import { useNavigate } from 'react-router-dom'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'

export function EmptyMessageCard() {
  const navigate = useNavigate()
  return (
    <Paper variant="outlined" sx={{ py: 7, px: 3, textAlign: 'center', bgcolor: PORTRA_COLORS.paper, borderColor: PORTRA_COLORS.borderMuted, boxShadow: 'none' }}>
      <Stack spacing={1.5} alignItems="center">
        <Box sx={{ width: 52, height: 52, display: 'grid', placeItems: 'center', bgcolor: PORTRA_COLORS.yellow, borderRadius: PORTRA_RADII.control, color: PORTRA_COLORS.ink }}>
          <ForumRoundedIcon />
        </Box>
        <Box>
          <Typography fontWeight={900} color={PORTRA_COLORS.ink}>还没有正在沟通的约拍</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>去约拍大厅看看正在招募的拍摄需求</Typography>
        </Box>
        <Button variant="outlined" color="inherit" startIcon={<ExploreRoundedIcon />} onClick={() => navigate('/hall')}>前往约拍大厅</Button>
      </Stack>
    </Paper>
  )
}
