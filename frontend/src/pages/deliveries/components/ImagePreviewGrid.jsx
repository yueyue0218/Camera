import { useEffect, useMemo } from 'react'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { formatUploadFileSize } from './deliveryUploadModel.js'

export function ImagePreviewGrid({
  items = [],
  statusLabel = '待上传',
  onRemove,
  disabled = false
}) {
  const previews = useMemo(() => items.map(item => ({
    item,
    url: URL.createObjectURL(item.file)
  })), [items])

  useEffect(() => () => {
    previews.forEach(preview => URL.revokeObjectURL(preview.url))
  }, [previews])

  if (!items.length) return null

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
      gap: 1
    }}>
      {previews.map(({ item, url }) => (
        <Box key={item.id} sx={imageCardSx}>
          <Box sx={{ aspectRatio: '4 / 3', overflow: 'hidden', bgcolor: PORTRA_SURFACE.paperMuted }}>
            <Box
              component="img"
              src={url}
              alt={item.file.name}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </Box>
          <Box sx={imageOverlaySx}>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ color: '#fff', fontSize: 13, fontWeight: 850 }}>
                {item.file.name}
              </Typography>
              <Stack direction="row" spacing={0.65} sx={{ alignItems: 'center' }}>
                <Typography sx={imageMetaSx}>{formatUploadFileSize(item.file.size)}</Typography>
                <Typography sx={imageMetaSx}>{statusLabel}</Typography>
              </Stack>
            </Box>
            {onRemove && (
              <IconButton
                size="small"
                onClick={() => onRemove(item.id)}
                disabled={disabled}
                aria-label="移除图片"
                sx={{ color: '#fff', bgcolor: 'rgba(17,16,21,.32)', '&:hover': { bgcolor: 'rgba(17,16,21,.52)' } }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

const imageCardSx = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: PORTRA_RADIUS.card,
  border: `1px solid ${PORTRA_SURFACE.borderSoft}`,
  bgcolor: PORTRA_SURFACE.paper,
  boxShadow: 'none',
  transition: 'box-shadow 140ms ease, transform 140ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 12px 24px rgba(21,19,24,.12)'
  }
}

const imageOverlaySx = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  p: 1,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 0.8,
  background: 'linear-gradient(180deg, rgba(17,16,21,0), rgba(17,16,21,.72))'
}

const imageMetaSx = {
  color: 'rgba(255,255,255,.82)',
  fontSize: 12,
  fontWeight: 750
}
