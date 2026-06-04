import { yuanToCent } from '../../../utils/index.js'

export function createDefaultDemandForm() {
  return {
    title: '想拍一组毕业照',
    scene: '毕业照',
    cityCode: 'NJU',
    location: '南京大学鼓楼校区',
    expectedDate: '',
    timeSlot: '14:00-16:00',
    timeDescription: '本周六下午',
    timeTags: ['NEAR_7_DAYS'],
    budgetMinYuan: 199,
    budgetMaxYuan: 399,
    styleTagsText: '自然抓拍,校园,生活感',
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
    styleTags: form.styleTagsText.split(',').map(tag => tag.trim()).filter(Boolean),
    referenceFileIds: Array.isArray(form.referenceFileIds) ? form.referenceFileIds : [],
    description: form.description
  }
}
