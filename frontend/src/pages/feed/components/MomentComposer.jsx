import { Box, Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

function ImageGrid({ images, onRemove }) {
  if (!images.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {images.map((src, i) => (
        <Box key={i} sx={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
          <Box
            component="img"
            src={src}
            alt={`图片${i + 1}`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1, display: 'block' }}
          />
          <IconButton
            size="small"
            onClick={() => onRemove(i)}
            sx={{
              position: 'absolute', top: -8, right: -8,
              bgcolor: 'grey.800', color: '#fff', p: 0.25,
              '&:hover': { bgcolor: 'error.main' }
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      ))}
    </Box>
  )
}

export function MomentComposer({
  draft,
  mentionsText,
  imageDataList,
  onDraftChange,
  onMentionsChange,
  onChooseImages,
  onRemoveImage,
  onCancel,
  onPublish
}) {
  const count = imageDataList.length
  const full = count >= 9

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <TextField
          label="动态题目"
          value={draft.title}
          onChange={event => onDraftChange({ ...draft, title: event.target.value })}
          required
        />
        <TextField
          label="动态文案"
          multiline
          minRows={3}
          value={draft.content}
          onChange={event => onDraftChange({ ...draft, content: event.target.value })}
        />
        <TextField
          label="@"
          placeholder="输入昵称或编号，用逗号分隔"
          value={mentionsText}
          onChange={event => onMentionsChange(event.target.value)}
          InputProps={{ startAdornment: <AlternateEmailRoundedIcon color="action" sx={{ mr: 1 }} /> }}
        />

        <ImageGrid images={imageDataList} onRemove={onRemoveImage} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              component="label"
              variant="outlined"
              startIcon={<AddPhotoAlternateRoundedIcon />}
              disabled={full}
            >
              {full ? '已达上限' : '添加照片'}
              <input hidden type="file" accept="image/*" multiple onChange={onChooseImages} />
            </Button>
            {count > 0 && (
              <Typography variant="caption" color="text.secondary">
                {count}/9
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="text" color="inherit" onClick={onCancel}>取消</Button>
            <Button variant="contained" onClick={onPublish} disabled={!draft.title.trim() || count === 0}>
              发布
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  )
}
