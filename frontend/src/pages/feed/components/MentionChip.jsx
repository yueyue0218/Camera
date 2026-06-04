import { Chip } from '@mui/material'

export function MentionChip({ mention, onOpen }) {
  const label = `@${String(mention).replace(/^@+/, '')}`
  return (
    <Chip
      size="small"
      label={label}
      clickable={Boolean(onOpen)}
      onClick={onOpen}
    />
  )
}
