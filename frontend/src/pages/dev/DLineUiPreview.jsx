import { useMemo, useState } from 'react'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { PORTRA_STATE_EVENT } from '../portra/PortraPages.jsx'

function Section({ title, subtitle, children }) {
  return (
    <Paper className="dev-preview-section" elevation={0}>
      <div className="dev-preview-head">
        <div>
          <Typography variant="h6">{title}</Typography>
          {subtitle ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography> : null}
        </div>
      </div>
      {children}
    </Paper>
  )
}

function DemoBell() {
  const [unread, setUnread] = useState(0)
  const [ringing, setRinging] = useState(false)

  const dispatchState = (nextUnread, ring = false) => {
    setUnread(nextUnread)
    setRinging(ring)
    window.dispatchEvent(new CustomEvent(PORTRA_STATE_EVENT, {
      detail: { previewUnreadCount: nextUnread, previewRing: ring }
    }))
    if (ring) window.setTimeout(() => setRinging(false), 620)
  }

  return (
    <Stack gap={1.5}>
      <button className="portra-notification-btn preview" type="button" aria-label="通知预览">
        {unread ? (
          <NotificationsRoundedIcon className={`portra-notification-bell ${ringing ? 'portra-notification-bell--ringing' : ''}`} />
        ) : (
          <NotificationsNoneRoundedIcon className="portra-notification-bell" />
        )}
        {unread ? <span className="portra-notice-badge" /> : null}
      </button>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button variant="outlined" onClick={() => dispatchState(0)}>无未读通知</Button>
        <Button variant="outlined" onClick={() => dispatchState(3)}>存在未读通知</Button>
        <Button variant="contained" onClick={() => dispatchState(Math.max(1, unread + 1), true)}>模拟新通知到达</Button>
        <Button variant="outlined" onClick={() => dispatchState(0)}>全部已读</Button>
      </Stack>
    </Stack>
  )
}

function FeedbackPlayground() {
  const [submitting, setSubmitting] = useState(false)
  const [snack, setSnack] = useState(null)
  const [inlineAlert, setInlineAlert] = useState(null)

  const showSnack = (message, severity = 'success') => {
    setSnack({ message, severity })
  }

  const triggerSubmitting = () => {
    setSubmitting(true)
    setInlineAlert(null)
    window.setTimeout(() => {
      setSubmitting(false)
      showSnack('提交成功', 'success')
    }, 1200)
  }

  const triggerInlineAlert = (message, severity) => {
    setInlineAlert({ message, severity })
    setSnack(null)
  }

  return (
    <>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button variant="contained" disabled={submitting} onClick={triggerSubmitting}>
          {submitting ? <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />提交中</> : '提交中'}
        </Button>
        <Button variant="outlined" onClick={() => showSnack('提交成功', 'success')}>提交成功 Snackbar</Button>
        <Button variant="outlined" onClick={() => triggerInlineAlert('提交失败，已保留当前输入', 'error')}>提交失败 Alert</Button>
        <Button variant="outlined" onClick={() => triggerInlineAlert('网络异常，请稍后重试', 'error')}>网络错误</Button>
        <Button variant="outlined" onClick={() => triggerInlineAlert('当前账号无权限执行此操作', 'warning')}>无权限</Button>
        <Button variant="outlined" onClick={() => triggerInlineAlert('重复提交已拦截', 'warning')}>重复提交</Button>
      </Stack>
      {inlineAlert ? (
        <Alert severity={inlineAlert.severity} sx={{ mt: 1.5 }}>
          {inlineAlert.message}
        </Alert>
      ) : null}
      <Snackbar open={Boolean(snack)} autoHideDuration={2600} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>{snack.message}</Alert> : null}
      </Snackbar>
    </>
  )
}

function DialogPreview() {
  const [dialogType, setDialogType] = useState('')
  const [text, setText] = useState('')
  const config = useMemo(() => ({
    review: { title: '评价窗口', placeholder: '填写评价内容' },
    followUp: { title: '追评窗口', placeholder: '填写追评内容' },
    appeal: { title: '申诉窗口', placeholder: '填写申诉原因' },
    reject: { title: '认证处理窗口', placeholder: '填写处理原因' },
    arbitrate: { title: '申诉处理窗口', placeholder: '填写处理说明' },
    creditRule: { title: '信用规则说明', placeholder: '' }
  }), [])

  const current = config[dialogType]

  return (
    <>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {Object.entries(config).map(([key, item]) => (
          <Button key={key} variant="outlined" onClick={() => setDialogType(key)}>{item.title}</Button>
        ))}
      </Stack>
      <Dialog open={Boolean(dialogType)} onClose={() => setDialogType('')} fullWidth maxWidth="sm" className="credit-rule-dialog">
        <DialogTitle>{current?.title}</DialogTitle>
        <DialogContent>
          {dialogType === 'creditRule' ? (
            <Alert severity="info">信用分综合参考履约表现、评价反馈、申诉处理结果与平台规则。</Alert>
          ) : (
            <TextField
              fullWidth
              multiline
              minRows={4}
              label={current?.placeholder}
              value={text}
              onChange={event => setText(event.target.value)}
              helperText={`${text.length}/300`}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogType('')}>关闭</Button>
          <Button variant="contained" disabled={dialogType !== 'creditRule' && !text.trim()} onClick={() => setDialogType('')}>确认</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export function DLineUiPreview() {
  const navigate = useNavigate()

  return (
    <Box className="dev-preview-page">
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="overline" color="primary">界面预览</Typography>
          <Typography variant="h4" fontWeight={900}>界面状态预览</Typography>
          <Typography color="text.secondary">这里集中展示加载、空状态、失败状态、弹窗和反馈效果。</Typography>
        </Box>
      </Stack>

      <Section title="通知状态" subtitle="验证铃铛红点、自动已读和单次晃动。">
        <DemoBell />
      </Section>

      <Section title="信用模块入口" subtitle="从这里进入高保真信用详情页。">
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="contained" onClick={() => navigate('/profile/credit?demo=1')}>个人主页信用详情</Button>
          <Button variant="outlined" onClick={() => navigate('/users/demo-user/credit?demo=1')}>公开主页信用详情</Button>
        </Stack>
      </Section>

      <Section title="状态样例" subtitle="保留真实页面需要的加载、空状态和失败状态。">
        <Stack gap={1.25}>
          <Paper className="dev-preview-state">
            <CircularProgress size={24} />
            <span>加载中</span>
          </Paper>
          <Paper className="dev-preview-state empty">
            <strong>暂无数据</strong>
            <span>该状态用于正式页面空列表。</span>
          </Paper>
          <Paper className="dev-preview-state error">
            <strong>暂时无法加载信用数据</strong>
            <span>请稍后重试</span>
          </Paper>
        </Stack>
      </Section>

      <Section title="弹窗" subtitle="全部使用 MUI Dialog，不使用原生 alert/prompt。">
        <DialogPreview />
      </Section>

      <Section title="反馈状态" subtitle="成功、失败、网络异常和权限问题。">
        <FeedbackPlayground />
      </Section>
    </Box>
  )
}
