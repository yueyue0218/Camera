import { Button, Paper, Stack, TextField } from '@mui/material'
import PublishRoundedIcon from '@mui/icons-material/PublishRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'

export function FeedToolbar({ query, onQueryChange, onSearch, onToggleComposer }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <TextField
          fullWidth
          label="搜索动态"
          placeholder="输入标题或文案"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') onSearch()
          }}
        />
        <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={onSearch}>
          搜索
        </Button>
        <Button variant="contained" startIcon={<PublishRoundedIcon />} onClick={onToggleComposer}>
          发布动态
        </Button>
      </Stack>
    </Paper>
  )
}
