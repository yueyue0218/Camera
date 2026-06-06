import { Box, Typography } from '@mui/material'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { isImageDeliveryFile } from '../deliveryDisplay.js'

export function DeliveryThumbnailStrip({ files = [], previewUrls = {}, variant = 'order' }) {
  const visible = files.slice(0, 4)
  const extraCount = Math.max(0, files.length - visible.length)
  const compact = variant === 'message'

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: visible.length === 1 ? '1fr' : 'repeat(2, 1fr)',
        gridAutoRows: compact ? 48 : 72,
        gap: 0.6,
        minHeight: compact ? 96 : 148,
        borderRadius: PORTRA_RADIUS.control,
        overflow: 'hidden',
        bgcolor: PORTRA_SURFACE.paperMuted
      }}
    >
      {visible.length ? visible.map((file, index) => (
        <ThumbnailTile
          key={file.id || `${file.fileId}-${index}`}
          file={file}
          previewUrl={previewUrls[file.id] || previewUrls[file.fileId]}
          overlay={index === 3 && extraCount > 0 ? `+${extraCount}` : ''}
        />
      )) : (
        <ThumbnailPlaceholder label="暂无可预览文件" />
      )}
    </Box>
  )
}

function ThumbnailTile({ file, previewUrl, overlay }) {
  return (
    <Box sx={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
      {previewUrl && isImageDeliveryFile(file) ? (
        <Box component="img" src={previewUrl} alt={file.fileName} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <ThumbnailPlaceholder label={isImageDeliveryFile(file) ? '图片待加载' : '文件'} />
      )}
      {overlay && (
        <Box sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'rgba(16, 24, 40, 0.48)',
          color: '#fff',
          fontSize: 22,
          fontWeight: 950
        }}>
          {overlay}
        </Box>
      )}
    </Box>
  )
}

function ThumbnailPlaceholder({ label }) {
  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      minHeight: 48,
      display: 'grid',
      placeItems: 'center',
      bgcolor: 'rgba(255,253,249,.72)',
      color: PORTRA_SURFACE.muted
    }}>
      <Box sx={{ textAlign: 'center' }}>
        {label === '文件' ? <InsertDriveFileRoundedIcon /> : <ImageRoundedIcon />}
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800 }}>{label}</Typography>
      </Box>
    </Box>
  )
}
