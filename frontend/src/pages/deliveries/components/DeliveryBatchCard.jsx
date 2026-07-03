import { Box, Button, Stack, Typography } from '@mui/material'
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { PortraStatusBadge, PortraTicketCard } from '../../../components/portra/index.js'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { DeliveryThumbnailStrip } from './DeliveryThumbnailStrip.jsx'

export function DeliveryBatchCard({
  batch,
  variant = 'order',
  chrome = 'card',
  previewUrls = {},
  onOpen,
  disabled = false
}) {
  if (!batch) return null
  const message = variant === 'message'
  const orderSection = variant === 'orderSection' || variant === 'order'
  const gallery = variant === 'gallery'
  const sidePanel = variant === 'sidePanel' || variant === 'gallerySummary'
  const inline = chrome === 'none'
  const hasGalleryTarget = Boolean(batch.orderId && batch.deliveryId)
  const clickable = Boolean(onOpen) && hasGalleryTarget && !disabled
  const Root = inline ? Box : PortraTicketCard
  const subtitle = message
    ? batch.messageSubtitle || batch.subtitle
    : sidePanel || gallery ? batch.subtitle : batch.orderSubtitle || batch.subtitle
  const thumbnailVariant = message ? 'message' : gallery ? 'gallery' : orderSection ? 'orderSection' : sidePanel ? 'sidePanel' : variant

  return (
    <Root
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={event => {
        if (clickable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onOpen()
        }
      }}
      sx={{
        width: message ? { xs: 'min(100%, 540px)', md: 'min(540px, 100%)' } : '100%',
        px: inline ? 0 : message ? 1.35 : sidePanel ? 1.1 : 1.6,
        py: inline ? 0 : message ? 1.2 : sidePanel ? 1 : 1.45,
        pl: inline ? 0 : message ? 2.2 : sidePanel ? 1.1 : 2.5,
        cursor: clickable ? 'pointer' : 'default',
        '&:hover': inline ? undefined : clickable ? undefined : { transform: 'none' }
      }}
    >
      <Stack spacing={1}>
        {inline ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              {!message && (
                <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950, lineHeight: 1.35 }}>
                  {batch.title}
                </Typography>
              )}
              <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, fontWeight: 750, minWidth: 0 }}>
                {subtitle}
              </Typography>
            </Box>
            {!message && <PortraStatusBadge label={batch.statusLabel || '已上传作品'} />}
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
                <CollectionsRoundedIcon sx={{ color: PORTRA_SURFACE.portraBlue, fontSize: 19 }} />
                <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950, lineHeight: 1.35 }}>
                  {batch.title}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.35, color: PORTRA_SURFACE.muted }}>
                {subtitle}
              </Typography>
            </Box>
            <PortraStatusBadge label={batch.statusLabel || '已上传作品'} />
          </Stack>
        )}
        <DeliveryThumbnailStrip files={batch.files} previewUrls={previewUrls} variant={thumbnailVariant} mode="contain" />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, minWidth: 0 }}>
            共 {formatDeliveryBatchCount(batch, message)}
          </Typography>
          <Button size="small" variant="outlined" startIcon={<OpenInNewRoundedIcon />} disabled={!clickable} onClick={event => {
            event.stopPropagation()
            if (clickable) onOpen()
          }}>
            查看作品
          </Button>
        </Stack>
        {!hasGalleryTarget && (
          <Typography variant="caption" sx={{ color: PORTRA_SURFACE.muted }}>作品暂不可查看</Typography>
        )}
      </Stack>
    </Root>
  )
}

function formatDeliveryBatchCount(batch, compact = false) {
  const imageCount = Number(batch?.imageCount || 0)
  const zipCount = Number(batch?.zipCount || 0)
  const fileCount = Number(batch?.fileCount || batch?.files?.length || 0)
  const otherCount = Math.max(0, fileCount - imageCount - zipCount)
  const parts = []
  if (imageCount) parts.push(`${imageCount} 张图片`)
  if (zipCount) parts.push(`${zipCount} 个 ZIP`)
  if (otherCount) parts.push(`${otherCount} 个文件`)
  if (!parts.length) return compact ? '0 张作品' : '0 份作品'
  return parts.join(' / ')
}
