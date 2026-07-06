import { useEffect, useState } from 'react'
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import { formatTime } from '../utils/conversationUtils.js'
import { fileApi } from '../../../api/fileApi.js'
import { getSafeDisplayText, PORTRA_COLORS, PORTRA_RADII, PORTRA_SHADOWS } from '../MessageVisualTokens.js'
import { MessageActorAvatar } from './MessageActorAvatar.jsx'

export function MessageBubble({ message, mine, actor, currentUser, canSaveSubmittedPhoto, onSaveSubmittedPhoto, onDownloadAttachment, onRetry }) {
  if (!message) return null
  const attachment = getMessageAttachment(message)
  const isImage = attachment?.kind === 'IMAGE' || message.messageType === 'IMAGE'
  const hasAttachment = Boolean(attachment)
  const deliveryStatus = message.deliveryStatus || (message.optimistic ? 'sending' : 'sent')
  const sending = deliveryStatus === 'sending'
  const failed = deliveryStatus === 'failed'
  const avatarAccent = mine ? PORTRA_COLORS.blue : PORTRA_COLORS.subInk
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 1.05 }}>
      {!mine && (
        <MessageActorAvatar
          actor={actor}
          dataKind="bubble"
          accent={avatarAccent}
          fallbackText="对"
        />
      )}
      <Stack spacing={0.38} sx={{ maxWidth: { xs: '86%', md: 'min(64%, 620px)' }, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Paper
          elevation={0}
          sx={{
            px: hasAttachment ? 0.85 : 1.75,
            py: hasAttachment ? 0.85 : 1.22,
            bgcolor: mine ? PORTRA_COLORS.blue : PORTRA_COLORS.paper,
            color: mine ? PORTRA_COLORS.paper : PORTRA_COLORS.subInk,
            border: mine ? `1px solid ${PORTRA_COLORS.blue}` : `1px solid ${PORTRA_COLORS.borderMuted}`,
            borderRadius: mine ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
            boxShadow: mine ? '0 10px 22px rgba(13, 47, 178, 0.14)' : PORTRA_SHADOWS.subtle,
            overflow: 'hidden'
          }}
        >
          {hasAttachment ? (
            <Stack spacing={0.8}>
              {isImage ? (
                <AttachmentImage attachment={attachment} message={message} currentUser={currentUser} />
              ) : (
                <AttachmentFileCard attachment={attachment} mine={mine} onDownload={onDownloadAttachment} disabled={sending} />
              )}
              {message.content && (
                <Typography sx={{ fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', px: 0.35 }}>
                  {getSafeDisplayText(message.content, '')}
                </Typography>
              )}
              {canSaveSubmittedPhoto && (
                <Button size="small" variant="contained" color="inherit" onClick={onSaveSubmittedPhoto}>
                  保存提交照片
                </Button>
              )}
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 15, lineHeight: 1.58, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{getSafeDisplayText(message.content, '消息内容')}</Typography>
          )}
        </Paper>
        <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center', px: 0.4 }}>
          <Typography variant="caption" sx={{ color: failed ? '#b42318' : PORTRA_COLORS.faintInk, fontSize: 12 }}>
            {formatTime(message.createdAt)}
          </Typography>
          {sending && (
            <Stack direction="row" spacing={0.45} sx={{ alignItems: 'center', color: PORTRA_COLORS.faintInk }}>
              <CircularProgress size={11} thickness={5} sx={{ color: PORTRA_COLORS.faintInk }} />
              <Typography variant="caption" sx={{ fontSize: 12, color: PORTRA_COLORS.faintInk }}>发送中</Typography>
            </Stack>
          )}
          {failed && (
            <Button
              size="small"
              color="error"
              onClick={onRetry}
              sx={{ minHeight: 22, px: 0.6, py: 0, fontSize: 12, fontWeight: 850 }}
            >
              发送失败，点击重试
            </Button>
          )}
        </Stack>
      </Stack>
      {mine && (
        <MessageActorAvatar
          actor={actor}
          dataKind="bubble"
          accent={avatarAccent}
          fallbackText="我"
        />
      )}
    </Box>
  )
}

function AttachmentImage({ attachment, message, currentUser }) {
  const [objectUrl, setObjectUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const source = attachment.localPreviewUrl || objectUrl || (!attachment.fileId ? message.content : '')

  useEffect(() => {
    if (!attachment.fileId || attachment.localPreviewUrl) return undefined
    let cancelled = false
    let nextObjectUrl = ''
    setFailed(false)
    fileApi.downloadObjectUrl(attachment.fileId, currentUser)
      .then(url => {
        nextObjectUrl = url
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        setObjectUrl(previous => {
          if (previous) URL.revokeObjectURL(previous)
          return url
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl)
    }
  }, [attachment.fileId, attachment.localPreviewUrl, currentUser])

  if (failed || !source) {
    return (
      <Box sx={imageFallbackSx}>
        图片暂不可预览
      </Box>
    )
  }

  return (
    <Box
      component="img"
      src={source}
      alt={attachment.fileName || '沟通图片'}
      sx={attachmentImageSx}
      onError={() => setFailed(true)}
    />
  )
}

function AttachmentFileCard({ attachment, mine, onDownload, disabled }) {
  return (
    <Stack direction="row" spacing={1} sx={fileCardSx(mine)}>
      <Box sx={fileIconSx(mine)}>
        <InsertDriveFileRoundedIcon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 900, color: mine ? PORTRA_COLORS.paper : PORTRA_COLORS.ink }} noWrap>
          {attachment.fileName || '附件'}
        </Typography>
        <Typography variant="caption" sx={{ color: mine ? 'rgba(255,255,255,.72)' : PORTRA_COLORS.faintInk }}>
          {formatFileSize(attachment.size)}
        </Typography>
      </Box>
      <Button
        size="small"
        startIcon={<DownloadRoundedIcon />}
        onClick={onDownload}
        disabled={disabled || !attachment.fileId}
        sx={downloadButtonSx(mine)}
      >
        下载
      </Button>
    </Stack>
  )
}

function getMessageAttachment(message = {}) {
  const fileId = message.fileId || message.attachment?.fileId || null
  const fileName = message.fileName || message.attachment?.fileName || message.attachment?.name || ''
  const mimeType = message.mimeType || message.attachment?.mimeType || message.attachment?.type || ''
  const kind = String(message.attachmentKind || message.fileType || message.attachment?.kind || message.messageType || '')
    .toUpperCase()
  if (!fileId && !fileName && !message.attachment?.localPreviewUrl && message.messageType !== 'IMAGE') return null
  return {
    fileId,
    fileName,
    mimeType,
    size: message.size || message.attachment?.size || 0,
    kind: kind === 'IMAGE' || String(mimeType).toLowerCase().startsWith('image/') ? 'IMAGE' : 'FILE',
    localPreviewUrl: message.attachment?.localPreviewUrl || ''
  }
}

function formatFileSize(size) {
  const value = Number(size || 0)
  if (!Number.isFinite(value) || value <= 0) return '未知大小'
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

const attachmentImageSx = {
  display: 'block',
  width: '100%',
  maxWidth: { xs: '100%', md: 420 },
  maxHeight: 280,
  borderRadius: PORTRA_RADII.control,
  objectFit: 'contain',
  bgcolor: PORTRA_COLORS.paper
}

const imageFallbackSx = {
  display: 'grid',
  placeItems: 'center',
  width: { xs: 220, sm: 280 },
  maxWidth: '100%',
  height: 148,
  borderRadius: PORTRA_RADII.control,
  bgcolor: PORTRA_COLORS.paperMuted,
  color: PORTRA_COLORS.faintInk,
  fontSize: 13,
  fontWeight: 850
}

function fileCardSx(mine) {
  return {
    width: { xs: 232, sm: 300 },
    maxWidth: '100%',
    alignItems: 'center',
    p: 1,
    borderRadius: PORTRA_RADII.control,
    bgcolor: mine ? 'rgba(255,255,255,.12)' : PORTRA_COLORS.page,
    border: `1px solid ${mine ? 'rgba(255,255,255,.18)' : PORTRA_COLORS.borderMuted}`
  }
}

function fileIconSx(mine) {
  return {
    width: 38,
    height: 38,
    borderRadius: '10px',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    bgcolor: mine ? 'rgba(255,255,255,.16)' : PORTRA_COLORS.paper,
    color: mine ? PORTRA_COLORS.paper : PORTRA_COLORS.blue
  }
}

function downloadButtonSx(mine) {
  return {
    minHeight: 30,
    borderRadius: 999,
    flexShrink: 0,
    color: mine ? PORTRA_COLORS.paper : PORTRA_COLORS.blue,
    borderColor: mine ? 'rgba(255,255,255,.28)' : PORTRA_COLORS.borderMuted
  }
}
