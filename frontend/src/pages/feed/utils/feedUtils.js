export const roleMap = {
  CUSTOMER: '需求方',
  PROVIDER: '服务方'
}

export function parseMentions(text) {
  return String(text || '')
    .split(/[,\n，\s]+/)
    .map(value => value.replace(/^@+/, '').trim())
    .filter(Boolean)
}

export function formatTime(value) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
