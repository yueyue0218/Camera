import { yuanToCent } from '../../../utils/index.js'

function splitList(value) {
  return String(value || '')
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function splitIds(value) {
  return splitList(value)
    .map(item => Number(item))
    .filter(Number.isFinite)
}

export function createDefaultServicePackageForm() {
  return {
    title: '校园写真橱窗',
    cityCode: 'NJU',
    serviceArea: '南京大学校园',
    scene: 'GRADUATION',
    styleTagsText: '自然,校园,写真',
    imagesText: '',
    basePriceYuan: 399,
    priceRange: '399-599',
    durationMinutes: 120,
    originalCount: 30,
    refinedCount: 9,
    deliveryDays: 7,
    availableDatesText: '',
    portfolioIdsText: '',
    description: '适合毕业照、校园写真和轻量约拍。',
    timeDescription: '近一周周末可约',
    timeTagsText: 'NEAR_7_DAYS'
  }
}

export function validateServicePackageForm(form) {
  const errors = []
  if (!form.title.trim()) errors.push('请填写橱窗标题')
  if (!form.cityCode.trim()) errors.push('请填写城市')
  if (!form.scene.trim()) errors.push('请填写拍摄场景')
  if (!form.timeDescription.trim()) errors.push('请填写时间说明')
  if (Number(form.basePriceYuan) <= 0) errors.push('基础价格必须大于 0')
  if (Number(form.durationMinutes) <= 0) errors.push('拍摄时长必须大于 0')
  if (Number(form.originalCount) < 0) errors.push('原片数量不能为负数')
  if (Number(form.refinedCount) < 0) errors.push('精修数量不能为负数')
  if (Number(form.deliveryDays) <= 0) errors.push('交付天数必须大于 0')
  return errors
}

export function buildServicePackagePayload(form) {
  return {
    title: form.title.trim(),
    cityCode: form.cityCode.trim(),
    serviceArea: form.serviceArea.trim() || null,
    scene: form.scene.trim(),
    styleTags: splitList(form.styleTagsText),
    images: splitList(form.imagesText),
    basePriceCent: yuanToCent(form.basePriceYuan),
    priceRange: form.priceRange.trim() || null,
    durationMinutes: Number(form.durationMinutes),
    originalCount: Number(form.originalCount),
    refinedCount: Number(form.refinedCount),
    deliveryDays: Number(form.deliveryDays),
    availableDates: splitList(form.availableDatesText),
    portfolioIds: splitIds(form.portfolioIdsText),
    description: form.description.trim() || null,
    timeDescription: form.timeDescription.trim(),
    timeTags: splitList(form.timeTagsText)
  }
}
