export const TIME_TAG_OPTIONS = [
  { label: '时间标签', value: '' },
  { label: '不限时间', value: '' },
  { label: '近三天', value: 'NEAR_3_DAYS' },
  { label: '近七天', value: 'NEAR_7_DAYS' },
  { label: '近一个月', value: 'NEAR_1_MONTH' }
]

export const TIME_STYLE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '近三天', value: 'NEAR_3_DAYS' },
  { label: '近七天', value: 'NEAR_7_DAYS' },
  { label: '近一个月', value: 'NEAR_1_MONTH' }
]

export const CITY_OPTIONS = [
  { label: '城市', value: '' },
  { label: '南京', value: 'NJ' },
  { label: '上海', value: 'SH' },
  { label: '北京', value: 'BJ' },
  { label: '杭州', value: 'HZ' }
]

export const TYPE_OPTIONS = [
  { label: '类型', value: '' },
  { label: '毕业照', value: '毕业照' },
  { label: '写真', value: '写真' }
]

export const BUDGET_OPTIONS = [
  { label: '预算', value: '' },
  { label: '￥200-500', value: '200-500', minCent: 20000, maxCent: 50000 }
]

export const demandStatusText = {
  OPEN: '开放中',
  MATCHED: '已匹配',
  CLOSED: '已关闭',
  PENDING_CUSTOMER_ACCEPT: '待接受',
  ACCEPTED: '已接受',
  REJECTED: '已拒绝'
}

export const cityNameMap = {
  NJU: '南京大学',
  NJ: '南京',
  NKG: '南京',
  NANJING: '南京',
  nanjing: '南京',
  南京: '南京',
  SH: '上海',
  SHA: '上海',
  SHANGHAI: '上海',
  shanghai: '上海',
  上海: '上海',
  BJ: '北京',
  PEK: '北京',
  BEIJING: '北京',
  beijing: '北京',
  北京: '北京',
  HZ: '杭州',
  HGH: '杭州',
  HANGZHOU: '杭州',
  hangzhou: '杭州',
  杭州: '杭州'
}

const gradients = [
  'linear-gradient(135deg,#d7c3b4,#9aa6a7 48%,#f3dfc0)',
  'linear-gradient(135deg,#a66e5f,#e5c9a9 44%,#4b5260)',
  'linear-gradient(135deg,#e9d8cc,#b9a29b 42%,#22324f)',
  'linear-gradient(135deg,#f0c064,#cec8b7 46%,#566f78)'
]

export function gradientFor(id) {
  return gradients[Math.abs(Number(id || 0)) % gradients.length]
}

export function splitTags(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {
    return trimmed.split(/[,\s/]+/).map(item => item.trim()).filter(Boolean)
  }
  return []
}

export function firstText(...values) {
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || ''
}

export function cityName(value) {
  return cityNameMap[value] || cityNameMap[String(value || '').toUpperCase()] || value || ''
}

export function countText(value, unit = '') {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return `${number}${unit}`
}

export function timeTagLabel(value) {
  return TIME_STYLE_OPTIONS.find(option => option.value === value)?.label || value || ''
}

export function moneyRange(minCent, maxCent, fallback = '暂无') {
  const min = money(minCent, '')
  const max = money(maxCent, '')
  if (min && max) return `${min}-${max.replace('￥', '')}`
  return min || max || fallback
}

export function money(value, fallback = '暂无') {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  if (Number.isNaN(number)) return fallback
  return `￥${Math.round(number / 100)}`
}

export function shortDateTime(value) {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function readableDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function priceParamsFromBudget(value) {
  const option = BUDGET_OPTIONS.find(item => item.value === value)
  return {
    minCent: option?.minCent || null,
    maxCent: option?.maxCent || null
  }
}
