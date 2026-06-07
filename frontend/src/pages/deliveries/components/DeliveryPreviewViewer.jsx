import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function DeliveryPreviewViewer({
  open,
  file,
  index = 0,
  total = 0,
  previewUrl,
  onClose,
  onPrev,
  onNext,
  onDownload
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography fontWeight={900}>{file?.fileName || '作品'}</Typography>
          <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted }}>{total ? `${index + 1}/${total}` : ''}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: '#121821', p: 0, minHeight: '62vh', display: 'grid', placeItems: 'center', position: 'relative' }}>
        <IconButton onClick={onPrev} disabled={total <= 1} sx={navButtonSx('left')}>
          <ChevronLeftRoundedIcon />
        </IconButton>
        {previewUrl ? (
          <Box component="img" src={previewUrl} alt={file?.fileName || '作品'} sx={{ maxWidth: '100%', maxHeight: '74vh', objectFit: 'contain', display: 'block' }} />
        ) : (
          <Typography sx={{ color: '#fff' }}>该作品暂不支持预览。</Typography>
        )}
        <IconButton onClick={onNext} disabled={total <= 1} sx={navButtonSx('right')}>
          <ChevronRightRoundedIcon />
        </IconButton>
      </DialogContent>
      <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
        <Button color="inherit" onClick={onClose}>关闭</Button>
        <Button startIcon={<DownloadRoundedIcon />} onClick={() => onDownload(file)} disabled={!file?.fileId}>下载当前图片</Button>
      </DialogActions>
    </Dialog>
  )
}

function navButtonSx(side) {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 12,
    transform: 'translateY(-50%)',
    color: '#fff',
    bgcolor: 'rgba(255,255,255,.14)',
    '&:hover': { bgcolor: 'rgba(255,255,255,.24)' }
  }
}
