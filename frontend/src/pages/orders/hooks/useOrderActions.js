import { deliveryApi, orderApi, photoAuthorizationApi, reviewApi, reviewComplaintApi } from '../../../api.js'
import { REWORK_REQUIREMENT_MAX_LENGTH } from '../../../utils/workflowLimits.js'
import { canCustomerConfirm } from '../orderActions.js'
import {
  getArbitrationsByOrder,
  getLocalReviewsByOrder,
  getOrderReviewDirection,
  getReviewTargetUserId,
  isApiUnavailable,
  mergeComplaints,
  mergeReviewLists,
  saveLocalArbitration,
  saveLocalReview
} from '../utils/orderStatusUtils.js'

export function useOrderActions({
  selectedOrder,
  currentUser,
  actionVisibility,
  deliveryRecords,
  deliveryForm,
  deliveryDraft,
  reworkRequirement,
  reworkDraft,
  photoAuthorizationForm,
  setPhotoAuthorizationForm,
  photoAuthorizationDraft,
  authorizationRemarks,
  authorizationRemarkDraft,
  reviewForm,
  reviewDraft,
  arbitrationForm,
  arbitrationDraft,
  reviewToComplain,
  orderReviews,
  setOrderReviews,
  arbitrations,
  setArbitrations,
  followUpReview,
  followUpContent,
  setFollowUpContent,
  setCompletionDialogOpen,
  setDeliveryUploadDialogOpen,
  setReworkDialogOpen,
  setPhotoAuthorizationDialogOpen,
  setPhotoAuthorizations,
  setShowReviewForm,
  setShowArbitrationForm,
  setFollowUpDialogOpen,
  setFollowUpReview,
  feedback,
  run,
  loadOrders
}) {
  async function operateOrder(action) {
    if (!selectedOrder) return
    const result = await run(async () => {
      if (action.kind === 'pay') {
        return orderApi.mockPay(selectedOrder.orderId, selectedOrder.amountCent, currentUser)
      }
      if (action.kind === 'transition' && action.targetStatus === 'COMPLETED' && actionVisibility.canConfirmDelivery && canCustomerConfirm(selectedOrder, currentUser, { deliveries: deliveryRecords })) {
        return orderApi.transition(selectedOrder.orderId, 'COMPLETED', action.reason, currentUser)
      }
      throw new Error('当前状态不支持这个操作。')
    }, action.successText)
    if (result) {
      await loadOrders(selectedOrder.orderId)
      if (action.kind === 'transition' && action.targetStatus === 'COMPLETED') {
        setCompletionDialogOpen(true)
      }
    }
  }

  function openReviewFromCompletion() {
    setCompletionDialogOpen(false)
    setShowReviewForm(true)
    feedback.info('评价功能入口已打开')
  }

  async function submitDelivery(event) {
    event?.preventDefault?.()
    const files = Array.isArray(deliveryForm.files) ? deliveryForm.files : deliveryForm.file ? [deliveryForm.file] : []
    if (!selectedOrder || !files.length) return false
    const result = await run(async () => deliveryApi.upload(
      selectedOrder.orderId,
      files,
      deliveryForm.remark.trim(),
      currentUser
    ), selectedOrder.status === 'REWORK_REQUIRED' ? '返修作品已发送给客户验收' : '交付作品已发送给客户验收')
    if (result) {
      deliveryDraft.clearDraft()
      setDeliveryUploadDialogOpen(false)
      await loadOrders(selectedOrder.orderId, { preserveDrafts: true })
    }
    return Boolean(result)
  }

  async function submitRework(event) {
    event.preventDefault()
    if (!selectedOrder) return
    const trimmedRequirement = reworkRequirement.trim()
    if (!trimmedRequirement) {
      feedback.warning('请填写返修要求')
      return
    }
    if (trimmedRequirement.length > REWORK_REQUIREMENT_MAX_LENGTH) {
      feedback.warning(`返修要求不能超过 ${REWORK_REQUIREMENT_MAX_LENGTH} 字`)
      return
    }
    const result = await run(async () => orderApi.requestRework(
      selectedOrder.orderId,
      trimmedRequirement,
      currentUser
    ), '返修请求已提交')
    if (result) {
      reworkDraft.clearDraft()
      setReworkDialogOpen(false)
      await loadOrders(selectedOrder.orderId, { preserveDrafts: true })
    }
  }

  async function cancelSelectedOrder(cancelAction) {
    if (!selectedOrder || !cancelAction) return
    const confirmed = await feedback.confirm({
      title: cancelAction.title || '确认取消订单',
      message: cancelAction.confirmText,
      confirmText: cancelAction.label || '确认取消',
      tone: 'danger'
    })
    if (!confirmed) return
    const result = await run(async () => orderApi.cancel(
      selectedOrder.orderId,
      { reason: cancelAction.reason },
      currentUser
    ), cancelAction.successText)
    if (result) {
      await loadOrders(selectedOrder.orderId)
    }
  }

  async function submitPhotoAuthorizationRequest(event) {
    event.preventDefault()
    if (!selectedOrder || !photoAuthorizationForm.fileIds.length) return
    const result = await run(async () => photoAuthorizationApi.request(selectedOrder.orderId, {
      fileIds: photoAuthorizationForm.fileIds,
      remark: photoAuthorizationForm.remark.trim()
    }, currentUser), '展示授权申请已发送')
    if (result) {
      photoAuthorizationDraft.clearDraft()
      setPhotoAuthorizationDialogOpen(false)
      setPhotoAuthorizations(await photoAuthorizationApi.listByOrder(selectedOrder.orderId, currentUser))
    }
  }

  function togglePhotoAuthorizationFile(file) {
    const fileId = Number(file?.fileId)
    if (!fileId) return
    const next = new Set(photoAuthorizationForm.fileIds.map(Number))
    if (next.has(fileId)) next.delete(fileId)
    else next.add(fileId)
    setPhotoAuthorizationForm({
      ...photoAuthorizationForm,
      fileIds: Array.from(next)
    })
  }

  async function handlePhotoAuthorizationDecision(authorization, decision, decisionRemark = '') {
    if (!selectedOrder) return
    const remark = (decisionRemark || authorizationRemarks[authorization.id] || '').trim()
    if (decision === 'reject' && !remark) {
      feedback.warning('请填写拒绝原因')
      return false
    }
    const action = decision === 'approve' ? photoAuthorizationApi.approve : photoAuthorizationApi.reject
    const successText = decision === 'approve' ? '已同意展示授权' : '已拒绝展示授权'
    const result = await run(async () => action(authorization.id, { remark }, currentUser), successText)
    if (result) {
      authorizationRemarkDraft.setValue(previous => ({ ...previous, [authorization.id]: '' }))
      setPhotoAuthorizations(await photoAuthorizationApi.listByOrder(selectedOrder.orderId, currentUser))
    }
    return Boolean(result)
  }

  async function submitReview(event) {
    event.preventDefault()
    if (!selectedOrder) return
    const direction = getOrderReviewDirection(selectedOrder, currentUser.userId)
    const targetUserId = getReviewTargetUserId(selectedOrder, currentUser.userId)
    const result = await run(async () => {
      try {
        return await reviewApi.create(selectedOrder.orderId, {
          rating: reviewForm.rating,
          content: reviewForm.content.trim()
        }, currentUser)
      } catch (error) {
        if (!error.isNetworkError && error.status !== 404 && error.code !== 50001) {
          throw error
        }
        return saveLocalReview({
          orderId: selectedOrder.orderId,
          reviewerId: currentUser.userId,
          targetUserId,
          direction,
          rating: reviewForm.rating,
          content: reviewForm.content.trim()
        })
      }
    }, '评价已提交')
    if (result) {
      setOrderReviews(mergeReviewLists([result], orderReviews, getLocalReviewsByOrder(selectedOrder.orderId)))
      setShowReviewForm(false)
      reviewDraft.clearDraft()
    }
  }

  async function submitArbitration(event) {
    event.preventDefault()
    if (!selectedOrder) return
    const reason = `${arbitrationForm.reason}${arbitrationForm.description.trim() ? `：${arbitrationForm.description.trim()}` : ''}`
    const localRecord = {
      orderId: selectedOrder.orderId,
      reviewId: reviewToComplain?.reviewId,
      applicantId: currentUser.userId,
      respondentId: reviewToComplain?.reviewerId || getReviewTargetUserId(selectedOrder, currentUser.userId),
      reason,
      description: arbitrationForm.description.trim(),
      status: 'PENDING'
    }
    const result = await run(async () => {
      if (reviewToComplain?.reviewId && !String(reviewToComplain.reviewId).startsWith('local')) {
        try {
          return await reviewComplaintApi.create(reviewToComplain.reviewId, {
            reason,
            evidenceFileIds: ''
          }, currentUser)
        } catch (error) {
          if (!isApiUnavailable(error)) throw error
        }
      }
      return saveLocalArbitration(localRecord)
    }, '评价申诉已提交')
    if (result) {
      setArbitrations(mergeComplaints([result], arbitrations, getArbitrationsByOrder(selectedOrder.orderId)))
      setShowArbitrationForm(false)
      arbitrationDraft.clearDraft()
    }
  }

  async function submitFollowUp(event) {
    event.preventDefault()
    if (!selectedOrder?.orderId || !followUpReview?.reviewId || !followUpContent.trim()) return
    const result = await run(async () => (
      reviewApi.followUp(followUpReview.reviewId, { content: followUpContent.trim() }, currentUser)
    ), '追评已提交')
    if (result) {
      setOrderReviews(mergeReviewLists([result], orderReviews, getLocalReviewsByOrder(selectedOrder.orderId)))
      setFollowUpDialogOpen(false)
      setFollowUpReview(null)
      setFollowUpContent('')
    }
  }

  return {
    operateOrder,
    openReviewFromCompletion,
    submitDelivery,
    submitRework,
    cancelSelectedOrder,
    submitPhotoAuthorizationRequest,
    togglePhotoAuthorizationFile,
    handlePhotoAuthorizationDecision,
    submitReview,
    submitArbitration,
    submitFollowUp
  }
}
