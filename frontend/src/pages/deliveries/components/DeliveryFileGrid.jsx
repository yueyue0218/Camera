import { Box, Checkbox, IconButton, Stack, Typography } from '@mui/material'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { isImageDeliveryFile } from '../deliveryDisplay.js'

export function DeliveryFileGrid({
  files = [],
  previewUrls = {},
  selectedIds = new Set(),
  onToggle,
  onOpenViewer,
  onDownloadFile
}) {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' },
      gap: 1
    }}>
      {files.map((file, index) => {
        const selected = selectedIds.has(file.id)
        const previewUrl = previewUrls[file.id] || previewUrls[file.fileId]
        const image = isImageDeliveryFile(file)
        return (
          <Box
            key={file.id}
            sx={{
              position: 'relative',
              border: `1px solid ${selected ? PORTRA_SURFACE.portraBlue : PORTRA_SURFACE.borderSubtle}`,
              borderRadius: PORTRA_RADIUS.control,
              overflow: 'hidden',
              bgcolor: PORTRA_SURFACE.paper,
              boxShadow: selected ? '0 0 0 3px rgba(13,47,178,.12)' : 'none'
            }}
          >
            <Box sx={{ aspectRatio: '4 / 3', bgcolor: PORTRA_SURFACE.paperMuted, cursor: image ? 'zoom-in' : 'default' }} onClick={() => image && onOpenViewer(index)}>
              {previewUrl && image ? (
                <Box component="img" src={previewUrl} alt={file.fileName} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <Stack spacing={0.5} sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: PORTRA_SURFACE.muted }}>
                  <InsertDriveFileRoundedIcon />
                  <Typography variant="caption">{image ? '暂无缩略图' : 'ZIP 文件'}</Typography>
                </Stack>
              )}
            </Box>
            <Checkbox
              checked={selected}
              onChange={() => onToggle(file.id)}
              sx={{ position: 'absolute', top: 4, left: 4, bgcolor: 'rgba(255,255,255,.78)', borderRadius: '50%' }}
            />
            <IconButton
              size="small"
              onClick={() => image ? onOpenViewer(index) : onDownloadFile?.(file, index)}
              sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(255,255,255,.78)' }}
            >
              {image ? <VisibilityRoundedIcon fontSize="small" /> : <DownloadRoundedIcon fontSize="small" />}
            </IconButton>
            <Box sx={{ px: 0.9, py: 0.75 }}>
              <Typography variant="body2" noWrap sx={{ color: PORTRA_SURFACE.ink, fontWeight: 800 }}>{file.fileName}</Typography>
              <Typography variant="caption" sx={{ color: PORTRA_SURFACE.muted }}>
                {image ? (file.fileId ? '可预览 / 下载原图' : '原图待同步') : '压缩包 / 可下载'}
              </Typography>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
