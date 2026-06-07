export function yuanToCent(value) {
  if (value === '' || value === null || value === undefined) return null
  return Math.round(Number(value) * 100)
}

export function centToYuan(value) {
  if (value === null || value === undefined) return '未填写'
  return `¥${(value / 100).toFixed(2)}`
}
