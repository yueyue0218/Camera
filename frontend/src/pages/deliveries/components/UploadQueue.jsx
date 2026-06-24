import { Alert, Box, Stack, Typography } from '@mui/material'
import { PORTRA_SURFACE } from '../../../theme/portraSurfaceTokens.js'
import { DeliveryFileCard } from './DeliveryFileCard.jsx'
import { ImagePreviewGrid } from './ImagePreviewGrid.jsx'

export function UploadQueue({
  items = [],
  errors = [],
  loading = false,
  failed = false,
  onRemove
}) {
  const images = items.filter(item => item.fileType === 'IMAGE')
  const files = items.filter(item => item.fileType !== 'IMAGE')
  const statusLabel = loading ? '上传中' : failed ? '上传失败，可重试' : '待上传'

  if (!items.length && !errors.length) {
    return (
      <Box sx={{ py: 0.2 }}>
        <Typography sx={{ color: PORTRA_SURFACE.muted, fontSize: 14 }}>
          选择照片后会在这里生成交付预览，客户将按批次查看这些作品。
        </Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={1.2}>
      {failed && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          上传失败，请检查网络或稍后重试；队列已保留，可以直接再次提交。
        </Alert>
      )}
      {errors.map(error => (
        <Alert key={error} severity="warning" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      ))}
      {images.length > 0 && (
        <Stack spacing={0.75}>
          <Typography sx={sectionTitleSx}>图片预览</Typography>
          <ImagePreviewGrid
            items={images}
            statusLabel={statusLabel}
            onRemove={onRemove}
            disabled={loading}
          />
        </Stack>
      )}
      {files.length > 0 && (
        <Stack spacing={0.75}>
          <Typography sx={sectionTitleSx}>交付文件</Typography>
          {files.map(item => (
            <DeliveryFileCard
              key={item.id}
              item={item}
              statusLabel={statusLabel}
              onRemove={() => onRemove?.(item.id)}
              disabled={loading}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

const sectionTitleSx = {
  color: PORTRA_SURFACE.faint,
  fontSize: 12,
  fontWeight: 950
}
