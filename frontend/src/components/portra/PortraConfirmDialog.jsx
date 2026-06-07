import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export function PortraConfirmDialog({ confirmState, onResolve }) {
  const open = Boolean(confirmState?.open)
  const destructive = confirmState?.tone === 'danger'
  return (
    <Dialog open={open} onClose={() => onResolve(false)} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 900 }}>{confirmState?.title || '确认操作'}</DialogTitle>
      <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
        <Typography sx={{ color: PORTRA_SURFACE.muted, lineHeight: 1.8 }}>
          {confirmState?.message || '是否继续？'}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted, px: 2, py: 1.3 }}>
        <Button color="inherit" onClick={() => onResolve(false)}>{confirmState?.cancelText || '取消'}</Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          onClick={() => onResolve(true)}
          sx={{ borderRadius: PORTRA_RADIUS.compact }}
        >
          {confirmState?.confirmText || '确认'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
