import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { portraTokens } from '../../theme/theme.js'

export const portra = portraTokens

export const panelSx = {
  border: `1px solid ${portraTokens.border}`,
  borderRadius: '20px',
  boxShadow: '0 14px 28px rgba(21, 19, 24, 0.08)',
  backgroundColor: portraTokens.paper
}

export function PageHeader({ eyebrow = 'PORTRA / D-LINE', title, description, action, actions }) {
  const headerAction = action ?? actions
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', md: 'flex-end' }}
      gap={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="overline" sx={{ color: portraTokens.primary, fontWeight: 900, letterSpacing: '0.16em' }}>
          {eyebrow}
        </Typography>
        <Typography variant="h4" sx={{ color: portraTokens.textPrimary, fontWeight: 900 }}>
          {title}
        </Typography>
        {description ? (
          <Typography sx={{ color: portraTokens.textSecondary, mt: 0.75 }}>{description}</Typography>
        ) : null}
      </Box>
      {headerAction ? <Stack direction="row" spacing={1} alignItems="center">{headerAction}</Stack> : null}
    </Stack>
  )
}

export function Feedback({ error, success }) {
  return (
    <>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}
    </>
  )
}

export function Notice({ notice, error, success }) {
  if (notice) {
    const severity = notice.type || 'info'
    return <Alert severity={severity} sx={{ mb: 2 }}>{notice.text}</Alert>
  }
  return <Feedback error={error} success={success} />
}

export function EmptyState({ text, children }) {
  const content = children ?? text
  return (
    <Paper sx={{ ...panelSx, p: 3 }}>
      <Typography sx={{ color: portraTokens.textSecondary }}>{content}</Typography>
    </Paper>
  )
}

export function StatusChip({ value, status }) {
  const currentStatus = value ?? status
  const map = {
    AVAILABLE: { label: '可预约', color: portraTokens.primary, backgroundColor: '#dbe3ff' },
    BOOKED: { label: '已锁定', color: '#fff', backgroundColor: portraTokens.primary },
    UNAVAILABLE: { label: '不可约', color: '#5d6167', backgroundColor: '#dedad6' },
    PENDING: { label: '待处理', color: '#5a4400', backgroundColor: '#fff1a8' },
    PENDING_REVIEW: { label: '待审核', color: '#5a4400', backgroundColor: '#fff1a8' },
    APPROVED: { label: '已通过', color: '#245b2b', backgroundColor: '#ddf4df' },
    REJECTED: { label: '已驳回', color: '#8a2f0e', backgroundColor: '#ffe0d4' },
    RESOLVED: { label: '已完成', color: '#245b2b', backgroundColor: '#ddf4df' },
    PROCESSED: { label: '已处理', color: '#245b2b', backgroundColor: '#ddf4df' },
    CANCELED: { label: '已取消', color: '#5d6167', backgroundColor: '#dedad6' },
    CANCELLED: { label: '已取消', color: '#5d6167', backgroundColor: '#dedad6' }
  }
  const item = map[currentStatus] || { label: currentStatus || '未知', color: '#5d6167', backgroundColor: '#dedad6' }

  return <Chip size="small" label={item.label} sx={{ color: item.color, backgroundColor: item.backgroundColor, fontWeight: 700 }} />
}

export function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

export function toInputDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const pad = item => String(item).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
