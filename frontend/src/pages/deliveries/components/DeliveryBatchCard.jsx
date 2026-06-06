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
  const inline = chrome === 'none'
  const hasGalleryTarget = Boolean(batch.orderId && batch.deliveryId)
  const clickable = Boolean(onOpen) && hasGalleryTarget && !disabled
  const Root = inline ? Box : PortraTicketCard

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
        width: message ? { xs: 'min(100%, 540px)', md: 'min(600px, 100%)' } : '100%',
        px: inline ? 0 : message ? 1.35 : 1.6,
        py: inline ? 0 : message ? 1.2 : 1.45,
        pl: inline ? 0 : message ? 2.2 : 2.5,
        cursor: clickable ? 'pointer' : 'default',
        '&:hover': inline ? undefined : clickable ? undefined : { transform: 'none' }
      }}
    >
      <Stack spacing={1}>
        {inline ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, fontWeight: 800, minWidth: 0 }}>
              {batch.subtitle}
            </Typography>
            <PortraStatusBadge label={batch.statusLabel || '已上传作品'} />
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
                {batch.subtitle}
              </Typography>
            </Box>
            <PortraStatusBadge label={batch.statusLabel || '已上传作品'} />
          </Stack>
        )}
        <DeliveryThumbnailStrip files={batch.files} previewUrls={previewUrls} variant={variant} />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, minWidth: 0 }}>
            共 {batch.fileCount || batch.files?.length || 0} 个文件
          </Typography>
          <Button size="small" variant="outlined" startIcon={<OpenInNewRoundedIcon />} disabled={!clickable} onClick={event => {
            event.stopPropagation()
            if (clickable) onOpen()
          }}>
            查看作品
          </Button>
        </Stack>
        {!hasGalleryTarget && (
          <Typography variant="caption" sx={{ color: PORTRA_SURFACE.muted }}>作品记录暂不可查看</Typography>
        )}
      </Stack>
    </Root>
  )
}
