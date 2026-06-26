import { Button, Paper, Stack, Typography } from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import ClearRoundedIcon from '@mui/icons-material/ClearRounded'
import SelectAllRoundedIcon from '@mui/icons-material/SelectAllRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'

export function DeliveryActionBar({
  selectionMode = false,
  selectedCount = 0,
  downloadableCount = 0,
  onDownloadSelected,
  onDownloadAll,
  onClearSelection,
  onEnterSelection,
  onCancelSelection,
  children
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 3,
        px: 1.4,
        py: 1.1,
        bgcolor: 'rgba(255,253,249,.94)',
        borderColor: PORTRA_SURFACE.borderSubtle,
        borderRadius: PORTRA_RADIUS.control,
        backdropFilter: 'blur(12px)'
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}>
        <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 850 }}>
          {selectionMode ? `已选择 ${selectedCount} 项` : `共 ${downloadableCount} 个可下载作品`}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, justifyContent: 'flex-end' }}>
          {selectionMode ? (
            <>
              <Button startIcon={<DownloadRoundedIcon />} variant="contained" onClick={onDownloadSelected} disabled={!selectedCount}>下载所选</Button>
              <Button startIcon={<ClearRoundedIcon />} color="inherit" onClick={onCancelSelection || onClearSelection}>取消选择</Button>
            </>
          ) : (
            <>
              <Button startIcon={<SelectAllRoundedIcon />} variant="outlined" onClick={onEnterSelection} disabled={!downloadableCount}>批量选择</Button>
              <Button startIcon={<DownloadRoundedIcon />} variant="contained" onClick={onDownloadAll} disabled={!downloadableCount}>下载全部</Button>
            </>
          )}
          {children}
        </Stack>
      </Stack>
    </Paper>
  )
}
