import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

const toneMap = {
  primary: { bgcolor: PORTRA_SURFACE.portraBlue, color: '#fff' },
  waiting: { bgcolor: PORTRA_SURFACE.filmYellowSoft, color: PORTRA_SURFACE.ink },
  warning: { bgcolor: PORTRA_SURFACE.filmYellowSoft, color: PORTRA_SURFACE.ink },
  danger: { bgcolor: PORTRA_SURFACE.warmOrangeDeep, color: '#fff' },
  cancelled: { bgcolor: 'rgba(93,97,103,.14)', color: PORTRA_SURFACE.muted },
  completed: { bgcolor: '#dfe8e4', color: '#203b35' },
  neutral: { bgcolor: PORTRA_SURFACE.paperMuted, color: PORTRA_SURFACE.muted }
}

function inferStatusTone(value = '') {
  const text = String(value)
  if (/取消|退款|灰|cancel/i.test(text)) return 'cancelled'
  if (/完成|释放|结算|completed|released|settled/i.test(text)) return 'completed'
  if (/拒绝|返修|异常|申诉|失败|danger|error|rework|appeal/i.test(text)) return 'danger'
  if (/等待|待|未付款|未结算|pending|waiting|not_/i.test(text)) return 'waiting'
  if (/托管|进行|拍摄|交付|primary|hold|held|paid/i.test(text)) return 'primary'
  return 'neutral'
}

export function PortraTicketCard({
  children,
  selected = false,
  accent = PORTRA_SURFACE.portraBlue,
  sx,
  ...props
}) {
  return (
    <Box
      {...props}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        bgcolor: PORTRA_SURFACE.paper,
        border: `1px solid ${PORTRA_SURFACE.borderSubtle}`,
        borderRadius: PORTRA_RADIUS.card,
        boxShadow: selected ? PORTRA_SHADOW.floating : PORTRA_SHADOW.soft,
        transition: 'transform .16s ease, box-shadow .16s ease, border-color .16s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: '0 auto 0 0',
          width: 4,
          bgcolor: accent
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 0,
          borderTop: '1px dashed rgba(13,47,178,.15)'
        },
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: PORTRA_SHADOW.floating,
          borderColor: 'rgba(13,47,178,.22)'
        },
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

export function PortraTicketSection({ title, eyebrow, action, children, sx }) {
  return (
    <Box
      component="section"
      sx={{
        display: 'grid',
        gap: 2,
        ...sx
      }}
    >
      <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          {eyebrow && (
            <Typography sx={{ color: PORTRA_SURFACE.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
              {eyebrow}
            </Typography>
          )}
          <Typography sx={{ color: PORTRA_SURFACE.ink, fontSize: 16, fontWeight: 850 }}>
            {title}
          </Typography>
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  )
}

export function PortraStatusPill({ label, tone, sx }) {
  const resolvedTone = tone || inferStatusTone(label)
  const colors = toneMap[resolvedTone] || toneMap.neutral
  return (
    <Chip
      size="small"
      label={label || '状态待确认'}
      sx={{
        height: 24,
        borderRadius: PORTRA_RADIUS.compact,
        bgcolor: colors.bgcolor,
        color: colors.color,
        fontSize: 12,
        fontWeight: 800,
        boxShadow: 'none',
        cursor: 'default',
        '& .MuiChip-label': { px: 1.05 },
        ...sx
      }}
    />
  )
}

export function PortraStatusBadge(props) {
  return <PortraStatusPill {...props} />
}

export function PortraInfoBanner({ tone = 'info', title, children, action, sx }) {
  const warning = tone === 'warning'
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
        px: 1.5,
        py: 1.15,
        bgcolor: warning ? PORTRA_SURFACE.filmYellowSoft : PORTRA_SURFACE.portraBlueSoft,
        borderLeft: `4px solid ${warning ? PORTRA_SURFACE.warmOrangeDeep : PORTRA_SURFACE.portraBlue}`,
        borderRadius: PORTRA_RADIUS.control,
        color: PORTRA_SURFACE.ink,
        ...sx
      }}
    >
      <Box sx={{ width: 18, fontSize: 12, fontWeight: 900, color: warning ? PORTRA_SURFACE.warmOrangeDeep : PORTRA_SURFACE.portraBlue }}>
        {warning ? '!' : 'i'}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {title && <Typography sx={{ fontSize: 13, fontWeight: 850 }}>{title}</Typography>}
        {typeof children === 'string' ? (
          <Typography sx={{ color: PORTRA_SURFACE.muted, fontSize: 13, lineHeight: 1.55 }}>{children}</Typography>
        ) : (
          <Box sx={{ color: PORTRA_SURFACE.muted, fontSize: 13, lineHeight: 1.55 }}>{children}</Box>
        )}
      </Box>
      {action}
    </Box>
  )
}

export function PortraTimeline({ items = [], emptyText = '暂无状态日志', sx }) {
  if (!items.length) return <PortraEmptyState title={emptyText} compact />
  return (
    <Stack sx={{ position: 'relative', gap: 0, ...sx }}>
      {items.map((item, index) => (
        <Box
          key={item.id || `${item.title}-${index}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: '22px minmax(0, 1fr)',
            columnGap: 1,
            pb: index === items.length - 1 ? 0 : 1.55
          }}
        >
          <Box sx={{ position: 'relative', minHeight: 34 }}>
            {index !== items.length - 1 && (
              <Box sx={{ position: 'absolute', top: 18, bottom: -12, left: 7, width: 1, bgcolor: 'rgba(13,47,178,.16)' }} />
            )}
            <Box sx={{ position: 'absolute', top: 5, left: 3, width: 10, height: 10, borderRadius: '50%', bgcolor: item.tone === 'danger' ? PORTRA_SURFACE.warmOrangeDeep : PORTRA_SURFACE.portraBlue, boxShadow: `0 0 0 4px ${PORTRA_SURFACE.paper}` }} />
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} sx={{ justifyContent: 'space-between', gap: 0.75, minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 850, color: PORTRA_SURFACE.ink }}>{item.title}</Typography>
              {item.description && <Typography sx={{ mt: 0.2, color: PORTRA_SURFACE.muted, fontSize: 13, lineHeight: 1.55 }}>{item.description}</Typography>}
            </Box>
            {item.time && <Typography sx={{ flexShrink: 0, color: PORTRA_SURFACE.muted, fontSize: 12 }}>{item.time}</Typography>}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}

export function PortraEmptyState({ title = '暂无内容', description = '', compact = false, sx }) {
  return (
    <Box
      sx={{
        px: compact ? 1.2 : 2,
        py: compact ? 1 : 2,
        bgcolor: 'rgba(255,253,249,.54)',
        border: `1px dashed ${PORTRA_SURFACE.borderSubtle}`,
        borderRadius: PORTRA_RADIUS.control,
        color: PORTRA_SURFACE.muted,
        ...sx
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{title}</Typography>
      {description && <Typography sx={{ mt: 0.25, fontSize: 13 }}>{description}</Typography>}
    </Box>
  )
}

export function PortraActionButton({ children, tone = 'primary', loading = false, disabled = false, sx, ...props }) {
  const primary = tone === 'primary'
  return (
    <Button
      size="small"
      variant={primary ? 'contained' : 'outlined'}
      disabled={disabled || loading}
      {...props}
      sx={{
        borderRadius: PORTRA_RADIUS.compact,
        px: 1.35,
        minHeight: primary ? 40 : 34,
        fontWeight: 850,
        textTransform: 'none',
        bgcolor: primary ? PORTRA_SURFACE.portraBlue : 'transparent',
        color: primary ? '#fff' : PORTRA_SURFACE.portraBlue,
        borderColor: primary ? PORTRA_SURFACE.portraBlue : 'rgba(13,47,178,.28)',
        '&:hover': {
          bgcolor: primary ? PORTRA_SURFACE.portraBlueHover : PORTRA_SURFACE.portraBlueSoft,
          borderColor: PORTRA_SURFACE.portraBlue
        },
        ...sx
      }}
    >
      {loading ? '处理中' : children}
    </Button>
  )
}

export function PortraPrimaryAction({ children, sx, ...props }) {
  return (
    <PortraActionButton
      tone="primary"
      {...props}
      sx={{
        borderRadius: PORTRA_RADIUS.control,
        minHeight: 40,
        px: 1.6,
        boxShadow: 'none',
        ...sx
      }}
    >
      {children}
    </PortraActionButton>
  )
}

export function PortraSecondaryAction({ children, sx, ...props }) {
  return (
    <PortraActionButton
      tone="secondary"
      {...props}
      sx={{
        borderRadius: PORTRA_RADIUS.control,
        minHeight: 34,
        px: 1.35,
        color: PORTRA_SURFACE.ink,
        borderColor: PORTRA_SURFACE.borderSubtle,
        ...sx
      }}
    >
      {children}
    </PortraActionButton>
  )
}

export function PortraActionLink({ children, sx, ...props }) {
  return (
    <Button
      size="small"
      variant="text"
      {...props}
      sx={{
        minHeight: 28,
        minWidth: 0,
        px: 0.45,
        py: 0,
        borderRadius: PORTRA_RADIUS.control,
        textTransform: 'none',
        fontSize: 12.5,
        fontWeight: 850,
        lineHeight: 1.2,
        color: PORTRA_SURFACE.portraBlue,
        '& .MuiButton-startIcon': {
          mr: 0.45,
          '& svg': { fontSize: 16 }
        },
        '&:hover': {
          bgcolor: 'rgba(13,47,178,.06)'
        },
        ...sx
      }}
    >
      {children}
    </Button>
  )
}

export function PortraContextActionButton({ children, emphasis = false, sx, ...props }) {
  return (
    <Button
      size="small"
      variant={emphasis ? 'contained' : 'outlined'}
      {...props}
      sx={{
        minHeight: 32,
        px: 1.15,
        borderRadius: 999,
        textTransform: 'none',
        fontSize: 13,
        fontWeight: 850,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        color: emphasis ? '#fff' : PORTRA_SURFACE.ink,
        bgcolor: emphasis ? PORTRA_SURFACE.portraBlue : 'rgba(255, 253, 249, 0.62)',
        borderColor: emphasis ? PORTRA_SURFACE.portraBlue : PORTRA_SURFACE.borderSubtle,
        boxShadow: emphasis ? '0 8px 18px rgba(13, 47, 178, 0.16)' : 'none',
        '& .MuiButton-startIcon': {
          mr: 0.55,
          '& svg': { fontSize: 17 }
        },
        '&:hover': {
          bgcolor: emphasis ? PORTRA_SURFACE.portraBlueHover : PORTRA_SURFACE.portraBlueSoft,
          borderColor: emphasis ? PORTRA_SURFACE.portraBlueHover : 'rgba(13,47,178,.28)',
          boxShadow: emphasis ? '0 10px 22px rgba(13, 47, 178, 0.2)' : 'none'
        },
        '&.Mui-disabled': {
          color: 'rgba(55, 61, 73, 0.42)',
          bgcolor: 'rgba(248, 243, 235, 0.48)',
          borderColor: PORTRA_SURFACE.borderSoft
        },
        ...sx
      }}
    >
      {children}
    </Button>
  )
}

export function PortraSystemNotice({ children, time, action, sx }) {
  return (
    <Box
      data-portra-system-notice="true"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        px: { xs: 1, md: 2 },
        ...sx
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          maxWidth: { xs: 'min(92%, 500px)', md: 500 },
          minHeight: 28,
          px: 1,
          py: 0.18,
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          rowGap: 0.15,
          bgcolor: 'rgba(248,243,235,.46)',
          borderRadius: PORTRA_RADIUS.compact,
          boxShadow: 'none'
        }}
      >
        <Typography sx={{ color: PORTRA_SURFACE.muted, fontSize: 12.5, fontWeight: 750, lineHeight: 1.35 }}>
          {children}
        </Typography>
        {time && <Typography sx={{ color: PORTRA_SURFACE.faint, fontSize: 11.5, lineHeight: 1.2 }}>{time}</Typography>}
        {action}
      </Stack>
    </Box>
  )
}

export function PortraWorkflowPanel({ children, sx, ...props }) {
  return (
    <Box
      {...props}
      sx={{
        p: { xs: 1.25, md: 1.4 },
        bgcolor: 'rgba(248,243,235,.72)',
        border: `1px solid ${PORTRA_SURFACE.borderSoft}`,
        borderRadius: PORTRA_RADIUS.card,
        boxShadow: 'none',
        minWidth: 0,
        ...sx
      }}
    >
      {children}
    </Box>
  )
}
