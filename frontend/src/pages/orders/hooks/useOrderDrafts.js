import { useWorkflowDraft } from '../../../hooks/useWorkflowDraft.js'

function createDeliveryDraft() {
  return { files: [], remark: '' }
}

function createPhotoAuthorizationDraft() {
  return { fileIds: [], remark: '' }
}

function createReviewDraft() {
  return { rating: 5, content: '沟通顺畅，履约体验很好。' }
}

function createArbitrationDraft() {
  return { reason: '评价内容不实', description: '' }
}

function isDeliveryDraftDirty(value) {
  return Boolean((Array.isArray(value?.files) && value.files.length) || String(value?.remark || '').trim())
}

function isPhotoAuthorizationDraftDirty(value) {
  return Boolean((Array.isArray(value?.fileIds) && value.fileIds.length) || String(value?.remark || '').trim())
}

function isReviewDraftDirty(value) {
  return Number(value?.rating || 5) !== 5 || String(value?.content || '').trim() !== '沟通顺畅，履约体验很好。'
}

function isArbitrationDraftDirty(value) {
  return String(value?.reason || '') !== '评价内容不实' || String(value?.description || '').trim().length > 0
}

function hasAuthorizationRemarkDraft(value) {
  return Object.values(value || {}).some(remark => String(remark || '').trim())
}

export function useOrderDrafts({ orderId, fallbackOrderId }) {
  const orderDraftScope = `order:${orderId || fallbackOrderId || 'none'}`
  const deliveryDraft = useWorkflowDraft(`${orderDraftScope}:delivery`, createDeliveryDraft, isDeliveryDraftDirty)
  const reworkDraft = useWorkflowDraft(`${orderDraftScope}:rework`, () => '', value => String(value || '').trim().length > 0)
  const photoAuthorizationDraft = useWorkflowDraft(`${orderDraftScope}:photo-authorization`, createPhotoAuthorizationDraft, isPhotoAuthorizationDraftDirty)
  const authorizationRemarkDraft = useWorkflowDraft(`${orderDraftScope}:authorization-remarks`, () => ({}), hasAuthorizationRemarkDraft)
  const reviewDraft = useWorkflowDraft(`${orderDraftScope}:review`, createReviewDraft, isReviewDraftDirty)
  const arbitrationDraft = useWorkflowDraft(`${orderDraftScope}:arbitration`, createArbitrationDraft, isArbitrationDraftDirty)

  return {
    deliveryDraft,
    reworkDraft,
    photoAuthorizationDraft,
    authorizationRemarkDraft,
    reviewDraft,
    arbitrationDraft,
    deliveryForm: deliveryDraft.value || createDeliveryDraft(),
    setDeliveryForm: deliveryDraft.setValue,
    reworkRequirement: reworkDraft.value || '',
    setReworkRequirement: reworkDraft.setValue,
    photoAuthorizationForm: photoAuthorizationDraft.value || createPhotoAuthorizationDraft(),
    setPhotoAuthorizationForm: photoAuthorizationDraft.setValue,
    authorizationRemarks: authorizationRemarkDraft.value || {},
    setAuthorizationRemarks: authorizationRemarkDraft.setValue,
    reviewForm: reviewDraft.value || createReviewDraft(),
    setReviewForm: reviewDraft.setValue,
    arbitrationForm: arbitrationDraft.value || createArbitrationDraft(),
    setArbitrationForm: arbitrationDraft.setValue
  }
}
