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
  { label: '北京', value: 'BJ' },
  { label: '天津', value: 'TJ' },
  { label: '河北', value: 'HE' },
  { label: '山西', value: 'SX' },
  { label: '内蒙古', value: 'NM' },
  { label: '辽宁', value: 'LN' },
  { label: '吉林', value: 'JL' },
  { label: '黑龙江', value: 'HL' },
  { label: '上海', value: 'SH' },
  { label: '江苏', value: 'JS' },
  { label: '浙江', value: 'ZJ' },
  { label: '安徽', value: 'AH' },
  { label: '福建', value: 'FJ' },
  { label: '江西', value: 'JX' },
  { label: '山东', value: 'SD' },
  { label: '河南', value: 'HA' },
  { label: '湖北', value: 'HB' },
  { label: '湖南', value: 'HN' },
  { label: '广东', value: 'GD' },
  { label: '广西', value: 'GX' },
  { label: '海南', value: 'HI' },
  { label: '重庆', value: 'CQ' },
  { label: '四川', value: 'SC' },
  { label: '贵州', value: 'GZ' },
  { label: '云南', value: 'YN' },
  { label: '西藏', value: 'XZ' },
  { label: '陕西', value: 'SN' },
  { label: '甘肃', value: 'GS' },
  { label: '青海', value: 'QH' },
  { label: '宁夏', value: 'NX' },
  { label: '新疆', value: 'XJ' },
  { label: '香港', value: 'HK' },
  { label: '澳门', value: 'MO' },
  { label: '台湾', value: 'TW' }
]

export const TYPE_OPTIONS = [
  { label: '毕业照', value: '毕业照' },
  { label: '互勉', value: '互勉' },
  { label: '写真', value: '写真' },
  { label: '二次元', value: '二次元' },
  { label: '其他', value: '其他' }
]

export const DEFAULT_CITY_CODE = 'JS'
export const DEFAULT_TYPE = '毕业照'
export const DEFAULT_BUDGET_MIN_YUAN = 300
export const DEFAULT_BUDGET_MAX_YUAN = 500

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
  JS: '江苏',
  JIANGSU: '江苏',
  jiangsu: '江苏',
  江苏: '江苏',
  ZJ: '浙江',
  ZHEJIANG: '浙江',
  浙江: '浙江',
  GD: '广东',
  GUANGDONG: '广东',
  广东: '广东',
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
  return CITY_OPTIONS.find(option => option.value === value)?.label ||
    cityNameMap[value] ||
    cityNameMap[String(value || '').toUpperCase()] ||
    value ||
    ''
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
  if (!value || typeof value !== 'object') return { minCent: null, maxCent: null }
  const min = value.minYuan === '' || value.minYuan === null || value.minYuan === undefined ? null : Number(value.minYuan)
  const max = value.maxYuan === '' || value.maxYuan === null || value.maxYuan === undefined ? null : Number(value.maxYuan)
  return {
    minCent: Number.isFinite(min) ? Math.max(0, Math.round(min * 100)) : null,
    maxCent: Number.isFinite(max) ? Math.max(0, Math.round(max * 100)) : null
  }
}
