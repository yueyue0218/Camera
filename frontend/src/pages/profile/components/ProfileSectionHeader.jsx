import { Stack, Typography } from '@mui/material'

export function ProfileSectionHeader({ title, subtitle }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="h5">{title}</Typography>
      <Typography color="text.secondary">{subtitle}</Typography>
    </Stack>
  )
}
