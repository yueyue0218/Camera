import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export function OrderCompletionDialog({ open, onClose, onReview, reviewDisabled = false }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
          <TaskAltRoundedIcon color="success" />
          <Typography component="span" fontWeight={900}>订单完成！</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ position: 'relative', overflow: 'hidden', bgcolor: PORTRA_SURFACE.paper }}>
        <CompletionSprinkles />
        <Stack spacing={1.1}>
          <Typography sx={{ color: PORTRA_SURFACE.ink }}>
            作品已确认，感谢你完成这次校园约拍。可以去评价这次合作，帮助对方积累信用。
          </Typography>
          <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, lineHeight: 1.8 }}>
            也可以稍后再说，订单状态已经正常更新。
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted, px: 2, py: 1.4 }}>
        <Button color="inherit" onClick={onClose}>稍后再说</Button>
        <Button
          variant="contained"
          startIcon={<RateReviewRoundedIcon />}
          onClick={onReview}
          disabled={reviewDisabled}
          sx={{ borderRadius: PORTRA_RADIUS.compact }}
        >
          去评价
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function CompletionSprinkles() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        '@media (prefers-reduced-motion: no-preference)': {
          '& span': { animation: 'portraCompletionFloat 700ms ease-out both' }
        },
        '@keyframes portraCompletionFloat': {
          from: { opacity: 0, transform: 'translateY(8px) scale(.85)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' }
        }
      }}
    >
      {[['12%', '24%', PORTRA_SURFACE.filmYellow], ['82%', '18%', PORTRA_SURFACE.portraBlue], ['74%', '78%', PORTRA_SURFACE.warmOrange], ['18%', '72%', '#7db9a4']].map(([left, top, color]) => (
        <Box
          key={`${left}-${top}`}
          component="span"
          sx={{
            position: 'absolute',
            left,
            top,
            width: 7,
            height: 7,
            borderRadius: '50%',
            bgcolor: color,
            opacity: 0.55
          }}
        />
      ))}
    </Box>
  )
}
