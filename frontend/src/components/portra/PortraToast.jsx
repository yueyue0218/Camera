import { Alert, Snackbar } from '@mui/material'

export function PortraToast({ toast, onClose }) {
  return (
    <Snackbar
      open={Boolean(toast?.open)}
      autoHideDuration={toast?.autoHideDuration || 3200}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      {toast?.message ? (
        <Alert
          elevation={3}
          onClose={onClose}
          severity={toast.severity || 'info'}
          variant="filled"
          sx={{ width: '100%', borderRadius: 3, fontWeight: 750 }}
        >
          {toast.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  )
}
