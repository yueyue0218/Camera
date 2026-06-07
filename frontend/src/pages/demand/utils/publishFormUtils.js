import {
  DEFAULT_BUDGET_MAX_YUAN,
  DEFAULT_BUDGET_MIN_YUAN,
  DEFAULT_CITY_CODE,
  DEFAULT_TYPE
} from '../../hall/components/hallUtils.js'

function centToYuan(value, fallback = '') {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number / 100) : fallback
}

function yuanToValidCent(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) : null
}

export function createDefaultDemandForm() {
  return {
    title: '想拍一组毕业照',
    scene: DEFAULT_TYPE,
    cityCode: DEFAULT_CITY_CODE,
    location: '',
    expectedDate: '',
    timeSlot: '14:00-16:00',
    timeDescription: '本周六下午',
    timeTags: ['NEAR_7_DAYS'],
    budgetMinYuan: DEFAULT_BUDGET_MIN_YUAN,
    budgetMaxYuan: DEFAULT_BUDGET_MAX_YUAN,
    styleTagsText: DEFAULT_TYPE,
    referenceFileIds: [],
    referenceFileNames: [],
    referencePreviewUrls: [],
    description: '想拍一组自然、不模板化的校园毕业照，偏生活感。'
  }
}

export function validateDemandForm(form) {
  const errors = []
  const min = yuanToValidCent(form.budgetMinYuan)
  const max = yuanToValidCent(form.budgetMaxYuan)
  if (form.budgetMinYuan !== '' && min === null) errors.push('budgetMinYuan must be a valid number')
  if (form.budgetMaxYuan !== '' && max === null) errors.push('budgetMaxYuan must be a valid number')
  if (min !== null && min < 0) errors.push('budgetMinYuan must not be negative')
  if (max !== null && max < 0) errors.push('budgetMaxYuan must not be negative')
  if (min !== null && max !== null && max < min) errors.push('budgetMaxYuan must not be below budgetMinYuan')
  return errors
}

function generateTimeDescription(form) {
  return [
    form.timeDescription,
    form.timeSlot,
    form.expectedDate,
    form.description,
    form.scene
  ].find(value => String(value || '').trim())?.trim() || '待沟通'
}

export function buildDemandPayload(form) {
  const styleTags = new Set([
    form.scene,
    ...String(form.styleTagsText || '').split(',').map(tag => tag.trim()).filter(Boolean)
  ].filter(Boolean))
  return {
    scene: form.scene,
    cityCode: form.cityCode,
    location: form.location,
    expectedDate: form.expectedDate || null,
    timeSlot: form.timeSlot,
    timeDescription: generateTimeDescription(form),
    timeTags: Array.isArray(form.timeTags) ? form.timeTags : [],
    budgetMinCent: yuanToValidCent(form.budgetMinYuan),
    budgetMaxCent: yuanToValidCent(form.budgetMaxYuan),
    styleTags: Array.from(styleTags),
    // Persist fileIds only; protected download URLs are resolved to blob URLs when rendered.
    referenceFileIds: Array.isArray(form.referenceFileIds) ? form.referenceFileIds : [],
    description: [form.title, form.description].filter(value => String(value || '').trim()).join('\n')
  }
}

export function demandDetailToForm(demand = {}) {
  const descriptionLines = String(demand.description || '').split(/\r?\n/)
  const hasGeneratedTitle = !demand.title && descriptionLines.length > 1
  return {
    title: demand.title || demand.scene || descriptionLines[0] || '想拍一组毕业照',
    scene: demand.scene || DEFAULT_TYPE,
    cityCode: demand.cityCode || DEFAULT_CITY_CODE,
    location: demand.location || '',
    expectedDate: demand.expectedDate || '',
    timeSlot: demand.timeSlot || '',
    timeDescription: demand.timeDescription || demand.timeSlot || '',
    timeTags: Array.isArray(demand.timeTags) ? demand.timeTags : [],
    budgetMinYuan: centToYuan(demand.budgetMinCent, DEFAULT_BUDGET_MIN_YUAN),
    budgetMaxYuan: centToYuan(demand.budgetMaxCent, DEFAULT_BUDGET_MAX_YUAN),
    styleTagsText: Array.isArray(demand.styleTags) ? demand.styleTags.join(',') : '',
    referenceFileIds: Array.isArray(demand.referenceFileIds) ? demand.referenceFileIds : [],
    referenceFileNames: [],
    referencePreviewUrls: [],
    description: hasGeneratedTitle ? descriptionLines.slice(1).join('\n') : (demand.description || '')
  }
}
