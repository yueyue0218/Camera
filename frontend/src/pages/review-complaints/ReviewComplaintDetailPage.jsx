import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { reviewComplaintApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, Feedback, PageHeader, formatDateTime, panelSx, portra } from '../dline/shared.jsx'
import { demoReviewComplaints } from '../../mocks/dline/reviewFixtures.js'

function useComplaintDemoMode() {
  const [params] = useSearchParams()
  return import.meta.env.DEV && params.get('demo') === '1'
}

function complaintTone(status) {
  const value = String(status || '').trim().toUpperCase()

  if (value === 'REJECTED') {
    return {
      label: '已驳回',
      chipColor: 'warning',
      accent: '#c76a00',
      surface: 'rgba(255,196,86,.12)',
      severity: 'warning'
    }
  }

  if (value === 'APPROVED' || value === 'REVIEW_HIDDEN' || value === 'RESOLVED') {
    return {
      label: '已处理',
      chipColor: 'success',
      accent: '#157347',
      surface: 'rgba(46,160,67,.10)',
      severity: 'success'
    }
  }

  if (value === 'PROCESSING') {
    return {
      label: '处理中',
      chipColor: 'info',
      accent: portra.primary,
      surface: 'rgba(13,47,178,.10)',
      severity: 'info'
    }
  }

  return {
    label: '待处理',
    chipColor: 'primary',
    accent: portra.primary,
    surface: 'rgba(13,47,178,.08)',
    severity: 'info'
  }
}

function ComplaintLoadingState() {
  return (
    <Stack gap={1.5}>
      <Paper
        variant="outlined"
        sx={{
          ...panelSx,
          p: 2.5,
          borderRadius: 4,
          background:
            'radial-gradient(circle at top right, rgba(13,47,178,.08), transparent 28%), linear-gradient(145deg, rgba(255,253,248,.98), rgba(247,244,237,.96))'
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="overline" sx={{ color: portra.primary, fontWeight: 900, letterSpacing: '.16em' }}>
              评价申诉
            </Typography>
            <Skeleton variant="text" width="42%" height={40} sx={{ mt: 0.75 }} />
            <Skeleton variant="text" width="76%" height={26} />
          </Box>
          <Skeleton variant="rounded" width={88} height={30} />
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Paper key={index} variant="outlined" sx={{ ...panelSx, p: 1.75, flex: '1 1 0', borderRadius: 3 }}>
            <Skeleton variant="text" width="46%" height={20} />
            <Skeleton variant="text" width="68%" height={32} sx={{ mt: 0.5 }} />
          </Paper>
        ))}
      </Stack>

      {Array.from({ length: 2 }).map((_, index) => (
        <Paper key={index} variant="outlined" sx={{ ...panelSx, p: 2, borderRadius: 3.5 }}>
          <Skeleton variant="text" width={120} height={22} />
          <Skeleton variant="text" width="100%" height={26} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="94%" height={26} />
          <Skeleton variant="text" width="78%" height={26} />
        </Paper>
      ))}
    </Stack>
  )
}

export function ReviewComplaintDetailPage() {
  const { complaintId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const demoMode = useComplaintDemoMode()
  const [detail, setDetail] = useState(null)
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(false)
  const tone = useMemo(() => complaintTone(detail?.status), [detail?.status])

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        const data = demoMode ? demoReviewComplaints[0] : await reviewComplaintApi.detail(complaintId, currentUser)
        if (alive) {
          setDetail(data || null)
          setFeedback({})
        }
      } catch (error) {
        if (alive) setFeedback({ error: error.message || '申诉详情加载失败' })
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [complaintId, currentUser, demoMode])

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="申诉处理"
        title="评价申诉详情"
        description="查看申诉原因、处理状态和仲裁结果。"
        action={<Button onClick={() => navigate(-1)}>返回</Button>}
      />
      <Feedback {...feedback} />

      {loading ? <ComplaintLoadingState /> : null}

      {!loading && detail ? (
        <Stack spacing={1.5}>
          <Paper
            sx={{
              ...panelSx,
              p: 2.5,
              borderRadius: 4,
              border: `1px solid ${tone.surface}`,
              background:
                `radial-gradient(circle at top right, ${tone.surface}, transparent 30%), linear-gradient(145deg, rgba(255,253,248,.98), rgba(247,244,237,.96))`
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" sx={{ color: tone.accent, fontWeight: 900, letterSpacing: '.16em' }}>
                  申诉详情
                </Typography>
                <Typography variant="h5" fontWeight={900}>
                  申诉 #{detail.complaintId || complaintId}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.8 }}>
                  这里会展示申诉原因、当前状态和最终处理结果，方便随时查看进展。
                </Typography>
              </Box>
              <Chip
                label={tone.label}
                color={tone.chipColor}
                sx={{ fontWeight: 800, minWidth: 84 }}
              />
            </Stack>
          </Paper>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Paper variant="outlined" sx={{ ...panelSx, p: 1.75, flex: '1 1 0', minWidth: 160, borderRadius: 3.5 }}>
              <Typography variant="caption" color="text.secondary">关联订单</Typography>
              <Typography fontWeight={900} sx={{ mt: 0.5 }}>#{detail.orderId}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ ...panelSx, p: 1.75, flex: '1 1 0', minWidth: 160, borderRadius: 3.5 }}>
              <Typography variant="caption" color="text.secondary">关联评价</Typography>
              <Typography fontWeight={900} sx={{ mt: 0.5 }}>#{detail.reviewId}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ ...panelSx, p: 1.75, flex: '1 1 0', minWidth: 160, borderRadius: 3.5 }}>
              <Typography variant="caption" color="text.secondary">提交时间</Typography>
              <Typography fontWeight={900} sx={{ mt: 0.5 }}>{formatDateTime(detail.createdAt)}</Typography>
            </Paper>
          </Stack>

          <Alert severity={tone.severity} sx={{ borderRadius: 3 }}>
            {detail.arbitrationResult
              ? `当前状态：${tone.label}。本条申诉已有处理结论，可结合下方处理结果查看。`
              : `当前状态：${tone.label}。申诉正在处理中，最终结果会同步到这里。`}
          </Alert>

          <Stack gap={1.5}>
            <Paper variant="outlined" sx={{ ...panelSx, p: 2.1, borderRadius: 3.5 }}>
              <Typography variant="overline" sx={{ color: tone.accent, fontWeight: 900, letterSpacing: '.14em' }}>
                申诉原因
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, mt: 1 }}>
                {detail.reason || '暂无原因'}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ ...panelSx, p: 2.1, borderRadius: 3.5 }}>
              <Typography variant="overline" sx={{ color: tone.accent, fontWeight: 900, letterSpacing: '.14em' }}>
                处理结果
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, mt: 1 }}>
                {detail.arbitrationResult || '暂未处理'}
                {detail.arbitrationComment ? `，${detail.arbitrationComment}` : ''}
              </Typography>
            </Paper>
          </Stack>
        </Stack>
      ) : null}

      {!loading && !detail ? <EmptyState text="暂无申诉详情" /> : null}
    </Stack>
  )
}
