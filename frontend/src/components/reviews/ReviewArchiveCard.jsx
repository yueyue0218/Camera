import { useEffect, useState } from 'react'
import { Avatar, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { useAuth } from '../../AuthContext.jsx'
import { fileApi, userApi } from '../../api.js'
import { ReviewStarsDisplay } from './ReviewStarsDisplay.jsx'

const reviewAvatarFileIdCache = new Map()

export function reviewRoleLabel(direction) {
  const value = String(direction || '').trim().toUpperCase()
  if (value === 'CUSTOMER_TO_PROVIDER') return '客户评价摄影师'
  if (value === 'PROVIDER_TO_CUSTOMER') return '摄影师评价客户'
  return '本次约拍评价'
}

export function reviewDisplayName(value) {
  const text = String(value || '').trim()
  return text || 'Portra 用户'
}

export function reviewInitial(value) {
  const text = reviewDisplayName(value)
  return text.slice(0, 1).toUpperCase()
}

export function reviewRoleHint(direction) {
  const value = String(direction || '').trim().toUpperCase()
  if (value === 'CUSTOMER_TO_PROVIDER') return 'CUSTOMER'
  if (value === 'PROVIDER_TO_CUSTOMER') return 'PROVIDER'
  return ''
}

export function ReviewAvatar({
  userId,
  roleHint,
  displayName,
  size = 38,
  sx
}) {
  const { currentUser } = useAuth()
  const cacheKey = `${userId || 'unknown'}:${roleHint || ''}`
  const [avatarFileId, setAvatarFileId] = useState(() => reviewAvatarFileIdCache.get(cacheKey) || null)
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    let active = true

    async function loadAvatarFileId() {
      if (!userId || !currentUser) {
        setAvatarFileId(null)
        return
      }
      if (reviewAvatarFileIdCache.has(cacheKey)) {
        setAvatarFileId(reviewAvatarFileIdCache.get(cacheKey) || null)
        return
      }
      setAvatarFileId(null)
      try {
        const brief = await userApi.brief(userId, currentUser, roleHint || undefined)
        const nextFileId = brief?.avatarFileId || null
        reviewAvatarFileIdCache.set(cacheKey, nextFileId)
        if (active) setAvatarFileId(nextFileId)
      } catch {
        reviewAvatarFileIdCache.set(cacheKey, null)
        if (active) setAvatarFileId(null)
      }
    }

    loadAvatarFileId()
    return () => { active = false }
  }, [cacheKey, currentUser, roleHint, userId])

  useEffect(() => {
    let active = true
    let objectUrl = ''
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null

    if (!avatarFileId || !currentUser) {
      setAvatarUrl('')
      return undefined
    }

    setAvatarUrl('')
    fileApi.downloadObjectUrl(avatarFileId, currentUser, { signal: controller?.signal })
      .then(url => {
        objectUrl = url
        if (!active) {
          URL.revokeObjectURL(url)
          return
        }
        setAvatarUrl(url)
      })
      .catch(error => {
        if (error?.name === 'AbortError') return
        if (active) setAvatarUrl('')
      })

    return () => {
      active = false
      controller?.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [avatarFileId, currentUser])

  return (
    <Avatar
      src={avatarUrl || undefined}
      sx={{
        width: size,
        height: size,
        bgcolor: '#e8f0ff',
        color: '#1d4ed8',
        fontSize: 14,
        fontWeight: 900,
        boxShadow: 'inset 0 0 0 1px rgba(29, 78, 216, .10)',
        ...sx
      }}
    >
      {!avatarUrl ? reviewInitial(displayName) : null}
    </Avatar>
  )
}

export function ReviewArchiveCard({
  review,
  timeText,
  actionLabel = '查看相关评价',
  onAction,
  actionDisabled = false,
  sx
}) {
  const reviewerName = reviewDisplayName(review?.reviewerNickname)
  const targetName = reviewDisplayName(review?.targetUserNickname)
  const roleLabel = reviewRoleLabel(review?.direction)

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.45,
        borderRadius: 3.2,
        bgcolor: '#fffdf8',
        borderColor: 'rgba(22, 52, 118, .10)',
        boxShadow: '0 8px 18px rgba(28, 38, 64, .04)',
        ...sx
      }}
    >
      <Stack spacing={1.05}>
        <Stack direction="row" spacing={1.1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.2 }}>
          <Stack direction="row" spacing={1.05} sx={{ minWidth: 0, alignItems: 'flex-start' }}>
            <ReviewAvatar
              userId={review?.reviewerId}
              roleHint={reviewRoleHint(review?.direction)}
              displayName={reviewerName}
            />
            <Stack spacing={0.38} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.55 }}>
                <Typography sx={{ fontWeight: 900, color: '#1f2937', lineHeight: 1.2 }}>
                  {reviewerName}
                </Typography>
                <Chip
                  size="small"
                  label={roleLabel}
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
              <Typography variant="body2" sx={{ color: '#7b8391', lineHeight: 1.35 }}>
                {timeText}
              </Typography>
            </Stack>
          </Stack>

          <ReviewStarsDisplay value={review?.rating} emphasize sx={{ flexShrink: 0, pt: 0.15 }} />
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
          <Typography sx={{ color: '#2a3240', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontWeight: 600 }}>
            {review?.content || '对方没有留下文字评价'}
          </Typography>
        </Paper>

        <Typography variant="body2" sx={{ color: '#7c8695', pl: 0.15 }}>
          评价对象：<Box component="span" sx={{ color: '#243041', fontWeight: 800 }}>{targetName}</Box>
        </Typography>

        {review?.replyContent ? (
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
                  {review.replyTime}
                </Typography>
              ) : null}
            </Stack>
          </Paper>
        ) : null}

        {onAction ? (
          <Box sx={{ pt: 0.25, borderTop: '1px solid rgba(18, 44, 98, .08)' }}>
            <Button
              variant="text"
              size="small"
              disableElevation
              onClick={() => onAction(review)}
              disabled={actionDisabled}
              sx={{
                alignSelf: 'flex-start',
                minHeight: 30,
                px: 0.35,
                color: '#1d4ed8',
                fontWeight: 900,
                borderRadius: 999,
                '&:hover': { bgcolor: 'rgba(29, 78, 216, .06)' }
              }}
            >
              {actionLabel}
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  )
}
