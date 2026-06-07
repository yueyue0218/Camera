import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Rating,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import { useAuth } from '../../AuthContext.jsx'
import {
  demandApi,
  deliveryApi,
  fileApi,
  orderApi,
  photoAuthorizationApi,
  reviewApi,
  reviewComplaintApi
} from '../../api.js'
import { buildOrderNavigationTarget, goToOrderConversation, normalizeOrderId } from '../../utils/orderNavigation.js'
import { goToDeliveryGallery } from '../../utils/deliveryNavigation.js'
import { PRODUCT_ACTION_COPY } from '../../utils/productCopy.js'
import { ORDER_SURFACES, WORKFLOW_SOURCES, buildOrderListTarget, isOrderListSurface } from '../../utils/workflowNavigation.js'
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
  formatStatusLogText
} from '../../utils/displayFormatters.js'
import {
  PortraActionButton,
  PortraActionLink,
  PortraEmptyState,
  PortraInfoBanner,
  OrderCompletionDialog,
  PortraWorkflowFrame,
  PortraStatusBadge,
  PortraStatusPill,
  PortraTicketCard,
  PortraTicketSection,
  PortraTimeline
} from '../../components/portra/index.js'
import { AuthorizationRequestCard } from '../../components/portra/AuthorizationRequestCard.jsx'
import { PORTRA_LAYOUT, PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import {
  canCustomerConfirm,
  canCustomerPay,
  canCustomerRequestRework,
  canCustomerReviewPhotoAuthorization,
  canProviderRequestPhotoAuthorization,
  canProviderUploadDelivery,
  canShowOrderNormalActions
} from './orderActions.js'
import { EmptyOrderCard } from './components/EmptyOrderCard.jsx'
import { InfoRows } from './components/InfoRows.jsx'
import { OrdersSectionHeader } from './components/OrdersSectionHeader.jsx'
import { ReviewList } from './components/ReviewList.jsx'
import { DeliveryBatchCard } from '../deliveries/components/DeliveryBatchCard.jsx'
import { buildDeliveryBatches } from '../deliveries/deliveryDisplay.js'
import {
  addDays,
  complaintStatusMap,
  formatEscrowStatus,
  formatOrderStatus,
  formatOrderTitle,
  formatRefundStatus,
  formatSettlementStatus,
  formatTime,
  getArbitrationsByOrder,
  getLatestDeliveryUploadTime,
  getLocalReviewsByOrder,
  getOrderFulfillmentNotice,
  getOrderReviewDirection,
  getReviewTargetUserId,
  isApiUnavailable,
  isOrderParticipant,
  mergeComplaints,
  mergeReviewLists,
  orderStatusMap,
  parseQuoteSnapshot,
  saveLocalArbitration,
  saveLocalReview,
  sanitizeSeedText,
  saveOrderSnapshots
} from './utils/orderStatusUtils.js'
function parseInputDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getOrderAction(order, currentUser) {
  if (canCustomerPay(order, currentUser)) {
    return {
      kind: 'pay',
      label: PRODUCT_ACTION_COPY.payOrder,
      icon: <PaidRoundedIcon />,
      allowed: true,
      successText: '支付成功，资金已进入平台担保'
    }
  }
  if (canCustomerConfirm(order, currentUser)) {
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

function shouldShowShootStartedCancelNotice(order, currentUser) {
  return isOrderCustomer(order, currentUser)
    && order.status === 'PAID_PENDING_SHOOT'
    && !isBeforeShootStart(order)
}

function isOrderCustomer(order, currentUser) {
  return Boolean(order)
    && Boolean(currentUser)
    && Number(order.customerId) === Number(currentUser.userId)
}

function getOrderPerspective(order, currentUser) {
  if (!order || !currentUser) return ''
  if (Number(order.customerId) === Number(currentUser.userId)) return '客户'
  if (Number(order.providerUserId) === Number(currentUser.userId)) return '摄影师'
  return '协作方'
}

function getCounterpartyLabel(order, currentUser) {
  if (!order || !currentUser) return '对方未确认'
  if (Number(order.customerId) === Number(currentUser.userId)) {
    return `摄影师 ${order.providerUserId || '-'}`
  }
  if (Number(order.providerUserId) === Number(currentUser.userId)) {
    return `客户 ${order.customerId || '-'}`
  }
  return `客户 ${order.customerId || '-'} / 摄影师 ${order.providerUserId || '-'}`
}

const deliveryStatusLabelMap = {
  DELIVERED: '已上传作品',
  REWORKED: '返修作品'
}

function getSettlementRefundLabel(order) {
  return `${formatSettlementStatus(order?.settlementStatus)} / ${formatRefundStatus(order?.refundStatus)}`
}

function formatOrderTimeRange(order) {
  return `${formatTime(order?.shootStartTime)} 至 ${formatTime(order?.shootEndTime)}`
}

function formatOrderIndexDate(order) {
  const label = formatDateOnly(order?.shootStartTime || order?.createdAt, '')
  return label ? label.slice(5).replace('-', '/') : '待定'
}

function isImageDelivery(record) {
  const text = `${record?.mimeType || ''} ${record?.contentType || ''} ${record?.fileName || ''}`.toLowerCase()
  return /image\//.test(text) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(text)
}

function formatQuoteCount(quoteSnapshot) {
  const originalCount = quoteSnapshot?.originalCount
  const refinedCount = quoteSnapshot?.refinedCount
  if (originalCount === undefined && refinedCount === undefined) return '未填写'
  return `${originalCount ?? 0} / ${refinedCount ?? 0}`
}

function isBeforeShootStart(order) {
  const shootStartTime = parseInputDate(order?.shootStartTime)
  return Boolean(shootStartTime) && new Date() < shootStartTime
}
async function complaintApiSafeList(reviewId, currentUser) {
  try {
    return await reviewComplaintApi.listByReview(reviewId, currentUser)
  } catch (error) {
    if (isApiUnavailable(error)) return []
    throw error
  }
}

async function optionalOrderData(action, fallback = []) {
  try {
    return await action()
  } catch (error) {
    if (isApiUnavailable(error) || error.status === 403 || error.status === 404) return fallback
    return fallback
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function OrdersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const focusOrderId = useMemo(() => {
    const value = new URLSearchParams(location.search).get('orderId')
    return normalizeOrderId(location.state?.orderId) || normalizeOrderId(value)
  }, [location.search, location.state])
  const explicitReturnToConversation = useMemo(() => getExplicitReturnToConversation(location), [location.search, location.state])
  const orderListSurface = useMemo(() => isOrderListSurface(location), [location.search, location.state])
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [statusLogs, setStatusLogs] = useState([])
  const [deliveryRecords, setDeliveryRecords] = useState([])
  const [deliveryForm, setDeliveryForm] = useState({ file: null, remark: '' })
  const [reworkRequirement, setReworkRequirement] = useState('')
  const [reworkDialogOpen, setReworkDialogOpen] = useState(false)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [previewDelivery, setPreviewDelivery] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [photoAuthorizations, setPhotoAuthorizations] = useState([])
  const [photoAuthorizationForm, setPhotoAuthorizationForm] = useState({ fileIds: [], remark: '' })
  const [authorizationRemarks, setAuthorizationRemarks] = useState({})
  const [orderReviews, setOrderReviews] = useState([])
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: '沟通顺畅，履约体验很好。' })
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [arbitrations, setArbitrations] = useState([])
  const [arbitrationForm, setArbitrationForm] = useState({
    reason: '评价内容不实',
    description: ''
  })
  const [showArbitrationForm, setShowArbitrationForm] = useState(false)
  const [sentInvitations, setSentInvitations] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadOrders(focusOrderId)
  }, [currentUser.userId, currentUser.role, statusFilter, focusOrderId, orderListSurface])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function run(action, successText) {
    setLoading(true)
    setNotice(null)
    try {
      const result = await action()
      if (successText) setNotice({ type: 'success', text: successText })
      return result
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      return null
    } finally {
      setLoading(false)
    }
  }

  async function loadOrders(focusOrderId = selectedOrder?.orderId) {
    await run(async () => {
      const nextOrders = await orderApi.list({
        role: currentUser.role === 'PROVIDER' ? 'provider' : 'customer',
        status: statusFilter
      }, currentUser)
      let nextInvitations = []
      if (currentUser.role === 'PROVIDER') {
        try {
          nextInvitations = await demandApi.sentInvitations(currentUser)
        } catch {
          nextInvitations = []
        }
      }
      const roleOrders = asArray(nextOrders).filter(order => currentUser.role === 'PROVIDER'
        ? Number(order.providerUserId) === Number(currentUser.userId)
        : Number(order.customerId) === Number(currentUser.userId))
      setOrders(roleOrders)
      saveOrderSnapshots(roleOrders)
      setSentInvitations(asArray(nextInvitations))
      if (focusOrderId && roleOrders.some(order => Number(order.orderId) === Number(focusOrderId))) {
        const focusedOrder = roleOrders.find(order => Number(order.orderId) === Number(focusOrderId))
        await openOrder(focusedOrder || focusOrderId, false)
      } else if (roleOrders.length && !orderListSurface) {
        await openOrder(roleOrders[0], false)
      } else {
        setSelectedOrder(null)
        setStatusLogs([])
        setDeliveryRecords([])
        setPhotoAuthorizations([])
        setOrderReviews([])
        setArbitrations([])
      }
    })
  }

  async function openOrder(orderOrId, updateUrl = true) {
    const orderId = normalizeOrderId(typeof orderOrId === 'object' ? orderOrId.orderId : orderOrId)
    const fallbackOrder = typeof orderOrId === 'object' ? orderOrId : orders.find(order => Number(order.orderId) === Number(orderId))
    if (!orderId) {
      setNotice({ type: 'warning', text: '订单信息暂时不可用，请刷新后重试。' })
      return false
    }
    setLoading(true)
    setNotice(null)
    try {
      let detail = fallbackOrder || null
      try {
        detail = await orderApi.detail(orderId, currentUser) || detail
      } catch (error) {
        if (!detail || (!isApiUnavailable(error) && error.status !== 403 && error.status !== 404)) throw error
        setNotice({ type: 'warning', text: '订单详情接口暂时不可用，已先展示订单列表中的档案信息。' })
      }
      if (!detail) {
        setNotice({ type: 'warning', text: '订单信息暂时不可用，请刷新后重试。' })
        return false
      }
      const logs = asArray(await optionalOrderData(() => orderApi.statusLogs(orderId, currentUser)))
      const deliveries = asArray(await optionalOrderData(() => deliveryApi.listByOrder(orderId, currentUser)))
      const authorizations = asArray(await optionalOrderData(() => photoAuthorizationApi.listByOrder(orderId, currentUser)))
      let reviews = asArray(getLocalReviewsByOrder(orderId))
      const remoteReviews = asArray(await optionalOrderData(() => reviewApi.listByOrder(orderId, currentUser), []))
      reviews = mergeReviewLists(remoteReviews, reviews)
      let complaints = asArray(getArbitrationsByOrder(orderId))
      const complaintReviewIds = reviews
        .map(review => review.reviewId)
        .filter(reviewId => reviewId && !String(reviewId).startsWith('local'))
      if (complaintReviewIds.length) {
        try {
          const remoteComplaints = await Promise.all(complaintReviewIds.map(reviewId => complaintApiSafeList(reviewId, currentUser)))
          complaints = mergeComplaints(complaints, remoteComplaints.flat())
        } catch {
          complaints = mergeComplaints(complaints)
        }
      }
      setSelectedOrder(detail)
      saveOrderSnapshots([detail])
      setStatusLogs(logs)
      setDeliveryRecords(deliveries)
      setDeliveryForm({ file: null, remark: '' })
      setReworkRequirement('')
      setPhotoAuthorizations(authorizations)
      setPhotoAuthorizationForm({ fileIds: [], remark: '' })
      setAuthorizationRemarks({})
      setOrderReviews(reviews)
      setArbitrations(complaints)
      setShowReviewForm(false)
      setShowArbitrationForm(false)
      if (updateUrl) {
        const searchConversationId = new URLSearchParams(location.search).get('conversationId')
        const target = buildOrderNavigationTarget(orderId, {
          conversationId: detail.conversationId || location.state?.conversationId || searchConversationId,
          returnTo: explicitReturnToConversation,
          source: explicitReturnToConversation ? WORKFLOW_SOURCES.conversation : WORKFLOW_SOURCES.order,
          orderSurface: ORDER_SURFACES.detail
        })
        if (target) navigate(target.to, { replace: true, state: target.state })
      }
      return true
    } catch (error) {
      setNotice({ type: 'error', text: error.message || '订单详情暂时无法打开，请刷新后重试。' })
      return false
    } finally {
      setLoading(false)
    }
  }

  async function operateOrder(action) {
    if (!selectedOrder) return
    const result = await run(async () => {
      if (action.kind === 'pay') {
        return orderApi.mockPay(selectedOrder.orderId, selectedOrder.amountCent, currentUser)
      }
      if (action.kind === 'transition' && action.targetStatus === 'COMPLETED' && canCustomerConfirm(selectedOrder, currentUser)) {
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
  }

  async function submitDelivery(event) {
    event.preventDefault()
    if (!selectedOrder || !deliveryForm.file) return
    const result = await run(async () => deliveryApi.upload(
      selectedOrder.orderId,
      deliveryForm.file,
      deliveryForm.remark.trim(),
      currentUser
    ), selectedOrder.status === 'REWORK_REQUIRED' ? '返修作品已上传' : '作品已上传')
    if (result) {
      setDeliveryForm({ file: null, remark: '' })
      await loadOrders(selectedOrder.orderId)
    }
  }

  async function submitRework(event) {
    event.preventDefault()
    if (!selectedOrder) return
    const trimmedRequirement = reworkRequirement.trim()
    if (!trimmedRequirement) {
      setNotice({ type: 'warning', text: '请填写返修要求' })
      return
    }
    const result = await run(async () => orderApi.requestRework(
      selectedOrder.orderId,
      trimmedRequirement,
      currentUser
    ), '返修请求已提交')
    if (result) {
      setReworkRequirement('')
      setReworkDialogOpen(false)
      await loadOrders(selectedOrder.orderId)
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
      setNotice({ type: 'warning', text: '当前作品暂未提供下载链接。' })
      return
    }
    try {
      const url = await fileApi.downloadObjectUrl(record.fileId, currentUser)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = formatFileDisplayName(record, `作品-${record.fileId}`)
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setNotice({ type: 'error', text: error.message || '作品下载失败，请稍后重试。' })
    }
  }

  async function cancelSelectedOrder(cancelAction) {
    if (!selectedOrder || !cancelAction) return
    if (!window.confirm(cancelAction.confirmText)) return
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
      setPhotoAuthorizationForm({ fileIds: [], remark: '' })
      setPhotoAuthorizations(await photoAuthorizationApi.listByOrder(selectedOrder.orderId, currentUser))
    }
  }

  async function handlePhotoAuthorizationDecision(authorization, decision, decisionRemark = '') {
    if (!selectedOrder) return
    const remark = (decisionRemark || authorizationRemarks[authorization.id] || '').trim()
    if (decision === 'reject' && !remark) {
      setNotice({ type: 'warning', text: '请填写拒绝原因' })
      return false
    }
    const action = decision === 'approve' ? photoAuthorizationApi.approve : photoAuthorizationApi.reject
    const successText = decision === 'approve' ? '已同意展示授权' : '已拒绝展示授权'
    const result = await run(async () => action(authorization.id, { remark }, currentUser), successText)
    if (result) {
      setAuthorizationRemarks({ ...authorizationRemarks, [authorization.id]: '' })
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
      setReviewForm({ rating: 5, content: '沟通顺畅，履约体验很好。' })
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
    }, '仲裁申请已提交')
    if (result) {
      setArbitrations(mergeComplaints([result], arbitrations, getArbitrationsByOrder(selectedOrder.orderId)))
      setShowArbitrationForm(false)
      setArbitrationForm({ reason: '评价内容不实', description: '' })
    }
  }

  const action = selectedOrder ? getOrderAction(selectedOrder, currentUser) : null
  const quoteSnapshot = parseQuoteSnapshot(selectedOrder?.quoteSnapshotJson)
  const canUploadDelivery = selectedOrder && canProviderUploadDelivery(selectedOrder, currentUser)
  const canAcceptDelivery = selectedOrder && canCustomerConfirm(selectedOrder, currentUser)
  const canRequestRework = selectedOrder && canCustomerRequestRework(selectedOrder, currentUser)
  const canRequestPhotoAuthorization = selectedOrder && canProviderRequestPhotoAuthorization(selectedOrder, currentUser)
  const cancelAction = selectedOrder ? getCustomerCancelAction(selectedOrder, currentUser) : null
  const showShootStartedCancelNotice = selectedOrder
    && shouldShowShootStartedCancelNotice(selectedOrder, currentUser)
  const deliveryFileOptions = useMemo(() => {
    const map = new Map()
    deliveryRecords
      .filter(record => record.fileId)
      .forEach(record => {
        const fileId = Number(record.fileId)
        if (!map.has(fileId)) {
          map.set(fileId, {
            fileId,
            fileName: formatFileDisplayName(record, `作品 ${fileId}`),
            uploadTime: record.uploadTime
          })
        }
      })
    return Array.from(map.values())
  }, [deliveryRecords])
  const deliveryFileNameMap = useMemo(() => new Map(
    deliveryFileOptions.map(file => [Number(file.fileId), file.fileName])
  ), [deliveryFileOptions])
  const deliveryBatches = useMemo(() => buildDeliveryBatches(deliveryRecords, selectedOrder), [deliveryRecords, selectedOrder])
  const latestDeliveryUploadTime = useMemo(() => getLatestDeliveryUploadTime(deliveryRecords), [deliveryRecords])
  const estimatedAutoConfirmTime = latestDeliveryUploadTime ? addDays(latestDeliveryUploadTime, 7) : null
  const fulfillmentNotice = selectedOrder
    ? getOrderFulfillmentNotice(selectedOrder, statusLogs, deliveryRecords, latestDeliveryUploadTime, estimatedAutoConfirmTime)
    : null
  const canReviewSelectedOrder = selectedOrder?.status === 'COMPLETED' && isOrderParticipant(selectedOrder, currentUser.userId)
  const currentReviewDirection = selectedOrder ? getOrderReviewDirection(selectedOrder, currentUser.userId) : ''
  const myReview = orderReviews.find(review => Number(review.reviewerId) === currentUser.userId || review.direction === currentReviewDirection)
  const reviewToComplain = orderReviews.find(review => Number(review.targetUserId) === currentUser.userId && review.isVisible !== false)
  const selectedOrderPerspective = selectedOrder ? getOrderPerspective(selectedOrder, currentUser) : ''
  const selectedCounterpartyLabel = selectedOrder ? getCounterpartyLabel(selectedOrder, currentUser) : ''
  const selectedOrderLocation = quoteSnapshot?.location || selectedOrder?.shootLocation || '未填写'
  const selectedOrderServiceContent = sanitizeSeedText(quoteSnapshot?.serviceContent || selectedOrder?.serviceContent, '校园约拍服务')
  const selectedOrderTitle = selectedOrder ? formatOrderTitle(selectedOrder, quoteSnapshot) : ''
  const selectedOrderConversationId = selectedOrder?.conversationId
  const canReturnToConversation = Boolean(explicitReturnToConversation)
  const canContactCounterparty = !canReturnToConversation && Boolean(selectedOrderConversationId)
  const statusTimelineItems = statusLogs.map(log => ({
    id: log.logId || `${log.orderId}-${log.createdAt}`,
    title: formatStatusLogText(log),
    description: `${log.fromStatus ? formatOrderStatus(log.fromStatus) : '创建'} → ${formatOrderStatus(log.toStatus)}`,
    time: formatTime(log.createdAt),
    tone: log.toStatus === 'APPEALING' || log.toStatus === 'REWORK_REQUIRED' ? 'danger' : 'primary'
  }))

  function openDeliveryBatch(batch) {
    const succeeded = goToDeliveryGallery(navigate, {
      orderId: selectedOrder?.orderId || batch?.orderId,
      deliveryId: batch?.deliveryId,
      conversationId: selectedOrderConversationId,
      returnTo: explicitReturnToConversation,
      source: explicitReturnToConversation ? WORKFLOW_SOURCES.conversation : WORKFLOW_SOURCES.order
    })
    if (!succeeded) {
      setNotice({ type: 'warning', text: '作品记录暂不可查看，请刷新后重试。' })
    }
  }

  function returnToConversation() {
    const succeeded = navigateBackToConversation(navigate, location, selectedOrderConversationId)
    if (!succeeded) setNotice({ type: 'warning', text: '暂时没有可返回的沟通记录。' })
  }

  function continueConversation() {
    const succeeded = goToOrderConversation(navigate, selectedOrderConversationId)
    if (!succeeded) setNotice({ type: 'warning', text: '暂无可进入的沟通记录。' })
  }

  function returnToOrderList() {
    const target = buildOrderListTarget()
    setSelectedOrder(null)
    setStatusLogs([])
    setDeliveryRecords([])
    setPhotoAuthorizations([])
    setOrderReviews([])
    setArbitrations([])
    navigate(target.to, { state: target.state })
  }

  return (
    <PortraWorkflowFrame spacing={2.5} maxWidth="page" sx={orderPageSx}>
      <OrdersSectionHeader title="订单" subtitle="查看订单进展、平台担保状态和每次状态流转。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      <Box data-order-workspace="true" sx={orderGridSx}>
        <Paper variant="outlined" sx={orderIndexPanelSx}>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 950 }}>订单索引</Typography>
              <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => loadOrders()} disabled={loading}>
                刷新
              </Button>
            </Stack>
            <FormControl size="small" sx={filterControlSx}>
              <InputLabel>状态</InputLabel>
              <Select label="状态" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <MenuItem value="">全部</MenuItem>
                {Object.entries(orderStatusMap).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack spacing={1.2}>
              {orders.map(order => {
                const orderQuoteSnapshot = parseQuoteSnapshot(order.quoteSnapshotJson)
                return (
                  <PortraTicketCard
                    key={order.orderId}
                    onClick={() => openOrder(order)}
                    selected={selectedOrder?.orderId === order.orderId}
                    sx={orderIndexCardSx(selectedOrder?.orderId === order.orderId)}
                  >
                    <Stack spacing={0.55} sx={{ minHeight: 66, px: 1.5, py: 1.05, pl: 2.3, justifyContent: 'center' }}>
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Typography fontWeight={900} noWrap sx={{ minWidth: 0, color: PORTRA_SURFACE.ink, lineHeight: 1.3 }}>{formatOrderTitle(order, orderQuoteSnapshot)}</Typography>
                        <PortraStatusBadge label={formatOrderStatus(order.status)} />
                      </Stack>
                      <Typography sx={{ color: PORTRA_SURFACE.ink, fontWeight: 850 }}>{centToYuan(order.amountCent)} · {getCounterpartyLabel(order, currentUser)}</Typography>
                      <Typography sx={{ color: PORTRA_SURFACE.faint, fontSize: 12.5 }} variant="body2">
                        拍摄日期 {formatOrderIndexDate(order)}
                      </Typography>
                    </Stack>
                  </PortraTicketCard>
                )
              })}
              {!orders.length && <PortraEmptyState title="暂无订单" description="当前还没有进入订单阶段的合作。" />}
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

        {!selectedOrder ? (
          <EmptyOrderCard text="选择订单查看详情" />
        ) : (
          <Stack spacing={2} sx={orderDetailWorkspaceSx}>
            <Paper variant="outlined" sx={orderArchiveHeroSx}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.8 }}>
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
                    <Typography variant="h5" sx={{ fontSize: { xs: 20, md: 24 }, color: PORTRA_SURFACE.ink, fontWeight: 950 }}>{selectedOrderTitle}</Typography>
                    <Typography sx={{ color: PORTRA_SURFACE.muted, mt: 0.4 }}>
                      订单 · {selectedCounterpartyLabel}
                    </Typography>
                    <Typography sx={{ mt: 1.2, color: PORTRA_SURFACE.ink, fontSize: { xs: 28, md: 32 }, fontWeight: 950, lineHeight: 1 }}>
                      {centToYuan(selectedOrder.amountCent)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <PortraStatusPill label={selectedOrderPerspective || '身份待确认'} tone="neutral" />
                    <PortraStatusPill label={formatOrderStatus(selectedOrder.status)} />
                    <PortraStatusPill label={formatEscrowStatus(selectedOrder.escrowStatus)} />
                  </Stack>
                </Stack>
                <Divider sx={{ borderColor: PORTRA_SURFACE.borderSoft }} />
                <PortraTicketSection title="交易概览">
                  <InfoRows rows={[
                    ['当前身份', selectedOrderPerspective || '未确认'],
                    ['对方', selectedCounterpartyLabel],
                    ['结算/退款', getSettlementRefundLabel(selectedOrder)]
                  ]} />
                </PortraTicketSection>
                <PortraTicketSection title="履约安排">
                  <InfoRows rows={[
                    ['拍摄时间', formatOrderTimeRange(selectedOrder)],
                    ['拍摄地点', selectedOrderLocation],
                    ['成片截止', formatTime(selectedOrder.deliveryDeadline)]
                  ]} />
                </PortraTicketSection>
                {fulfillmentNotice && (
                  <PortraTicketSection title="当前待办">
                    <Stack spacing={1.1}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                        <Box>
                          <Typography fontWeight={900}>{fulfillmentNotice.title}</Typography>
                          <Typography sx={{ color: PORTRA_SURFACE.muted }} variant="body2">{fulfillmentNotice.description}</Typography>
                        </Box>
                        <PortraStatusBadge label={formatOrderStatus(selectedOrder.status)} />
                      </Stack>
                      <InfoRows rows={fulfillmentNotice.rows} />
                      {fulfillmentNotice.note && (
                        <PortraInfoBanner tone={fulfillmentNotice.severity === 'warning' ? 'warning' : 'info'}>
                          {fulfillmentNotice.note}
                        </PortraInfoBanner>
                      )}
                    </Stack>
                  </PortraTicketSection>
                )}
                {quoteSnapshot && (
                  <PortraTicketSection title="报价快照">
                    <InfoRows rows={[
                      ['服务内容', selectedOrderServiceContent],
                      ['原片/精修', formatQuoteCount(quoteSnapshot)],
                      ['照片用途', formatPhotoUsageScope(quoteSnapshot.photoUsageScope)]
                    ]} />
                  </PortraTicketSection>
                )}
                {action && canShowOrderNormalActions(selectedOrder) ? (
                  <PortraActionButton
                    startIcon={action.icon}
                    onClick={() => operateOrder(action)}
                    disabled={loading || !action.allowed}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {action.label}
                  </PortraActionButton>
                ) : (
                  <PortraStatusBadge label="暂无需要你操作的事项" tone="neutral" sx={{ alignSelf: 'flex-start' }} />
                )}
                {cancelAction && (
                  <Paper variant="outlined" sx={warmNoticeSx}>
                    <Stack spacing={1}>
                      <Typography fontWeight={900}>{cancelAction.title}</Typography>
                      <Typography sx={{ color: PORTRA_SURFACE.muted }} variant="body2">{cancelAction.description}</Typography>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CloseRoundedIcon />}
                        onClick={() => cancelSelectedOrder(cancelAction)}
                        disabled={loading}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {cancelAction.label}
                      </Button>
                    </Stack>
                  </Paper>
                )}
                {showShootStartedCancelNotice && (
                  <PortraInfoBanner tone="warning">拍摄开始后不可直接取消，如有争议请走申诉或联系平台处理。</PortraInfoBanner>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={archiveSectionSx}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h6">作品</Typography>
                    <Typography sx={{ color: PORTRA_SURFACE.muted }}>摄影师通过上传作品推进待确认状态，返修也从这里重新上传。</Typography>
                  </Box>
                  {canUploadDelivery && (
                    <Chip color="secondary" label={selectedOrder.status === 'REWORK_REQUIRED' ? '可上传返修作品' : '可上传作品'} />
                  )}
                </Stack>

                {canUploadDelivery && (
                  <Paper component="form" variant="outlined" onSubmit={submitDelivery} sx={subCardSx}>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                        <Button variant="outlined" component="label" startIcon={<AddPhotoAlternateRoundedIcon />}>
                          选择作品
                          <input
                            hidden
                            type="file"
                            onChange={event => setDeliveryForm({ ...deliveryForm, file: event.target.files?.[0] || null })}
                          />
                        </Button>
                        <Typography sx={{ color: PORTRA_SURFACE.muted }} variant="body2">
                          {deliveryForm.file ? deliveryForm.file.name : '尚未选择作品'}
                        </Typography>
                      </Stack>
                      <TextField
                        label="作品说明"
                        value={deliveryForm.remark}
                        onChange={event => setDeliveryForm({ ...deliveryForm, remark: event.target.value })}
                        multiline
                        minRows={2}
                        placeholder="说明本次作品内容、返修修改点或注意事项"
                      />
                      <Button type="submit" variant="contained" startIcon={<TaskAltRoundedIcon />} disabled={loading || !deliveryForm.file}>
                        上传作品
                      </Button>
                    </Stack>
                  </Paper>
                )}

                {(canAcceptDelivery || canRequestRework) && (
                  <PortraInfoBanner tone="warning" title="请处理作品">
                    <Stack direction="row" spacing={1} sx={{ mt: 0.8, flexWrap: 'wrap' }}>
                      {canAcceptDelivery && action && (
                        <PortraActionButton startIcon={<CheckCircleRoundedIcon />} onClick={() => operateOrder(action)} disabled={loading || !action.allowed}>
                          {PRODUCT_ACTION_COPY.confirmDelivery}
                        </PortraActionButton>
                      )}
                      {canRequestRework && (
                        <PortraActionButton tone="secondary" startIcon={<RefreshRoundedIcon />} onClick={() => setReworkDialogOpen(true)} disabled={loading}>
                          提交返修要求
                        </PortraActionButton>
                      )}
                    </Stack>
                  </PortraInfoBanner>
                )}

                <Stack spacing={1}>
                  <Typography variant="overline" sx={overlineSx}>作品记录</Typography>
                  {deliveryBatches.map(batch => (
                    <DeliveryBatchCard
                      key={batch.id}
                      batch={batch}
                      variant="orderSection"
                      onOpen={() => openDeliveryBatch(batch)}
                      disabled={!batch.deliveryId || !selectedOrder?.orderId}
                    />
                  ))}
                  {!deliveryBatches.length && <PortraEmptyState title="暂无作品记录" compact />}
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={archiveSectionSx}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h6">展示授权</Typography>
                    <Typography sx={{ color: PORTRA_SURFACE.muted }}>客户同意后，摄影师才能把本订单作品作为真实客片展示。</Typography>
                  </Box>
                  {selectedOrder.status === 'COMPLETED' && (
                    <Chip color="success" label="订单已完成，可处理授权" />
                  )}
                </Stack>

                {canRequestPhotoAuthorization && (
                  <Paper component="form" variant="outlined" onSubmit={submitPhotoAuthorizationRequest} sx={subCardSx}>
                    <Stack spacing={1.5}>
                      <Typography fontWeight={800}>发起展示授权申请</Typography>
                      {deliveryFileOptions.length ? (
                        <>
                          <FormControl size="small">
                            <InputLabel>选择作品</InputLabel>
                            <Select
                              multiple
                              label="选择作品"
                              value={photoAuthorizationForm.fileIds}
                              onChange={event => {
                                const value = event.target.value
                                setPhotoAuthorizationForm({
                                  ...photoAuthorizationForm,
                                  fileIds: (typeof value === 'string' ? value.split(',') : value).map(Number)
                                })
                              }}
                              renderValue={selected => selected
                                .map(fileId => deliveryFileNameMap.get(Number(fileId)) || `作品 ${fileId}`)
                                .join('、')}
                            >
                              {deliveryFileOptions.map(file => (
                                <MenuItem key={file.fileId} value={file.fileId}>
                                  {file.fileName} · {formatTime(file.uploadTime)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <TextField
                            label="申请说明"
                            value={photoAuthorizationForm.remark}
                            onChange={event => setPhotoAuthorizationForm({ ...photoAuthorizationForm, remark: event.target.value })}
                            multiline
                            minRows={2}
                            placeholder="说明希望展示这些照片的用途，例如作品集客片展示"
                          />
                          <Button
                            type="submit"
                            variant="contained"
                            startIcon={<ImageRoundedIcon />}
                            disabled={loading || !photoAuthorizationForm.fileIds.length}
                          >
                            发送授权申请
                          </Button>
                        </>
                      ) : (
                        <PortraInfoBanner>暂无可授权作品，请先上传作品。</PortraInfoBanner>
                      )}
                    </Stack>
                  </Paper>
                )}

                <Stack spacing={1}>
                  <Typography variant="overline" sx={overlineSx}>授权申请记录</Typography>
                  {photoAuthorizations.map(authorization => (
                    <AuthorizationRequestCard
                      key={authorization.id || authorization.authorizationId}
                      authorization={authorization}
                      order={selectedOrder}
                      canReview={canCustomerReviewPhotoAuthorization(selectedOrder, currentUser, authorization)}
                      loading={loading}
                      onDecision={handlePhotoAuthorizationDecision}
                      onOpenDelivery={openDeliveryBatch}
                    />
                  ))}
                  {!photoAuthorizations.length && <PortraEmptyState title="暂无照片授权申请" compact />}
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={archiveSectionSx}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h6">评价与仲裁</Typography>
                    <Typography sx={{ color: PORTRA_SURFACE.muted }}>订单完成后双方都可以评价；被评价方可对不实评价发起投诉仲裁。</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {canReviewSelectedOrder && !myReview && (
                      <Button
                        variant={showReviewForm ? 'contained' : 'outlined'}
                        startIcon={<RateReviewRoundedIcon />}
                        onClick={() => setShowReviewForm(!showReviewForm)}
                      >
                        评价
                      </Button>
                    )}
                    <Button
                      variant={showArbitrationForm ? 'contained' : 'outlined'}
                      color="inherit"
                      startIcon={<GavelRoundedIcon />}
                      onClick={() => setShowArbitrationForm(!showArbitrationForm)}
                      disabled={!reviewToComplain}
                    >
                      申请仲裁
                    </Button>
                  </Stack>
                </Stack>

                {myReview && (
                  <PortraInfoBanner>你已评价过该订单，可以在历史评价中查看。</PortraInfoBanner>
                )}
                {!reviewToComplain && (
                  <PortraInfoBanner>需收到对方评价后才可发起仲裁。</PortraInfoBanner>
                )}

                {showReviewForm && (
                  <Paper component="form" variant="outlined" onSubmit={submitReview} sx={subCardSx}>
                    <Stack spacing={1.5}>
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
                        minRows={2}
                        required
                      />
                      <Button type="submit" variant="contained" startIcon={<RateReviewRoundedIcon />} disabled={loading}>
                        提交评价
                      </Button>
                    </Stack>
                  </Paper>
                )}

                {showArbitrationForm && (
                  <Paper component="form" variant="outlined" onSubmit={submitArbitration} sx={subCardSx}>
                    <Stack spacing={1.5}>
                      <TextField
                        select
                        label="仲裁原因"
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
                        minRows={2}
                        required
                      />
                      <Button type="submit" variant="contained" color="warning" startIcon={<GavelRoundedIcon />}>
                        提交仲裁记录
                      </Button>
                    </Stack>
                  </Paper>
                )}

                <ReviewList reviews={orderReviews} emptyText="该订单还没有评价" />

                {arbitrations.length > 0 && (
                  <Stack spacing={1}>
                    <Typography variant="overline" sx={overlineSx}>仲裁记录</Typography>
                    {arbitrations.map(record => (
                      <Paper key={record.arbitrationId} variant="outlined" sx={warmNoticeSx}>
                        <Stack spacing={0.6}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                            <Typography fontWeight={800}>{record.reason}</Typography>
                            <Chip size="small" color="warning" label={complaintStatusMap[record.status] || '处理记录'} />
                          </Stack>
                          <Typography>{record.description}</Typography>
                          <Typography sx={{ color: PORTRA_SURFACE.muted }} variant="body2">
                            申请人 {record.applicantId} · 被申请人 {record.respondentId} · {formatTime(record.createdAt)}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={archiveSectionSx}>
              <Stack spacing={2}>
                <PortraTicketSection title="状态日志">
                  <PortraTimeline items={statusTimelineItems} emptyText="暂无状态日志" />
                </PortraTicketSection>
              </Stack>
            </Paper>
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

      <Dialog open={reworkDialogOpen} onClose={() => setReworkDialogOpen(false)} fullWidth maxWidth="sm">
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
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: PORTRA_SURFACE.paperMuted }}>
          <Button color="inherit" onClick={() => setReworkDialogOpen(false)}>取消</Button>
          <Button type="submit" form="order-rework-dialog-form" variant="contained" disabled={loading || !reworkRequirement.trim()}>
            提交返修
          </Button>
        </DialogActions>
      </Dialog>
    </PortraWorkflowFrame>
  )
}

const orderPageSx = {
  color: PORTRA_SURFACE.ink,
  overflowWrap: 'anywhere',
  overflowX: 'hidden'
}

const orderGridSx = {
  display: 'grid',
  width: '100%',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    lg: `${PORTRA_LAYOUT.orderSidebarWidth.lg} minmax(0, 1fr)`,
    xl: `${PORTRA_LAYOUT.orderSidebarWidth.xl} minmax(0, 1fr)`
  },
  gap: { xs: 1.6, lg: 2.75 },
  alignItems: 'start',
  minWidth: 0,
  overflowX: 'hidden'
}

const orderIndexPanelSx = {
  p: { xs: 1.6, md: 1.8 },
  alignSelf: 'start',
  minWidth: 0,
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSubtle,
  borderRadius: PORTRA_RADIUS.panel,
  boxShadow: PORTRA_SHADOW.soft
}

const orderDetailWorkspaceSx = {
  minWidth: 0,
  width: '100%',
  maxWidth: '100%',
  overflowWrap: 'anywhere'
}

const filterControlSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: PORTRA_SURFACE.paperSoft,
    borderRadius: PORTRA_RADIUS.control
  }
}

function orderIndexCardSx(selected) {
  return {
    cursor: 'pointer',
    bgcolor: selected ? PORTRA_SURFACE.portraBlueSoft : PORTRA_SURFACE.paper,
    borderColor: selected ? PORTRA_SURFACE.portraBlue : PORTRA_SURFACE.borderSoft,
    borderRadius: PORTRA_RADIUS.card,
    borderLeft: `4px solid ${selected ? PORTRA_SURFACE.portraBlue : 'transparent'}`,
    boxShadow: selected ? '0 14px 32px rgba(13, 47, 178, 0.12)' : 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
    '&:hover': {
      borderColor: PORTRA_SURFACE.portraBlue,
      transform: 'translateY(-1px)',
      boxShadow: '0 12px 26px rgba(25, 30, 45, 0.08)'
    }
  }
}

const orderArchiveHeroSx = {
  p: { xs: 2, md: 2.6 },
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSubtle,
  borderRadius: PORTRA_RADIUS.panel,
  boxShadow: PORTRA_SHADOW.soft,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 24,
    top: 0,
    width: 66,
    height: 4,
    borderRadius: 999,
    bgcolor: PORTRA_SURFACE.portraBlue
  }
}

const archiveSectionSx = {
  p: { xs: 2, md: 2.35 },
  bgcolor: PORTRA_SURFACE.paper,
  borderColor: PORTRA_SURFACE.borderSoft,
  borderRadius: PORTRA_RADIUS.panel,
  boxShadow: '0 10px 26px rgba(25, 30, 45, 0.055)'
}

const subCardSx = {
  p: 1.5,
  bgcolor: PORTRA_SURFACE.paperSoft,
  borderColor: PORTRA_SURFACE.borderSoft,
  borderRadius: PORTRA_RADIUS.card,
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.68) inset'
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

const statusChipSx = {
  borderRadius: PORTRA_RADIUS.compact,
  fontWeight: 800,
  '& .MuiChip-label': { px: 1 }
}

const returnLinkSx = {
  alignSelf: 'flex-start',
  mb: 0.8,
  ml: -0.4
}

