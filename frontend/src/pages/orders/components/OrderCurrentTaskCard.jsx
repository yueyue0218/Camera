import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

const iconMap = {
  confirm: <CheckCircleRoundedIcon />,
  upload: <CloudUploadRoundedIcon />,
  warning: <WarningAmberRoundedIcon />,
  idle: <InfoRoundedIcon />
}

export function OrderCurrentTaskCard({
  icon = 'idle',
  title,
  subtitle,
  chipLabel,
  chipTone = 'primary',
  children,
  notice,
  deadlineLabel,
  deadlineValue,
  primaryAction,
  secondaryAction
}) {
  return (
    <Paper variant="outlined" sx={cardSx}>
      <Stack spacing={2.1}>
        <Stack direction="row" spacing={1.4} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Stack direction="row" spacing={1.35} sx={{ minWidth: 0 }}>
            <Box sx={iconBoxSx}>{iconMap[icon] || iconMap.idle}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 22, fontWeight: 950, lineHeight: 1.25 }}>
                {title}
              </Typography>
              <Typography sx={{ mt: 0.45, color: PORTRA_SURFACE.muted, lineHeight: 1.55 }}>
                {subtitle}
              </Typography>
            </Box>
          </Stack>
          {chipLabel ? <Chip size="small" label={chipLabel} sx={chipSx(chipTone)} /> : null}
        </Stack>

        {children}

        {deadlineLabel || deadlineValue ? (
          <Box sx={deadlineSx}>
            <Typography sx={{ color: PORTRA_SURFACE.muted, fontWeight: 850 }}>{deadlineLabel}</Typography>
            <Typography sx={{ color: deadlineValue?.includes('逾期') ? PORTRA_SURFACE.warmOrange : PORTRA_SURFACE.warmOrange, fontWeight: 950 }}>
              {deadlineValue}
            </Typography>
          </Box>
        ) : null}

        {notice ? <Box sx={noticeSx}>{notice}</Box> : null}

        {(primaryAction || secondaryAction) ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ pt: 0.4 }}>
            {primaryAction ? (
              <Button
                variant="contained"
                size="large"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                sx={primaryButtonSx}
              >
                {primaryAction.label}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button
                variant="outlined"
                size="large"
                color="inherit"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                sx={secondaryButtonSx}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  )
}

const cardSx = {
  p: { xs: 2.3, md: 3 },
  bgcolor: '#fffcf6',
  borderColor: 'rgba(79, 70, 60, .10)',
  borderRadius: '22px',
  boxShadow: 'none'
}

const iconBoxSx = {
  width: 48,
  height: 48,
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  borderRadius: '14px',
  bgcolor: 'rgba(37, 99, 235, .08)',
  color: '#2563eb'
}

const deadlineSx = {
  px: 1.6,
  py: 1.25,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 1,
  borderRadius: PORTRA_RADIUS.control,
  bgcolor: '#f3efe8'
}

const noticeSx = {
  px: 1.6,
  py: 1.2,
  borderRadius: PORTRA_RADIUS.control,
  bgcolor: '#fff4e5',
  border: '1px solid rgba(249, 115, 22, .18)',
  color: '#9a4b00',
  fontWeight: 750,
  lineHeight: 1.65
}

const primaryButtonSx = {
  minHeight: 52,
  flex: { xs: '1 1 auto', sm: '1 1 0' },
  borderRadius: '14px',
  fontSize: 17,
  fontWeight: 950,
  bgcolor: '#2563eb'
}

const secondaryButtonSx = {
  minHeight: 52,
  minWidth: { sm: 116 },
  borderRadius: '14px',
  fontSize: 16,
  fontWeight: 900,
  borderColor: 'rgba(133, 148, 173, .24)'
}

function chipSx(tone) {
  const danger = tone === 'danger' || tone === 'warning'
  return {
    bgcolor: danger ? '#fff0e8' : '#edf4ff',
    color: danger ? PORTRA_SURFACE.warmOrange : PORTRA_SURFACE.portraBlue,
    fontWeight: 900,
    borderRadius: '999px'
  }
}
