import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded'
import { DeliveryThumbnailStrip } from '../../deliveries/components/DeliveryThumbnailStrip.jsx'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function OrderDeliverySummaryCard({
  batch,
  label = '作品已上传',
  helper,
  onOpen,
  disabled = false
}) {
  if (!batch) return null
  const countText = formatDeliverySummaryCount(batch)
  return (
    <Paper
      variant="outlined"
      role={onOpen && !disabled ? 'button' : undefined}
      tabIndex={onOpen && !disabled ? 0 : undefined}
      onClick={onOpen && !disabled ? onOpen : undefined}
      onKeyDown={event => {
        if (!onOpen || disabled || (event.key !== 'Enter' && event.key !== ' ')) return
        event.preventDefault()
        onOpen()
      }}
      sx={{
        borderColor: PORTRA_SURFACE.borderSoft,
        bgcolor: '#f5f7fc',
        borderRadius: PORTRA_RADIUS.card,
        overflow: 'hidden',
        cursor: onOpen && !disabled ? 'pointer' : 'default',
        transition: 'border-color .16s ease, transform .16s ease',
        '&:hover': onOpen && !disabled ? {
          borderColor: PORTRA_SURFACE.portraBlue,
          transform: 'translateY(-1px)'
        } : undefined
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ p: 1.15, alignItems: { sm: 'center' } }}>
        <Box sx={{ width: { xs: '100%', sm: 188 }, flexShrink: 0 }}>
          <DeliveryThumbnailStrip files={batch.files || []} variant="message" mode="cover" />
        </Box>
        <Stack spacing={0.55} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
            <CollectionsRoundedIcon sx={{ color: PORTRA_SURFACE.portraBlue, fontSize: 19 }} />
            <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950 }}>{label}</Typography>
          </Stack>
          {helper && (
            <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted }}>
              {helper}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted }}>
            {countText} · 点击查看
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          endIcon={<ArrowForwardRoundedIcon />}
          disabled={disabled}
          onClick={event => {
            event.stopPropagation()
            if (onOpen && !disabled) onOpen()
          }}
          sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, flexShrink: 0 }}
        >
          查看作品
        </Button>
      </Stack>
    </Paper>
  )
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
