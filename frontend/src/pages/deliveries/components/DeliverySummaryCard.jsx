import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import { DeliveryCoverMosaic } from './DeliveryCoverMosaic.jsx'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function DeliverySummaryCard({
  batch,
  variant = 'order',
  label,
  helper,
  statusLabel,
  timeLabel,
  onOpen,
  disabled = false
}) {
  if (!batch) return null
  const clickable = Boolean(onOpen) && !disabled
  const conversation = variant === 'conversation'
  const countText = formatDeliverySummaryCount(batch)

  if (conversation) {
    return (
      <Paper
        variant="outlined"
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? onOpen : undefined}
        onKeyDown={event => handleKeyboardOpen(event, clickable, onOpen)}
        sx={conversationCardSx(clickable)}
      >
        <Box sx={conversationHeaderSx}>
          <Stack direction="row" spacing={1.1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
            <Box sx={conversationIconSx}>
              <ImageRoundedIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 18, fontWeight: 950, lineHeight: 1.22 }}>
                {label || '作品已上传'}
              </Typography>
              {timeLabel && (
                <Typography variant="body2" sx={{ mt: 0.22, color: PORTRA_SURFACE.muted, fontWeight: 750 }}>
                  {timeLabel}
                </Typography>
              )}
            </Box>
          </Stack>
          <Chip
            size="small"
            label={statusLabel || batch.statusLabel || '待客户确认'}
            sx={conversationChipSx}
          />
        </Box>

        <DeliveryCoverMosaic files={batch.files || []} variant="conversation" />

        <Stack direction="row" spacing={1} sx={conversationFooterSx}>
          <Stack direction="row" spacing={0.65} sx={{ alignItems: 'center', minWidth: 0 }}>
            <CollectionsRoundedIcon sx={{ color: PORTRA_SURFACE.portraBlue, fontSize: 18 }} />
            <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, fontWeight: 850, minWidth: 0 }}>
              {countText}
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            endIcon={<ArrowForwardRoundedIcon />}
            disabled={!clickable}
            onClick={event => {
              event.stopPropagation()
              if (clickable) onOpen()
            }}
            sx={conversationButtonSx}
          >
            查看作品
          </Button>
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper
      variant="outlined"
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={event => handleKeyboardOpen(event, clickable, onOpen)}
      sx={orderCardSx(clickable)}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
        <Box sx={{ width: { xs: '100%', sm: 132 }, flexShrink: 0 }}>
          <DeliveryCoverMosaic files={batch.files || []} variant="order" />
        </Box>
        <Stack spacing={0.45} sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950, lineHeight: 1.35 }}>
            {label || '查看交付作品'}
          </Typography>
          {helper && (
            <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, lineHeight: 1.55 }}>
              {helper}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, lineHeight: 1.55 }}>
            {countText} · 点击查看
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          endIcon={<ArrowForwardRoundedIcon />}
          disabled={!clickable}
          onClick={event => {
            event.stopPropagation()
            if (clickable) onOpen()
          }}
          sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, flexShrink: 0 }}
        >
          查看
        </Button>
      </Stack>
    </Paper>
  )
}

function handleKeyboardOpen(event, clickable, onOpen) {
  if (!clickable || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  onOpen()
}

function formatDeliverySummaryCount(batch) {
  const imageCount = Number(batch?.imageCount || 0)
  const zipCount = Number(batch?.zipCount || 0)
  const fileCount = Number(batch?.fileCount || batch?.files?.length || 0)
  const otherCount = Math.max(0, fileCount - imageCount - zipCount)
  const parts = []
  if (imageCount) parts.push(`${imageCount} 张图片`)
  if (zipCount) parts.push(`${zipCount} 个压缩包`)
  if (otherCount) parts.push(`${otherCount} 个文件`)
  return parts.length ? parts.join(' · ') : '暂无文件'
}

function conversationCardSx(clickable) {
  return {
    width: { xs: '100%', md: 420 },
    maxWidth: '100%',
    p: 0,
    bgcolor: '#fff',
    borderColor: 'rgba(205, 215, 232, .88)',
    borderRadius: '22px',
    overflow: 'hidden',
    cursor: clickable ? 'pointer' : 'default',
    boxShadow: '0 10px 24px rgba(24, 38, 62, .055)',
    transition: 'transform .16s ease, border-color .16s ease, box-shadow .16s ease',
    '&:hover': clickable ? {
      transform: 'translateY(-1px)',
      borderColor: 'rgba(63, 127, 219, .46)',
      boxShadow: '0 14px 30px rgba(24, 38, 62, .075)'
    } : undefined
  }
}

const conversationHeaderSx = {
  minHeight: { xs: 72, sm: 80 },
  px: { xs: 1.45, sm: 1.7 },
  py: { xs: 1.15, sm: 1.35 },
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1.2
}

const conversationIconSx = {
  width: 42,
  height: 42,
  borderRadius: '14px',
  display: 'grid',
  placeItems: 'center',
  bgcolor: '#eaf2ff',
  color: PORTRA_SURFACE.portraBlue,
  flexShrink: 0
}

const conversationChipSx = {
  height: 30,
  px: 0.65,
  borderRadius: 999,
  bgcolor: 'rgba(255, 240, 232, .92)',
  color: '#e95a24',
  fontWeight: 900,
  flexShrink: 0
}

const conversationFooterSx = {
  minHeight: { xs: 76, sm: 84 },
  px: { xs: 1.45, sm: 1.7 },
  py: { xs: 1.2, sm: 1.35 },
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1
}

const conversationButtonSx = {
  minHeight: 44,
  px: 2,
  borderRadius: '14px',
  bgcolor: '#fff',
  color: PORTRA_SURFACE.ink,
  borderColor: 'rgba(133, 148, 173, .32)',
  fontWeight: 950
}

function orderCardSx(clickable) {
  return {
    p: 1.15,
    bgcolor: '#f7f9fd',
    borderColor: 'rgba(205, 215, 232, .88)',
    borderRadius: PORTRA_RADIUS.card,
    overflow: 'hidden',
    cursor: clickable ? 'pointer' : 'default',
    boxShadow: 'none',
    transition: 'border-color .16s ease, transform .16s ease',
    '&:hover': clickable ? {
      borderColor: PORTRA_SURFACE.portraBlue,
      transform: 'translateY(-1px)'
    } : undefined
  }
}
