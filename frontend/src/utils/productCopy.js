const PRODUCT_COPY_REPLACEMENTS = [
  [/交付文件/g, '作品'],
  [/作品文件/g, '作品'],
  [/需求方/g, '客户'],
  [/服务方/g, '摄影师'],
  [/会话/g, '沟通'],
  [/模拟支付/g, '支付'],
  [/\bPERSONAL_USE\b/g, '仅限个人留念'],
  [/\bCOMMERCIAL_USE\b/g, '商业使用'],
  [/\bPUBLIC_DISPLAY\b/g, '可公开展示'],
  [/\bUI_REVIEW_SEED\b/g, ''],
  [/\bDemo\s+2002\b/gi, '']
]

export const PRODUCT_ACTION_COPY = {
  viewOrder: '查看订单',
  returnConversation: '返回沟通',
  returnOrderList: '返回订单列表',
  goConversation: '去沟通',
  payOrder: '去支付',
  confirmDelivery: '确认接收作品',
  requestRework: '提交返修要求'
}

export function normalizeProductCopy(value, fallback = '') {
  let text = String(value || '').trim()
  if (!text) return fallback
  PRODUCT_COPY_REPLACEMENTS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement)
  })
  text = text.replace(/\s{2,}/g, ' ').trim()
  return text || fallback
}

export function formatFileUnit(count, unit = '作品') {
  const value = Number(count)
  return `${Number.isFinite(value) ? value : 0} ${unit}`
}
