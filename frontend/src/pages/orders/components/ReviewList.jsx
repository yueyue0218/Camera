import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { useAuth } from '../../../AuthContext.jsx'
import { userApi } from '../../../api.js'
import { ReviewStarsDisplay } from '../../../components/reviews/ReviewStarsDisplay.jsx'
import { ReviewAvatar, reviewDisplayName, reviewRoleHint, reviewRoleLabel } from '../../../components/reviews/ReviewArchiveCard.jsx'
import { formatTime } from '../utils/orderStatusUtils.js'
import { EmptyOrderCard } from './EmptyOrderCard.jsx'

const reviewNameCache = new Map()

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
              p: 1.8,
              bgcolor: '#fcf8ef',
              borderColor: isReviewFocused ? 'rgba(83, 112, 171, .24)' : 'rgba(169, 145, 108, .14)',
              borderRadius: 3.2,
              boxShadow: isReviewFocused ? '0 0 0 2px rgba(83, 112, 171, .08)' : '0 10px 22px rgba(43, 50, 74, .04)'
            }}
          >
            <Stack spacing={1.2}>
              <Stack direction="row" spacing={1.2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.35 }}>
                <ReviewerIdentityBlock review={review} />

                <ReviewStarsDisplay value={review.rating} emphasize sx={{ minWidth: 96, flexShrink: 0, pt: 0.2, mr: 0.2 }} />
              </Stack>

              <Box
                sx={{
                  px: 1.2,
                  py: 1,
                  bgcolor: 'rgba(246, 238, 225, .96)',
                  borderRadius: 2.45,
                  boxShadow: 'inset 0 0 0 1px rgba(191, 167, 122, .12)'
                }}
              >
                <Typography sx={{ color: '#2a3240', lineHeight: 1.82, whiteSpace: 'pre-wrap', fontWeight: 600 }}>
                  {review.content || '对方没有留下文字评价'}
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ color: '#8490a0', textAlign: 'left' }}>
                评价对象：<Box component="span" sx={{ color: '#243041', fontWeight: 800 }}><ResolvedReviewName userId={review.targetUserId} roleHint={reviewTargetRoleHint(review.direction)} fallbackName={review.targetUserNickname} /></Box>
              </Typography>

              {review.replyContent ? (
                <Box
                  sx={{
                    px: 1.15,
                    py: 0.95,
                    bgcolor: 'rgba(238, 244, 252, .96)',
                    borderRadius: 2.35,
                    boxShadow: 'inset 0 0 0 1px rgba(152, 180, 224, .14)'
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
                </Box>
              ) : null}

              {reviewComplaints.length ? (
                <Stack spacing={0.85}>
                  {reviewComplaints.map(item => {
                    const complaintKey = String(item.complaintId || item.arbitrationId)
                    const isComplaintFocused = focusedComplaintId && String(focusedComplaintId) === complaintKey
                    return (
                      <Box
                        key={complaintKey}
                        ref={node => {
                          if (node) complaintRefs.current.set(complaintKey, node)
                          else complaintRefs.current.delete(complaintKey)
                        }}
                        sx={{
                          px: 1.18,
                          py: 1.05,
                          bgcolor: 'rgba(240, 245, 251, .88)',
                          borderRadius: 2.55,
                          boxShadow: isComplaintFocused
                            ? 'inset 0 0 0 1px rgba(100, 132, 191, .24), 0 0 0 2px rgba(100, 132, 191, .08)'
                            : 'inset 0 0 0 1px rgba(147, 172, 208, .18)'
                        }}
                      >
                        <Stack spacing={0.78}>
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ color: '#31425f', fontWeight: 900 }}>
                              处理结果
                            </Typography>
                            <Chip size="small" label={formatComplaintOutcome(item)} sx={complaintBadgeSx(item.arbitrationResult || item.status)} />
                          </Stack>

                          {formatComplaintReason(item) ? (
                            <ComplaintMeta label="申诉理由" value={formatComplaintReason(item)} />
                          ) : null}

                          <Box
                            sx={{
                              px: 1.15,
                              py: 0.95,
                              bgcolor: 'rgba(252, 247, 239, .95)',
                              borderRadius: 2.25,
                              boxShadow: 'inset 0 0 0 1px rgba(191, 167, 122, .12)'
                            }}
                          >
                            <Stack spacing={0.28}>
                              <Typography sx={{ color: '#8b6c3b', fontSize: 12, fontWeight: 900 }}>
                                处理说明
                              </Typography>
                              <Typography sx={{ color: '#52473e', lineHeight: 1.72, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                                {item.arbitrationComment || '暂无处理说明'}
                              </Typography>
                            </Stack>
                          </Box>

                          <Stack spacing={0.45}>
                            <ComplaintMeta compact label="提交时间" value={formatTime(item.createdAt)} />
                            <ComplaintMeta compact label="处理时间" value={item.handledAt ? formatTime(item.handledAt) : '待处理'} />
                          </Stack>
                        </Stack>
                      </Box>
                    )
                  })}
                </Stack>
              ) : null}

              {(canFollowUp || canComplain) ? (
                <Stack
                  direction="row"
                  spacing={0.9}
                  sx={{
                    flexWrap: 'wrap',
                    rowGap: 0.7,
                    pt: 0.2
                  }}
                >
                  {canFollowUp ? (
                    <Button size="small" variant="text" onClick={() => onFollowUp?.(review)} sx={miniActionSx}>
                      追加追评
                    </Button>
                  ) : null}
                  {canComplain ? (
                    <Button size="small" variant="outlined" color="inherit" onClick={() => onComplain?.(review)} sx={miniOutlinedSx}>
                      发起申诉
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

function ReviewerIdentityBlock({ review }) {
  const reviewerName = useResolvedReviewName(review.reviewerId, reviewRoleHint(review.direction), review.reviewerNickname)

  return (
    <Stack direction="row" spacing={1.15} sx={{ minWidth: 0, flex: 1, alignItems: 'flex-start' }}>
      <ReviewAvatar
        userId={review.reviewerId}
        roleHint={reviewRoleHint(review.direction)}
        displayName={reviewerName}
        size={42}
      />
      <Stack spacing={0.42} sx={{ minWidth: 0, flex: 1, alignItems: 'flex-start' }}>
        <Stack direction="row" spacing={0.72} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.55 }}>
          <Typography sx={{ color: '#1f2937', fontSize: 15, fontWeight: 900, lineHeight: 1.2, textAlign: 'left' }}>
            {reviewerName}
          </Typography>
          <Chip
            size="small"
            label={reviewRoleLabel(review.direction)}
            sx={{
              height: 24,
              borderRadius: 999,
              fontWeight: 800,
              bgcolor: 'rgba(216, 228, 246, .92)',
              color: '#466287',
              '& .MuiChip-label': { px: 1.05 }
            }}
          />
        </Stack>
        <Typography variant="body2" sx={{ color: '#7b8391', textAlign: 'left' }}>
          {formatTime(review.createdAt)}
        </Typography>
      </Stack>
    </Stack>
  )
}

function ResolvedReviewName({ userId, roleHint, fallbackName }) {
  return useResolvedReviewName(userId, roleHint, fallbackName)
}

function ComplaintMeta({ label, value, compact = false }) {
  return (
    <Stack spacing={0.18} sx={{ alignItems: 'flex-start', width: '100%' }}>
      <Typography sx={{ color: compact ? '#8b95a3' : '#69778a', fontSize: 12, fontWeight: 900 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          color: compact ? '#5f6977' : '#415062',
          lineHeight: compact ? 1.55 : 1.68,
          whiteSpace: 'pre-wrap',
          textAlign: 'left',
          width: '100%'
        }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

function useResolvedReviewName(userId, roleHint, fallbackName) {
  const { currentUser } = useAuth()
  const cacheKey = `${userId || 'unknown'}:${roleHint || ''}`
  const [resolvedName, setResolvedName] = useState(() => {
    const cachedName = reviewNameCache.get(cacheKey)
    return reviewDisplayName(cachedName || fallbackName)
  })

  useEffect(() => {
    const cachedName = reviewNameCache.get(cacheKey)
    if (cachedName) {
      setResolvedName(reviewDisplayName(cachedName))
      return
    }
    setResolvedName(reviewDisplayName(fallbackName))
  }, [cacheKey, fallbackName])

  useEffect(() => {
    let active = true

    async function loadDisplayName() {
      if (!userId || !currentUser) {
        setResolvedName(reviewDisplayName(fallbackName))
        return
      }
      if (reviewNameCache.has(cacheKey)) {
        setResolvedName(reviewDisplayName(reviewNameCache.get(cacheKey)))
        return
      }
      try {
        const brief = await userApi.brief(userId, currentUser, roleHint || undefined)
        const nextName = reviewDisplayName(brief?.nickname || fallbackName)
        reviewNameCache.set(cacheKey, nextName)
        if (active) setResolvedName(nextName)
      } catch {
        if (active) setResolvedName(reviewDisplayName(fallbackName))
      }
    }

    loadDisplayName()
    return () => { active = false }
  }, [cacheKey, currentUser, fallbackName, roleHint, userId])

  return resolvedName
}

function reviewTargetRoleHint(direction) {
  const value = String(direction || '').trim().toUpperCase()
  if (value === 'CUSTOMER_TO_PROVIDER') return 'PROVIDER'
  if (value === 'PROVIDER_TO_CUSTOMER') return 'CUSTOMER'
  return ''
}

function formatComplaintReason(item) {
  const reason = String(item?.reason || '').trim()
  const comment = String(item?.arbitrationComment || '').trim()
  if (!reason) return '评价申诉记录'
  if (!comment) return reason
  if (normalizeInlineText(reason) === normalizeInlineText(comment)) return ''

  const delimiterIndex = Math.max(reason.indexOf('：'), reason.indexOf(':'))
  if (delimiterIndex > -1) {
    const head = reason.slice(0, delimiterIndex).trim()
    const tail = reason.slice(delimiterIndex + 1).trim()
    if (tail && normalizeInlineText(tail) === normalizeInlineText(comment)) {
      return head
    }
  }
  return reason
}

function normalizeInlineText(value) {
  return String(value || '').replace(/\s+/g, '').trim()
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
    bgcolor: approved
      ? 'rgba(222, 242, 229, .95)'
      : rejected
        ? 'rgba(252, 231, 231, .95)'
        : active
          ? 'rgba(225, 235, 249, .95)'
          : 'rgba(235, 240, 246, .95)',
    color: approved ? '#1f7a4d' : rejected ? '#c04848' : active ? '#466287' : '#5b6472',
    '& .MuiChip-label': { px: 1.05 }
  }
}

const miniActionSx = {
  minHeight: 30,
  px: 0.7,
  color: '#1d4ed8',
  fontWeight: 900,
  borderRadius: 999,
  '&:hover': { bgcolor: 'rgba(29, 78, 216, .06)' }
}

const miniOutlinedSx = {
  minHeight: 30,
  px: 1.15,
  color: '#4b5563',
  borderColor: 'rgba(107, 114, 128, .24)',
  bgcolor: 'rgba(252, 250, 245, .82)',
  fontWeight: 850,
  borderRadius: 999,
  '&:hover': { borderColor: 'rgba(29, 78, 216, .24)', color: '#1d4ed8', bgcolor: 'rgba(29, 78, 216, .03)' }
}
