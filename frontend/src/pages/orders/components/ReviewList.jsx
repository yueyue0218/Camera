import { useEffect, useMemo, useRef } from 'react'
import { Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { ReviewStarsDisplay } from '../../../components/reviews/ReviewStarsDisplay.jsx'
import { reviewDisplayName, reviewInitial, reviewRoleLabel } from '../../../components/reviews/ReviewArchiveCard.jsx'
import { formatTime } from '../utils/orderStatusUtils.js'
import { EmptyOrderCard } from './EmptyOrderCard.jsx'

export function ReviewList({
  reviews,
  complaints = [],
  emptyText = '暂无历史评价',
  currentUserId,
  focusedReviewId = '',
  focusedComplaintId = '',
  complainableReviewId = '',
  onFollowUp,
  onComplain
}) {
  const reviewRefs = useRef(new Map())
  const complaintRefs = useRef(new Map())
  const complaintMap = useMemo(() => {
    const map = new Map()
    complaints.forEach(item => {
      const key = String(item.reviewId || '')
      if (!key) return
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    })
    return map
  }, [complaints])

  useEffect(() => {
    if (focusedComplaintId) {
      const node = complaintRefs.current.get(String(focusedComplaintId))
      if (node) {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
    }
    if (focusedReviewId) {
      const node = reviewRefs.current.get(String(focusedReviewId))
      if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [focusedReviewId, focusedComplaintId, reviews, complaints])

  if (!reviews.length) return <EmptyOrderCard text={emptyText} />

  return (
    <Stack spacing={1.2}>
      {reviews.map(review => {
        const reviewKey = String(review.reviewId || `${review.orderId}-${review.direction}-${review.createdAt}`)
        const reviewComplaints = complaintMap.get(String(review.reviewId || '')) || []
        const canFollowUp = (
          Number(review.reviewerId) === Number(currentUserId)
          && review.isVisible !== false
          && !review.replyContent
          && !String(review.reviewId || '').startsWith('local')
        )
        const canComplain = (
          typeof onComplain === 'function'
          && review.isVisible !== false
          && String(complainableReviewId || '') === String(review.reviewId || '')
        )
        const isReviewFocused = focusedReviewId && String(focusedReviewId) === String(review.reviewId)

        return (
          <Paper
            key={reviewKey}
            ref={node => {
              if (node) reviewRefs.current.set(String(review.reviewId || reviewKey), node)
              else reviewRefs.current.delete(String(review.reviewId || reviewKey))
            }}
            variant="outlined"
            sx={{
              p: 1.5,
              bgcolor: '#fffdf8',
              borderColor: isReviewFocused ? 'rgba(29, 78, 216, .28)' : 'rgba(18, 44, 98, .10)',
              borderRadius: 3,
              boxShadow: isReviewFocused ? '0 0 0 2px rgba(29, 78, 216, .08)' : '0 8px 20px rgba(28, 38, 64, .045)'
            }}
          >
            <Stack spacing={1.15}>
              <Stack direction="row" spacing={1.1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.1 }}>
                <Stack direction="row" spacing={1.05} sx={{ minWidth: 0 }}>
                  <Avatar
                    sx={{
                      width: 38,
                      height: 38,
                      bgcolor: '#e8f0ff',
                      color: '#1d4ed8',
                      fontSize: 14,
                      fontWeight: 900
                    }}
                  >
                    {reviewInitial(review.reviewerNickname)}
                  </Avatar>
                  <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.6 }}>
                      <Typography sx={{ color: '#1f2937', fontWeight: 900, lineHeight: 1.2 }}>
                        {reviewDisplayName(review.reviewerNickname)}
                      </Typography>
                      <Chip
                        size="small"
                        label={reviewRoleLabel(review.direction)}
                        sx={{
                          height: 24,
                          borderRadius: 999,
                          fontWeight: 800,
                          bgcolor: 'rgba(29, 78, 216, .08)',
                          color: '#1d4ed8',
                          '& .MuiChip-label': { px: 1.05 }
                        }}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ color: '#7b8391' }}>
                      {formatTime(review.createdAt)}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack spacing={0.7} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  <ReviewStarsDisplay value={review.rating} emphasize />
                  {review.complaintStatus ? (
                    <Chip
                      size="small"
                      label={formatComplaintStatus(review.complaintStatus)}
                      sx={complaintBadgeSx(review.complaintStatus)}
                    />
                  ) : null}
                </Stack>
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  p: 1.15,
                  bgcolor: '#fffaf0',
                  borderColor: 'rgba(191, 167, 122, .18)',
                  borderRadius: 2.4
                }}
              >
                <Typography sx={{ color: '#2a3240', lineHeight: 1.82, whiteSpace: 'pre-wrap', fontWeight: 600 }}>
                  {review.content || '对方没有留下文字评价'}
                </Typography>
              </Paper>

              <Stack direction="row" spacing={1.4} sx={{ flexWrap: 'wrap', rowGap: 0.55, alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: '#8a92a0' }}>评价对象</Typography>
                  <Typography sx={{ mt: 0.15, color: '#243041', fontWeight: 800 }}>
                    {reviewDisplayName(review.targetUserNickname)}
                  </Typography>
                </Box>
              </Stack>

              {review.replyContent ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.05,
                    bgcolor: '#f4f8ff',
                    borderColor: 'rgba(29, 78, 216, .14)',
                    borderRadius: 2.3
                  }}
                >
                  <Stack spacing={0.45}>
                    <Typography sx={{ fontSize: 12, color: '#1d4ed8', fontWeight: 900 }}>
                      追加追评
                    </Typography>
                    <Typography sx={{ color: '#2a3240', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                      {review.replyContent}
                    </Typography>
                    {review.replyTime ? (
                      <Typography variant="body2" sx={{ color: '#7b8391' }}>
                        {formatTime(review.replyTime)}
                      </Typography>
                    ) : null}
                  </Stack>
                </Paper>
              ) : null}

              {(canFollowUp || canComplain) ? (
                <Stack direction="row" spacing={0.9} sx={{ flexWrap: 'wrap', rowGap: 0.7 }}>
                  {canFollowUp ? (
                    <Button size="small" variant="text" onClick={() => onFollowUp?.(review)} sx={miniActionSx}>
                      追加追评
                    </Button>
                  ) : null}
                  {canComplain ? (
                    <Button size="small" variant="outlined" color="inherit" onClick={() => onComplain?.(review)} sx={miniOutlinedSx}>
                      投诉评价
                    </Button>
                  ) : null}
                </Stack>
              ) : null}

              {reviewComplaints.length ? (
                <Stack spacing={0.9}>
                  <Typography sx={{ color: '#7b8391', fontSize: 12, fontWeight: 900, letterSpacing: '.06em' }}>
                    申诉记录与处理结果
                  </Typography>
                  {reviewComplaints.map(item => {
                    const complaintKey = String(item.complaintId || item.arbitrationId)
                    const isComplaintFocused = focusedComplaintId && String(focusedComplaintId) === complaintKey
                    return (
                      <Paper
                        key={complaintKey}
                        ref={node => {
                          if (node) complaintRefs.current.set(complaintKey, node)
                          else complaintRefs.current.delete(complaintKey)
                        }}
                        variant="outlined"
                        sx={{
                          p: 1.1,
                          bgcolor: '#faf7f1',
                          borderColor: isComplaintFocused ? 'rgba(214, 141, 53, .32)' : 'rgba(152, 120, 79, .14)',
                          borderRadius: 2.5,
                          boxShadow: isComplaintFocused ? '0 0 0 2px rgba(214, 141, 53, .08)' : 'none'
                        }}
                      >
                        <Stack spacing={0.75}>
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ color: '#3f3528', fontWeight: 900 }}>
                              {item.reason || '评价申诉记录'}
                            </Typography>
                            <Chip size="small" label={formatComplaintOutcome(item)} sx={complaintBadgeSx(item.arbitrationResult || item.status)} />
                          </Stack>
                          {item.description ? (
                            <Typography sx={{ color: '#5b5145', lineHeight: 1.72, whiteSpace: 'pre-wrap' }}>
                              {item.description}
                            </Typography>
                          ) : null}
                          {item.arbitrationComment ? (
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 0.95,
                                bgcolor: '#fffdf8',
                                borderColor: 'rgba(138, 114, 84, .14)',
                                borderRadius: 2
                              }}
                            >
                              <Typography sx={{ color: '#7a5d39', fontSize: 12, fontWeight: 900 }}>
                                处理说明
                              </Typography>
                              <Typography sx={{ mt: 0.45, color: '#52473e', lineHeight: 1.68, whiteSpace: 'pre-wrap' }}>
                                {item.arbitrationComment}
                              </Typography>
                            </Paper>
                          ) : null}
                          <Stack direction="row" spacing={1.1} sx={{ flexWrap: 'wrap', rowGap: 0.45 }}>
                            <Typography variant="body2" sx={{ color: '#84786d' }}>
                              提交时间：{formatTime(item.createdAt)}
                            </Typography>
                            {item.handledAt ? (
                              <Typography variant="body2" sx={{ color: '#84786d' }}>
                                处理时间：{formatTime(item.handledAt)}
                              </Typography>
                            ) : null}
                          </Stack>
                        </Stack>
                      </Paper>
                    )
                  })}
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        )
      })}
    </Stack>
  )
}

function formatComplaintStatus(status) {
  const text = String(status || '').toUpperCase()
  if (text === 'APPROVED') return '申诉通过'
  if (text === 'REJECTED') return '申诉驳回'
  if (text === 'RESOLVED') return '已处理'
  if (text === 'PROCESSING') return '处理中'
  if (text === 'PENDING') return '待处理'
  return '申诉记录'
}

function formatComplaintOutcome(item) {
  const result = String(item?.arbitrationResult || '').toUpperCase()
  if (result === 'APPROVED') return '申诉通过'
  if (result === 'REJECTED') return '申诉驳回'
  return formatComplaintStatus(item?.status)
}

function complaintBadgeSx(status) {
  const text = String(status || '').toUpperCase()
  const approved = text === 'APPROVED'
  const rejected = text === 'REJECTED'
  const active = text === 'PROCESSING' || text === 'PENDING'
  return {
    height: 24,
    borderRadius: 999,
    fontWeight: 800,
    bgcolor: approved ? 'rgba(22, 163, 74, .10)' : rejected ? 'rgba(239, 68, 68, .10)' : active ? 'rgba(29, 78, 216, .08)' : 'rgba(107, 114, 128, .10)',
    color: approved ? '#15803d' : rejected ? '#dc2626' : active ? '#1d4ed8' : '#5b6472'
  }
}

const miniActionSx = {
  minHeight: 30,
  px: 0.35,
  color: '#1d4ed8',
  fontWeight: 900,
  borderRadius: 999,
  '&:hover': { bgcolor: 'rgba(29, 78, 216, .06)' }
}

const miniOutlinedSx = {
  minHeight: 30,
  px: 1.1,
  color: '#4b5563',
  borderColor: 'rgba(107, 114, 128, .26)',
  fontWeight: 850,
  borderRadius: 999,
  '&:hover': { borderColor: 'rgba(29, 78, 216, .24)', color: '#1d4ed8', bgcolor: 'rgba(29, 78, 216, .03)' }
}
