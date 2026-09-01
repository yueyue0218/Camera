import { Box, Typography } from '@mui/material'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { useAuth } from '../../../AuthContext.jsx'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { getDeliveryFileId, isImageDeliveryFile, isZipDeliveryFile } from '../deliveryDisplay.js'
import { getPreviewKey, useDeliveryFilePreviews } from '../useDeliveryFilePreviews.js'

export function DeliveryThumbnailStrip({ files = [], previewUrls = {}, variant = 'order', mode = 'cover' }) {
  const { currentUser } = useAuth()
  const visible = files.slice(0, 4)
  const extraCount = Math.max(0, files.length - visible.length)
  const summary = variant === 'orderSummary'
  const messageCompact = variant === 'messageCompact'
  const compact = variant === 'message' || messageCompact || variant === 'sidePanel'
  const gallery = variant === 'gallery'
  const height = getStripHeight(visible.length, compact, gallery, summary, messageCompact)
  const shouldLoadPreviews = !previewUrls || !Object.keys(previewUrls).length
  const loadedPreviews = useDeliveryFilePreviews(visible, currentUser, { enabled: shouldLoadPreviews })

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: getGridColumns(visible.length, compact),
        gridAutoRows: getGridAutoRows(visible.length, compact, gallery, summary, messageCompact),
        gap: 0.6,
        width: messageCompact && visible.length <= 1 ? 164 : '100%',
        maxWidth: '100%',
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
          mode={mode}
          overlay={index === 3 && extraCount > 0 ? `+${extraCount}` : ''}
        />
      )) : (
        <ThumbnailPlaceholder label="暂无缩略图" />
      )}
    </Box>
  )
}

function ThumbnailTile({ file, previewUrl, loading, mode, overlay }) {
  const imageFile = getDeliveryFileId(file) && isImageDeliveryFile(file)
  return (
    <Box sx={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
      {previewUrl && isImageDeliveryFile(file) ? (
        <Box component="img" src={previewUrl} alt={file.fileName} sx={{ width: '100%', height: '100%', objectFit: mode === 'contain' ? 'contain' : 'cover', display: 'block', bgcolor: PORTRA_SURFACE.paper }} />
      ) : loading && imageFile ? (
        <ThumbnailLoading />
      ) : (
        <ThumbnailPlaceholder label={imageFile ? '暂无缩略图' : isZipDeliveryFile(file) ? 'ZIP' : '文件'} />
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
        {label === 'ZIP' || label === '文件' ? <InsertDriveFileRoundedIcon /> : <ImageRoundedIcon />}
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800 }}>{label}</Typography>
      </Box>
    </Box>
  )
}

function getStripHeight(count, compact, gallery, summary, messageCompact) {
  if (summary) return 82
  if (gallery) return count <= 1 ? 260 : 276
  if (messageCompact) return count <= 1 ? 126 : 132
  if (count <= 1) return compact ? 142 : 220
  return compact ? 150 : 228
}

function getGridColumns(count, compact) {
  if (count <= 1) return '1fr'
  if (compact) return 'repeat(2, minmax(0, 1fr))'
  return 'repeat(2, minmax(0, 1fr))'
}

function getGridAutoRows(count, compact, gallery, summary, messageCompact) {
  if (summary) return count <= 1 ? 82 : 38
  if (count <= 1) return '1fr'
  if (gallery) return 132
  if (messageCompact) return 63
  return compact ? 72 : 108
}
