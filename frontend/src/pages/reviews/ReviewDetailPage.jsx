import { useEffect, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { reviewApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, Feedback, PageHeader, formatDateTime, panelSx, portra } from '../dline/shared.jsx'
import { ReviewScore, reviewDirectionLabel } from './ReviewPage.jsx'

export function ReviewDetailPage() {
  const navigate = useNavigate()
  const { reviewId } = useParams()
  const { currentUser } = useAuth()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState({})
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        const data = await reviewApi.detail(reviewId, currentUser)
        if (!alive) return
        setReview(data)
        setFeedback({})
        if (data?.replyContent) {
          setReplyOpen(false)
        }
      } catch (error) {
        if (alive) setFeedback({ error: error.message })
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [currentUser, reviewId])

  const hasReply = Boolean(review?.replyContent)

  async function submitReply() {
    if (!replyContent.trim()) {
      setFeedback({ error: '请先填写追评内容' })
      return
    }
    setReplySubmitting(true)
    try {
      await reviewApi.followUp(reviewId, { content: replyContent.trim() }, currentUser)
      const data = await reviewApi.detail(reviewId, currentUser)
      setReview(data)
      setReplyOpen(false)
      setReplyContent('')
      setFeedback({ success: '追评已提交' })
    } catch (error) {
      setFeedback({ error: error.message })
    } finally {
      setReplySubmitting(false)
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="评价记录"
        title="评价详情"
        description="查看单条评价内容并追加追评。"
        action={<Button onClick={() => navigate(-1)}>返回</Button>}
      />

      <Feedback {...feedback} />

      {loading ? <EmptyState>正在加载评价详情...</EmptyState> : null}

      {!loading && review ? (
        <Paper sx={{ ...panelSx, p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Box>
                <Typography variant="overline" sx={{ color: portra.primary, fontWeight: 900, letterSpacing: '.14em' }}>
                  {reviewDirectionLabel(review.direction)}
                </Typography>
                <Typography variant="h5" fontWeight={900}>
                  订单 #{review.orderId || '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  评价时间 {formatDateTime(review.createdAt)}
                </Typography>
              </Box>
              <ReviewScore value={review.rating} />
            </Stack>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                评价正文
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                {review.content || '暂无评价正文'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                评价方向
              </Typography>
              <Typography>{reviewDirectionLabel(review.direction)}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                追评内容
              </Typography>
              {review.replyContent ? (
                <Stack spacing={0.75}>
                  <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                    {review.replyContent}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    追评时间 {formatDateTime(review.replyTime)}
                  </Typography>
                </Stack>
              ) : (
                <Typography color="text.secondary">暂无追评</Typography>
              )}
            </Box>

            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              {review.orderId ? (
                <Button
                  variant="outlined"
                  startIcon={<ReceiptLongRoundedIcon />}
                  onClick={() => navigate(`/orders?orderId=${review.orderId}`)}
                >
                  查看关联订单
                </Button>
              ) : null}
              {!hasReply ? (
                <Button
                  variant="contained"
                  startIcon={<RateReviewRoundedIcon />}
                  onClick={() => setReplyOpen(true)}
                >
                  追加追评
                </Button>
              ) : null}
              {hasReply ? (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  已有追评，无法再次提交
                </Alert>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {!loading && !review ? <EmptyState>暂无评价详情</EmptyState> : null}

      <Dialog open={replyOpen} onClose={() => setReplyOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>追加追评</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="追评正文"
              multiline
              minRows={4}
              value={replyContent}
              onChange={event => setReplyContent(event.target.value)}
              disabled={replySubmitting}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplyOpen(false)} disabled={replySubmitting}>取消</Button>
          <Button
            variant="contained"
            onClick={submitReply}
            disabled={replySubmitting}
          >
            {replySubmitting ? '提交中...' : '提交追评'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(feedback.success || feedback.error)}
        autoHideDuration={2800}
        onClose={() => setFeedback({})}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={feedback.error ? 'error' : 'success'}
          onClose={() => setFeedback({})}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {feedback.error || feedback.success || ''}
        </Alert>
      </Snackbar>
    </Stack>
  )
}
