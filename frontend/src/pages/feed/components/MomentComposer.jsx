import { useMemo } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

function ImageGrid({ images, onRemove }) {
  if (!images.length) return null
  return (
    <Box className="moment-composer__grid">
      {images.map((src, index) => (
        <Box key={src || index} className="moment-composer__thumb">
          <Box component="img" src={src} alt={`照片 ${index + 1}`} />
          <IconButton
            size="small"
            className="moment-composer__remove"
            onClick={() => onRemove(index)}
          >
            <CloseRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      ))}
    </Box>
  )
}

export function MomentComposer({
  open,
  mode = 'create',
  draft,
  imageDataList,
  onDraftChange,
  onChooseImages,
  onRemoveImage,
  onCancel,
  onPublish,
  submitting = false
}) {
  const title = mode === 'edit' ? '编辑动态' : '发布动态'
  const submitLabel = mode === 'edit' ? '保存修改' : '发布动态'
  const disabled = submitting || !draft.title.trim() || !draft.content.trim() || imageDataList.length === 0
  const countText = useMemo(() => `${imageDataList.length}/9`, [imageDataList.length])

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle className="moment-composer__title">
        <span>{title}</span>
        <span className="moment-composer__stamp">PORTRA FILE</span>
      </DialogTitle>
      <DialogContent className="moment-composer">
        <Stack spacing={2}>
          <Typography className="moment-composer__lead">
            分享今天想留下来的画面，或者补一条没写完整的记录。
          </Typography>
          <TextField
            label="标题"
            value={draft.title}
            onChange={event => onDraftChange({ ...draft, title: event.target.value })}
            required
            fullWidth
          />
          <TextField
            label="正文"
            multiline
            minRows={4}
            value={draft.content}
            onChange={event => onDraftChange({ ...draft, content: event.target.value })}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                添加照片
                <input hidden type="file" accept="image/*" multiple onChange={onChooseImages} />
              </Button>
              <Typography variant="caption" color="text.secondary">{countText}</Typography>
            </Stack>
          </Stack>
          <ImageGrid images={imageDataList} onRemove={onRemoveImage} />
        </Stack>
      </DialogContent>
      <DialogActions className="moment-composer__actions">
        <Button onClick={onCancel} color="inherit">取消</Button>
        <Button variant="contained" onClick={onPublish} disabled={disabled}>
          {submitting ? '提交中...' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
