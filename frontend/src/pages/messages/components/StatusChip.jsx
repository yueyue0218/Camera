import { Chip } from '@mui/material'
import { PORTRA_COLORS, PORTRA_RADII } from '../MessageVisualTokens.js'

export function StatusChip({ label, emphasis = false, size = 'small', sx = {}, ...chipProps }) {
  const tone = getStatusTone(label)
  return (
    <Chip
      size={size}
      label={label}
      {...chipProps}
      sx={{
        height: 24,
        borderRadius: PORTRA_RADII.compact,
        bgcolor: emphasis ? tone.strongBg : tone.bg,
        color: emphasis ? tone.strongColor : tone.color,
        border: `1px solid ${tone.border}`,
        fontWeight: 800,
        '& .MuiChip-label': { px: 1 },
        ...sx
      }}
    />
  )
}

function getStatusTone(label = '') {
  if (/完成|授权|已确认|已支付/.test(label)) {
    return { bg: '#d1fae5', strongBg: PORTRA_COLORS.blue, color: '#065f46', strongColor: PORTRA_COLORS.paper, border: 'rgba(6,95,70,.18)' }
  }
  if (/等待|待|返修|轮到我|付款/.test(label)) {
    return { bg: '#fef3c7', strongBg: PORTRA_COLORS.orange, color: '#92400e', strongColor: '#fff', border: 'rgba(146,64,14,.18)' }
  }
  if (/取消|退款|拒绝|争议|平台协助/.test(label)) {
    return { bg: '#fee2e2', strongBg: PORTRA_COLORS.orange, color: '#991b1b', strongColor: '#fff', border: 'rgba(153,27,27,.18)' }
  }
  return { bg: PORTRA_COLORS.paperMuted, strongBg: PORTRA_COLORS.subInk, color: PORTRA_COLORS.subInk, strongColor: PORTRA_COLORS.paper, border: PORTRA_COLORS.border }
}
