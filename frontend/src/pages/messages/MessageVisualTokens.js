import { PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export { PORTRA_ARCHIVE_SURFACE_SX, PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'

export const PORTRA_COLORS = {
  page: PORTRA_SURFACE.stone,
  paper: PORTRA_SURFACE.paper,
  paperMuted: PORTRA_SURFACE.paperMuted,
  paperSoft: PORTRA_SURFACE.paperSoft,
  blue: PORTRA_SURFACE.portraBlue,
  blueDark: PORTRA_SURFACE.portraBlueHover,
  blueSoft: PORTRA_SURFACE.portraBlueSoft,
  yellow: PORTRA_SURFACE.filmYellow,
  yellowSoft: PORTRA_SURFACE.filmYellowSoft,
  orange: '#FF6B3D',
  orangeSoft: '#FFE7DC',
  ink: PORTRA_SURFACE.ink,
  subInk: PORTRA_SURFACE.subInk,
  mutedInk: PORTRA_SURFACE.muted,
  faintInk: PORTRA_SURFACE.faint,
  border: PORTRA_SURFACE.borderSubtle,
  borderMuted: PORTRA_SURFACE.borderSoft,
  white: PORTRA_SURFACE.surface
}

export const PORTRA_SHADOWS = {
  subtle: PORTRA_SHADOW.soft,
  floating: PORTRA_SHADOW.floating
}

export const PORTRA_RADII = {
  compact: PORTRA_RADIUS.compact,
  control: PORTRA_RADIUS.control,
  panel: PORTRA_RADIUS.panel
}

export const QUOTE_VISUAL = {
  selfBg: '#EEF3FF',
  peerBg: '#FFFDF7',
  selfBorder: '#9DB7FF',
  peerBorder: '#E7DED2',
  blue: '#123DCC',
  ink: '#121622',
  muted: '#6B7280',
  subtle: '#A0A7B3',
  divider: 'rgba(18, 22, 34, 0.08)',
  coral: '#FF6B3D',
  coralSoft: '#FFE7DC',
  green: '#167A55',
  greenSoft: '#DFF3EA',
  waiting: '#7A5B00',
  waitingSoft: '#FFF3CC'
}

const TECHNICAL_DISPLAY_PATTERNS = [
  /^UI_REVIEW_SEED/i,
  /^UIO(?:\W|$)/i,
  /^对方\s*\d+$/i,
  /^(?:SETTLED|NONE)(?:\s*\/\s*(?:SETTLED|NONE))*$/i,
  /\b(?:PENDING_PAYMENT|PAID_PENDING_SHOOT|DELIVERED_PENDING_CONFIRM|REWORK_REQUIRED)\b/i,
  /\b(?:quoteId|conversationId|sourceId)\b/i,
  /接口未返回|fallback/i
]

export function getSafeDisplayText(value, fallback = '约拍沟通') {
  const text = String(value || '').trim()
  if (!text || TECHNICAL_DISPLAY_PATTERNS.some(pattern => pattern.test(text))) return fallback
  return text
}
