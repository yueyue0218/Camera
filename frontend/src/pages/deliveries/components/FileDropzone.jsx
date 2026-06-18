import { Box, Stack, Typography } from '@mui/material'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function FileDropzone({
  disabled = false,
  dragging = false,
  onBrowse,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop
}) {
  return (
    <Box
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onBrowse}
      onKeyDown={event => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onBrowse?.()
        }
      }}
      onDragEnter={disabled ? undefined : onDragEnter}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
      sx={{
        p: { xs: 2, sm: 2.4 },
        minHeight: 178,
        display: 'grid',
        placeItems: 'center',
        borderRadius: PORTRA_RADIUS.panel,
        border: `1.5px dashed ${dragging ? PORTRA_SURFACE.portraBlue : PORTRA_SURFACE.borderDashed}`,
        bgcolor: dragging ? PORTRA_SURFACE.portraBlueSoft : 'rgba(248,243,235,.72)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 140ms ease, border-color 140ms ease, transform 140ms ease',
        '&:hover': disabled ? undefined : {
          borderColor: PORTRA_SURFACE.portraBlue,
          bgcolor: 'rgba(231,235,250,.68)',
          transform: 'translateY(-1px)'
        }
      }}
    >
      <Stack spacing={1.1} sx={{ alignItems: 'center', textAlign: 'center', maxWidth: 430 }}>
        <Box sx={{
          width: 50,
          height: 50,
          borderRadius: '18px',
          display: 'grid',
          placeItems: 'center',
          bgcolor: PORTRA_SURFACE.portraBlue,
          color: '#fff',
          boxShadow: '0 12px 26px rgba(13,47,178,.16)'
        }}>
          <CloudUploadRoundedIcon />
        </Box>
        <Box>
          <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 18, fontWeight: 950 }}>
            拖拽照片或压缩包到这里
          </Typography>
          <Typography sx={{ mt: 0.45, color: PORTRA_SURFACE.muted, fontSize: 14.5, lineHeight: 1.65 }}>
            支持 JPG、PNG、WEBP 图片和 ZIP 压缩包，图片单个不超过 20MB，ZIP 不超过 200MB。
          </Typography>
        </Box>
        <Typography sx={{ color: PORTRA_SURFACE.portraBlue, fontSize: 14, fontWeight: 900 }}>
          点击选择文件
        </Typography>
      </Stack>
    </Box>
  )
}
