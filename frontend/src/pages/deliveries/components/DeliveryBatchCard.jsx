import { Box, Button, Stack, Typography } from '@mui/material'
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { PortraStatusBadge, PortraTicketCard } from '../../../components/portra/index.js'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { DeliveryThumbnailStrip } from './DeliveryThumbnailStrip.jsx'

export function DeliveryBatchCard({
  batch,
  variant = 'order',
  previewUrls = {},
  onOpen,
  disabled = false
}) {
  if (!batch) return null
  const message = variant === 'message'
  const clickable = Boolean(onOpen) && !disabled

  return (
    <PortraTicketCard
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={event => {
        if (clickable && (event.key === 'Enter' || event.key === ' ')) onOpen()
      }}
      sx={{
        width: message ? { xs: 'min(100%, 540px)', md: 'min(600px, 100%)' } : '100%',
        px: message ? 1.35 : 1.6,
        py: message ? 1.2 : 1.45,
        pl: message ? 2.2 : 2.5,
        cursor: clickable ? 'pointer' : 'default',
        '&:hover': clickable ? undefined : { transform: 'none' }
      }}
    >
      <Stack spacing={1.15}>
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
          <PortraStatusBadge label={batch.statusLabel || '已交付'} />
        </Stack>
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
        {!clickable && (
          <Typography variant="caption" sx={{ color: PORTRA_SURFACE.muted }}>交付记录暂不可查看</Typography>
        )}
      </Stack>
    </PortraTicketCard>
  )
}
