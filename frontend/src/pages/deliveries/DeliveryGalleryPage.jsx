import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { deliveryApi, fileApi, orderApi } from '../../api.js'
import { goToOrder } from '../../utils/orderNavigation.js'
import { formatOrderTitle } from '../../utils/displayFormatters.js'
import { PortraEmptyState, PortraInfoBanner, PortraStatusBadge, PortraTicketSection } from '../../components/portra/index.js'
import { PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import { centToYuan } from '../../utils/index.js'
import {
  buildDeliveryBatches,
  findDeliveryBatch,
  getDeliveryDownloadName,
  getDeliveryFileId,
  isImageDeliveryFile
} from './deliveryDisplay.js'
import { DeliveryActionBar } from './components/DeliveryActionBar.jsx'
import { DeliveryBatchCard } from './components/DeliveryBatchCard.jsx'
import { DeliveryFileGrid } from './components/DeliveryFileGrid.jsx'
import { DeliveryPreviewViewer } from './components/DeliveryPreviewViewer.jsx'

export function DeliveryGalleryPage() {
  const { orderId, deliveryId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [order, setOrder] = useState(null)
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [previewUrls, setPreviewUrls] = useState({})
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [viewerIndex, setViewerIndex] = useState(-1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
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
        if (!cancelled) setError(loadError.message || '交付记录加载失败。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [orderId, currentUser])

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
      setNotice({ type: 'error', text: downloadError.message || '文件下载失败。' })
      return false
    }
  }

  async function downloadFiles(nextFiles) {
    const downloadable = nextFiles.filter(file => file.fileId)
    if (!downloadable.length) {
      setNotice({ type: 'warning', text: '当前没有可下载文件。' })
      return
    }
    for (const [index, file] of downloadable.entries()) {
      await downloadFile(file, index)
    }
    setNotice({ type: 'info', text: downloadable.length > 1 ? '浏览器可能会逐个确认多个文件下载。' : '已开始下载。' })
  }

  const selectedFiles = files.filter(file => selectedIds.has(file.id))
  const viewerFile = viewerIndex >= 0 ? files[viewerIndex] : null
  const viewerUrl = viewerFile ? previewUrls[viewerFile.id] || previewUrls[viewerFile.fileId] : ''
  const conversationId = location.state?.conversationId || new URLSearchParams(location.search).get('conversationId')

  if (loading) {
    return <PortraEmptyState title="交付记录加载中" description="正在读取订单和交付作品。" />
  }

  if (error) {
    return <PortraEmptyState title="交付记录加载失败" description={error} />
  }

  if (!batch) {
    return (
      <Stack spacing={1.5}>
        <Button startIcon={<ArrowBackRoundedIcon />} color="inherit" onClick={() => goToOrder(navigate, orderId)}>返回订单</Button>
        <PortraEmptyState title="交付记录不存在" description="该交付记录可能不属于当前订单，或已经被移除。" />
      </Stack>
    )
  }

  return (
    <Stack spacing={2.2} sx={{ color: PORTRA_SURFACE.ink }}>
      <Paper variant="outlined" sx={headerSx}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}>
          <Stack spacing={0.8}>
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
              <Button startIcon={<ArrowBackRoundedIcon />} color="inherit" onClick={() => goToOrder(navigate, orderId)}>返回订单</Button>
              {conversationId && (
                <Button startIcon={<ForumRoundedIcon />} color="inherit" onClick={() => navigate(`/messages/${conversationId}`)}>返回会话</Button>
              )}
            </Stack>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 950 }}>{batch.title}</Typography>
              <Typography sx={{ mt: 0.45, color: PORTRA_SURFACE.muted }}>{batch.subtitle}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <PortraStatusBadge label={batch.statusLabel} />
            <Chip icon={<ReceiptLongIconShim />} label={formatOrderTitle(order)} />
          </Stack>
        </Stack>
      </Paper>

      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      <Box sx={galleryGridSx}>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <DeliveryBatchCard batch={batch} previewUrls={previewUrls} disabled />
          <PortraTicketSection title="交付相册">
            {files.length ? (
              <DeliveryFileGrid
                files={files}
                previewUrls={previewUrls}
                selectedIds={selectedIds}
                onToggle={toggleSelected}
                onOpenViewer={setViewerIndex}
              />
            ) : (
              <PortraEmptyState title="暂无交付文件" description="该交付记录没有可展示的文件信息。" />
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

        <Paper variant="outlined" sx={sidePanelSx}>
          <Stack spacing={1.5}>
            <PortraTicketSection title="交付信息">
              <Stack spacing={0.85}>
                <InfoLine label="订单金额" value={centToYuan(order?.amountCent)} />
                <InfoLine label="文件数量" value={`${batch.fileCount} 个文件`} />
                <InfoLine label="交付说明" value={batch.description} />
              </Stack>
            </PortraTicketSection>
            <Divider sx={{ borderColor: PORTRA_SURFACE.borderSoft }} />
            <PortraInfoBanner>
              图片会在可预览时显示缩略图；没有真实预览 URL 的文件会保持占位，不伪造图片。
            </PortraInfoBanner>
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
    </Stack>
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

function ReceiptLongIconShim() {
  return <ReceiptLongRoundedIcon fontSize="small" />
}

const headerSx = {
  px: { xs: 1.5, md: 2 },
  py: 1.5,
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSubtle,
  borderRadius: PORTRA_RADIUS.card,
  boxShadow: PORTRA_SHADOW.soft
}

const galleryGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' },
  gap: 2,
  alignItems: 'start'
}

const sidePanelSx = {
  p: 1.5,
  position: { lg: 'sticky' },
  top: { lg: 18 },
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSubtle,
  borderRadius: PORTRA_RADIUS.card,
  boxShadow: PORTRA_SHADOW.soft
}
