import { useEffect, useMemo, useRef } from 'react'
import { Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import { ReviewStarsDisplay } from '../../../components/reviews/ReviewStarsDisplay.jsx'
import { ReviewAvatar, reviewDisplayName, reviewRoleHint, reviewRoleLabel } from '../../../components/reviews/ReviewArchiveCard.jsx'
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
    <Stack spacing={1.35}>
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
              p: 1.55,
              bgcolor: '#fffdf8',
              borderColor: isReviewFocused ? 'rgba(29, 78, 216, .28)' : 'rgba(18, 44, 98, .10)',
              borderRadius: 3.1,
              boxShadow: isReviewFocused ? '0 0 0 2px rgba(29, 78, 216, .08)' : '0 8px 18px rgba(28, 38, 64, .04)'
            }}
          >
            <Stack spacing={1.1}>
              <Stack direction="row" spacing={1.1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.2 }}>
                <Stack direction="row" spacing={1.05} sx={{ minWidth: 0, flex: 1 }}>
                  <ReviewAvatar
                    userId={review.reviewerId}
                    roleHint={reviewRoleHint(review.direction)}
                    displayName={review.reviewerNickname}
                    size={40}
                  />
                  <Stack spacing={0.36} sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.55 }}>
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

                <Stack spacing={0.85} sx={{ alignItems: 'flex-end', minWidth: 118, flexShrink: 0 }}>
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
                  p: 1.18,
                  bgcolor: '#fffaf0',
                  borderColor: 'rgba(191, 167, 122, .18)',
                  borderRadius: 2.45
                }}
              >
                <Typography sx={{ color: '#2a3240', lineHeight: 1.82, whiteSpace: 'pre-wrap', fontWeight: 600 }}>
                  {review.content || '对方没有留下文字评价'}
                </Typography>
              </Paper>

              <Typography variant="body2" sx={{ color: '#7c8695', pl: 0.15 }}>
                评价对象：<Box component="span" sx={{ color: '#243041', fontWeight: 800 }}>{reviewDisplayName(review.targetUserNickname)}</Box>
              </Typography>

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

              {reviewComplaints.length ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.08,
                    bgcolor: '#faf7f1',
                    borderColor: 'rgba(152, 120, 79, .14)',
                    borderRadius: 2.6
                  }}
                >
                  <Stack spacing={0.95}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography sx={{ color: '#6d5a40', fontSize: 12, fontWeight: 900, letterSpacing: '.06em' }}>
                        申诉记录
                      </Typography>
                      {review.complaintStatus ? (
                        <Chip size="small" label={formatComplaintStatus(review.complaintStatus)} sx={complaintBadgeSx(review.complaintStatus)} />
                      ) : null}
                    </Stack>
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
                            p: 1,
                            bgcolor: '#fffdfa',
                            borderColor: isComplaintFocused ? 'rgba(214, 141, 53, .28)' : 'rgba(138, 114, 84, .14)',
                            borderRadius: 2.3,
                            boxShadow: isComplaintFocused ? '0 0 0 2px rgba(214, 141, 53, .08)' : 'none'
                          }}
                        >
                          <Stack spacing={0.75}>
                            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                              <Typography sx={{ color: '#3f3528', fontWeight: 900 }}>
                                处理结果
                              </Typography>
                              <Chip size="small" label={formatComplaintOutcome(item)} sx={complaintBadgeSx(item.arbitrationResult || item.status)} />
                            </Stack>

                            <ComplaintLine label="申诉理由" value={item.reason || '评价申诉记录'} />
                            {item.description ? <ComplaintLine label="补充说明" value={item.description} /> : null}

                            {item.arbitrationComment ? (
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 0.92,
                                  bgcolor: '#fff7ea',
                                  borderColor: 'rgba(214, 141, 53, .18)',
                                  borderRadius: 2
                                }}
                              >
                                <Stack spacing={0.35}>
                                  <Typography sx={{ color: '#8b5f22', fontSize: 12, fontWeight: 900 }}>
                                    处理说明
                                  </Typography>
                                  <Typography sx={{ color: '#52473e', lineHeight: 1.68, whiteSpace: 'pre-wrap' }}>
                                    {item.arbitrationComment}
                                  </Typography>
                                </Stack>
                              </Paper>
                            ) : null}

                            <Divider sx={{ borderColor: 'rgba(138, 114, 84, .12)' }} />

                            <Stack direction="row" spacing={1.1} sx={{ flexWrap: 'wrap', rowGap: 0.35 }}>
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
                </Paper>
              ) : null}

              {(canFollowUp || canComplain) ? (
                <Stack
                  direction="row"
                  spacing={0.9}
                  sx={{
                    flexWrap: 'wrap',
                    rowGap: 0.7,
                    pt: 0.25,
                    borderTop: '1px solid rgba(18, 44, 98, .08)'
                  }}
                >
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
            </Stack>
          </Paper>
        )
      })}
    </Stack>
  )
}

function ComplaintLine({ label, value }) {
  return (
    <Box>
      <Typography sx={{ color: '#8a7660', fontSize: 12, fontWeight: 900 }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.18, color: '#574d42', lineHeight: 1.68, whiteSpace: 'pre-wrap' }}>
        {value}
      </Typography>
    </Box>
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
    color: approved ? '#15803d' : rejected ? '#dc2626' : active ? '#1d4ed8' : '#5b6472',
    '& .MuiChip-label': { px: 1.05 }
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
