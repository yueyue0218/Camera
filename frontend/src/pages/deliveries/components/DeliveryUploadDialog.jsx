import { Dialog, DialogContent } from '@mui/material'
import { PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { DeliveryUploadPanel } from './DeliveryUploadPanel.jsx'

export function DeliveryUploadDialog({
  open,
  mode = 'upload',
  value,
  loading = false,
  onChange,
  onClose,
  onSubmit
}) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: PORTRA_RADIUS.panel,
          bgcolor: PORTRA_SURFACE.paper,
          border: `1px solid ${PORTRA_SURFACE.borderSubtle}`,
          boxShadow: PORTRA_SHADOW.floating,
          overflow: 'hidden'
        }
      }}
    >
      <DialogContent sx={{ p: { xs: 2, sm: 2.6 }, bgcolor: PORTRA_SURFACE.paper }}>
        <DeliveryUploadPanel
          mode={mode}
          value={value}
          loading={loading}
          onChange={onChange}
          onSubmit={async () => {
            const succeeded = await onSubmit?.()
            if (succeeded) onClose?.()
            return succeeded
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
