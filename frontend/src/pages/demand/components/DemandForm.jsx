import { Box, Button, Paper, Stack, TextField } from '@mui/material'

export function DemandForm({ form, onChange, onSubmit }) {
  return (
    <Paper component="form" variant="outlined" onSubmit={onSubmit} sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <TextField label="场景" value={form.scene} onChange={event => onChange('scene', event.target.value)} required />
        <TextField label="城市" value={form.cityCode} onChange={event => onChange('cityCode', event.target.value)} required />
        <TextField label="地点" value={form.location} onChange={event => onChange('location', event.target.value)} required />
        <TextField label="日期" value={form.expectedDate} onChange={event => onChange('expectedDate', event.target.value)} placeholder="2026-06-01" inputProps={{ inputMode: 'numeric' }} />
        <TextField label="时间段" value={form.timeSlot} onChange={event => onChange('timeSlot', event.target.value)} />
        <TextField label="风格标签" value={form.styleTagsText} onChange={event => onChange('styleTagsText', event.target.value)} />
        <TextField label="最低预算" type="number" value={form.budgetMinYuan} onChange={event => onChange('budgetMinYuan', event.target.value)} />
        <TextField label="最高预算" type="number" value={form.budgetMaxYuan} onChange={event => onChange('budgetMaxYuan', event.target.value)} />
        <TextField
          label="需求描述"
          multiline
          minRows={4}
          value={form.description}
          onChange={event => onChange('description', event.target.value)}
          sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}
        />
      </Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button type="submit" variant="contained" size="large">发布需求</Button>
      </Stack>
    </Paper>
  )
}
