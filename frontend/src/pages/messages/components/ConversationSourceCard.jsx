import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { InfoRows } from './InfoRows.jsx'

export function ConversationSourceCard({ isBackendConversation, currentUser, sourceRows, sourceHint }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, bgcolor: '#fbfdff' }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h6">会话工作台</Typography>
            <Typography color="text.secondary">这里承载沟通、报价、订单入口和后续履约协作，不是普通私聊。</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" color={isBackendConversation ? 'primary' : 'default'} label={isBackendConversation ? '真实 C 会话' : '本地 fallback 会话'} />
            <Chip size="small" label={currentUser.role === 'PROVIDER' ? '当前身份：服务方' : '当前身份：顾客'} />
          </Stack>
        </Stack>
        <InfoRows rows={sourceRows} />
        <Alert severity="info">{sourceHint}</Alert>
      </Stack>
    </Paper>
  )
}
