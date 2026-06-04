import { Button, Paper, Stack, TextField } from '@mui/material'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded'

export function MomentComposer({
  draft,
  mentionsText,
  imageData,
  onDraftChange,
  onMentionsChange,
  onChooseImage,
  onCancel,
  onPublish
}) {
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
        {imageData && <img className="feed-image" src={imageData} alt="待发布照片" />}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
          <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
            选择照片
            <input hidden type="file" accept="image/*" onChange={onChooseImage} />
          </Button>
          <Stack direction="row" spacing={1}>
            <Button variant="text" color="inherit" onClick={onCancel}>取消</Button>
            <Button variant="contained" onClick={onPublish} disabled={!draft.title.trim()}>发布</Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  )
}
