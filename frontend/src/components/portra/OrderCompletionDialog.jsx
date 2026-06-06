import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export function OrderCompletionDialog({ open, onClose, onReview, reviewDisabled = false }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
          <TaskAltRoundedIcon color="success" />
          <Typography component="span" fontWeight={900}>订单已完成</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
        <Stack spacing={1.1}>
          <Typography sx={{ color: PORTRA_SURFACE.ink }}>
            本次约拍已进入完成状态，平台将按规则结算给摄影师。
          </Typography>
          <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, lineHeight: 1.8 }}>
            可以现在评价这次合作，帮助双方积累信用。
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted, px: 2, py: 1.4 }}>
        <Button color="inherit" onClick={onClose}>稍后</Button>
        <Button
          variant="contained"
          startIcon={<RateReviewRoundedIcon />}
          onClick={onReview}
          disabled={reviewDisabled}
          sx={{ borderRadius: PORTRA_RADIUS.pill }}
        >
          去评价
        </Button>
      </DialogActions>
    </Dialog>
  )
}
