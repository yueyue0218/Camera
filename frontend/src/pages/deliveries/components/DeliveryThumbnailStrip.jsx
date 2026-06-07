import { Box, Typography } from '@mui/material'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { useAuth } from '../../../AuthContext.jsx'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { getDeliveryFileId, isImageDeliveryFile } from '../deliveryDisplay.js'
import { getPreviewKey, useDeliveryFilePreviews } from '../useDeliveryFilePreviews.js'

export function DeliveryThumbnailStrip({ files = [], previewUrls = {}, variant = 'order' }) {
  const { currentUser } = useAuth()
  const visible = files.slice(0, 4)
  const extraCount = Math.max(0, files.length - visible.length)
  const compact = variant === 'message' || variant === 'sidePanel'
  const gallery = variant === 'gallery'
  const height = getStripHeight(visible.length, compact, gallery)
  const shouldLoadPreviews = !previewUrls || !Object.keys(previewUrls).length
  const loadedPreviews = useDeliveryFilePreviews(visible, currentUser, { enabled: shouldLoadPreviews })

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: visible.length === 1 ? '1fr' : 'repeat(2, 1fr)',
        gridAutoRows: visible.length <= 1 ? '1fr' : compact ? 66 : gallery ? 112 : 84,
        gap: 0.6,
        height,
        minHeight: 0,
        borderRadius: PORTRA_RADIUS.control,
        overflow: 'hidden',
        bgcolor: 'rgba(255,253,249,.72)'
      }}
    >
      {visible.length ? visible.map((file, index) => (
        <ThumbnailTile
          key={file.id || `${file.fileId}-${index}`}
          file={file}
          previewUrl={previewUrls[file.id] || previewUrls[file.fileId] || loadedPreviews.previewUrls[getPreviewKey(file)]}
          loading={loadedPreviews.loadingIds.has(getPreviewKey(file))}
          overlay={index === 3 && extraCount > 0 ? `+${extraCount}` : ''}
        />
      )) : (
        <ThumbnailPlaceholder label="暂无缩略图" />
      )}
    </Box>
  )
}

function ThumbnailTile({ file, previewUrl, loading, overlay }) {
  const imageFile = getDeliveryFileId(file) && isImageDeliveryFile(file)
  return (
    <Box sx={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
      {previewUrl && isImageDeliveryFile(file) ? (
        <Box component="img" src={previewUrl} alt={file.fileName} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : loading && imageFile ? (
        <ThumbnailLoading />
      ) : (
        <ThumbnailPlaceholder label={imageFile ? '暂无缩略图' : '作品'} />
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

function ThumbnailLoading() {
  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      minHeight: 48,
      bgcolor: 'rgba(255,253,249,.9)',
      position: 'relative',
      overflow: 'hidden',
      '&::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        transform: 'translateX(-100%)',
        background: 'linear-gradient(90deg, transparent, rgba(13,47,178,.10), transparent)',
        animation: 'portraThumbLoading 1.15s ease-in-out infinite'
      },
      '@keyframes portraThumbLoading': {
        '100%': { transform: 'translateX(100%)' }
      }
    }} />
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
        {label === '作品' ? <InsertDriveFileRoundedIcon /> : <ImageRoundedIcon />}
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800 }}>{label}</Typography>
      </Box>
    </Box>
  )
}

function getStripHeight(count, compact, gallery) {
  if (gallery) return count <= 1 ? 220 : 240
  if (count <= 1) return compact ? 132 : 162
  return compact ? 136 : 176
}
