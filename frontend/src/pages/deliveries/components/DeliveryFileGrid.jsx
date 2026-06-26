import { Box, Button, Checkbox, Stack, Typography } from '@mui/material'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import FolderZipRoundedIcon from '@mui/icons-material/FolderZipRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { useAuth } from '../../../AuthContext.jsx'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { getDeliveryFileId, isImageDeliveryFile, isZipDeliveryFile } from '../deliveryDisplay.js'
import { getPreviewKey, useDeliveryFilePreviews } from '../useDeliveryFilePreviews.js'

export function DeliveryFileGrid({
  files = [],
  mode = 'browse',
  compact = false,
  previewUrls = {},
  selectedFileIds,
  selectedIds = new Set(),
  onToggleSelect,
  onToggle,
  onPreview,
  onOpenViewer,
  onDownload,
  onDownloadFile
}) {
  const { currentUser } = useAuth()
  const selectMode = mode === 'select'
  const selectedSet = selectedFileIds || selectedIds || new Set()
  const shouldLoadPreviews = !previewUrls || !Object.keys(previewUrls).length
  const loadedPreviews = useDeliveryFilePreviews(files, currentUser, { enabled: shouldLoadPreviews })

  function isSelected(file) {
    const id = getSelectionId(file)
    return selectedSet.has(id) || selectedSet.has(Number(id)) || selectedSet.has(String(id))
  }

  function toggle(file, index) {
    if (typeof onToggleSelect === 'function') return onToggleSelect(file, index)
    if (typeof onToggle === 'function') return onToggle(getSelectionId(file), file, index)
    return undefined
  }

  function preview(file, index) {
    if (typeof onPreview === 'function') return onPreview(file, index)
    if (typeof onOpenViewer === 'function') return onOpenViewer(index, file)
    return undefined
  }

  function download(file, index) {
    if (typeof onDownload === 'function') return onDownload(file, index)
    if (typeof onDownloadFile === 'function') return onDownloadFile(file, index)
    return undefined
  }

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: compact
        ? { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }
        : files.length === 1
          ? { xs: 'minmax(0, min(100%, 420px))' }
          : { xs: '1fr', sm: 'repeat(auto-fit, minmax(220px, 1fr))' },
      gap: compact ? 0.8 : 1.4,
      alignItems: 'start',
      justifyContent: compact ? 'stretch' : 'start'
    }}>
      {files.map((file, index) => {
        const selected = isSelected(file)
        const previewUrl = previewUrls[file.id]
          || previewUrls[file.fileId]
          || loadedPreviews.previewUrls[getPreviewKey(file)]
        const loadingPreview = loadedPreviews.loadingIds.has(getPreviewKey(file))
        const image = isImageDeliveryFile(file)
        const zip = isZipDeliveryFile(file)
        const hasFile = Boolean(getDeliveryFileId(file))
        return (
          <Box
            key={file.id || file.fileId || index}
            role={selectMode || image || hasFile ? 'button' : undefined}
            tabIndex={selectMode || image || hasFile ? 0 : undefined}
            onClick={() => {
              if (selectMode) return toggle(file, index)
              if (image) return preview(file, index)
              if (hasFile) return download(file, index)
              return undefined
            }}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              if (!selectMode && !image && !hasFile) return
              event.preventDefault()
              if (selectMode) toggle(file, index)
              else if (image) preview(file, index)
              else if (hasFile) download(file, index)
            }}
            sx={{
              position: 'relative',
              border: `1px solid ${selected ? PORTRA_SURFACE.portraBlue : PORTRA_SURFACE.borderSubtle}`,
              borderRadius: PORTRA_RADIUS.control,
              overflow: 'hidden',
              bgcolor: PORTRA_SURFACE.paper,
              cursor: selectMode ? 'pointer' : image ? 'zoom-in' : hasFile ? 'pointer' : 'default',
              boxShadow: selected ? '0 0 0 3px rgba(13,47,178,.12)' : 'none',
              transition: 'border-color .16s ease, box-shadow .16s ease, transform .16s ease',
              '&:hover': {
                borderColor: selectMode || image || hasFile ? PORTRA_SURFACE.portraBlue : PORTRA_SURFACE.borderSubtle,
                transform: selectMode || image || hasFile ? 'translateY(-1px)' : 'none'
              },
              '&:hover .delivery-grid-preview-hint': {
                opacity: selectMode || !image ? 0 : 1
              }
            }}
          >
            <Box sx={{
              position: 'relative',
              aspectRatio: compact || selectMode ? '4 / 3' : '3 / 2',
              minHeight: compact || selectMode ? 0 : { xs: 220, sm: 190 },
              bgcolor: '#f6f8fc',
              overflow: 'hidden'
            }}>
              {previewUrl && image ? (
                <Box component="img" src={previewUrl} alt={file.fileName} sx={{ width: '100%', height: '100%', objectFit: compact || selectMode ? 'cover' : 'contain', display: 'block' }} />
              ) : loadingPreview && image ? (
                <Stack spacing={0.5} sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: PORTRA_SURFACE.muted }}>
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>缩略图加载中</Typography>
                </Stack>
              ) : zip ? (
                <Stack spacing={0.75} sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: PORTRA_SURFACE.ink, px: 1.2, textAlign: 'center' }}>
                  <FolderZipRoundedIcon sx={{ color: PORTRA_SURFACE.portraBlue, fontSize: compact ? 30 : 36 }} />
                  <Typography variant="caption" sx={{ color: PORTRA_SURFACE.muted, fontWeight: 850 }}>ZIP 压缩包</Typography>
                </Stack>
              ) : (
                <Stack spacing={0.5} sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: PORTRA_SURFACE.muted }}>
                  <InsertDriveFileRoundedIcon />
                  <Typography variant="caption">{image ? '暂无缩略图' : '文件'}</Typography>
                </Stack>
              )}
              {image && !selectMode && (
                <Box className="delivery-grid-preview-hint" sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  opacity: 0,
                  pointerEvents: 'none',
                  transition: 'opacity .16s ease',
                  bgcolor: 'rgba(17,24,39,.18)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 13
                }}>
                  查看大图
                </Box>
              )}
            </Box>
            {selectMode && (
              <Checkbox
                checked={selected}
                icon={<Box sx={checkboxIconSx} />}
                checkedIcon={<CheckCircleRoundedIcon sx={{ color: PORTRA_SURFACE.portraBlue, bgcolor: '#fff', borderRadius: '50%' }} />}
                onClick={event => event.stopPropagation()}
                onChange={() => toggle(file, index)}
                sx={{ position: 'absolute', top: 6, right: 6, p: 0.4, bgcolor: 'rgba(255,255,255,.82)', borderRadius: '50%' }}
              />
            )}
            {selectMode || !image ? (
              <Box sx={{ px: 0.9, py: 0.75 }}>
                <Typography variant="body2" noWrap sx={{ color: PORTRA_SURFACE.ink, fontWeight: 800 }}>{file.fileName}</Typography>
                <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: PORTRA_SURFACE.muted }}>
                    {image ? '图片' : zip ? 'ZIP 压缩包' : '交付文件'}
                  </Typography>
                  {!selectMode && hasFile && !image && (
                    <Button
                      size="small"
                      startIcon={<DownloadRoundedIcon />}
                      onClick={event => {
                        event.stopPropagation()
                        download(file, index)
                      }}
                      sx={{ minWidth: 0, px: 0.6, py: 0.1, fontSize: 12 }}
                    >
                      下载
                    </Button>
                  )}
                </Stack>
              </Box>
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}

function getSelectionId(file) {
  return getDeliveryFileId(file) || file?.id
}

const checkboxIconSx = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: `2px solid ${PORTRA_SURFACE.borderSubtle}`,
  bgcolor: 'rgba(255,255,255,.92)'
}
