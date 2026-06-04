import { Alert, Box, Button, Paper, Stack, TextField } from '@mui/material'

export function ServicePackageForm({ form, errors, onChange, onSubmit }) {
  return (
    <Paper component="form" variant="outlined" onSubmit={onSubmit} sx={{ p: { xs: 2, md: 3 } }}>
      {!!errors.length && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {errors.map(error => <div key={error}>{error}</div>)}
        </Alert>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <TextField label="橱窗标题" value={form.title} onChange={event => onChange('title', event.target.value)} required />
        <TextField label="城市" value={form.cityCode} onChange={event => onChange('cityCode', event.target.value)} required />
        <TextField label="服务区域" value={form.serviceArea} onChange={event => onChange('serviceArea', event.target.value)} />
        <TextField label="拍摄场景" value={form.scene} onChange={event => onChange('scene', event.target.value)} required />
        <TextField label="风格标签" value={form.styleTagsText} onChange={event => onChange('styleTagsText', event.target.value)} />
        <TextField label="时间标签" value={form.timeTagsText} onChange={event => onChange('timeTagsText', event.target.value)} />
        <TextField label="基础价格" type="number" value={form.basePriceYuan} onChange={event => onChange('basePriceYuan', event.target.value)} required />
        <TextField label="价格区间" value={form.priceRange} onChange={event => onChange('priceRange', event.target.value)} />
        <TextField label="拍摄时长（分钟）" type="number" value={form.durationMinutes} onChange={event => onChange('durationMinutes', event.target.value)} required />
        <TextField label="交付天数" type="number" value={form.deliveryDays} onChange={event => onChange('deliveryDays', event.target.value)} required />
        <TextField label="原片数量" type="number" value={form.originalCount} onChange={event => onChange('originalCount', event.target.value)} required />
        <TextField label="精修数量" type="number" value={form.refinedCount} onChange={event => onChange('refinedCount', event.target.value)} required />
        <TextField
          label="图片 URL"
          multiline
          minRows={2}
          value={form.imagesText}
          onChange={event => onChange('imagesText', event.target.value)}
          sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}
        />
        <TextField
          label="可预约日期"
          value={form.availableDatesText}
          onChange={event => onChange('availableDatesText', event.target.value)}
          placeholder="2026-07-01,2026-07-02"
          sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}
        />
        <TextField
          label="作品 ID"
          value={form.portfolioIdsText}
          onChange={event => onChange('portfolioIdsText', event.target.value)}
          sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}
        />
        <TextField
          label="时间说明"
          multiline
          minRows={2}
          value={form.timeDescription}
          onChange={event => onChange('timeDescription', event.target.value)}
          required
          sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}
        />
        <TextField
          label="橱窗说明"
          multiline
          minRows={4}
          value={form.description}
          onChange={event => onChange('description', event.target.value)}
          sx={{ gridColumn: { xs: 'span 1', md: 'span 2' } }}
        />
      </Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button type="submit" variant="contained" size="large">发布橱窗</Button>
      </Stack>
    </Paper>
  )
}
