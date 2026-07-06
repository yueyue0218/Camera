import { useWorkflowDraft } from '../../../hooks/useWorkflowDraft.js'

function createDeliveryDraft() {
  return { files: [], remark: '' }
}

function createPhotoAuthorizationDraft() {
  return { fileIds: [], remark: '' }
}

function isDeliveryDraftDirty(value) {
  return Boolean((Array.isArray(value?.files) && value.files.length) || String(value?.remark || '').trim())
}

function isPhotoAuthorizationDraftDirty(value) {
  return Boolean((Array.isArray(value?.fileIds) && value.fileIds.length) || String(value?.remark || '').trim())
}

function hasAuthorizationRemarkDraft(value) {
  return Object.values(value || {}).some(remark => String(remark || '').trim())
}

export function useConversationDrafts({ conversationId, orderId }) {
  const orderDraftScope = `conversation:${conversationId}:order:${orderId || 'none'}`
  const deliveryDraft = useWorkflowDraft(`${orderDraftScope}:delivery`, createDeliveryDraft, isDeliveryDraftDirty)
  const reworkDraft = useWorkflowDraft(`${orderDraftScope}:rework`, () => '', value => String(value || '').trim().length > 0)
  const photoAuthorizationDraft = useWorkflowDraft(`${orderDraftScope}:photo-authorization`, createPhotoAuthorizationDraft, isPhotoAuthorizationDraftDirty)
  const authorizationRemarkDraft = useWorkflowDraft(`${orderDraftScope}:authorization-remarks`, () => ({}), hasAuthorizationRemarkDraft)

  return {
    deliveryDraft,
    reworkDraft,
    photoAuthorizationDraft,
    authorizationRemarkDraft,
    deliveryForm: deliveryDraft.value || createDeliveryDraft(),
    setDeliveryForm: deliveryDraft.setValue,
    reworkRequirement: reworkDraft.value || '',
    setReworkRequirement: reworkDraft.setValue,
    photoAuthorizationForm: photoAuthorizationDraft.value || createPhotoAuthorizationDraft(),
    setPhotoAuthorizationForm: photoAuthorizationDraft.setValue,
    authorizationRemarks: authorizationRemarkDraft.value || {},
    setAuthorizationRemarks: authorizationRemarkDraft.setValue
  }
}
