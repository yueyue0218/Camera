import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { deliveryApi, fileApi, orderApi } from '../../api.js'
import { goToOrder } from '../../utils/orderNavigation.js'
import { ORDER_SURFACES, WORKFLOW_SOURCES, getWorkflowSource } from '../../utils/workflowNavigation.js'
import {
  getExplicitReturnToConversation,
  getReturnToConversation,
  navigateBackToConversation
} from '../../utils/conversationNavigation.js'
import { formatOrderTitle } from '../../utils/displayFormatters.js'
import { OrderCompletionDialog, PortraActionButton, PortraActionLink, PortraContextActionButton, PortraEmptyState, PortraInfoBanner, PortraStatusPill, PortraTicketSection, PortraWorkflowFrame, usePortraFeedback } from '../../components/portra/index.js'
import { PORTRA_LAYOUT, PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import { centToYuan } from '../../utils/index.js'
import {
  buildDeliveryBatches,
  findDeliveryBatch,
  getDeliveryDownloadName,
  getDeliveryFileId,
  isImageDeliveryFile
} from './deliveryDisplay.js'
import { DeliveryActionBar } from './components/DeliveryActionBar.jsx'
import { DeliveryFileGrid } from './components/DeliveryFileGrid.jsx'
import { DeliveryPreviewViewer } from './components/DeliveryPreviewViewer.jsx'
import { useWorkflowNavigate } from '../../hooks/useWorkflowNavigate.js'
import { buildWorkflowCacheKey, readWorkflowViewState, writeWorkflowViewState } from '../../utils/workflowViewCache.js'

export function DeliveryGalleryPage() {
  const { orderId, deliveryId } = useParams()
  const location = useLocation()
  const navigate = useWorkflowNavigate()
  const { currentUser } = useAuth()
  const feedback = usePortraFeedback()
  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewUrls, setPreviewUrls] = useState({})
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [viewerIndex, setViewerIndex] = useState(-1)
  const [actionLoading, setActionLoading] = useState(false)
  const [reworkDialogOpen, setReworkDialogOpen] = useState(false)
  const [reworkRequirement, setReworkRequirement] = useState('')
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const viewCacheKey = buildWorkflowCacheKey('delivery-gallery', orderId, deliveryId, currentUser.role)

  useEffect(() => {
    let cancelled = false
    const cached = readWorkflowViewState(viewCacheKey)
    const hadCachedData = Boolean(cached?.order || cached?.deliveries?.length)
    if (cached?.order) setOrder(cached.order)
    if (Array.isArray(cached?.deliveries)) setDeliveries(cached.deliveries)
    if (hadCachedData) setLoading(false)

    async function load() {
      if (!hadCachedData) setLoading(true)
      setError('')
      try {
        const [nextOrder, nextDeliveries] = await Promise.all([
          orderApi.detail(orderId, currentUser),
          deliveryApi.listByOrder(orderId, currentUser)
        ])
        if (cancelled) return
        setOrder(nextOrder)
        setDeliveries(Array.isArray(nextDeliveries) ? nextDeliveries : [])
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || '作品记录加载失败。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [orderId, deliveryId, currentUser, viewCacheKey])

  useEffect(() => {
    if (!order && !deliveries.length) return
    writeWorkflowViewState(viewCacheKey, { order, deliveries })
  }, [viewCacheKey, order, deliveries])

  const batches = useMemo(() => buildDeliveryBatches(deliveries, order), [deliveries, order])
  const batch = useMemo(() => findDeliveryBatch(batches, deliveryId), [batches, deliveryId])
  const files = batch?.files || []
  const fileKey = files.map(file => `${file.id}:${file.fileId}`).join('|')

  useEffect(() => {
    let cancelled = false
    const urls = {}
    async function loadPreviews() {
      const imageFiles = files.filter(file => file.fileId && isImageDeliveryFile(file))
      await Promise.all(imageFiles.map(async file => {
        try {
          const url = await fileApi.downloadObjectUrl(file.fileId, currentUser)
          if (!cancelled) urls[file.id] = url
        } catch {
          // Preview is optional. The gallery keeps a stable placeholder when a file cannot be rendered.
        }
      }))
      if (!cancelled) setPreviewUrls(urls)
    }
    setPreviewUrls({})
    loadPreviews()
    return () => {
      cancelled = true
      Object.values(urls).forEach(url => URL.revokeObjectURL(url))
    }
  }, [fileKey, currentUser])

  useEffect(() => () => {
    Object.values(previewUrls).forEach(url => URL.revokeObjectURL(url))
  }, [previewUrls])

  function toggleSelected(fileId) {
    setSelectedIds(previous => {
      const next = new Set(previous)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  async function downloadFile(file, index = 0) {
    const fileId = getDeliveryFileId(file)
    if (!fileId) return false
    try {
      const url = await fileApi.downloadObjectUrl(fileId, currentUser)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = getDeliveryDownloadName(file, index)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
      return true
    } catch (downloadError) {
      const message = downloadError.message || '作品下载失败。'
      feedback.error(message)
      return false
    }
  }

  async function downloadFiles(nextFiles) {
    const downloadable = nextFiles.filter(file => file.fileId)
    if (!downloadable.length) {
      feedback.warning('当前没有可下载作品。')
      return
    }
    for (const [index, file] of downloadable.entries()) {
      await downloadFile(file, index)
    }
    const message = downloadable.length > 1 ? '浏览器可能会逐个确认多个作品下载。' : '已开始下载。'
    feedback.info(message)
  }

  async function reloadOrderAndDeliveries() {
    const [nextOrder, nextDeliveries] = await Promise.all([
      orderApi.detail(orderId, currentUser),
      deliveryApi.listByOrder(orderId, currentUser)
    ])
    setOrder(nextOrder)
    setDeliveries(Array.isArray(nextDeliveries) ? nextDeliveries : [])
  }

  async function confirmDelivery() {
    if (!order?.orderId || !canCustomerAct) return
    setActionLoading(true)
    try {
      await orderApi.transition(order.orderId, 'COMPLETED', '客户确认接收作品', currentUser)
      await reloadOrderAndDeliveries()
      feedback.success('订单已完成')
      setCompletionDialogOpen(true)
    } catch (actionError) {
      const message = actionError.message || '确认接收失败。'
      feedback.error(message)
    } finally {
      setActionLoading(false)
    }
  }

  async function submitRework(event) {
    event.preventDefault()
    const reason = reworkRequirement.trim()
    if (!reason) {
      feedback.warning('请填写返修要求。')
      return
    }
    if (reason.length > 500) {
      feedback.warning('返修要求不能超过 500 字。')
      return
    }
    setActionLoading(true)
    try {
      await orderApi.requestRework(order.orderId, reason, currentUser)
      setReworkDialogOpen(false)
      setReworkRequirement('')
      await reloadOrderAndDeliveries()
      feedback.success('返修要求已提交。')
    } catch (actionError) {
      const message = actionError.message || '返修要求提交失败。'
      feedback.error(message)
    } finally {
      setActionLoading(false)
    }
  }

  const selectedFiles = files.filter(file => selectedIds.has(file.id))
  const viewerFile = viewerIndex >= 0 ? files[viewerIndex] : null
  const viewerUrl = viewerFile ? previewUrls[viewerFile.id] || previewUrls[viewerFile.fileId] : ''
  const conversationId = location.state?.conversationId || new URLSearchParams(location.search).get('conversationId')
  const workflowSource = getWorkflowSource(location)
  const explicitReturnToConversation = getExplicitReturnToConversation(location)
  const returnToConversation = getReturnToConversation(location, order?.conversationId || conversationId)
  const primaryBackIsConversation = workflowSource === WORKFLOW_SOURCES.conversation || Boolean(explicitReturnToConversation)
  const associatedConversationId = order?.conversationId || conversationId
  const currentUserId = Number(currentUser?.userId)
  const canCustomerAct = Number(order?.customerId) === currentUserId && order?.status === 'DELIVERED_PENDING_CONFIRM'
  const isProvider = Number(order?.providerUserId) === currentUserId
  const isReworkForProvider = isProvider && order?.status === 'REWORK_REQUIRED'
  const isCompleted = order?.status === 'COMPLETED'
  const galleryMeta = [batch?.subtitle, formatOrderTitle(order)].filter(Boolean).join(' · ')
  const orderNavigationOptions = {
    conversationId: associatedConversationId,
    returnTo: explicitReturnToConversation,
    source: primaryBackIsConversation ? WORKFLOW_SOURCES.conversation : WORKFLOW_SOURCES.order,
    orderSurface: ORDER_SURFACES.detail
  }

  if (loading) {
    return <DeliveryGallerySkeleton />
  }

  if (error) {
    return <PortraEmptyState title="作品记录加载失败" description={error} />
  }

  if (!batch) {
    return (
      <PortraWorkflowFrame spacing={1.5} maxWidth="gallery">
        <PortraContextActionButton
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => primaryBackIsConversation
            ? navigateBackToConversation(navigate, location, associatedConversationId)
            : goToOrder(navigate, orderId, orderNavigationOptions)}
        >
          {primaryBackIsConversation ? '返回沟通' : '返回订单'}
        </PortraContextActionButton>
        <PortraEmptyState title="作品记录不存在" description="该作品记录可能不属于当前订单，或已经被移除。" />
      </PortraWorkflowFrame>
    )
  }

  return (
    <PortraWorkflowFrame spacing={2.2} maxWidth="gallery" sx={{ color: PORTRA_SURFACE.ink }}>
      <Paper variant="outlined" sx={headerSx}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}>
          <Stack spacing={0.8}>
            <PortraContextActionButton
              startIcon={<ArrowBackRoundedIcon />}
              sx={primaryBackButtonSx}
              onClick={() => primaryBackIsConversation
                ? navigateBackToConversation(navigate, location, associatedConversationId)
                : goToOrder(navigate, orderId, orderNavigationOptions)}
            >
              {primaryBackIsConversation ? '返回沟通' : '返回订单'}
            </PortraContextActionButton>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 950 }}>{batch.title}</Typography>
              <Typography sx={{ mt: 0.45, color: PORTRA_SURFACE.muted }}>{galleryMeta}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center' }}>
            <PortraStatusPill label={batch.statusLabel} />
            {primaryBackIsConversation ? (
              <PortraActionLink
                startIcon={<ReceiptLongRoundedIcon />}
                onClick={() => goToOrder(navigate, orderId, orderNavigationOptions)}
              >
                查看订单
              </PortraActionLink>
            ) : null}
          </Stack>
        </Stack>
      </Paper>
      <Box data-delivery-gallery-grid="true" sx={galleryGridSx}>
        <Paper variant="outlined" sx={galleryPanelSx}>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <PortraTicketSection title="作品相册">
            {files.length ? (
              <DeliveryFileGrid
                files={files}
                previewUrls={previewUrls}
                selectedIds={selectedIds}
                onToggle={toggleSelected}
                onOpenViewer={setViewerIndex}
                onDownloadFile={downloadFile}
              />
            ) : (
              <PortraEmptyState title="暂无作品" description="该作品记录没有可展示的照片信息。" />
            )}
          </PortraTicketSection>
          <DeliveryActionBar
            selectedCount={selectedFiles.length}
            downloadableCount={files.filter(file => file.fileId).length}
            onDownloadSelected={() => downloadFiles(selectedFiles)}
            onDownloadAll={() => downloadFiles(files)}
            onClearSelection={() => setSelectedIds(new Set())}
          />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={sidePanelSx}>
          <Stack spacing={1.5}>
            <PortraTicketSection title="作品信息">
              <Stack spacing={0.85}>
                <InfoLine label="订单金额" value={centToYuan(order?.amountCent)} />
                <InfoLine label="交付内容" value={formatGalleryFileCount(batch)} />
                <InfoBlock label="作品说明" value={batch.description || '摄影师已上传作品，等待客户确认。'} />
              </Stack>
            </PortraTicketSection>
            <Divider sx={{ borderColor: PORTRA_SURFACE.borderSoft }} />
            <PortraTicketSection title="处理动作">
              {canCustomerAct && (
                <Stack spacing={1}>
                  <PortraInfoBanner tone="warning">请确认作品是否符合约定；确认接收后订单将完成。</PortraInfoBanner>
                  <PortraActionButton startIcon={<CheckCircleRoundedIcon />} onClick={confirmDelivery} disabled={actionLoading}>
                    确认接收作品
                  </PortraActionButton>
                  <PortraActionButton tone="secondary" startIcon={<RefreshRoundedIcon />} onClick={() => setReworkDialogOpen(true)} disabled={actionLoading}>
                    提交返修要求
                  </PortraActionButton>
                </Stack>
              )}
              {isReworkForProvider && (
                <Stack spacing={1}>
                  <PortraInfoBanner tone="warning">客户已提出返修要求，请回到沟通重新上传作品。</PortraInfoBanner>
                  {returnToConversation && (
                    <Button startIcon={<ForumRoundedIcon />} variant="outlined" onClick={() => navigateBackToConversation(navigate, location, associatedConversationId)}>
                      返回沟通重新上传作品
                    </Button>
                  )}
                </Stack>
              )}
              {isCompleted && (
                <PortraInfoBanner>订单已完成，可返回订单查看评价入口。</PortraInfoBanner>
              )}
              {!canCustomerAct && !isReworkForProvider && !isCompleted && (
                <PortraInfoBanner>作品已提交，等待客户确认。</PortraInfoBanner>
              )}
            </PortraTicketSection>
          </Stack>
        </Paper>
      </Box>

      <DeliveryPreviewViewer
        open={viewerIndex >= 0}
        file={viewerFile}
        index={viewerIndex}
        total={files.length}
        previewUrl={viewerUrl}
        onClose={() => setViewerIndex(-1)}
        onPrev={() => setViewerIndex(index => (index <= 0 ? files.length - 1 : index - 1))}
        onNext={() => setViewerIndex(index => (index >= files.length - 1 ? 0 : index + 1))}
        onDownload={downloadFile}
      />

      <Dialog open={reworkDialogOpen} onClose={() => setReworkDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>提交返修要求</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack component="form" id="delivery-gallery-rework-form" spacing={1.5} onSubmit={submitRework}>
            <PortraInfoBanner tone="warning">请说明需要返修的照片、问题和期望修改方向。</PortraInfoBanner>
            <TextField
              autoFocus
              label="返修要求"
              value={reworkRequirement}
              onChange={event => setReworkRequirement(event.target.value)}
              multiline
              minRows={4}
              inputProps={{ maxLength: 500 }}
              helperText={`${reworkRequirement.length}/500`}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={() => setReworkDialogOpen(false)}>取消</Button>
          <Button type="submit" form="delivery-gallery-rework-form" variant="contained" disabled={actionLoading || !reworkRequirement.trim()}>
            提交返修
          </Button>
        </DialogActions>
      </Dialog>

      <OrderCompletionDialog
        open={completionDialogOpen}
        onClose={() => setCompletionDialogOpen(false)}
        onReview={() => {
          setCompletionDialogOpen(false)
          goToOrder(navigate, order?.orderId, {
            ...orderNavigationOptions,
            state: { orderId: order?.orderId, focusReview: true }
          })
        }}
      />
    </PortraWorkflowFrame>
  )
}

function InfoLine({ label, value }) {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', gap: 1 }}>
      <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: PORTRA_SURFACE.ink, fontWeight: 850, textAlign: 'right' }}>{value || '暂无'}</Typography>
    </Stack>
  )
}

function InfoBlock({ label, value }) {
  return (
    <Stack spacing={0.4}>
      <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: PORTRA_SURFACE.ink, fontWeight: 850, lineHeight: 1.65 }}>{value || '暂无'}</Typography>
    </Stack>
  )
}

const headerSx = {
  px: { xs: 1.5, md: 2 },
  py: 1.5,
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSubtle,
  borderRadius: PORTRA_RADIUS.card,
  boxShadow: PORTRA_SHADOW.soft
}

function DeliveryGallerySkeleton() {
  return (
    <PortraWorkflowFrame spacing={2.2} maxWidth="gallery" sx={{ color: PORTRA_SURFACE.ink }} aria-label="作品相册加载中">
      <Paper variant="outlined" sx={headerSx}>
        <Stack spacing={1}>
          <Skeleton variant="rounded" width={96} height={34} sx={{ borderRadius: PORTRA_RADIUS.compact }} />
          <Skeleton variant="text" width="34%" height={34} />
          <Skeleton variant="text" width="52%" height={22} />
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 1.2, md: 1.6 }, borderRadius: PORTRA_RADIUS.panel, borderColor: PORTRA_SURFACE.borderSoft, bgcolor: PORTRA_SURFACE.paper }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.2 }}>
          {[0, 1, 2, 3, 4, 5].map(index => (
            <Skeleton key={index} variant="rounded" height={180} sx={{ borderRadius: PORTRA_RADIUS.card }} />
          ))}
        </Box>
      </Paper>
    </PortraWorkflowFrame>
  )
}

const galleryGridSx = {
  display: 'grid',
  width: '100%',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    lg: `minmax(0, 1fr) ${PORTRA_LAYOUT.compactRightPanelWidth.lg}`,
    xl: `minmax(0, 1fr) ${PORTRA_LAYOUT.compactRightPanelWidth.xl}`
  },
  gap: { xs: 1.6, lg: 2.5 },
  alignItems: 'start',
  minWidth: 0,
  overflowX: 'hidden'
}

const galleryPanelSx = {
  p: { xs: 1.25, md: 1.6 },
  minWidth: 0,
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSubtle,
  borderRadius: PORTRA_RADIUS.card,
  boxShadow: PORTRA_SHADOW.soft
}

const sidePanelSx = {
  p: 1.5,
  minWidth: 0,
  position: { lg: 'sticky' },
  top: { lg: 18 },
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSubtle,
  borderRadius: PORTRA_RADIUS.card,
  boxShadow: PORTRA_SHADOW.soft
}

const primaryBackButtonSx = {
  alignSelf: 'flex-start'
}

function formatGalleryFileCount(batch) {
  const imageCount = Number(batch?.imageCount || 0)
  const zipCount = Number(batch?.zipCount || 0)
  const fileCount = Number(batch?.fileCount || batch?.files?.length || 0)
  const otherCount = Math.max(0, fileCount - imageCount - zipCount)
  const parts = []
  if (imageCount) parts.push(`${imageCount} 张图片`)
  if (zipCount) parts.push(`${zipCount} 个 ZIP`)
  if (otherCount) parts.push(`${otherCount} 个文件`)
  return parts.length ? parts.join(' / ') : '暂无文件'
}
