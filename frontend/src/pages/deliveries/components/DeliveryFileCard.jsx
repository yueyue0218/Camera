import { Box, IconButton, Stack, Typography } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { formatUploadFileSize } from './deliveryUploadModel.js'

export function DeliveryFileCard({
  item,
  statusLabel = '待上传',
  onRemove,
  disabled = false
}) {
  const zip = item?.fileType === 'ZIP'
  const file = item?.file
  return (
    <Box sx={{
      p: 1.2,
      borderRadius: PORTRA_RADIUS.card,
      border: `1px solid ${PORTRA_SURFACE.borderSoft}`,
      bgcolor: PORTRA_SURFACE.paper,
      boxShadow: '0 1px 0 rgba(255,255,255,.72) inset'
    }}>
      <Stack direction="row" spacing={1.1} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Box sx={{
          width: 44,
          height: 44,
          flex: '0 0 auto',
          borderRadius: '15px',
          display: 'grid',
          placeItems: 'center',
          bgcolor: zip ? PORTRA_SURFACE.filmYellowSoft : PORTRA_SURFACE.paperMuted,
          color: zip ? PORTRA_SURFACE.warmOrange : PORTRA_SURFACE.muted
        }}>
          {zip ? <FolderZipRoundedIcon /> : <InsertDriveFileRoundedIcon />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ color: PORTRA_SURFACE.ink, fontSize: 14.5, fontWeight: 900 }}>
            {file?.name || '交付文件'}
          </Typography>
          <Stack direction="row" spacing={0.8} sx={{ mt: 0.35, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={fileMetaSx}>{zip ? '压缩包 / ZIP' : '文件'}</Typography>
            <Typography sx={fileMetaSx}>{formatUploadFileSize(file?.size)}</Typography>
            <Typography sx={{ ...fileMetaSx, color: PORTRA_SURFACE.portraBlue }}>{statusLabel}</Typography>
          </Stack>
        </Box>
        {onRemove && (
          <IconButton size="small" onClick={onRemove} disabled={disabled} aria-label="移除文件">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    </Box>
  )
}

const fileMetaSx = {
  color: PORTRA_SURFACE.muted,
  fontSize: 12.5,
  fontWeight: 750
}
