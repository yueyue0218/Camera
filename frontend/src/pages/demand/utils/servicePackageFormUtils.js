import { yuanToCent } from '../../../utils/index.js'
import { fileIdsFromValues } from '../../../api/fileApi.js'
import {
  DEFAULT_BUDGET_MAX_YUAN,
  DEFAULT_BUDGET_MIN_YUAN,
  DEFAULT_CITY_CODE,
  DEFAULT_TYPE
} from '../../hall/components/hallUtils.js'

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

function centToYuan(value, fallback = '') {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number / 100) : fallback
}

function uniqueIds(values) {
  return Array.from(new Set(values.map(value => Number(value)).filter(Number.isFinite)))
}

function normalizeYuan(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function buildPriceRange(minYuan, maxYuan) {
  const min = normalizeYuan(minYuan)
  const max = normalizeYuan(maxYuan)
  if (min !== null && max !== null) return `${min}-${max}`
  if (min !== null) return `${min}`
  if (max !== null) return `${max}`
  return null
}

function maxPriceFromRange(priceRange, fallback) {
  const matches = String(priceRange || '').match(/\d+/g)
  if (!matches?.length) return fallback
  return matches[matches.length - 1]
}

export function createDefaultServicePackageForm() {
  return {
    title: '校园写真橱窗',
    cityCode: DEFAULT_CITY_CODE,
    serviceArea: '',
    scene: DEFAULT_TYPE,
    styleTagsText: DEFAULT_TYPE,
    imagesText: '',
    basePriceYuan: DEFAULT_BUDGET_MIN_YUAN,
    maxPriceYuan: DEFAULT_BUDGET_MAX_YUAN,
    priceRange: `${DEFAULT_BUDGET_MIN_YUAN}-${DEFAULT_BUDGET_MAX_YUAN}`,
    durationMinutes: 120,
    originalCount: 30,
    refinedCount: 9,
    deliveryDays: 7,
    availableDatesText: '',
    portfolioIdsText: '',
    portfolioIds: [],
    portfolioFileNames: [],
    portfolioPreviewUrls: [],
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
  const imageCount = uniqueIds([
    ...(Array.isArray(form.portfolioIds) ? form.portfolioIds : []),
    ...splitIds(form.portfolioIdsText)
  ]).length + splitList(form.imagesText).length
  if (imageCount === 0) errors.push('发布橱窗至少需要上传 1 张图片')
  return errors
}

export function buildServicePackagePayload(form) {
  const styleTags = new Set([
    form.scene,
    ...splitList(form.styleTagsText)
  ].filter(Boolean))
  const manualImages = splitList(form.imagesText)
  const portfolioIds = uniqueIds([
    ...(Array.isArray(form.portfolioIds) ? form.portfolioIds : []),
    ...splitIds(form.portfolioIdsText),
    ...fileIdsFromValues(manualImages)
  ])
  const publicImages = manualImages.filter(image => !fileIdsFromValues(image).length)
  return {
    title: form.title.trim(),
    cityCode: form.cityCode.trim(),
    serviceArea: form.serviceArea.trim() || null,
    scene: form.scene.trim(),
    styleTags: Array.from(styleTags),
    // Persist uploaded portfolio fileIds in portfolioIds; protected download URLs must not be saved in images.
    images: publicImages,
    basePriceCent: yuanToCent(form.basePriceYuan),
    priceRange: buildPriceRange(form.basePriceYuan, form.maxPriceYuan),
    durationMinutes: Number(form.durationMinutes),
    originalCount: Number(form.originalCount),
    refinedCount: Number(form.refinedCount),
    deliveryDays: Number(form.deliveryDays),
    availableDates: splitList(form.availableDatesText),
    portfolioIds,
    description: form.description.trim() || null,
    timeDescription: form.timeDescription.trim(),
    timeTags: splitList(form.timeTagsText)
  }
}

export function servicePackageDetailToForm(service = {}) {
  const rawImages = Array.isArray(service.images) ? service.images : []
  const portfolioIds = uniqueIds([
    ...(Array.isArray(service.portfolioIds) ? service.portfolioIds : []),
    ...fileIdsFromValues(rawImages)
  ])
  const images = rawImages.filter(image => !fileIdsFromValues(image).length)
  const basePriceYuan = centToYuan(service.basePriceCent, DEFAULT_BUDGET_MIN_YUAN)
  const maxPriceYuan = maxPriceFromRange(service.priceRange, DEFAULT_BUDGET_MAX_YUAN)
  return {
    title: service.title || '校园写真橱窗',
    cityCode: service.cityCode || DEFAULT_CITY_CODE,
    serviceArea: service.serviceArea || '',
    scene: service.scene || DEFAULT_TYPE,
    styleTagsText: Array.isArray(service.styleTags) ? service.styleTags.join(',') : '',
    imagesText: images.join(','),
    basePriceYuan,
    maxPriceYuan,
    priceRange: service.priceRange || `${basePriceYuan}-${maxPriceYuan}`,
    durationMinutes: service.durationMinutes || 120,
    originalCount: service.originalCount ?? 30,
    refinedCount: service.refinedCount ?? 9,
    deliveryDays: service.deliveryDays || 7,
    availableDatesText: Array.isArray(service.availableDates) ? service.availableDates.join(',') : '',
    portfolioIdsText: '',
    portfolioIds,
    portfolioFileNames: [],
    portfolioPreviewUrls: [],
    description: service.description || '',
    timeDescription: service.timeDescription || '',
    timeTagsText: Array.isArray(service.timeTags) ? service.timeTags.join(',') : ''
  }
}
