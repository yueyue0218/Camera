import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Rating,
  Skeleton,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { useAuth } from '../../AuthContext.jsx'
import {
  deliveryApi,
  fileApi,
  orderApi,
  photoAuthorizationApi,
  reviewApi,
  reviewComplaintApi
} from '../../api.js'
import { goToOrderConversation, normalizeOrderId } from '../../utils/orderNavigation.js'
import { goToDeliveryGallery } from '../../utils/deliveryNavigation.js'
import { PRODUCT_ACTION_COPY } from '../../utils/productCopy.js'
import { WORKFLOW_SOURCES, buildOrderListTarget, isOrderListSurface } from '../../utils/workflowNavigation.js'
import { deriveOrderWorkflowState } from '../../utils/orderWorkflowModel.js'
import { getOrderActionVisibility } from '../../utils/orderActionVisibility.js'
import { useWorkflowNavigate } from '../../hooks/useWorkflowNavigate.js'
import { REWORK_REQUIREMENT_MAX_LENGTH, getReworkRequirementHelperText } from '../../utils/workflowLimits.js'
import {
  getExplicitReturnToConversation,
  navigateBackToConversation
} from '../../utils/conversationNavigation.js'
import { centToYuan } from '../../utils/index.js'
import {
  formatDateOnly,
  formatDeliveryDescription,
  formatDeliveryTitle,
  formatFileDisplayName,
  formatPhotoUsageScope,
} from '../../utils/displayFormatters.js'
import {
  PortraActionButton,
  PortraActionLink,
  PortraEmptyState,
  PortraInfoBanner,
  OrderCompletionDialog,
  PortraWorkflowFrame,
  usePortraFeedback
} from '../../components/portra/index.js'
import { usePortraAsyncAction } from '../../hooks/usePortraAsyncAction.js'
import { AuthorizationRequestCard } from '../../components/portra/AuthorizationRequestCard.jsx'
import { PORTRA_RADIUS, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import { ORDER_WORKFLOW_COLORS } from './orderWorkflowTokens.js'
import {
  canCustomerConfirm,
  canCustomerReviewPhotoAuthorization,
  canShowOrderNormalActions
} from './orderActions.js'
import { EmptyOrderCard } from './components/EmptyOrderCard.jsx'
import { InfoRows } from './components/InfoRows.jsx'
import { OrderCurrentTaskCard } from './components/OrderCurrentTaskCard.jsx'
import { OrderDeliverySummaryCard } from './components/OrderDeliverySummaryCard.jsx'
import { OrderFollowupCards } from './components/OrderFollowupCards.jsx'
import { OrderSummaryCard } from './components/OrderSummaryCard.jsx'
import { OrderTimelineCard } from './components/OrderTimelineCard.jsx'
import { ReviewList } from './components/ReviewList.jsx'
import { useOrderDrafts } from './hooks/useOrderDrafts.js'
import { useOrdersData } from './hooks/useOrdersData.js'
import { DeliveryFileGrid } from '../deliveries/components/DeliveryFileGrid.jsx'
import { DeliveryUploadPanel } from '../deliveries/components/DeliveryUploadPanel.jsx'
import { buildDeliveryBatches, flattenDeliveryFiles, isAuthorizableDeliveryFile } from '../deliveries/deliveryDisplay.js'
import {
  formatOrderStatus,
  formatOrderTitle,
  formatTime,
  getArbitrationsByOrder,
  getLatestDeliveryUploadTime,
  getLocalReviewsByOrder,
  getOrderReviewDirection,
  getReviewTargetUserId,
  isApiUnavailable,
  isOrderParticipant,
  mergeComplaints,
  mergeReviewLists,
  parseQuoteSnapshot,
  saveLocalArbitration,
  saveLocalReview,
  sanitizeSeedText
} from './utils/orderStatusUtils.js'
import {
  buildOrderMetaText,
  buildOrderProgressItems,
  buildOrderSummaryRows,
  formatAuthorizationSummary,
  formatDeadlineDistance,
  formatDeliveryBatchContent,
  formatOrderIndexDate,
  formatQuoteCount,
  getAuthorizationFollowupTone,
  getCounterpartyLabel,
  getLatestDeliveryBatch,
  getOrderPerspective,
  getOrderStatusDotColor,
  getReviewFollowupTone,
  formatReviewFollowupStatus,
  hasComplaintResult,
  parseInputDate
} from './utils/orderDetailViewModel.js'
function getOrderAction(order, currentUser, actionVisibility) {
  if ((actionVisibility || getOrderActionVisibility(order, currentUser)).canPay) {
    return {
      kind: 'pay',
      label: PRODUCT_ACTION_COPY.payOrder,
      icon: <PaidRoundedIcon />,
      allowed: true,
      successText: '支付成功，资金已进入平台担保'
    }
  }
  if ((actionVisibility || getOrderActionVisibility(order, currentUser, { allowUnknownDeliveries: true })).canConfirmDelivery) {
    return {
      kind: 'transition',
      targetStatus: 'COMPLETED',
      label: PRODUCT_ACTION_COPY.confirmDelivery,
      icon: <CheckCircleRoundedIcon />,
      allowed: true,
      reason: '客户确认接收作品',
      successText: '订单已完成'
    }
  }
  return null
}

function getCustomerCancelAction(order, currentUser) {
  if (!isOrderCustomer(order, currentUser)) return null
  if (order.status === 'PENDING_PAYMENT') {
    return {
      label: '取消待支付订单',
      title: '取消待支付订单',
      description: '该订单尚未支付，取消后订单结束，不涉及退款。',
      confirmText: '确定取消这个待支付订单吗？该操作不涉及退款。',
      reason: '客户取消未支付订单',
      successText: '待支付订单已取消'
    }
  }
  if (order.status === 'PAID_PENDING_SHOOT' && isBeforeShootStart(order)) {
    return {
      label: '取消并申请退款',
      title: '拍摄前取消并退款',
      description: '订单已支付且拍摄尚未开始，取消后平台担保资金将退回客户。',
      confirmText: '确定取消订单并申请退款吗？平台担保资金将退回客户。',
      reason: '客户拍摄前取消，申请退回托管款',
      successText: '订单已取消，退款状态已更新'
    }
  }
  return null
}

function isOrderCustomer(order, currentUser) {
  return Boolean(order)
    && Boolean(currentUser)
    && Number(order.customerId) === Number(currentUser.userId)
}

const deliveryStatusLabelMap = {
  DELIVERED: '已上传作品',
  REWORKED: '返修作品'
}

function orderStatusDotSx(status) {
  return {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
    bgcolor: getOrderStatusDotColor(status)
  }
}

function isImageDelivery(record) {
  const text = `${record?.mimeType || ''} ${record?.contentType || ''} ${record?.fileName || ''}`.toLowerCase()
  return /image\//.test(text) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(text)
}

function isBeforeShootStart(order) {
  const shootStartTime = parseInputDate(order?.shootStartTime)
  return Boolean(shootStartTime) && new Date() < shootStartTime
}
export function OrdersPage() {
  const location = useLocation()
  const navigate = useWorkflowNavigate()
  const { currentUser } = useAuth()
  const orderSearch = useMemo(() => new URLSearchParams(location.search), [location.search])
  const focusOrderId = useMemo(() => {
    const value = orderSearch.get('orderId')
    return normalizeOrderId(location.state?.orderId) || normalizeOrderId(value)
  }, [orderSearch, location.state])
  const focusSection = useMemo(
    () => String(location.state?.section || orderSearch.get('section') || '').trim().toLowerCase(),
    [location.state, orderSearch]
  )
  const focusedReviewId = useMemo(
    () => String(location.state?.reviewId || orderSearch.get('reviewId') || '').trim(),
    [location.state, orderSearch]
  )
  const focusedComplaintId = useMemo(
    () => String(location.state?.complaintId || orderSearch.get('complaintId') || '').trim(),
    [location.state, orderSearch]
  )
  const explicitReturnToConversation = useMemo(() => getExplicitReturnToConversation(location), [location.search, location.state])
  const orderListSurface = useMemo(() => isOrderListSurface(location), [location.search, location.state])
  const [reworkDialogOpen, setReworkDialogOpen] = useState(false)
  const [deliveryUploadDialogOpen, setDeliveryUploadDialogOpen] = useState(false)
  const [photoAuthorizationDialogOpen, setPhotoAuthorizationDialogOpen] = useState(false)
  const [authorizationRecordsDialogOpen, setAuthorizationRecordsDialogOpen] = useState(false)
  const [reviewRecordsDialogOpen, setReviewRecordsDialogOpen] = useState(false)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [previewDelivery, setPreviewDelivery] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [showArbitrationForm, setShowArbitrationForm] = useState(false)
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false)
  const [followUpReview, setFollowUpReview] = useState(null)
  const [followUpContent, setFollowUpContent] = useState('')
  const statusFilter = ''
  const feedback = usePortraFeedback()
  const { run: runWorkflowAction, loading: actionLoading } = usePortraAsyncAction({
    errorMessage: error => error?.message || '操作失败，请稍后重试。'
  })
  async function run(action, successText) {
    return runWorkflowAction(action, {
      successMessage: successText
    })
  }
  const {
    orders,
    selectedOrder,
    statusLogs,
    deliveryRecords,
    photoAuthorizations,
    setPhotoAuthorizations,
    orderReviews,
    setOrderReviews,
    arbitrations,
    setArbitrations,
    sentInvitations,
    pageLoading,
    loadOrders,
    openOrder,
    clearOrderSelection
  } = useOrdersData({
    currentUser,
    focusOrderId,
    statusFilter,
    orderListSurface,
    location,
    navigate,
    explicitReturnToConversation,
    feedback,
    run,
    onResetOrderUi: clearCurrentOrderDrafts
  })
  const {
    deliveryDraft,
    reworkDraft,
    photoAuthorizationDraft,
    authorizationRemarkDraft,
    reviewDraft,
    arbitrationDraft,
    deliveryForm,
    setDeliveryForm,
    reworkRequirement,
    setReworkRequirement,
    photoAuthorizationForm,
    setPhotoAuthorizationForm,
    authorizationRemarks,
    setAuthorizationRemarks,
    reviewForm,
    setReviewForm,
    arbitrationForm,
    setArbitrationForm
  } = useOrderDrafts({
    orderId: selectedOrder?.orderId,
    fallbackOrderId: focusOrderId
  })
  const loading = pageLoading || actionLoading

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

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

  async function openDeliveryPreview(record) {
    setPreviewDelivery(record)
    setPreviewError('')
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
    }
    if (!record?.fileId) {
      setPreviewError('当前作品暂未提供预览链接。')
      return
    }
    if (!isImageDelivery(record)) {
        setPreviewError('该作品暂不支持预览，可以先下载查看。')
      return
    }
    setPreviewLoading(true)
    try {
      const url = await fileApi.downloadObjectUrl(record.fileId, currentUser)
      setPreviewUrl(url)
    } catch (error) {
      setPreviewError(error.message || '作品预览加载失败。')
    } finally {
      setPreviewLoading(false)
    }
  }

  function closeDeliveryPreview() {
    setPreviewDelivery(null)
    setPreviewError('')
    setPreviewLoading(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
    }
  }

  async function downloadDeliveryFile(record) {
    if (!record?.fileId) {
      feedback.warning('当前作品暂未提供下载链接。')
      return
    }
    const result = await run(async () => {
      const url = await fileApi.downloadObjectUrl(record.fileId, currentUser)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = formatFileDisplayName(record, `作品-${record.fileId}`)
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return true
    }, '下载已开始')
    return Boolean(result)
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

  async function openOrderWithDraftGuard(orderOrId) {
    const nextOrderId = normalizeOrderId(typeof orderOrId === 'object' ? orderOrId.orderId : orderOrId)
    const currentOrderId = normalizeOrderId(selectedOrder?.orderId)
    if (currentOrderId && nextOrderId && Number(currentOrderId) !== Number(nextOrderId) && hasUnsavedOrderDraft()) {
      const confirmed = await feedback.confirm({
        title: '切换订单？',
        message: '当前订单仍有未提交内容，切换后将丢弃这些草稿。确定切换吗？',
        confirmText: '确定切换',
        cancelText: '继续编辑',
        tone: 'danger'
      })
      if (!confirmed) return false
      clearCurrentOrderDrafts()
    }
    return openOrder(orderOrId, true, { preserveDrafts: nextOrderId && Number(currentOrderId) === Number(nextOrderId) })
  }

  function hasUnsavedOrderDraft() {
    return deliveryDraft.dirty
      || reworkDraft.dirty
      || photoAuthorizationDraft.dirty
      || authorizationRemarkDraft.dirty
      || reviewDraft.dirty
      || arbitrationDraft.dirty
  }

  function clearCurrentOrderDrafts() {
    deliveryDraft.clearDraft()
    reworkDraft.clearDraft()
    photoAuthorizationDraft.clearDraft()
    authorizationRemarkDraft.clearDraft()
    reviewDraft.clearDraft()
    arbitrationDraft.clearDraft()
    setReworkDialogOpen(false)
    setDeliveryUploadDialogOpen(false)
    setPhotoAuthorizationDialogOpen(false)
    setAuthorizationRecordsDialogOpen(false)
    setReviewRecordsDialogOpen(false)
    setShowReviewForm(false)
    setShowArbitrationForm(false)
    setFollowUpDialogOpen(false)
    setFollowUpReview(null)
    setFollowUpContent('')
  }

  async function closeReworkDialog() {
    if (actionLoading) {
      feedback.warning('操作正在提交，请稍候。')
      return
    }
    const confirmed = await reworkDraft.confirmDiscard(feedback, {
      message: '当前返修要求尚未提交，关闭后将丢弃已填写内容。确定关闭吗？'
    })
    if (confirmed) setReworkDialogOpen(false)
  }

  async function closeDeliveryUploadDialog() {
    if (actionLoading) {
      feedback.warning('作品正在提交，请稍候。')
      return
    }
    const confirmed = await deliveryDraft.confirmDiscard(feedback, {
      message: '当前交付作品尚未提交，关闭后将丢弃已选择的文件和填写内容。确定关闭吗？'
    })
    if (confirmed) setDeliveryUploadDialogOpen(false)
  }

  async function closePhotoAuthorizationDialog() {
    if (actionLoading) {
      feedback.warning('授权申请正在提交，请稍候。')
      return
    }
    const confirmed = await photoAuthorizationDraft.confirmDiscard(feedback, {
      message: '当前授权申请尚未提交，关闭后将丢弃已选择的图片和填写内容。确定关闭吗？'
    })
    if (confirmed) setPhotoAuthorizationDialogOpen(false)
  }

  async function toggleReviewForm() {
    if (showReviewForm) {
      const confirmed = await reviewDraft.confirmDiscard(feedback, {
        message: '当前评价尚未提交，关闭后将丢弃已填写内容。确定关闭吗？'
      })
      if (confirmed) setShowReviewForm(false)
      return
    }
    setShowReviewForm(true)
  }

  async function toggleArbitrationForm() {
    if (showArbitrationForm) {
      const confirmed = await arbitrationDraft.confirmDiscard(feedback, {
        message: '当前申诉说明尚未提交，关闭后将丢弃已填写内容。确定关闭吗？'
      })
      if (confirmed) setShowArbitrationForm(false)
      return
    }
    setShowArbitrationForm(true)
  }

  function openFollowUpDialog(review) {
    setFollowUpReview(review)
    setFollowUpContent('')
    setFollowUpDialogOpen(true)
  }

  function closeFollowUpDialog() {
    if (loading) return
    setFollowUpDialogOpen(false)
    setFollowUpReview(null)
    setFollowUpContent('')
  }

  const selectedOrderWorkflow = useMemo(() => deriveOrderWorkflowState(selectedOrder, {
    currentUserRole: currentUser.role,
    deliveries: deliveryRecords
  }), [selectedOrder, currentUser.role, deliveryRecords])
  const actionVisibility = useMemo(() => getOrderActionVisibility(selectedOrder, currentUser, {
    deliveries: deliveryRecords,
    authorizations: photoAuthorizations,
    workflowState: selectedOrderWorkflow
  }), [selectedOrder, currentUser, deliveryRecords, photoAuthorizations, selectedOrderWorkflow])
  const action = selectedOrder ? getOrderAction(selectedOrder, currentUser, actionVisibility) : null
  const quoteSnapshot = parseQuoteSnapshot(selectedOrder?.quoteSnapshotJson)
  const canUploadDelivery = selectedOrder && (actionVisibility.canUploadDelivery || actionVisibility.canReuploadDelivery)
  const canAcceptDelivery = selectedOrder && actionVisibility.canConfirmDelivery
  const canRequestRework = selectedOrder && actionVisibility.canRequestRework
  const canRequestPhotoAuthorization = selectedOrder && actionVisibility.canRequestPhotoAuthorization
  const cancelAction = selectedOrder ? getCustomerCancelAction(selectedOrder, currentUser) : null
  const deliveryFileOptions = useMemo(() => {
    const map = new Map()
    flattenDeliveryFiles(deliveryRecords)
      .filter(file => file.fileId && isAuthorizableDeliveryFile(file))
      .forEach(file => {
        const fileId = Number(file.fileId)
        if (!map.has(fileId)) {
          map.set(fileId, {
            fileId,
            id: file.id || `authorization-${fileId}`,
            fileName: formatFileDisplayName(file, '交付图片'),
            mimeType: file.mimeType,
            fileType: file.fileType,
            fileSize: file.fileSize,
            uploadTime: file.uploadTime,
            source: file
          })
        }
      })
    return Array.from(map.values())
  }, [deliveryRecords])
  const selectedPhotoAuthorizationFileIds = useMemo(
    () => new Set(photoAuthorizationForm.fileIds.map(Number)),
    [photoAuthorizationForm.fileIds]
  )
  const deliveryBatches = useMemo(() => buildDeliveryBatches(deliveryRecords, selectedOrder), [deliveryRecords, selectedOrder])
  const latestDeliveryBatch = useMemo(() => getLatestDeliveryBatch(deliveryBatches), [deliveryBatches])
  const latestDeliveryUploadTime = useMemo(() => getLatestDeliveryUploadTime(deliveryRecords), [deliveryRecords])
  const estimatedAutoConfirmTime = latestDeliveryUploadTime ? addDays(latestDeliveryUploadTime, 7) : null
  const canReviewSelectedOrder = selectedOrder?.status === 'COMPLETED' && isOrderParticipant(selectedOrder, currentUser.userId)
  const currentReviewDirection = selectedOrder ? getOrderReviewDirection(selectedOrder, currentUser.userId) : ''
  const myReview = orderReviews.find(review => Number(review.reviewerId) === currentUser.userId || review.direction === currentReviewDirection)
  const resolvedComplaintReviewIds = useMemo(() => {
    const ids = new Set()
    arbitrations.forEach(item => {
      if (hasComplaintResult(item) && item?.reviewId) ids.add(String(item.reviewId))
    })
    return ids
  }, [arbitrations])
  const reviewToComplain = orderReviews.find(review => (
    Number(review.targetUserId) === currentUser.userId
    && review.isVisible !== false
    && !resolvedComplaintReviewIds.has(String(review.reviewId || ''))
  ))
  const selectedOrderPerspective = selectedOrder ? getOrderPerspective(selectedOrder, currentUser) : ''
  const selectedCounterpartyLabel = selectedOrder ? getCounterpartyLabel(selectedOrder, currentUser) : ''
  const selectedOrderLocation = quoteSnapshot?.location || selectedOrder?.shootLocation || '未填写'
  const selectedOrderTitle = selectedOrder ? formatOrderTitle(selectedOrder, quoteSnapshot) : ''
  const selectedOrderConversationId = selectedOrder?.conversationId
  const selectedOrderMetaText = selectedOrder ? buildOrderMetaText(selectedOrder, selectedCounterpartyLabel, selectedOrderLocation) : ''
  const selectedOrderDeliveryText = quoteSnapshot ? formatQuoteCount(quoteSnapshot) : formatDeliveryBatchContent(latestDeliveryBatch)
  const orderSummaryRows = selectedOrder ? buildOrderSummaryRows({
    order: selectedOrder,
    quoteSnapshot,
    deliveryText: selectedOrderDeliveryText,
    estimatedAutoConfirmTime
  }) : []
  const orderTimelineItems = selectedOrder ? buildOrderProgressItems({
    order: selectedOrder,
    statusLogs,
    deliveryRecords,
    currentUser
  }) : []
  const followupItems = selectedOrder ? [
    {
      key: 'delivery',
      kind: 'delivery',
      title: '交付作品',
      status: latestDeliveryBatch ? formatDeliveryBatchContent(latestDeliveryBatch) : canUploadDelivery ? '待上传' : '等待作品',
      tone: latestDeliveryBatch ? 'success' : canUploadDelivery ? 'warning' : 'default',
      primaryAction: latestDeliveryBatch ? {
        label: '查看作品',
        onClick: () => openDeliveryBatch(latestDeliveryBatch),
        disabled: !latestDeliveryBatch.deliveryId || !selectedOrder?.orderId
      } : canUploadDelivery ? {
        label: selectedOrder.status === 'REWORK_REQUIRED' ? '上传返修作品' : '上传作品',
        onClick: () => setDeliveryUploadDialogOpen(true),
        disabled: loading
      } : null
    },
    {
      key: 'authorization',
      kind: 'authorization',
      title: '展示授权',
      status: formatAuthorizationSummary(photoAuthorizations),
      tone: getAuthorizationFollowupTone(photoAuthorizations),
      primaryAction: photoAuthorizations.length ? {
        label: '查看授权记录',
        onClick: () => setAuthorizationRecordsDialogOpen(true)
      } : canRequestPhotoAuthorization ? {
        label: '申请展示授权',
        onClick: () => setPhotoAuthorizationDialogOpen(true)
      } : null,
      secondaryAction: photoAuthorizations.length && canRequestPhotoAuthorization ? {
        label: '再次申请',
        onClick: () => setPhotoAuthorizationDialogOpen(true)
      } : null
    },
    {
      key: 'review',
      kind: 'review',
      title: '评价与申诉',
      status: formatReviewFollowupStatus({ canReview: canReviewSelectedOrder, myReview, reviewToComplain, orderReviews, arbitrations }),
      tone: getReviewFollowupTone({ canReview: canReviewSelectedOrder, myReview, reviewToComplain, orderReviews, arbitrations }),
      primaryAction: canReviewSelectedOrder && !myReview ? {
        label: '评价',
        onClick: toggleReviewForm
      } : (orderReviews.length || arbitrations.length) ? {
        label: '查看评价',
        onClick: () => setReviewRecordsDialogOpen(true)
      } : null,
      secondaryAction: reviewToComplain ? {
        label: '发起申诉',
        onClick: toggleArbitrationForm
      } : null
    }
  ] : []
  const canReturnToConversation = Boolean(explicitReturnToConversation)
  const canContactCounterparty = !canReturnToConversation && Boolean(selectedOrderConversationId)
  useEffect(() => {
    if (!location.state?.openReview || !selectedOrder?.orderId || !canReviewSelectedOrder || myReview) return
    setShowReviewForm(true)
    feedback.info('评价功能入口已打开')
  }, [location.state, selectedOrder?.orderId, canReviewSelectedOrder, myReview, feedback])
  useEffect(() => {
    if (!selectedOrder?.orderId) return
    if (focusSection === 'reviews' || focusedReviewId || focusedComplaintId) {
      setReviewRecordsDialogOpen(true)
    }
  }, [selectedOrder?.orderId, focusSection, focusedReviewId, focusedComplaintId])

  function openDeliveryBatch(batch) {
    const succeeded = goToDeliveryGallery(navigate, {
      orderId: selectedOrder?.orderId || batch?.orderId,
      deliveryId: batch?.deliveryId,
      conversationId: selectedOrderConversationId,
      returnTo: explicitReturnToConversation,
      source: explicitReturnToConversation ? WORKFLOW_SOURCES.conversation : WORKFLOW_SOURCES.order
    })
    if (!succeeded) {
      feedback.warning('作品暂不可查看，请刷新后重试。')
    }
  }

  function returnToConversation() {
    const succeeded = navigateBackToConversation(navigate, location, selectedOrderConversationId)
    if (!succeeded) feedback.warning('暂时没有可返回的沟通记录。')
  }

  function continueConversation() {
    const succeeded = goToOrderConversation(navigate, selectedOrderConversationId)
    if (!succeeded) feedback.warning('暂无可进入的沟通记录。')
  }

  function renderCurrentTaskCard() {
    if (!selectedOrder) return null

    if (canAcceptDelivery) {
      return (
        <OrderCurrentTaskCard
          icon="confirm"
          title="作品已到达，请确认"
          subtitle="摄影师已上传成片，查看后确认是否收片。"
          chipLabel="待你操作"
          chipTone="warning"
          notice={estimatedAutoConfirmTime ? `逾期未操作，平台将于 ${formatTime(estimatedAutoConfirmTime)} 自动确认并结算给摄影师。` : ''}
          primaryAction={{
            label: '确认收片',
            onClick: () => action && operateOrder(action),
            disabled: loading || !action?.allowed
          }}
          secondaryAction={{
            label: '有问题',
            onClick: () => setReworkDialogOpen(true),
            disabled: loading
          }}
        >
          {latestDeliveryBatch ? (
            <OrderDeliverySummaryCard
              batch={latestDeliveryBatch}
              label="作品已上传"
              onOpen={() => openDeliveryBatch(latestDeliveryBatch)}
              disabled={!latestDeliveryBatch.deliveryId || !selectedOrder?.orderId}
            />
          ) : null}
        </OrderCurrentTaskCard>
      )
    }

    if (canUploadDelivery) {
      return (
        <OrderCurrentTaskCard
          icon="upload"
          title={selectedOrder.status === 'REWORK_REQUIRED' ? '上传返修作品' : '上传作品'}
          subtitle={selectedOrder.status === 'REWORK_REQUIRED' ? '客户提出了返修要求，请重新上传调整后的成片。' : '拍摄已结束，等待你上传成片。'}
          chipLabel="待处理"
          chipTone="warning"
          deadlineLabel="距离截止还有"
          deadlineValue={formatDeadlineDistance(selectedOrder.deliveryDeadline)}
          primaryAction={{
            label: selectedOrder.status === 'REWORK_REQUIRED' ? '上传返修作品' : '上传作品',
            onClick: () => setDeliveryUploadDialogOpen(true),
            disabled: loading
          }}
        />
      )
    }

    if (action && canShowOrderNormalActions(selectedOrder)) {
      return (
        <OrderCurrentTaskCard
          icon={action.kind === 'pay' ? 'warning' : 'idle'}
          title={selectedOrderWorkflow.title || action.label}
          subtitle={selectedOrderWorkflow.description}
          chipLabel="待处理"
          chipTone="warning"
          primaryAction={{
            label: action.label,
            onClick: () => operateOrder(action),
            disabled: loading || !action.allowed
          }}
          secondaryAction={cancelAction ? {
            label: cancelAction.label,
            onClick: () => cancelSelectedOrder(cancelAction),
            disabled: loading
          } : null}
        />
      )
    }

    return (
      <OrderCurrentTaskCard
        icon="idle"
        title="暂无需要你处理的事项"
        subtitle={selectedOrderWorkflow.description || '订单正在按流程推进，可以查看作品、授权、评价和进度记录。'}
        chipLabel="已同步"
        secondaryAction={cancelAction ? {
          label: cancelAction.label,
          onClick: () => cancelSelectedOrder(cancelAction),
          disabled: loading
        } : null}
      >
        {latestDeliveryBatch ? (
          <OrderDeliverySummaryCard
            batch={latestDeliveryBatch}
            label="查看交付作品"
            onOpen={() => openDeliveryBatch(latestDeliveryBatch)}
            disabled={!latestDeliveryBatch.deliveryId || !selectedOrder?.orderId}
          />
        ) : null}
      </OrderCurrentTaskCard>
    )
  }

  function returnToOrderList() {
    const target = buildOrderListTarget()
    clearOrderSelection()
    navigate(target.to, { state: target.state })
  }

  return (
    <PortraWorkflowFrame spacing={0} maxWidth="page" sx={orderPageSx}>
      <Box data-order-workspace="true" sx={orderGridSx}>
        <Paper variant="outlined" sx={orderIndexPanelSx}>
          <Stack spacing={1.6}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 950, color: PORTRA_SURFACE.faint }}>我的订单</Typography>
              <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => loadOrders()} disabled={loading}>
                刷新
              </Button>
            </Stack>
            <Stack spacing={0.4} sx={{ mx: -1.6 }}>
              {loading && !orders.length && <OrderIndexSkeleton />}
              {orders.map(order => {
                const orderQuoteSnapshot = parseQuoteSnapshot(order.quoteSnapshotJson)
                const selected = selectedOrder?.orderId === order.orderId
                return (
                  <Paper
                    key={order.orderId}
                    variant="outlined"
                    onClick={() => openOrderWithDraftGuard(order)}
                    sx={orderIndexCardSx(selected)}
                  >
                    <Stack spacing={0.65} sx={{ minHeight: 82, px: 2.2, py: 1.25, justifyContent: 'center' }}>
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Typography fontWeight={950} noWrap sx={{ minWidth: 0, color: selected ? PORTRA_SURFACE.portraBlue : PORTRA_SURFACE.ink, lineHeight: 1.3 }}>
                          {formatOrderTitle(order, orderQuoteSnapshot)}
                        </Typography>
                        <Typography sx={{ color: PORTRA_SURFACE.faint, fontSize: 13, flexShrink: 0 }}>
                          {formatOrderIndexDate(order)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <Box sx={orderStatusDotSx(order.status)} />
                        <Typography sx={{ color: PORTRA_SURFACE.muted, fontSize: 14 }} noWrap>
                          {formatOrderStatus(order.status)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                )
              })}
              {!loading && !orders.length && <PortraEmptyState title="暂无订单" description="当前还没有进入订单阶段的合作。" />}
            </Stack>
            {currentUser.role === 'PROVIDER' && (
              <>
                <Divider sx={{ borderColor: PORTRA_SURFACE.borderSoft }} />
                <Stack spacing={1}>
                  <Typography variant="overline" sx={overlineSx}>邀请状态</Typography>
                  {sentInvitations.map(invitation => {
                    const status = invitation.status || 'PENDING'
                    return (
                      <Paper key={invitation.invitationId} variant="outlined" sx={subCardSx}>
                        <Stack spacing={0.7}>
                          <Typography fontWeight={800}>{sanitizeSeedText(invitation.demandScene, '校园约拍邀请')}</Typography>
                          <Typography sx={{ color: PORTRA_SURFACE.muted }} variant="body2">{sanitizeSeedText(invitation.message, '已发送约拍邀请，等待对方处理。')}</Typography>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <Chip size="small" label={centToYuan(invitation.expectedPriceCent)} />
                            <Chip
                              size="small"
                              color={status === 'ACCEPTED' ? 'success' : status === 'REJECTED' ? 'default' : 'warning'}
                              label={status === 'ACCEPTED' ? '已接受，可继续沟通' : status === 'REJECTED' ? '已被婉拒' : '待处理'}
                            />
                          </Stack>
                        </Stack>
                      </Paper>
                    )
                  })}
                  {!sentInvitations.length && <PortraEmptyState title="暂无邀请记录" compact />}
                </Stack>
              </>
            )}
          </Stack>
        </Paper>

        {loading && !selectedOrder ? (
          <OrderDetailSkeleton />
        ) : !selectedOrder ? (
          <EmptyOrderCard text="选择订单查看详情" />
        ) : (
          <Stack spacing={2.6} sx={orderDetailWorkspaceSx}>
            <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <PortraActionLink
                startIcon={<ArrowBackRoundedIcon />}
                onClick={canReturnToConversation ? returnToConversation : returnToOrderList}
                sx={returnLinkSx}
              >
                {canReturnToConversation ? PRODUCT_ACTION_COPY.returnConversation : PRODUCT_ACTION_COPY.returnOrderList}
              </PortraActionLink>
              {!canReturnToConversation && canContactCounterparty && (
                <PortraActionLink onClick={continueConversation} sx={returnLinkSx}>
                  {PRODUCT_ACTION_COPY.goConversation}
                </PortraActionLink>
              )}
            </Stack>

            <OrderSummaryCard
              title={selectedOrderTitle}
              amountText={centToYuan(selectedOrder.amountCent)}
              metaText={selectedOrderMetaText}
              badgeText={selectedOrderPerspective}
              rows={orderSummaryRows}
            />

            {renderCurrentTaskCard()}

            <OrderTimelineCard items={orderTimelineItems} />

            <OrderFollowupCards items={followupItems} />
          </Stack>
        )}
      </Box>
      <Dialog open={Boolean(previewDelivery)} onClose={closeDeliveryPreview} fullWidth maxWidth="md">
        <DialogTitle>{previewDelivery ? formatDeliveryTitle(previewDelivery) : '作品'}</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack spacing={1.5}>
            {previewLoading && <Typography sx={{ color: PORTRA_SURFACE.muted }}>作品预览加载中...</Typography>}
            {!previewLoading && previewUrl && (
              <Box
                component="img"
                src={previewUrl}
                alt={previewDelivery ? formatDeliveryTitle(previewDelivery) : '作品'}
                sx={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', borderRadius: PORTRA_RADIUS.control, bgcolor: PORTRA_SURFACE.paperMuted }}
              />
            )}
            {!previewLoading && !previewUrl && (
              <PortraEmptyState
                title={previewError || '该作品暂不支持预览'}
                description="可以下载到本地后查看原图。"
              />
            )}
            {previewDelivery && (
              <InfoRows rows={[
                ['作品', formatDeliveryTitle(previewDelivery)],
                ['上传时间', formatTime(previewDelivery.uploadTime)],
                ['作品说明', formatDeliveryDescription(previewDelivery, '无作品说明')]
              ]} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={closeDeliveryPreview}>关闭</Button>
          <Button startIcon={<DownloadRoundedIcon />} onClick={() => downloadDeliveryFile(previewDelivery)} disabled={!previewDelivery?.fileId}>
            下载
          </Button>
        </DialogActions>
      </Dialog>

      <OrderCompletionDialog
        open={completionDialogOpen}
        onClose={() => setCompletionDialogOpen(false)}
        onReview={openReviewFromCompletion}
        reviewDisabled={!canReviewSelectedOrder || Boolean(myReview)}
      />

      <Dialog open={authorizationRecordsDialogOpen} onClose={() => setAuthorizationRecordsDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>展示授权记录</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack spacing={1.2}>
            <PortraInfoBanner>客户同意后，摄影师才能将本订单图片作为客片展示。</PortraInfoBanner>
            {photoAuthorizations.map(authorization => (
              <AuthorizationRequestCard
                key={authorization.id || authorization.authorizationId}
                authorization={authorization}
                order={selectedOrder}
                chrome="none"
                canReview={canCustomerReviewPhotoAuthorization(selectedOrder, currentUser, authorization)}
                loading={loading}
                onDecision={handlePhotoAuthorizationDecision}
                onOpenDelivery={openDeliveryBatch}
              />
            ))}
            {!photoAuthorizations.length && <PortraEmptyState title="暂无授权申请" compact />}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={() => setAuthorizationRecordsDialogOpen(false)}>关闭</Button>
          {canRequestPhotoAuthorization && (
            <Button variant="contained" startIcon={<ImageRoundedIcon />} onClick={() => {
              setAuthorizationRecordsDialogOpen(false)
              setPhotoAuthorizationDialogOpen(true)
            }}>
              申请展示授权
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={reviewRecordsDialogOpen} onClose={() => setReviewRecordsDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>评价与申诉</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack spacing={1.35}>
            <PortraInfoBanner>
              {canReviewSelectedOrder && !myReview
                ? '本次合作已完成，可以在这里留下评价，并在后续补充追评。'
                : reviewToComplain
                  ? '如遇到不实评价，可在对应评价卡片里发起申诉；处理结果会单独记录在下方。'
                  : '这里集中展示本次合作的评价、追加追评与申诉处理记录。'}
            </PortraInfoBanner>
            <ReviewList
              reviews={orderReviews}
              complaints={arbitrations}
              emptyText="该订单还没有评价"
              currentUserId={currentUser.userId}
              focusedReviewId={focusedReviewId}
              focusedComplaintId={focusedComplaintId}
              complainableReviewId={reviewToComplain?.reviewId}
              onFollowUp={openFollowUpDialog}
              onComplain={review => {
                if (!reviewToComplain || String(reviewToComplain.reviewId) !== String(review.reviewId)) return
                setReviewRecordsDialogOpen(false)
                toggleArbitrationForm()
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={() => setReviewRecordsDialogOpen(false)}>关闭</Button>
          {canReviewSelectedOrder && !myReview && (
            <Button variant="contained" size="small" startIcon={<RateReviewRoundedIcon />} onClick={() => {
              setReviewRecordsDialogOpen(false)
              setShowReviewForm(true)
            }} sx={{ borderRadius: 999, px: 1.6 }}>
              评价
            </Button>
          )}
          {reviewToComplain && (
            <Button color="warning" size="small" variant="outlined" startIcon={<GavelRoundedIcon />} onClick={() => {
              setReviewRecordsDialogOpen(false)
              setShowArbitrationForm(true)
            }} sx={{ borderRadius: 999, px: 1.55 }}>
              发起申诉
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={showReviewForm} onClose={toggleReviewForm} fullWidth maxWidth="sm">
        <DialogTitle>评价本次合作</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack component="form" id="order-review-form" spacing={1.5} onSubmit={submitReview}>
            <PortraInfoBanner>评分会影响对方在平台上的合作信用，请基于真实履约体验填写。</PortraInfoBanner>
            <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
              <Typography fontWeight={800}>评分</Typography>
              <Rating
                value={reviewForm.rating}
                onChange={(_, value) => setReviewForm({ ...reviewForm, rating: value || 5 })}
              />
            </Stack>
            <TextField
              label="评价内容"
              value={reviewForm.content}
              onChange={event => setReviewForm({ ...reviewForm, content: event.target.value })}
              multiline
              minRows={3}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={toggleReviewForm}>取消</Button>
          <Button type="submit" form="order-review-form" variant="contained" startIcon={<RateReviewRoundedIcon />} disabled={loading}>
            提交评价
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showArbitrationForm} onClose={toggleArbitrationForm} fullWidth maxWidth="sm">
        <DialogTitle>发起评价申诉</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack component="form" id="order-arbitration-form" spacing={1.5} onSubmit={submitArbitration}>
            <PortraInfoBanner>请说明你认为评价不实或存在争议的原因，处理结果会记录在本次约拍的评价区。</PortraInfoBanner>
            <TextField
              select
              label="申诉原因"
              value={arbitrationForm.reason}
              onChange={event => setArbitrationForm({ ...arbitrationForm, reason: event.target.value })}
            >
              <MenuItem value="评价内容不实">评价内容不实</MenuItem>
              <MenuItem value="评价包含攻击性表述">评价包含攻击性表述</MenuItem>
              <MenuItem value="评价与订单无关">评价与订单无关</MenuItem>
              <MenuItem value="其他评价争议">其他评价争议</MenuItem>
            </TextField>
            <TextField
              label="补充说明"
              value={arbitrationForm.description}
              onChange={event => setArbitrationForm({ ...arbitrationForm, description: event.target.value })}
              multiline
              minRows={3}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={toggleArbitrationForm}>取消</Button>
          <Button type="submit" form="order-arbitration-form" variant="contained" color="warning" startIcon={<GavelRoundedIcon />}>
            提交申诉
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={followUpDialogOpen} onClose={closeFollowUpDialog} fullWidth maxWidth="sm">
        <DialogTitle>追加追评</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack component="form" id="order-follow-up-form" spacing={1.35} onSubmit={submitFollowUp}>
            <PortraInfoBanner>补充你对这次合作的后续感受，追评会直接展示在原评价下方。</PortraInfoBanner>
            <TextField
              label="追评内容"
              value={followUpContent}
              onChange={event => setFollowUpContent(event.target.value)}
              multiline
              minRows={3}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={closeFollowUpDialog}>取消</Button>
          <Button type="submit" form="order-follow-up-form" variant="contained" startIcon={<RateReviewRoundedIcon />} disabled={loading || !followUpContent.trim()}>
            提交追评
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deliveryUploadDialogOpen} onClose={closeDeliveryUploadDialog} fullWidth maxWidth="md">
        <DialogTitle>{selectedOrder?.status === 'REWORK_REQUIRED' ? '上传返修作品' : '上传作品'}</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <DeliveryUploadPanel
            mode={selectedOrder?.status === 'REWORK_REQUIRED' ? 'rework' : 'upload'}
            value={deliveryForm}
            loading={loading}
            onChange={setDeliveryForm}
            onSubmit={submitDelivery}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={closeDeliveryUploadDialog}>取消</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={photoAuthorizationDialogOpen} onClose={closePhotoAuthorizationDialog} fullWidth maxWidth="md">
        <DialogTitle>申请展示授权</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack component="form" id="order-photo-authorization-form" spacing={1.5} onSubmit={submitPhotoAuthorizationRequest}>
            <PortraInfoBanner>仅可选择图片用于展示授权，压缩包不会用于公开展示。</PortraInfoBanner>
            {deliveryFileOptions.length ? (
              <>
                <Typography variant="body2" sx={{ color: PORTRA_SURFACE.muted, fontWeight: 850 }}>
                  已选择 {selectedPhotoAuthorizationFileIds.size} 张
                </Typography>
                <DeliveryFileGrid
                  files={deliveryFileOptions}
                  mode="select"
                  selectedFileIds={selectedPhotoAuthorizationFileIds}
                  onToggleSelect={togglePhotoAuthorizationFile}
                />
                <TextField
                  label="申请说明"
                  value={photoAuthorizationForm.remark}
                  onChange={event => setPhotoAuthorizationForm({ ...photoAuthorizationForm, remark: event.target.value })}
                  multiline
                  minRows={3}
                  placeholder="说明希望展示这些照片的用途，例如作品集客片展示"
                />
              </>
            ) : (
              <PortraInfoBanner>暂无可授权图片，请先上传图片交付文件。</PortraInfoBanner>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={closePhotoAuthorizationDialog}>取消</Button>
          <Button
            type="submit"
            form="order-photo-authorization-form"
            variant="contained"
            startIcon={<ImageRoundedIcon />}
            disabled={loading || !photoAuthorizationForm.fileIds.length}
          >
            发送申请
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reworkDialogOpen} onClose={closeReworkDialog} fullWidth maxWidth="sm">
        <DialogTitle>提交返修要求</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: PORTRA_SURFACE.paper }}>
          <Stack component="form" id="order-rework-dialog-form" spacing={1.5} onSubmit={submitRework}>
            <PortraInfoBanner tone="warning">请说明需要返修的照片、问题和期望修改方向。</PortraInfoBanner>
            <TextField
              autoFocus
              label="返修要求"
              value={reworkRequirement}
              onChange={event => setReworkRequirement(event.target.value)}
              multiline
              minRows={4}
              inputProps={{ maxLength: REWORK_REQUIREMENT_MAX_LENGTH }}
              helperText={getReworkRequirementHelperText(reworkRequirement)}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={closeReworkDialog}>取消</Button>
          <Button type="submit" form="order-rework-dialog-form" variant="contained" disabled={loading || !reworkRequirement.trim()}>
            提交返修
          </Button>
        </DialogActions>
      </Dialog>
    </PortraWorkflowFrame>
  )
}

const orderPageSx = {
  color: '#171717',
  overflowWrap: 'anywhere',
  overflowX: 'hidden',
  bgcolor: '#f2eee7',
  minHeight: 'calc(100dvh - 88px)',
  borderRadius: { xs: 0, md: '0' }
}

const orderGridSx = {
  display: 'grid',
  width: '100%',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    lg: '300px minmax(0, 1fr)',
    xl: '300px minmax(0, 1fr)'
  },
  gap: { xs: 1.6, lg: 0 },
  alignItems: 'start',
  minWidth: 0,
  overflowX: 'hidden',
  bgcolor: '#f2eee7'
}

const orderIndexPanelSx = {
  p: { xs: 1.6, md: 2 },
  alignSelf: 'start',
  minWidth: 0,
  minHeight: { lg: 'calc(100dvh - 88px)' },
  bgcolor: '#fffdf8',
  borderColor: 'transparent',
  borderRight: { lg: '1px solid rgba(79, 70, 60, .10)' },
  borderRadius: 0,
  boxShadow: 'none'
}

const orderDetailWorkspaceSx = {
  minWidth: 0,
  width: '100%',
  maxWidth: 860,
  mx: 'auto',
  px: { xs: 1.2, md: 4 },
  py: { xs: 1.8, md: 4 },
  overflowWrap: 'anywhere',
  bgcolor: 'transparent'
}

function OrderIndexSkeleton() {
  return (
    <Stack spacing={1.2} aria-label="订单索引加载中">
      {[0, 1, 2].map(index => (
        <Paper key={index} variant="outlined" sx={{ p: 1.4, borderRadius: PORTRA_RADIUS.card, borderColor: 'rgba(79, 70, 60, .10)', bgcolor: '#fffcf6' }}>
          <Skeleton variant="text" width={`${72 - index * 8}%`} height={24} />
          <Skeleton variant="text" width="54%" height={20} />
          <Skeleton variant="text" width="36%" height={18} />
        </Paper>
      ))}
    </Stack>
  )
}

function OrderDetailSkeleton() {
  return (
    <Stack spacing={2} sx={orderDetailWorkspaceSx} aria-label="订单详情加载中">
      <Paper variant="outlined" sx={orderArchiveHeroSx}>
        <Stack spacing={2}>
          <Skeleton variant="text" width="42%" height={34} />
          <Skeleton variant="text" width="24%" height={44} />
          <Divider sx={{ borderColor: PORTRA_SURFACE.borderSoft }} />
          {[0, 1, 2].map(index => (
            <Stack key={index} spacing={0.8}>
              <Skeleton variant="text" width="22%" height={24} />
              <Skeleton variant="rounded" width="100%" height={index === 1 ? 88 : 64} sx={{ borderRadius: PORTRA_RADIUS.control }} />
            </Stack>
          ))}
        </Stack>
      </Paper>
    </Stack>
  )
}

function orderIndexCardSx(selected) {
  return {
    cursor: 'pointer',
    bgcolor: selected ? 'rgba(37, 99, 235, .08)' : 'transparent',
    borderColor: 'transparent',
    borderRadius: 0,
    borderLeft: `4px solid ${selected ? ORDER_WORKFLOW_COLORS.primary : 'transparent'}`,
    boxShadow: 'none',
    transition: 'background-color 140ms ease, border-color 140ms ease',
    '&:hover': {
      bgcolor: selected ? 'rgba(37, 99, 235, .08)' : 'rgba(255, 252, 246, .72)'
    }
  }
}

const orderArchiveHeroSx = {
  p: { xs: 2, md: 2.6 },
  bgcolor: '#fffcf6',
  borderColor: 'rgba(79, 70, 60, .10)',
  borderRadius: PORTRA_RADIUS.panel,
  boxShadow: 'none',
  position: 'relative',
  overflow: 'hidden'
}

const subCardSx = {
  p: 1.5,
  bgcolor: '#fffcf6',
  borderColor: 'rgba(79, 70, 60, .10)',
  borderRadius: PORTRA_RADIUS.card,
  boxShadow: 'none'
}

const warmNoticeSx = {
  ...subCardSx,
  bgcolor: PORTRA_SURFACE.filmYellowSoft,
  borderLeft: `3px solid ${PORTRA_SURFACE.warmOrange}`
}

const overlineSx = {
  color: PORTRA_SURFACE.faint,
  fontWeight: 950,
  letterSpacing: 0
}

const returnLinkSx = {
  alignSelf: 'flex-start',
  mb: 0.8,
  ml: -0.4
}

