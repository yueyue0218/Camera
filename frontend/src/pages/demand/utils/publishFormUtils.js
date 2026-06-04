import { yuanToCent } from '../../../utils/index.js'
import {
  DEFAULT_BUDGET_MAX_YUAN,
  DEFAULT_BUDGET_MIN_YUAN,
  DEFAULT_CITY_CODE,
  DEFAULT_TYPE
} from '../../hall/components/hallUtils.js'

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
    description: '想拍一组自然、不模板化的校园毕业照，偏生活感。'
  }
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
    budgetMinCent: yuanToCent(form.budgetMinYuan),
    budgetMaxCent: yuanToCent(form.budgetMaxYuan),
    styleTags: Array.from(styleTags),
    referenceFileIds: Array.isArray(form.referenceFileIds) ? form.referenceFileIds : [],
    description: [form.title, form.description].filter(value => String(value || '').trim()).join('\n')
  }
}
