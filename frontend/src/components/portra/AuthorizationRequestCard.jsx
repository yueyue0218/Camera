import { forwardRef, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Slide,
  Typography
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import {
  formatAuthorizationDescription,
  formatDateTime,
  formatFileDisplayName,
  formatPhotoUsageScope
} from '../../utils/displayFormatters.js'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import { DeliveryThumbnailStrip } from '../../pages/deliveries/components/DeliveryThumbnailStrip.jsx'
import { getDeliveryFileId, isImageDeliveryFile } from '../../pages/deliveries/deliveryDisplay.js'
import { PortraPrimaryAction, PortraSecondaryAction, PortraStatusPill, PortraTicketCard } from './PortraBusinessPrimitives.jsx'

const AUTHORIZATION_STATUS_LABELS = {
  PENDING: '待客户确认',
  GRANTED: '已同意展示',
  REJECTED: '已拒绝展示'
}

export function AuthorizationRequestCard({
  authorization,
  order,
  variant = 'order',
  canReview = false,
  loading = false,
  onDecision,
  onOpenDelivery,
  chrome = 'card',
  sx
}) {
  const [open, setOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [decisionRemark, setDecisionRemark] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const model = useMemo(() => buildAuthorizationModel(authorization, order), [authorization, order])
  if (!authorization) return null

  const compact = variant === 'message'
  const inline = chrome === 'none'
  const messageInline = compact && inline
  const canOpenDelivery = Boolean(model.deliveryTarget && onOpenDelivery)
  const files = model.files
  const Root = inline ? Box : PortraTicketCard
  const openDelivery = event => {
    event?.stopPropagation()
    if (canOpenDelivery) onOpenDelivery(model.deliveryTarget)
  }
  const submitDecision = async decision => {
    const remark = decisionRemark.trim()
    if (decision === 'reject' && !remark) {
      setDecisionError('请填写拒绝原因')
      return
    }
    setDecisionError('')
    const handled = await onDecision?.(authorization, decision, remark)
    if (handled !== false) {
      setRejecting(false)
      setDecisionRemark('')
      setOpen(false)
    }
  }

  return (
    <>
      <Root
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        {...(!inline ? { accent: model.status === 'REJECTED' ? PORTRA_SURFACE.warmOrange : PORTRA_SURFACE.portraBlue } : {})}
        sx={{
          width: compact ? '100%' : 'auto',
          px: inline ? 0 : compact ? 1.25 : 1.55,
          py: inline ? 0 : compact ? 1.05 : 1.35,
          pl: inline ? 0 : compact ? 2.1 : 2.5,
          cursor: 'pointer',
          ...sx
        }}
      >
        <Stack spacing={messageInline ? 0.72 : 0.9}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              {!inline && (
                <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950, lineHeight: 1.36 }}>
                  摄影师申请作品展示授权
                </Typography>
              )}
              {inline && !compact && (
                <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950, lineHeight: 1.36 }}>
                  摄影师申请作品展示授权
                </Typography>
              )}
              <Typography variant="body2" sx={{ mt: messageInline ? 0 : 0.35, color: PORTRA_SURFACE.muted, lineHeight: 1.45 }}>
                {model.summary}
              </Typography>
            </Box>
            <PortraStatusPill label={model.statusLabel} />
          </Stack>
          {files.length > 0 && (
            <DeliveryThumbnailStrip
              files={files}
              variant={messageInline ? 'messageCompact' : 'message'}
              mode="contain"
            />
          )}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: PORTRA_SURFACE.faint, fontWeight: 800, minWidth: 0 }}>
              {messageInline ? model.fileMetaText || '作品授权详情' : '点击查看授权详情'}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNewRoundedIcon />}
              onClick={event => {
                event.stopPropagation()
                setOpen(true)
              }}
            >
              {messageInline ? '查看授权' : '查看详情'}
            </Button>
          </Stack>
        </Stack>
      </Root>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" TransitionComponent={DialogTransition}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 18, fontWeight: 950 }}>作品展示授权申请</Typography>
              <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, mt: 0.35 }}>
                {model.statusLabel}
              </Typography>
            </Box>
            <PortraStatusPill label={model.statusLabel} />
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <InfoLine label="申请人" value={model.applicantLabel} />
            <InfoLine label="申请时间" value={model.requestTime} />
            {model.usageLabel && <InfoLine label="申请用途" value={model.usageLabel} />}
            {model.remark && <InfoLine label="申请备注" value={model.remark} />}
            <Divider />
            <Stack spacing={1}>
              <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 900 }}>
                包含作品
              </Typography>
              {files.length > 0 ? (
                <>
                  <DeliveryThumbnailStrip files={files} variant="orderSection" mode="contain" />
                  {model.fileMetaText && (
                    <Typography variant="caption" sx={{ color: PORTRA_SURFACE.faint, fontWeight: 800 }}>
                      {model.fileMetaText}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                    {files.map((file, index) => (
                      <Chip
                        key={file.id || file.fileId || `${model.id}-file-${index}`}
                        size="small"
                        icon={<CollectionsRoundedIcon />}
                        label={formatFileDisplayName(file, `作品 ${index + 1}`)}
                        sx={{ borderRadius: PORTRA_RADIUS.compact, fontWeight: 800 }}
                      />
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted }}>
                  {canOpenDelivery ? '当前授权记录暂未返回可预览图片，可前往作品详情查看。' : '当前授权记录暂未返回可预览图片，可从订单作品记录查看。'}
                </Typography>
              )}
              {canOpenDelivery && (
                <PortraSecondaryAction startIcon={<OpenInNewRoundedIcon />} onClick={openDelivery} sx={{ alignSelf: 'flex-start' }}>
                  打开作品详情
                </PortraSecondaryAction>
              )}
            </Stack>
            {canReview && model.status === 'PENDING' && (
              <>
                <Divider />
                <Stack spacing={1}>
                  <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 900 }}>处理授权</Typography>
                  {rejecting && (
                    <TextField
                      size="small"
                      label="拒绝原因"
                      value={decisionRemark}
                      error={Boolean(decisionError)}
                      helperText={decisionError || '请简要说明为什么不同意展示'}
                      onChange={event => {
                        setDecisionRemark(event.target.value)
                        if (decisionError) setDecisionError('')
                      }}
                      multiline
                      minRows={2}
                    />
                  )}
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <PortraPrimaryAction
                      startIcon={<CheckCircleRoundedIcon />}
                      loading={loading}
                      onClick={() => submitDecision('approve')}
                    >
                      同意展示
                    </PortraPrimaryAction>
                    <PortraSecondaryAction
                      startIcon={<CloseRoundedIcon />}
                      loading={loading}
                      onClick={() => rejecting ? submitDecision('reject') : setRejecting(true)}
                    >
                      {rejecting ? '确认拒绝' : '拒绝授权'}
                    </PortraSecondaryAction>
                  </Stack>
                </Stack>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

const DialogTransition = forwardRef(function DialogTransition(props, ref) {
  return <Slide direction="up" ref={ref} timeout={180} {...props} />
})

function InfoLine({ label, value }) {
  if (!value) return null
  return (
    <Stack direction="row" spacing={1.2} sx={{ alignItems: 'baseline' }}>
      <Typography variant="body2" sx={{ width: 72, flexShrink: 0, color: PORTRA_SURFACE.faint, fontWeight: 800 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: PORTRA_SURFACE.ink, lineHeight: 1.55 }}>
        {value}
      </Typography>
    </Stack>
  )
}

function buildAuthorizationModel(authorization = {}, order) {
  const files = normalizeAuthorizationFiles(authorization)
  const scope = authorization.photoUsageScope || authorization.usageScope || authorization.usage || authorization.scope
  const usageLabel = scope ? formatPhotoUsageScope(scope) : ''
  const fileCount = files.length || Number(authorization.fileCount || authorization.selectedFileCount || 0)
  const status = String(authorization.status || '').toUpperCase()
  const summaryParts = [
    fileCount ? `已选 ${fileCount} 张作品` : '作品清单待同步',
    usageLabel ? `用途：${usageLabel}` : ''
  ].filter(Boolean)
  return {
    id: authorization.id || authorization.authorizationId || '',
    status,
    statusLabel: AUTHORIZATION_STATUS_LABELS[status] || '授权状态已更新',
    summary: summaryParts.join(' · '),
    files,
    fileMetaText: buildAuthorizationFileMetaText(files),
    usageLabel,
    applicantLabel: buildApplicantLabel(authorization, order),
    requestTime: formatDateTime(authorization.createdAt || authorization.requestedAt || authorization.authorizedAt || order?.updatedAt, '待同步'),
    remark: formatAuthorizationDescription(authorization, ''),
    deliveryTarget: getAuthorizationDeliveryTarget(authorization, order, files)
  }
}

function normalizeAuthorizationFiles(authorization = {}) {
  const files = [
    authorization.files,
    authorization.fileList,
    authorization.selectedFiles,
    authorization.selectedFileList,
    authorization.authorizationFiles,
    authorization.photoAuthorizationFiles,
    authorization.deliveryFiles,
    authorization.imageFiles,
    authorization.delivery?.files,
    authorization.deliveryRecord?.files,
    authorization.deliveryResponse?.files
  ].find(Array.isArray) || []
  return files
    .filter(Boolean)
    .map((file, index) => normalizeAuthorizationFileRecord(file, authorization, index))
    .filter(file => getDeliveryFileId(file) && isImageDeliveryFile(file))
}

function normalizeAuthorizationFileRecord(file = {}, authorization = {}, index = 0) {
  const nested = file.file || file.fileInfo || file.fileRecord || {}
  const deliveryFile = file.deliveryFile || file.delivery || {}
  const fileName = file.fileName || file.originalName || nested.fileName || nested.originalName || ''
  const mimeType = file.mimeType || file.contentType || nested.mimeType || nested.contentType || ''
  const fileSize = file.fileSize || file.size || nested.fileSize || nested.size || null
  const fileId = getPositiveId(file.fileId || nested.fileId || nested.id)
  return {
    ...nested,
    ...file,
    id: file.id || `${authorization.id || 'authorization'}-${fileId || index}`,
    fileId,
    deliveryId: getPositiveId(file.deliveryId || deliveryFile.deliveryId || authorization.deliveryId),
    orderId: file.orderId || file.order?.id || authorization.orderId,
    fileName,
    mimeType,
    fileType: file.fileType || deliveryFile.fileType || nested.fileType || inferAuthorizationFileType(fileName, mimeType),
    size: fileSize,
    fileSize,
    sortOrder: file.sortOrder ?? deliveryFile.sortOrder
  }
}

function inferAuthorizationFileType(fileName, mimeType) {
  const type = String(mimeType || '').toLowerCase()
  const name = String(fileName || '').toLowerCase()
  if (type.includes('zip') || /\.zip$/i.test(name)) return 'ZIP'
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(name)) return 'IMAGE'
  return ''
}

function getPositiveId(value) {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function buildAuthorizationFileMetaText(files = []) {
  if (!files.length) return ''
  const mimeTypes = Array.from(new Set(files.map(file => file.mimeType).filter(Boolean)))
  const totalSize = files
    .map(file => Number(file.fileSize || file.size || 0))
    .filter(size => Number.isFinite(size) && size > 0)
    .reduce((sum, size) => sum + size, 0)
  return [
    `${files.length} 张图片`,
    mimeTypes.slice(0, 2).join(' / '),
    totalSize > 0 ? formatFileSize(totalSize) : ''
  ].filter(Boolean).join(' · ')
}

function formatFileSize(size) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size >= 1024) return `${Math.round(size / 1024)} KB`
  return `${size} B`
}

function buildApplicantLabel(_authorization = {}, _order) {
  return '摄影师'
}

function getAuthorizationDeliveryTarget(authorization = {}, order, files = []) {
  const file = files.find(item => item.deliveryId) || null
  const deliveryId = authorization.deliveryId || file?.deliveryId
  const orderId = authorization.orderId || file?.orderId || order?.orderId
  if (!orderId || !deliveryId) return null
  return { orderId, deliveryId }
}
