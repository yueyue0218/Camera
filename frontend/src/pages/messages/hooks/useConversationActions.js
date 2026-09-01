import { useState } from 'react'
import { deliveryApi, orderApi, photoAuthorizationApi, quoteApi } from '../../../api.js'
import { goToUserProfile } from '../../../utils/orderNavigation.js'
import { navigateToDeliveryFromConversation, navigateToOrderFromConversation } from '../../../utils/conversationNavigation.js'
import { REWORK_REQUIREMENT_MAX_LENGTH } from '../../../utils/workflowLimits.js'
import {
  buildQuotePayload,
  createDefaultQuoteForm,
  createQuoteFormFromQuote,
  getQuoteConfirmationErrorText
} from '../utils/quoteUtils.js'
import { validateQuoteFormModel } from '../utils/quoteFormModel.js'

export function useConversationActions({
  conversationId,
  conversation,
  currentUser,
  currentOrder,
  quotes,
  deliveryForm,
  reworkRequirement,
  photoAuthorizationForm,
  authorizationRemarks,
  deliveryDraft,
  reworkDraft,
  photoAuthorizationDraft,
  authorizationRemarkDraft,
  feedback,
  run,
  loadConversationData,
  refreshConversationData,
  setNotice,
  setPageLoading,
  navigate,
  rawNavigate,
  loading
}) {
  const [quoteForm, setQuoteForm] = useState(() => createDefaultQuoteForm())
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [editingQuotationId, setEditingQuotationId] = useState(null)
  const [quoteValidationErrors, setQuoteValidationErrors] = useState([])
  const [quoteFieldErrors, setQuoteFieldErrors] = useState({})
  const [activeAction, setActiveAction] = useState(null)
  const [activeQuote, setActiveQuote] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('WECHAT')
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)

  async function createQuote(event) {
    event.preventDefault()
    const validation = validateQuoteFormModel(quoteForm, {
      conversation,
      currentUser,
      quotes,
      editingQuotationId
    })
    setQuoteValidationErrors(validation.errors)
    setQuoteFieldErrors(validation.fieldErrors)
    if (validation.errors.length) {
      feedback.warning(validation.errors[0])
      return
    }
    const quotePayload = buildQuotePayload(quoteForm, conversation)
    const quote = await run(async () => editingQuotationId
      ? quoteApi.update(editingQuotationId, quotePayload, currentUser)
      : quoteApi.create(quotePayload, currentUser), editingQuotationId ? '报价已更新' : '报价已发送')
    if (quote) {
      setShowQuoteForm(false)
      setEditingQuotationId(null)
      setQuoteValidationErrors([])
      setQuoteFieldErrors({})
      setQuoteForm(createDefaultQuoteForm())
      await loadConversationData()
    }
  }

  function startQuoteEditing(quote) {
    if (!quote) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return
    }
    setEditingQuotationId(quote.quotationId)
    setQuoteForm(createQuoteFormFromQuote(quote))
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setShowQuoteForm(true)
    feedback.info('正在编辑待确认报价，保存前客户仍看到原报价。')
  }

  function closeQuoteForm() {
    setShowQuoteForm(false)
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setQuoteForm(createDefaultQuoteForm())
  }

  function updateQuoteForm(nextForm) {
    setQuoteForm(nextForm)
    if (Object.keys(quoteFieldErrors).length) setQuoteFieldErrors({})
  }

  function openQuoteForm() {
    if (showQuoteForm && !editingQuotationId) {
      closeQuoteForm()
      return
    }
    setQuoteForm(createDefaultQuoteForm())
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setShowQuoteForm(true)
  }

  function resendQuote(quote) {
    if (!quote) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return
    }
    setQuoteForm(createQuoteFormFromQuote(quote))
    setEditingQuotationId(null)
    setQuoteValidationErrors([])
    setQuoteFieldErrors({})
    setShowQuoteForm(true)
    setActiveAction(null)
    setActiveQuote(null)
    feedback.info('已带入上次报价内容，请确认后重新发送给客户。')
  }

  async function confirmQuote(quote) {
    if (!quote?.quotationId) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return false
    }
    setPageLoading(true)
    setNotice(null)
    try {
      const result = await quoteApi.confirm(quote.quotationId, '客户已确认本次报价', currentUser)
      feedback.success('报价已确认，订单已生成')
      if (result?.orderId) {
        await refreshConversationData(conversation, result.orderId)
      } else {
        await refreshConversationData()
        feedback.error('报价已确认，但暂时没有拿到订单信息，请刷新后再查看。')
      }
      return true
    } catch (error) {
      try {
        await refreshConversationData()
      } catch {
        // Keep the original quote confirmation error visible.
      }
      const message = getQuoteConfirmationErrorText(error)
      feedback.error(message)
      return false
    } finally {
      setPageLoading(false)
    }
  }

  async function rejectQuote(quote) {
    if (!quote?.quotationId) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return false
    }
    const result = await run(async () => quoteApi.reject(quote.quotationId, '本次暂不采用该报价', currentUser), '报价已拒绝')
    if (result) {
      await loadConversationData()
      return true
    }
    return false
  }

  async function confirmQuoteFromDialog(quote) {
    const succeeded = await confirmQuote(quote)
    if (succeeded) {
      setActiveAction(null)
      setActiveQuote(null)
    }
  }

  async function rejectQuoteFromDialog(quote) {
    const succeeded = await rejectQuote(quote)
    if (succeeded) {
      setActiveAction(null)
      setActiveQuote(null)
    }
  }

  async function payCurrentOrder() {
    if (!currentOrder) return false
    const result = await run(async () => orderApi.mockPay(currentOrder.orderId, currentOrder.amountCent, currentUser), '支付成功，资金已进入平台担保')
    if (result) {
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function cancelCurrentOrder(cancelAction) {
    if (!currentOrder || !cancelAction) return
    const confirmed = await feedback.confirm({
      title: cancelAction.title || '确认取消订单',
      message: cancelAction.confirmText,
      confirmText: cancelAction.label || '确认取消',
      tone: 'danger'
    })
    if (!confirmed) return
    const result = await run(async () => orderApi.cancel(currentOrder.orderId, { reason: cancelAction.reason }, currentUser), '订单状态已更新')
    if (result) await refreshConversationData(conversation, currentOrder.orderId)
  }

  async function confirmCurrentOrder() {
    if (!currentOrder) return
    const confirmed = await feedback.confirm({
      title: '确认接收作品',
      message: '确认接收后，订单将完成，平台担保资金会结算给摄影师。是否确认？',
      confirmText: '确认接收'
    })
    if (!confirmed) return
    const result = await run(async () => orderApi.transition(currentOrder.orderId, 'COMPLETED', '客户确认接收作品', currentUser), '订单已完成')
    if (result) {
      await refreshConversationData(conversation, currentOrder.orderId)
      setCompletionDialogOpen(true)
    }
  }

  async function submitDelivery(event) {
    event?.preventDefault?.()
    const files = Array.isArray(deliveryForm.files) ? deliveryForm.files : deliveryForm.file ? [deliveryForm.file] : []
    if (!currentOrder || !files.length) return false
    const result = await run(async () => deliveryApi.upload(currentOrder.orderId, files, deliveryForm.remark.trim(), currentUser),
      currentOrder.status === 'REWORK_REQUIRED' ? '返修作品已发送给客户验收' : '交付作品已发送给客户验收')
    if (result) {
      deliveryDraft.clearDraft()
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function submitRework(event) {
    event.preventDefault()
    if (!currentOrder) return false
    const reason = reworkRequirement.trim()
    if (!reason) {
      feedback.warning('请填写返修要求')
      return false
    }
    if (reason.length > REWORK_REQUIREMENT_MAX_LENGTH) {
      feedback.warning(`返修要求不能超过 ${REWORK_REQUIREMENT_MAX_LENGTH} 字`)
      return false
    }
    const result = await run(async () => orderApi.requestRework(currentOrder.orderId, reason, currentUser), '返修请求已提交')
    if (result) {
      reworkDraft.clearDraft()
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function submitPhotoAuthorizationRequest(event) {
    event.preventDefault()
    if (!currentOrder || !photoAuthorizationForm.fileIds.length) return false
    const result = await run(async () => photoAuthorizationApi.request(currentOrder.orderId, {
      fileIds: photoAuthorizationForm.fileIds,
      remark: photoAuthorizationForm.remark.trim()
    }, currentUser), '展示授权申请已发送')
    if (result) {
      photoAuthorizationDraft.clearDraft()
      await refreshConversationData(conversation, currentOrder.orderId)
      return true
    }
    return false
  }

  async function handlePhotoAuthorizationDecision(authorization, decision, decisionRemark = '') {
    if (!currentOrder) return
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
      await refreshConversationData(conversation, currentOrder.orderId)
    }
    return Boolean(result)
  }

  function openPaymentDialog() {
    if (!currentOrder) return
    setPaymentMethod('WECHAT')
    setActiveAction('PAYMENT')
  }

  async function confirmPaymentFromDialog() {
    const succeeded = await payCurrentOrder()
    if (succeeded) setActiveAction(null)
  }

  function showUnavailableTool(name) {
    const messages = {
      图片: '图片发送正在完善中，暂未开放；交付作品请通过订单上传。',
      附件: '附件发送正在完善中，暂未开放。',
      表情: '表情功能正在完善中，暂未开放。',
      补款: '补款属于订单交易能力，后续会以追加费用流程开放。',
      平台协助: '平台协助正在完善中，暂未开放。'
    }
    feedback.info(messages[name] || '该功能正在完善中，暂未开放。')
  }

  function openQuoteDetail(quote) {
    if (!quote) {
      feedback.error('报价详情暂时无法打开，请刷新后重试。')
      return
    }
    setActiveQuote(quote)
    setActiveAction('QUOTE_DETAIL')
  }

  function openUserProfile(userId, event) {
    event?.stopPropagation()
    goToUserProfile(rawNavigate, userId, currentUser)
  }

  function openOrderArchive(orderId = currentOrder?.orderId, options = {}) {
    const succeeded = navigateToOrderFromConversation(navigate, {
      orderId: orderId || currentOrder?.orderId,
      conversationId
    }, options)
    if (!succeeded) {
      feedback.warning('订单信息暂时不可用，请稍后刷新后再查看。')
      return false
    }
    return true
  }

  function openDeliveryGallery(delivery) {
    const succeeded = navigateToDeliveryFromConversation(navigate, {
      orderId: currentOrder?.orderId || delivery?.orderId,
      deliveryId: delivery?.deliveryId || delivery?.fileId,
      conversationId
    })
    if (!succeeded) {
      feedback.warning('作品记录暂不可查看，请刷新后重试。')
    }
    return succeeded
  }

  async function closeActionDialogs() {
    if (loading) {
      feedback.warning('操作正在提交，请稍候。')
      return
    }
    const shouldClose = await confirmActiveActionDiscard()
    if (!shouldClose) return
    setActiveAction(null)
    setActiveQuote(null)
  }

  async function confirmActiveActionDiscard() {
    if (activeAction === 'UPLOAD_DELIVERY' || activeAction === 'REUPLOAD_DELIVERY') {
      return deliveryDraft.confirmDiscard(feedback)
    }
    if (activeAction === 'REQUEST_REWORK') {
      return reworkDraft.confirmDiscard(feedback, {
        message: '当前返修要求尚未提交，关闭后将丢弃已填写内容。确定关闭吗？'
      })
    }
    if (activeAction === 'REQUEST_AUTHORIZATION') {
      return photoAuthorizationDraft.confirmDiscard(feedback, {
        message: '当前授权申请尚未提交，关闭后将丢弃已选择的作品和填写内容。确定关闭吗？'
      })
    }
    return true
  }

  return {
    quoteForm,
    showQuoteForm,
    editingQuotationId,
    quoteValidationErrors,
    quoteFieldErrors,
    activeAction,
    setActiveAction,
    activeQuote,
    paymentMethod,
    setPaymentMethod,
    completionDialogOpen,
    setCompletionDialogOpen,
    createQuote,
    startQuoteEditing,
    closeQuoteForm,
    updateQuoteForm,
    openQuoteForm,
    resendQuote,
    confirmQuote,
    rejectQuote,
    confirmQuoteFromDialog,
    rejectQuoteFromDialog,
    cancelCurrentOrder,
    confirmCurrentOrder,
    submitDelivery,
    submitRework,
    submitPhotoAuthorizationRequest,
    handlePhotoAuthorizationDecision,
    openPaymentDialog,
    confirmPaymentFromDialog,
    showUnavailableTool,
    openQuoteDetail,
    openUserProfile,
    openOrderArchive,
    openDeliveryGallery,
    closeActionDialogs
  }
}
