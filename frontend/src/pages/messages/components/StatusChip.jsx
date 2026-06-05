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
    return { bg: PORTRA_COLORS.blueSoft, strongBg: PORTRA_COLORS.blue, color: PORTRA_COLORS.blue, strongColor: PORTRA_COLORS.paper, border: PORTRA_COLORS.blue }
  }
  if (/等待|待|返修|轮到我|付款/.test(label)) {
    return { bg: PORTRA_COLORS.yellowSoft, strongBg: PORTRA_COLORS.yellow, color: PORTRA_COLORS.ink, strongColor: PORTRA_COLORS.ink, border: PORTRA_COLORS.yellow }
  }
  if (/取消|退款|拒绝|争议|平台协助/.test(label)) {
    return { bg: PORTRA_COLORS.orangeSoft, strongBg: PORTRA_COLORS.orange, color: PORTRA_COLORS.orange, strongColor: PORTRA_COLORS.paper, border: PORTRA_COLORS.orange }
  }
  return { bg: PORTRA_COLORS.paperMuted, strongBg: PORTRA_COLORS.subInk, color: PORTRA_COLORS.subInk, strongColor: PORTRA_COLORS.paper, border: PORTRA_COLORS.border }
}
