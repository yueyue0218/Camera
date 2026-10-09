import { useEffect, useId, useRef, useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField, Typography } from '@mui/material'
import { reportApi } from '../../api/reportApi.js'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

const reasons = ['虚假或误导性信息', '广告或垃圾信息', '侵权或盗用他人作品', '骚扰或不当行为', '其他违规行为']

function errorMessage(error) {
  if (error?.isNetworkError) return '网络连接失败，请稍后重试。'
  const messages = {
    40101: '请先登录后再提交举报。',
    40301: '你暂时无权举报此对象。',
    40401: '举报对象不存在或已无法访问。',
    40902: '你已举报过此对象，平台正在处理中。',
    40901: '举报对象状态已变化，请刷新页面后重试。',
    40001: '举报信息不符合要求，请检查后重试。'
  }
  return messages[error?.code] || error?.message || '举报提交失败，请稍后重试。'
}

export function ReportDialog({ open, targetType, targetId, currentUser, onClose, onSuccess, onExited }) {
  const titleId = useId()
  const helpId = useId()
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const loggedIn = Boolean(currentUser?.token && currentUser?.userId)

  useEffect(() => {
    if (open) {
      setReason('')
      setDescription('')
      setError('')
    }
  }, [open, targetType, targetId])

  async function submit(event) {
    event.preventDefault()
    if (pending.current) return
    if (!loggedIn) { setError('请先登录后再提交举报。'); return }
    if (!reasons.includes(reason)) { setError('请选择举报原因。'); return }
    if (description && !description.trim()) { setError('补充说明不能只包含空白字符。'); return }
    pending.current = true
    setSubmitting(true)
    setError('')
    try {
      await reportApi.create({ targetType, targetId, reason, description: description.trim() || null }, currentUser)
      onSuccess()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={() => !pending.current && onClose()} fullWidth maxWidth="xs"
      aria-labelledby={titleId} aria-describedby={helpId} disableRestoreFocus
      slotProps={{ paper: { sx: { bgcolor: PORTRA_SURFACE.paper, borderRadius: PORTRA_RADIUS.card } }, transition: { onExited } }}>
      <form onSubmit={submit} aria-busy={submitting}>
        <DialogTitle id={titleId} sx={{ fontWeight: 800 }}>举报此内容</DialogTitle>
        <DialogContent dividers>
          <Typography id={helpId} sx={{ color: PORTRA_SURFACE.muted, fontSize: 14, mb: 2 }}>
            请选择举报原因，平台管理员将根据实际情况核查处理。
          </Typography>
          {(!loggedIn || error) && <Alert severity="error" sx={{ mb: 2 }}>{error || '请先登录后再提交举报。'}</Alert>}
          <FormControl disabled={submitting || !loggedIn} fullWidth>
            <FormLabel id={reasonId}>举报原因</FormLabel>
            <RadioGroup aria-labelledby={reasonId} value={reason} onChange={event => { setReason(event.target.value); setError('') }}>
              {reasons.map((value, index) => <FormControlLabel key={value} value={value} control={<Radio autoFocus={index === 0} />} label={value} />)}
            </RadioGroup>
          </FormControl>
          <TextField label="补充说明（选填）" multiline minRows={3} maxRows={6} fullWidth margin="normal"
            value={description} disabled={submitting || !loggedIn}
            onChange={event => { setDescription(event.target.value.slice(0, 1000)); setError('') }}
            helperText={`还可输入 ${1000 - description.length} 字`}
            slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted, px: 2, py: 1.5 }}>
          <Button color="inherit" disabled={submitting} onClick={onClose}>取消</Button>
          <Button type="submit" variant="contained" disabled={submitting || !loggedIn || !reason} sx={{ borderRadius: PORTRA_RADIUS.compact }}>
            {submitting ? '提交中…' : '提交举报'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
