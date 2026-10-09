import { useId, useRef, useState } from 'react'
import { IconButton, Menu, MenuItem } from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { ReportDialog } from './ReportDialog.jsx'
import { PortraToast } from '../portra/PortraToast.jsx'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export function ReportAction({ targetType, targetId, ownerId, currentUser, sx }) {
  const menuId = useId()
  const trigger = useRef(null)
  const [anchor, setAnchor] = useState(null)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0
  if (!['DEMAND', 'SERVICE_PACKAGE', 'USER'].includes(targetType) || !validId(targetId) || !validId(ownerId)
      || Number(ownerId) === Number(currentUser?.userId)) return null

  return (
    <>
      <IconButton ref={trigger} aria-label="更多操作" aria-haspopup="menu"
        aria-controls={anchor ? menuId : undefined} aria-expanded={Boolean(anchor)}
        onClick={event => setAnchor(event.currentTarget)}
        sx={{ color: PORTRA_SURFACE.muted, flexShrink: 0, ...sx }}>
        <MoreHorizIcon />
      </IconButton>
      <Menu id={menuId} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} disableRestoreFocus
        slotProps={{ paper: { sx: { bgcolor: PORTRA_SURFACE.paper, borderRadius: PORTRA_RADIUS.control, minWidth: 120 } }, transition: { onExited: () => { if (!open && !anchor) trigger.current?.focus() } } }}>
        <MenuItem onClick={() => { setAnchor(null); setOpen(true) }}>举报</MenuItem>
      </Menu>
      <ReportDialog open={open} targetType={targetType} targetId={Number(targetId)} currentUser={currentUser}
        onClose={() => setOpen(false)} onExited={() => { if (!open && !anchor) trigger.current?.focus() }}
        onSuccess={() => { setOpen(false); setToast({ open: true, severity: 'success', message: '举报已提交，平台管理员将核查处理。' }) }} />
      <PortraToast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
