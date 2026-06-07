import { useMemo, useState } from 'react'
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
  Typography
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import {
  formatDateTime,
  formatFileDisplayName,
  formatPhotoUsageScope
} from '../../utils/displayFormatters.js'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import { DeliveryThumbnailStrip } from '../../pages/deliveries/components/DeliveryThumbnailStrip.jsx'
import { getDeliveryFileId } from '../../pages/deliveries/deliveryDisplay.js'
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
        <Stack spacing={0.9}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 950, lineHeight: 1.36 }}>
                摄影师申请作品展示授权
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.35, color: PORTRA_SURFACE.muted, lineHeight: 1.45 }}>
                {model.summary}
              </Typography>
            </Box>
            <PortraStatusPill label={model.statusLabel} />
          </Stack>
          {files.length > 0 && (
            <DeliveryThumbnailStrip files={files} variant="message" />
          )}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: PORTRA_SURFACE.faint, fontWeight: 800 }}>
              点击查看授权详情
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
              查看详情
            </Button>
          </Stack>
        </Stack>
      </Root>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
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
                  <DeliveryThumbnailStrip files={files} variant="orderSection" />
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
                  当前接口未返回具体照片，可从订单作品记录进入查看。
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
                      disabled={loading}
                      onClick={() => submitDecision('approve')}
                    >
                      同意展示
                    </PortraPrimaryAction>
                    <PortraSecondaryAction
                      startIcon={<CloseRoundedIcon />}
                      disabled={loading}
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
    usageLabel,
    applicantLabel: buildApplicantLabel(authorization, order),
    requestTime: formatDateTime(authorization.createdAt || authorization.requestedAt || authorization.authorizedAt || order?.updatedAt, '待同步'),
    remark: String(authorization.remark || authorization.description || authorization.reason || '').trim(),
    deliveryTarget: getAuthorizationDeliveryTarget(authorization, order, files)
  }
}

function normalizeAuthorizationFiles(authorization = {}) {
  const files = Array.isArray(authorization.files)
    ? authorization.files
    : Array.isArray(authorization.fileList) ? authorization.fileList : []
  return files.filter(Boolean).map((file, index) => ({
    ...file,
    id: file.id || file.fileId || `${authorization.id || 'authorization'}-${index}`,
    fileId: file.fileId || file.id,
    deliveryId: file.deliveryId || authorization.deliveryId,
    orderId: file.orderId || authorization.orderId
  }))
}

function buildApplicantLabel(authorization = {}, order) {
  return '摄影师'
}

function getAuthorizationDeliveryTarget(authorization = {}, order, files = []) {
  const file = files.find(item => item.deliveryId || getDeliveryFileId(item)) || null
  const deliveryId = authorization.deliveryId || file?.deliveryId || getDeliveryFileId(file)
  const orderId = authorization.orderId || file?.orderId || order?.orderId
  if (!orderId || !deliveryId) return null
  return { orderId, deliveryId }
}
