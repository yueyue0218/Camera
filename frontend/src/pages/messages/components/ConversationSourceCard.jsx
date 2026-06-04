import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { InfoRows } from './InfoRows.jsx'

export function ConversationSourceCard({ isBackendConversation, currentUser, sourceRows, sourceHint }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, bgcolor: '#ebe6dd', borderColor: '#d4ccc2' }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h6">约拍沟通工作台</Typography>
            <Typography color="text.secondary">确认拍摄方案、报价和后续履约安排。</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" color={isBackendConversation ? 'primary' : 'default'} label={isBackendConversation ? '正式沟通' : '先沟通'} />
            <Chip size="small" label={currentUser.role === 'PROVIDER' ? '你是摄影师' : '你是客户'} />
          </Stack>
        </Stack>
        <InfoRows rows={sourceRows} />
        <Alert severity="info">{sourceHint}</Alert>
      </Stack>
    </Paper>
  )
}
