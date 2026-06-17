import { useEffect, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Snackbar, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { adminApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { demoAdminComplaints, demoAdminDashboard, demoCertifications } from '../../mocks/dline/adminFixtures.js'
import { EmptyState, Feedback, PageHeader, StatusChip, formatDateTime, panelSx } from '../dline/shared.jsx'

function Dashboard({ data }) {
  if (!data) return null
  const metrics = [
    ['总用户', data.totalUsers],
    ['今日 GMV', `¥${((data.todayGmvCent || 0) / 100).toFixed(2)}`],
    ['待审核', data.pendingAuditCount],
    ['待仲裁', data.pendingArbitrationCount]
  ]

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} flexWrap="wrap">
      {metrics.map(([label, value]) => (
        <Paper key={label} sx={{ ...panelSx, p: 2, minWidth: 180, flex: 1 }}>
          <Typography variant="overline">{label}</Typography>
          <Typography variant="h5" fontWeight={900}>{value}</Typography>
        </Paper>
      ))}
    </Stack>
  )
}

export function AdminPage() {
  const { currentUser } = useAuth()
  const [params] = useSearchParams()
  const demoMode = import.meta.env.DEV && params.get('demo') === '1'
  const hasAdminAccess = currentUser?.role === 'ADMIN' || currentUser?.adminCapable
  const [tab, setTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [certifications, setCertifications] = useState([])
  const [complaints, setComplaints] = useState([])
  const [feedback, setFeedback] = useState({})
  const [dialog, setDialog] = useState(null)
  const [dialogText, setDialogText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    if (!demoMode && !hasAdminAccess) return
    try {
      const [dashboardData, certificationItems, complaintItems] = demoMode
        ? [demoAdminDashboard, demoCertifications, demoAdminComplaints]
        : await Promise.all([
          adminApi.dashboard(currentUser),
          adminApi.listCertifications({ status: 'PENDING' }, currentUser),
          adminApi.listReviewComplaints({ status: 'PENDING' }, currentUser)
        ])
      setDashboard(dashboardData)
      setCertifications(certificationItems)
      setComplaints(complaintItems)
      setFeedback({})
    } catch (error) {
      setFeedback({ error: error.message })
    }
  }

  useEffect(() => { load() }, [])

  const reviewCertification = async (item, result, reason = '') => {
    try {
      setSubmitting(true)
      if (!demoMode) await adminApi.reviewCertification(item.type, item.id, { result, reason }, currentUser)
      setFeedback({ success: result === 'APPROVED' ? '认证审核已通过' : '驳回结果已提交' })
      closeDialog()
      if (demoMode) {
        setCertifications(current => current.map(certification => certification.id === item.id ? { ...certification, status: result } : certification))
      } else {
        await load()
      }
    } catch (error) {
      setFeedback({ error: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  const arbitrate = async (item, result, comment = '') => {
    try {
      setSubmitting(true)
      if (!demoMode) await adminApi.arbitrateReviewComplaint(item.complaintId, { result, comment }, currentUser)
      setFeedback({ success: '仲裁结果已保存' })
      closeDialog()
      if (demoMode) {
        setComplaints(current => current.map(complaint => complaint.complaintId === item.complaintId ? { ...complaint, status: result, arbitrationResult: result, arbitrationComment: comment } : complaint))
      } else {
        await load()
      }
    } catch (error) {
      setFeedback({ error: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  const openDialog = nextDialog => {
    setDialog(nextDialog)
    setDialogText('')
    setFeedback({})
  }

  const closeDialog = () => {
    setDialog(null)
    setDialogText('')
  }

  const submitDialog = () => {
    if (!dialog) return
    if (dialog.requireText && !dialogText.trim()) {
      setFeedback({ error: dialog.emptyMessage })
      return
    }
    if (dialog.kind === 'certification') reviewCertification(dialog.item, dialog.result, dialogText.trim())
    if (dialog.kind === 'complaint') arbitrate(dialog.item, dialog.result, dialogText.trim())
  }

  if (!demoMode && !hasAdminAccess) {
    return (
      <Box>
        <PageHeader title="管理后台" description="审核和仲裁入口。" />
        <Alert severity="warning">当前账号不是管理员。后端演示登录暂未开放 ADMIN 角色，请使用具备管理员权限的环境账号访问。</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader title="管理后台" description="处理认证审核与评价申诉仲裁。" />
      {demoMode ? <Box sx={{ mb: 2 }}><Alert severity="info">当前内容仅供参考</Alert></Box> : null}
      <Feedback {...feedback} />
      <Snackbar
        open={Boolean(feedback.success)}
        autoHideDuration={2600}
        onClose={() => setFeedback({})}
        message={feedback.success}
      />
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="dashboard" label="概览" />
        <Tab value="certifications" label="认证审核" />
        <Tab value="complaints" label="评价申诉" />
      </Tabs>
      {tab === 'dashboard' ? <Dashboard data={dashboard} /> : null}
      {tab === 'certifications' ? (
        !certifications.length ? <EmptyState>当前没有待审核认证。</EmptyState> : (
          <Stack gap={1.5}>
            {certifications.map(item => (
              <Paper key={`${item.type}-${item.id}`} sx={{ ...panelSx, p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                  <Box>
                    <Stack direction="row" gap={1}><StatusChip value={item.status} /><Typography fontWeight={900}>{item.type} / 用户 #{item.userId}</Typography></Stack>
                    <Typography color="text.secondary">{item.realNameMasked || item.university || '待核验资料'}</Typography>
                    <Typography variant="caption">{formatDateTime(item.appliedAt)}</Typography>
                  </Box>
                  <Stack direction="row" gap={1}>
                    <Button variant="contained" disabled={submitting} onClick={() => reviewCertification(item, 'APPROVED')}>通过</Button>
                    <Button color="error" disabled={submitting} onClick={() => openDialog({ kind: 'certification', item, result: 'REJECTED', title: '驳回认证', label: '驳回原因', requireText: true, emptyMessage: '请填写驳回原因' })}>驳回</Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )
      ) : null}
      {tab === 'complaints' ? (
        !complaints.length ? <EmptyState>当前没有待仲裁评价申诉。</EmptyState> : (
          <Stack gap={1.5}>
            {complaints.map(item => (
              <Paper key={item.complaintId} sx={{ ...panelSx, p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                  <Box>
                    <Stack direction="row" gap={1}><StatusChip value={item.status} /><Typography fontWeight={900}>评价 #{item.reviewId}</Typography></Stack>
                    <Typography color="text.secondary">{item.reason}</Typography>
                    <Typography variant="caption">{formatDateTime(item.createdAt)}</Typography>
                  </Box>
                  <Stack direction="row" gap={1}>
                    <Button variant="contained" disabled={submitting} onClick={() => openDialog({ kind: 'complaint', item, result: 'REVIEW_HIDDEN', title: '支持评价申诉', label: '仲裁说明', requireText: false })}>支持申诉</Button>
                    <Button color="error" disabled={submitting} onClick={() => openDialog({ kind: 'complaint', item, result: 'REJECTED', title: '驳回评价申诉', label: '仲裁说明', requireText: false })}>驳回申诉</Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )
      ) : null}
      <Dialog className="portra-dialog" open={Boolean(dialog)} onClose={submitting ? undefined : closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{dialog?.title}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            {dialog?.kind === 'certification' ? `认证对象：${dialog.item?.type} / 用户 #${dialog.item?.userId}` : `评价申诉：#${dialog?.item?.complaintId}`}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={4}
            label={dialog?.label}
            value={dialogText}
            inputProps={{ maxLength: 255 }}
            helperText={`${dialogText.length}/255`}
            onChange={event => setDialogText(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>取消</Button>
          <Button variant="contained" onClick={submitDialog} disabled={submitting || (dialog?.requireText && !dialogText.trim())}>
            {submitting ? '提交中...' : '确认提交'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
