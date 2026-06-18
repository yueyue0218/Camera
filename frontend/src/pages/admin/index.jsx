import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { adminApi } from '../../api/index.js'
import {
  demoAdminComplaints,
  demoAdminDashboard,
  demoCertifications
} from '../../mocks/dline/adminFixtures.js'
import {
  EmptyState,
  Feedback,
  PageHeader,
  StatusChip,
  formatDateTime,
  panelSx
} from '../dline/shared.jsx'

const ADMIN_TABS = new Set(['dashboard', 'certifications', 'complaints'])

function certificationFocusKey(item) {
  return `certification-${item.type}-${item.id}`
}

function complaintFocusKey(item) {
  return `complaint-${item.complaintId}`
}

function Dashboard({ data, certifications, complaints, onOpenTab }) {
  if (!data) return null

  const quickCards = [
    {
      key: 'certifications',
      label: '待审核认证',
      value: data.pendingAuditCount ?? 0,
      helper: '进入认证审核队列',
      actionLabel: '查看认证',
      onClick: () => onOpenTab('certifications')
    },
    {
      key: 'complaints',
      label: '待处理申诉',
      value: data.pendingArbitrationCount ?? 0,
      helper: '进入评价申诉队列',
      actionLabel: '查看申诉',
      onClick: () => onOpenTab('complaints')
    }
  ]

  return (
    <Stack gap={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
        {quickCards.map(card => (
          <Paper
            key={card.key}
            sx={{
              ...panelSx,
              p: 2.5,
              flex: 1,
              minWidth: 240,
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 16px 32px rgba(15, 23, 42, 0.10)'
              }
            }}
            onClick={card.onClick}
          >
            <Typography variant="overline">{card.label}</Typography>
            <Typography variant="h4" fontWeight={900} sx={{ mt: 0.5 }}>
              {card.value}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {card.helper}
            </Typography>
            <Button sx={{ mt: 1.5, px: 0 }} onClick={card.onClick}>
              {card.actionLabel}
            </Button>
          </Paper>
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', lg: 'row' }} gap={1.5}>
        <Paper sx={{ ...panelSx, p: 2.5, flex: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="overline">最近待审认证</Typography>
              <Typography variant="body2" color="text.secondary">
                点击后跳到对应审核记录
              </Typography>
            </Box>
            <Button onClick={() => onOpenTab('certifications')}>查看全部</Button>
          </Stack>
          {!certifications.length ? (
            <Typography color="text.secondary">当前没有待审核认证</Typography>
          ) : (
            <Stack gap={1}>
              {certifications.slice(0, 3).map(item => (
                <Paper
                  key={`dashboard-${item.type}-${item.id}`}
                  variant="outlined"
                  sx={{ p: 1.5, cursor: 'pointer' }}
                  onClick={() => onOpenTab('certifications', certificationFocusKey(item))}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1.5}>
                    <Box>
                      <Typography fontWeight={800}>{item.type} / 用户 #{item.userId}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.realNameMasked || item.university || '待核验资料'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(item.appliedAt)}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper sx={{ ...panelSx, p: 2.5, flex: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="overline">最近待处理申诉</Typography>
              <Typography variant="body2" color="text.secondary">
                点击后跳到对应申诉记录
              </Typography>
            </Box>
            <Button onClick={() => onOpenTab('complaints')}>查看全部</Button>
          </Stack>
          {!complaints.length ? (
            <Typography color="text.secondary">当前没有待处理申诉</Typography>
          ) : (
            <Stack gap={1}>
              {complaints.slice(0, 3).map(item => (
                <Paper
                  key={`dashboard-${item.complaintId}`}
                  variant="outlined"
                  sx={{ p: 1.5, cursor: 'pointer' }}
                  onClick={() => onOpenTab('complaints', complaintFocusKey(item))}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1.5}>
                    <Box>
                      <Typography fontWeight={800}>评价 #{item.reviewId}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.reason}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(item.createdAt)}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Stack>
  )
}

export function AdminPage() {
  const { currentUser } = useAuth()
  const [params, setParams] = useSearchParams()
  const demoMode = import.meta.env.DEV && params.get('demo') === '1'
  const hasAdminAccess = currentUser?.role === 'ADMIN' || currentUser?.adminCapable
  const tabParam = params.get('tab')
  const tab = ADMIN_TABS.has(tabParam) ? tabParam : 'dashboard'
  const focusKey = params.get('focus') || ''
  const [dashboard, setDashboard] = useState(null)
  const [certifications, setCertifications] = useState([])
  const [complaints, setComplaints] = useState([])
  const [feedback, setFeedback] = useState({})
  const [dialog, setDialog] = useState(null)
  const [dialogText, setDialogText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openTab = (nextTab, nextFocus = '') => {
    const next = new URLSearchParams(params)
    if (nextTab === 'dashboard') next.delete('tab')
    else next.set('tab', nextTab)

    if (nextFocus) next.set('focus', nextFocus)
    else next.delete('focus')

    setParams(next)
  }

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

  useEffect(() => { load() }, [demoMode, hasAdminAccess, currentUser?.userId])

  useEffect(() => {
    if (!focusKey || tab === 'dashboard') return

    const node = window.document.getElementById(`admin-${tab}-${focusKey}`)
    if (!node) return

    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [focusKey, tab, certifications, complaints])

  const reviewCertification = async (item, result, reason = '') => {
    try {
      setSubmitting(true)
      if (!demoMode) await adminApi.reviewCertification(item.type, item.id, { result, reason }, currentUser)
      setFeedback({ success: result === 'APPROVED' ? '认证审核已通过' : '驳回结果已提交' })
      closeDialog()
      if (demoMode) {
        setCertifications(current => current.map(certification => (
          certification.id === item.id ? { ...certification, status: result } : certification
        )))
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
      setFeedback({ success: '申诉处理结果已保存' })
      closeDialog()
      if (demoMode) {
        setComplaints(current => current.map(complaint => (
          complaint.complaintId === item.complaintId
            ? { ...complaint, status: result, arbitrationResult: result, arbitrationComment: comment }
            : complaint
        )))
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
        <PageHeader title="管理后台" description="审核与申诉处理入口" />
        <Alert severity="warning">当前账号不是管理员，请使用具备管理员权限的账号访问。</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader title="管理后台" description="集中处理认证审核与评价申诉" />
      {demoMode ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info">当前内容仅供参考</Alert>
        </Box>
      ) : null}
      <Feedback {...feedback} />
      <Snackbar
        open={Boolean(feedback.success)}
        autoHideDuration={2600}
        onClose={() => setFeedback({})}
        message={feedback.success}
      />
      <Tabs value={tab} onChange={(_, value) => openTab(value)} sx={{ mb: 2 }}>
        <Tab value="dashboard" label="概览" />
        <Tab value="certifications" label="认证审核" />
        <Tab value="complaints" label="评价申诉" />
      </Tabs>
      {tab === 'dashboard' ? (
        <Dashboard
          data={dashboard}
          certifications={certifications}
          complaints={complaints}
          onOpenTab={openTab}
        />
      ) : null}
      {tab === 'certifications' ? (
        !certifications.length ? (
          <EmptyState>当前没有待审核认证。</EmptyState>
        ) : (
          <Stack gap={1.5}>
            {certifications.map(item => (
              <Paper
                key={`${item.type}-${item.id}`}
                id={`admin-certifications-${certificationFocusKey(item)}`}
                sx={{
                  ...panelSx,
                  p: 2,
                  borderColor: focusKey === certificationFocusKey(item) ? 'primary.main' : undefined,
                  boxShadow: focusKey === certificationFocusKey(item)
                    ? '0 0 0 1px rgba(25, 118, 210, 0.28)'
                    : undefined
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                  <Box>
                    <Stack direction="row" gap={1}>
                      <StatusChip value={item.status} />
                      <Typography fontWeight={900}>{item.type} / 用户 #{item.userId}</Typography>
                    </Stack>
                    <Typography color="text.secondary">
                      {item.realNameMasked || item.university || '待核验资料'}
                    </Typography>
                    <Typography variant="caption">{formatDateTime(item.appliedAt)}</Typography>
                  </Box>
                  <Stack direction="row" gap={1}>
                    <Button variant="contained" disabled={submitting} onClick={() => reviewCertification(item, 'APPROVED')}>
                      通过
                    </Button>
                    <Button
                      color="error"
                      disabled={submitting}
                      onClick={() => openDialog({
                        kind: 'certification',
                        item,
                        result: 'REJECTED',
                        title: '驳回认证',
                        label: '驳回原因',
                        requireText: true,
                        emptyMessage: '请填写驳回原因'
                      })}
                    >
                      驳回
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )
      ) : null}
      {tab === 'complaints' ? (
        !complaints.length ? (
          <EmptyState>当前没有待处理申诉。</EmptyState>
        ) : (
          <Stack gap={1.5}>
            {complaints.map(item => (
              <Paper
                key={item.complaintId}
                id={`admin-complaints-${complaintFocusKey(item)}`}
                sx={{
                  ...panelSx,
                  p: 2,
                  borderColor: focusKey === complaintFocusKey(item) ? 'primary.main' : undefined,
                  boxShadow: focusKey === complaintFocusKey(item)
                    ? '0 0 0 1px rgba(25, 118, 210, 0.28)'
                    : undefined
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                  <Box>
                    <Stack direction="row" gap={1}>
                      <StatusChip value={item.status} />
                      <Typography fontWeight={900}>评价 #{item.reviewId}</Typography>
                    </Stack>
                    <Typography color="text.secondary">{item.reason}</Typography>
                    <Typography variant="caption">{formatDateTime(item.createdAt)}</Typography>
                  </Box>
                  <Stack direction="row" gap={1}>
                    <Button
                      variant="contained"
                      disabled={submitting}
                      onClick={() => openDialog({
                        kind: 'complaint',
                        item,
                        result: 'REVIEW_HIDDEN',
                        title: '支持评价申诉',
                        label: '处理说明',
                        requireText: false
                      })}
                    >
                      支持申诉
                    </Button>
                    <Button
                      color="error"
                      disabled={submitting}
                      onClick={() => openDialog({
                        kind: 'complaint',
                        item,
                        result: 'REJECTED',
                        title: '驳回评价申诉',
                        label: '处理说明',
                        requireText: false
                      })}
                    >
                      驳回申诉
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )
      ) : null}
      <Dialog
        className="portra-dialog"
        open={Boolean(dialog)}
        onClose={submitting ? undefined : closeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{dialog?.title}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            {dialog?.kind === 'certification'
              ? `认证对象：${dialog.item?.type} / 用户 #${dialog.item?.userId}`
              : `评价申诉：#${dialog?.item?.complaintId}`}
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
