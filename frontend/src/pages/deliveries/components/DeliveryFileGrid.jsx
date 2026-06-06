import { Box, Checkbox, IconButton, Stack, Typography } from '@mui/material'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { isImageDeliveryFile } from '../deliveryDisplay.js'

export function DeliveryFileGrid({
  files = [],
  previewUrls = {},
  selectedIds = new Set(),
  onToggle,
  onOpenViewer
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
            <Box sx={{ aspectRatio: '4 / 3', bgcolor: PORTRA_SURFACE.paperMuted, cursor: 'zoom-in' }} onClick={() => onOpenViewer(index)}>
              {previewUrl && isImageDeliveryFile(file) ? (
                <Box component="img" src={previewUrl} alt={file.fileName} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <Stack spacing={0.5} sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: PORTRA_SURFACE.muted }}>
                  <InsertDriveFileRoundedIcon />
                  <Typography variant="caption">暂无缩略图</Typography>
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
              onClick={() => onOpenViewer(index)}
              sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(255,255,255,.78)' }}
            >
              <VisibilityRoundedIcon fontSize="small" />
            </IconButton>
            <Box sx={{ px: 0.9, py: 0.75 }}>
              <Typography variant="body2" noWrap sx={{ color: PORTRA_SURFACE.ink, fontWeight: 800 }}>{file.fileName}</Typography>
              <Typography variant="caption" sx={{ color: PORTRA_SURFACE.muted }}>{file.fileId ? `文件 ${file.fileId}` : '无文件 ID'}</Typography>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
