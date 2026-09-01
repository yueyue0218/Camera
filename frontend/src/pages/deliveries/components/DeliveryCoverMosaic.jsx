import { Box, Typography } from '@mui/material'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { useAuth } from '../../../AuthContext.jsx'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { getDeliveryFileId, isImageDeliveryFile } from '../deliveryDisplay.js'
import { getPreviewKey, useDeliveryFilePreviews } from '../useDeliveryFilePreviews.js'

export function DeliveryCoverMosaic({
  files = [],
  variant = 'conversation',
  previewUrls = {}
}) {
  const { currentUser } = useAuth()
  const imageFiles = files.filter(isImageDeliveryFile)
  const coverFiles = imageFiles.length ? imageFiles : files
  const visible = coverFiles.slice(0, 4)
  const extraCount = Math.max(0, coverFiles.length - visible.length)
  const shouldLoadPreviews = !previewUrls || !Object.keys(previewUrls).length
  const loadedPreviews = useDeliveryFilePreviews(visible, currentUser, { enabled: shouldLoadPreviews })
  const conversation = variant === 'conversation'

  return (
    <Box sx={mosaicSx(visible.length, conversation)}>
      {visible.length ? visible.map((file, index) => {
        const previewUrl = previewUrls[file.id]
          || previewUrls[file.fileId]
          || loadedPreviews.previewUrls[getPreviewKey(file)]
        const loading = loadedPreviews.loadingIds.has(getPreviewKey(file))
        return (
          <MosaicTile
            key={file.id || `${file.fileId}-${index}`}
            file={file}
            previewUrl={previewUrl}
            loading={loading}
            conversation={conversation}
            index={index}
            count={visible.length}
            overlay={index === visible.length - 1 && extraCount > 0 ? `+${extraCount}` : ''}
          />
        )
      }) : (
        <MosaicPlaceholder label="暂无作品" />
      )}
    </Box>
  )
}

function MosaicTile({ file, previewUrl, loading, overlay, index, count, conversation }) {
  const image = getDeliveryFileId(file) && isImageDeliveryFile(file)
  return (
    <Box sx={{
      position: 'relative',
      minWidth: 0,
      minHeight: 0,
      bgcolor: '#f2eee7',
      gridRow: count === 3 && index === 0 ? '1 / span 2' : undefined
    }}>
      {previewUrl && image ? (
        <Box
          component="img"
          src={previewUrl}
          alt={file.fileName || '交付作品'}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
            bgcolor: PORTRA_SURFACE.paper
          }}
        />
      ) : loading && image ? (
        <MosaicLoading />
      ) : (
        <MosaicPlaceholder label={image ? '加载中' : '文件'} />
      )}
      {overlay && (
        <Box sx={overlaySx}>
          {overlay}
        </Box>
      )}
    </Box>
  )
}

function MosaicLoading() {
  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      bgcolor: '#f2eee7',
      position: 'relative',
      overflow: 'hidden',
      '&::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        transform: 'translateX(-100%)',
        background: 'linear-gradient(90deg, transparent, rgba(37,99,235,.12), transparent)',
        animation: 'portraMosaicLoading 1.05s ease-in-out infinite'
      },
      '@keyframes portraMosaicLoading': {
        '100%': { transform: 'translateX(100%)' }
      }
    }} />
  )
}

function MosaicPlaceholder({ label }) {
  const file = label === '文件'
  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      minHeight: 72,
      display: 'grid',
      placeItems: 'center',
      bgcolor: '#f2eee7',
      color: 'rgba(37,99,235,.38)'
    }}>
      <Box sx={{ textAlign: 'center' }}>
        {file ? <InsertDriveFileRoundedIcon /> : <ImageRoundedIcon />}
        <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: PORTRA_SURFACE.muted, fontWeight: 800 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  )
}

function mosaicSx(count, conversation) {
  return {
    display: 'grid',
    gridTemplateColumns: getColumns(count),
    gridTemplateRows: getRows(count),
    gap: conversation ? '2px' : '3px',
    width: '100%',
    height: conversation ? { xs: 142, sm: 154 } : 78,
    minHeight: conversation ? 142 : 76,
    overflow: 'hidden',
    bgcolor: '#f2eee7'
  }
}

function getColumns(count) {
  if (count <= 1) return '1fr'
  if (count === 2) return 'repeat(2, minmax(0, 1fr))'
  if (count === 3) return '1.32fr 1fr'
  return 'repeat(2, minmax(0, 1fr))'
}

function getRows(count) {
  if (count <= 2) return '1fr'
  return 'repeat(2, minmax(0, 1fr))'
}

const overlaySx = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  bgcolor: 'rgba(32, 96, 190, .78)',
  color: '#fff',
  fontSize: 24,
  fontWeight: 950
}
