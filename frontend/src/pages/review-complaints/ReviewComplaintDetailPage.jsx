import { useEffect, useState } from 'react'
import { Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { reviewComplaintApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, Feedback, PageHeader, formatDateTime, panelSx } from '../dline/shared.jsx'
import { demoReviewComplaints } from '../../mocks/dline/reviewFixtures.js'

function useComplaintDemoMode() {
  const [params] = useSearchParams()
  return import.meta.env.DEV && params.get('demo') === '1'
}

export function ReviewComplaintDetailPage() {
  const { complaintId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const demoMode = useComplaintDemoMode()
  const [detail, setDetail] = useState(null)
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(false)

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
        eyebrow="PORTRA REVIEW"
        title="评价申诉详情"
        description="查看申诉原因、处理状态和仲裁结果。"
        action={<Button onClick={() => navigate(-1)}>返回</Button>}
      />
      <Feedback {...feedback} />
      {loading ? <EmptyState>申诉详情加载中...</EmptyState> : null}
      {detail ? (
        <Paper sx={{ ...panelSx, p: 2 }}>
          <Stack gap={2}>
            <Stack direction="row" justifyContent="space-between" gap={2} flexWrap="wrap">
              <Typography fontWeight={900}>申诉 #{detail.complaintId || complaintId}</Typography>
              <Chip
                label={detail.status || 'UNKNOWN'}
                color={detail.status === 'REJECTED' ? 'warning' : 'primary'}
                sx={{ fontWeight: 800 }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap">
              <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 0', minWidth: 160 }}>
                <Typography variant="caption" color="text.secondary">关联订单</Typography>
                <Typography fontWeight={900}>#{detail.orderId}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 0', minWidth: 160 }}>
                <Typography variant="caption" color="text.secondary">关联评价</Typography>
                <Typography fontWeight={900}>#{detail.reviewId}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 0', minWidth: 160 }}>
                <Typography variant="caption" color="text.secondary">提交时间</Typography>
                <Typography fontWeight={900}>{formatDateTime(detail.createdAt)}</Typography>
              </Paper>
            </Stack>
            <Stack gap={1.5}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900 }}>申诉原因</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>{detail.reason || '暂无原因'}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900 }}>处理结果</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>
                  {detail.arbitrationResult || '暂未处理'}
                  {detail.arbitrationComment ? `：${detail.arbitrationComment}` : ''}
                </Typography>
              </Paper>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  )
}
