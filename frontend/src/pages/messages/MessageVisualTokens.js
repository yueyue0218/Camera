export const PORTRA_COLORS = {
  page: '#e6e2e0',
  paper: '#f8f3eb',
  paperMuted: '#ebe6dd',
  blue: '#0d2fb2',
  blueDark: '#09258f',
  blueSoft: '#e7ebfa',
  yellow: '#f7ce3a',
  yellowSoft: '#fff7d8',
  orange: '#f85104',
  orangeSoft: '#fae8df',
  ink: '#111015',
  subInk: '#151318',
  mutedInk: '#625f63',
  faintInk: '#858087',
  border: '#cbc6c4',
  borderMuted: '#d9d4d1',
  white: '#fffdf9'
}

export const PORTRA_SHADOWS = {
  subtle: '0 6px 18px rgba(17, 16, 21, 0.05)',
  floating: '0 12px 30px rgba(17, 16, 21, 0.08)'
}

export const PORTRA_RADII = {
  compact: '4px',
  control: '6px',
  panel: '8px'
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

export function getSafeDisplayText(value, fallback = '本次合作') {
  const text = String(value || '').trim()
  if (!text || TECHNICAL_DISPLAY_PATTERNS.some(pattern => pattern.test(text))) return fallback
  return text
}
