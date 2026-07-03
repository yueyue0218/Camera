import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

const iconMap = {
  delivery: <CollectionsRoundedIcon />,
  authorization: <ImageRoundedIcon />,
  review: <RateReviewRoundedIcon />,
  complaint: <GavelRoundedIcon />
}

export function OrderFollowupCards({ items = [] }) {
  if (!items.length) return null

  return (
    <Paper variant="outlined" sx={sectionSx}>
      <Stack spacing={1.8}>
        <Box>
          <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 18, fontWeight: 950 }}>
            后续事项
          </Typography>
        </Box>

        <Box sx={gridSx}>
          {items.map(item => (
            <Paper key={item.key} variant="outlined" sx={cardSx}>
              <Stack spacing={1.1} sx={{ height: '100%' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
                    <Box sx={iconSx(item.tone)}>{item.icon || iconMap[item.kind] || iconMap.delivery}</Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950, lineHeight: 1.35 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.25, color: PORTRA_SURFACE.muted, lineHeight: 1.55 }}>
                        {item.description}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={statusSx(item.tone)}>{item.status}</Box>
                </Stack>

                <Stack direction="row" spacing={0.8} sx={{ mt: 'auto', flexWrap: 'wrap', rowGap: 0.8 }}>
                  {item.primaryAction ? (
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<ArrowForwardRoundedIcon />}
                      onClick={item.primaryAction.onClick}
                      disabled={item.primaryAction.disabled}
                      sx={actionSx}
                    >
                      {item.primaryAction.label}
                    </Button>
                  ) : null}
                  {item.secondaryAction ? (
                    <Button
                      size="small"
                      color="inherit"
                      variant="text"
                      onClick={item.secondaryAction.onClick}
                      disabled={item.secondaryAction.disabled}
                      sx={secondaryActionSx}
                    >
                      {item.secondaryAction.label}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Stack>
    </Paper>
  )
}

const sectionSx = {
  p: { xs: 2.1, md: 2.6 },
  bgcolor: '#fffcf6',
  borderColor: 'rgba(79, 70, 60, .10)',
  borderRadius: '22px',
  boxShadow: 'none'
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
  gap: 1
}

const cardSx = {
  p: 1.35,
  minHeight: 150,
  bgcolor: '#fff8ee',
  borderColor: 'rgba(79, 70, 60, .09)',
  borderRadius: '18px',
  boxShadow: 'none'
}

function iconSx(tone) {
  return {
    width: 38,
    height: 38,
    borderRadius: '13px',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    bgcolor: tone === 'warning' ? '#fff4e5' : tone === 'success' ? '#ecfdf3' : 'rgba(37, 99, 235, .08)',
    color: tone === 'warning' ? '#f97316' : tone === 'success' ? '#16a34a' : '#2563eb',
    '& svg': { fontSize: 21 }
  }
}

function statusSx(tone) {
  return {
    px: 0.85,
    py: 0.35,
    borderRadius: 999,
    flexShrink: 0,
    bgcolor: tone === 'warning' ? '#fff4e5' : tone === 'success' ? '#ecfdf3' : 'rgba(37, 99, 235, .08)',
    color: tone === 'warning' ? '#f97316' : tone === 'success' ? '#16a34a' : '#2563eb',
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1.2
  }
}

const actionSx = {
  minHeight: 34,
  borderRadius: '11px',
  fontWeight: 900,
  borderColor: 'rgba(37, 99, 235, .26)',
  color: '#2563eb'
}

const secondaryActionSx = {
  minHeight: 34,
  borderRadius: '11px',
  fontWeight: 850,
  color: PORTRA_SURFACE.muted
}
