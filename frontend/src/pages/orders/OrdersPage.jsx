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
import { deriveOrderWorkflowState, getNextOrderWorkflowRefreshDelay } from '../../utils/orderWorkflowModel.js'
import { getOrderActionVisibility } from '../../utils/orderActionVisibility.js'
import { useWorkflowNavigate } from '../../hooks/useWorkflowNavigate.js'
import { useWorkflowDraft } from '../../hooks/useWorkflowDraft.js'
import { buildWorkflowCacheKey, readWorkflowViewState, writeWorkflowViewState } from '../../utils/workflowViewCache.js'
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
import { PORTRA_RADIUS, PORTRA_SHADOW, PORTRA_SURFACE } from '../../theme/portraSurfaceTokens.js'
import {
  canCustomerConfirm,
  canCustomerReviewPhotoAuthorization,
  canShowOrderNormalActions
} from './orderActions.js'
import { EmptyOrderCard } from './components/EmptyOrderCard.jsx'
import { InfoRows } from './components/InfoRows.jsx'
import { OrderCurrentTaskCard } from './components/OrderCurrentTaskCard.jsx'
import { OrderDeliverySummaryCard } from './components/OrderDeliverySummaryCard.jsx'
import { OrderSectionCard } from './components/OrderSectionCard.jsx'
import { OrderSummaryCard } from './components/OrderSummaryCard.jsx'
import { OrderTimelineCard } from './components/OrderTimelineCard.jsx'
import { ReviewList } from './components/ReviewList.jsx'
import { DeliveryFileGrid } from '../deliveries/components/DeliveryFileGrid.jsx'
import { DeliveryUploadPanel } from '../deliveries/components/DeliveryUploadPanel.jsx'
import { buildDeliveryBatches, flattenDeliveryFiles, isAuthorizableDeliveryFile } from '../deliveries/deliveryDisplay.js'
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
  getOrderReviewDirection,
  getReviewTargetUserId,
  isApiUnavailable,
  isOrderParticipant,
  mergeComplaints,
  mergeReviewLists,
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

function getOrderPerspective(order, currentUser) {
  if (!order || !currentUser) return ''
  if (Number(order.customerId) === Number(currentUser.userId)) return '客户'
  if (Number(order.providerUserId) === Number(currentUser.userId)) return '摄影师'
  return '协作方'
}

function getCounterpartyLabel(order, currentUser) {
  if (!order || !currentUser) return '对方未确认'
  if (Number(order.customerId) === Number(currentUser.userId)) {
    return '摄影师'
  }
  if (Number(order.providerUserId) === Number(currentUser.userId)) {
    return '客户'
  }
  return '订单参与方'
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

function orderStatusDotSx(status) {
  return {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
    bgcolor: getOrderStatusDotColor(status)
  }
}

function getOrderStatusDotColor(status) {
  if (['COMPLETED'].includes(status)) return '#4fbd78'
  if (['CANCELLED', 'REFUNDED'].includes(status)) return '#c4cedd'
  if (['PENDING_DELIVERY', 'DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'APPEALING'].includes(status)) return '#f05a24'
  return PORTRA_SURFACE.portraBlue
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

function buildOrderMetaText(order, counterpartyLabel, locationLabel) {
  const timeText = formatOrderTimeRange(order)
  return [counterpartyLabel, timeText, locationLabel].filter(Boolean).join(' · ')
}

function buildOrderSummaryRows({ order, quoteSnapshot, deliveryText, estimatedAutoConfirmTime }) {
  if (estimatedAutoConfirmTime) {
    return [
      {
        label: '交付内容',
        value: deliveryText || '按约定交付'
      },
      {
        label: '照片用途',
        value: formatPhotoUsageScope(quoteSnapshot?.photoUsageScope)
      },
      {
        label: '结算状态',
        value: formatEscrowStatus(order?.escrowStatus)
      },
      {
        label: '自动确认',
        value: formatShortDateTime(estimatedAutoConfirmTime)
      }
    ]
  }

  return [
    {
      label: '成片截止',
      value: formatTime(order?.deliveryDeadline),
      tone: isDeadlineClose(order?.deliveryDeadline) ? 'warning' : undefined
    },
    {
      label: '交付内容',
      value: deliveryText || '按约定交付'
    },
    {
      label: '结算状态',
      value: formatEscrowStatus(order?.escrowStatus)
    },
    {
      label: '照片用途',
      value: formatPhotoUsageScope(quoteSnapshot?.photoUsageScope)
    }
  ]
}

function formatDeliveryBatchContent(batch) {
  if (!batch) return '等待上传'
  const imageCount = Number(batch.imageCount || 0)
  const zipCount = Number(batch.zipCount || 0)
  const parts = []
  if (imageCount) parts.push(`${imageCount} 张图片`)
  if (zipCount) parts.push(`${zipCount} 个压缩包`)
  return parts.length ? parts.join(' · ') : '已上传作品'
}

function getLatestDeliveryBatch(batches = []) {
  return [...batches].sort((left, right) => {
    const leftTime = left?.latestUploadTime ? new Date(left.latestUploadTime).getTime() : 0
    const rightTime = right?.latestUploadTime ? new Date(right.latestUploadTime).getTime() : 0
    return rightTime - leftTime
  })[0] || null
}

function formatDeadlineDistance(value) {
  const deadline = parseInputDate(value)
  if (!deadline) return '未设置截止时间'
  const diff = deadline.getTime() - Date.now()
  if (diff <= 0) return '已到截止时间'
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  if (days > 0) return `${days} 天 ${remainHours} 小时`
  if (hours > 0) return `${hours} 小时`
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)))
  return `${minutes} 分钟`
}

function formatShortDateTime(value) {
  const date = parseInputDate(value)
  if (!date) return '待同步'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

function isDeadlineClose(value) {
  const deadline = parseInputDate(value)
  if (!deadline) return false
  return deadline.getTime() - Date.now() < 24 * 60 * 60 * 1000
}

function formatAuthorizationSummary(records = []) {
  if (!records.length) return '暂无申请'
  const latest = records[0]
  const status = String(latest.status || latest.authorizationStatus || '').toUpperCase()
  if (status === 'APPROVED' || status === 'GRANTED') return '已同意'
  if (status === 'REJECTED') return '已拒绝'
  return '待客户确认'
}

function buildOrderProgressItems({ order, statusLogs = [], deliveryRecords = [], currentUser }) {
  const status = order?.status || ''
  const hasDelivery = deliveryRecords.length > 0 || ['DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED'].includes(status)
  const isCustomer = Number(order?.customerId) === Number(currentUser?.userId)
  const completedStatuses = new Set(['COMPLETED'])
  const refundedOrCancelled = ['CANCELLED', 'REFUNDED'].includes(status)
  const steps = [
    {
      id: 'payment',
      title: '支付成功',
      complete: status !== 'PENDING_PAYMENT',
      time: findStatusTime(statusLogs, ['PAID_PENDING_SHOOT', 'SHOOTING', 'PENDING_DELIVERY', 'DELIVERED_PENDING_CONFIRM', 'COMPLETED'])
    },
    {
      id: 'shoot-start',
      title: '拍摄开始',
      complete: ['SHOOTING', 'PENDING_DELIVERY', 'DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED'].includes(status),
      current: status === 'SHOOTING',
      time: formatShortDateTime(order?.shootStartTime)
    },
    {
      id: 'shoot-end',
      title: '拍摄结束',
      complete: ['PENDING_DELIVERY', 'DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED'].includes(status),
      current: status === 'PENDING_DELIVERY',
      time: formatShortDateTime(order?.shootEndTime)
    },
    {
      id: 'delivery',
      title: hasDelivery ? '摄影师上传作品' : '待上传作品',
      complete: hasDelivery,
      current: status === 'PENDING_DELIVERY',
      time: hasDelivery ? findStatusTime(statusLogs, ['DELIVERED_PENDING_CONFIRM', 'REWORK_REQUIRED', 'COMPLETED']) : ''
    },
    {
      id: 'confirm',
      title: isCustomer ? '待你确认' : '待客户确认',
      complete: completedStatuses.has(status),
      current: status === 'DELIVERED_PENDING_CONFIRM',
      time: completedStatuses.has(status) ? findStatusTime(statusLogs, ['COMPLETED']) : ''
    },
    {
      id: 'complete',
      title: refundedOrCancelled ? formatOrderStatus(status) : '订单完成',
      complete: completedStatuses.has(status) || refundedOrCancelled,
      current: completedStatuses.has(status) || refundedOrCancelled,
      time: completedStatuses.has(status) || refundedOrCancelled ? findStatusTime(statusLogs, [status]) : ''
    }
  ]

  return steps.map(step => ({
    ...step,
    state: step.current ? 'current' : step.complete ? 'complete' : 'upcoming'
  }))
}

function findStatusTime(statusLogs = [], statuses = []) {
  const match = statusLogs.find(log => statuses.includes(log.toStatus))
  return match?.createdAt ? formatTime(match.createdAt) : ''
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

export function OrdersPage() {
  const location = useLocation()
  const navigate = useWorkflowNavigate()
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
  const [reworkDialogOpen, setReworkDialogOpen] = useState(false)
  const [deliveryUploadDialogOpen, setDeliveryUploadDialogOpen] = useState(false)
  const [photoAuthorizationDialogOpen, setPhotoAuthorizationDialogOpen] = useState(false)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [previewDelivery, setPreviewDelivery] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [photoAuthorizations, setPhotoAuthorizations] = useState([])
  const [orderReviews, setOrderReviews] = useState([])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [arbitrations, setArbitrations] = useState([])
  const [showArbitrationForm, setShowArbitrationForm] = useState(false)
  const [sentInvitations, setSentInvitations] = useState([])
  const statusFilter = ''
  const [pageLoading, setPageLoading] = useState(false)
  const feedback = usePortraFeedback()
  const orderDraftScope = `order:${selectedOrder?.orderId || focusOrderId || 'none'}`
  const deliveryDraft = useWorkflowDraft(`${orderDraftScope}:delivery`, createDeliveryDraft, isDeliveryDraftDirty)
  const reworkDraft = useWorkflowDraft(`${orderDraftScope}:rework`, () => '', value => String(value || '').trim().length > 0)
  const photoAuthorizationDraft = useWorkflowDraft(`${orderDraftScope}:photo-authorization`, createPhotoAuthorizationDraft, isPhotoAuthorizationDraftDirty)
  const authorizationRemarkDraft = useWorkflowDraft(`${orderDraftScope}:authorization-remarks`, () => ({}), hasAuthorizationRemarkDraft)
  const reviewDraft = useWorkflowDraft(`${orderDraftScope}:review`, createReviewDraft, isReviewDraftDirty)
  const arbitrationDraft = useWorkflowDraft(`${orderDraftScope}:arbitration`, createArbitrationDraft, isArbitrationDraftDirty)
  const deliveryForm = deliveryDraft.value || createDeliveryDraft()
  const setDeliveryForm = deliveryDraft.setValue
  const reworkRequirement = reworkDraft.value || ''
  const setReworkRequirement = reworkDraft.setValue
  const photoAuthorizationForm = photoAuthorizationDraft.value || createPhotoAuthorizationDraft()
  const setPhotoAuthorizationForm = photoAuthorizationDraft.setValue
  const authorizationRemarks = authorizationRemarkDraft.value || {}
  const setAuthorizationRemarks = authorizationRemarkDraft.setValue
  const reviewForm = reviewDraft.value || createReviewDraft()
  const setReviewForm = reviewDraft.setValue
  const arbitrationForm = arbitrationDraft.value || createArbitrationDraft()
  const setArbitrationForm = arbitrationDraft.setValue
  const { run: runWorkflowAction, loading: actionLoading } = usePortraAsyncAction({
    errorMessage: error => error?.message || '操作失败，请稍后重试。'
  })
  const loading = pageLoading || actionLoading
  const viewCacheKey = buildWorkflowCacheKey('orders', currentUser.userId, currentUser.role)

  useEffect(() => {
    const cached = readWorkflowViewState(viewCacheKey)
    if (!cached) return
    if (Array.isArray(cached.orders)) setOrders(cached.orders)
    if (cached.selectedOrder) setSelectedOrder(cached.selectedOrder)
    if (Array.isArray(cached.statusLogs)) setStatusLogs(cached.statusLogs)
    if (Array.isArray(cached.deliveryRecords)) setDeliveryRecords(cached.deliveryRecords)
    if (Array.isArray(cached.photoAuthorizations)) setPhotoAuthorizations(cached.photoAuthorizations)
    if (Array.isArray(cached.orderReviews)) setOrderReviews(cached.orderReviews)
    if (Array.isArray(cached.arbitrations)) setArbitrations(cached.arbitrations)
  }, [viewCacheKey])

  useEffect(() => {
    loadOrders(focusOrderId)
  }, [currentUser.userId, currentUser.role, statusFilter, focusOrderId, orderListSurface])

  useEffect(() => {
    writeWorkflowViewState(viewCacheKey, {
      orders,
      selectedOrder,
      statusLogs,
      deliveryRecords,
      photoAuthorizations,
      orderReviews,
      arbitrations
    })
  }, [viewCacheKey, orders, selectedOrder, statusLogs, deliveryRecords, photoAuthorizations, orderReviews, arbitrations])

  useEffect(() => {
    if (!selectedOrder?.orderId) return undefined
    const refreshCurrentOrder = () => loadOrders(selectedOrder.orderId)
    const intervalId = window.setInterval(refreshCurrentOrder, 30000)
    const refreshDelay = getNextOrderWorkflowRefreshDelay(selectedOrder)
    const timeoutId = refreshDelay ? window.setTimeout(refreshCurrentOrder, refreshDelay) : null
    return () => {
      window.clearInterval(intervalId)
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [
    selectedOrder?.orderId,
    selectedOrder?.status,
    selectedOrder?.shootStartTime,
    selectedOrder?.shootEndTime,
    selectedOrder?.startTime,
    selectedOrder?.endTime,
    currentUser.userId,
    currentUser.role
  ])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function run(action, successText) {
    return runWorkflowAction(action, {
      successMessage: successText
    })
  }

  async function loadOrders(focusOrderId = selectedOrder?.orderId, options = {}) {
    const { preserveDrafts = true } = options
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
        await openOrder(focusedOrder || focusOrderId, false, { preserveDrafts })
      } else if (roleOrders.length && !orderListSurface) {
        await openOrder(roleOrders[0], false, { preserveDrafts })
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

  async function openOrder(orderOrId, updateUrl = true, options = {}) {
    const { preserveDrafts = false } = options
    const orderId = normalizeOrderId(typeof orderOrId === 'object' ? orderOrId.orderId : orderOrId)
    const fallbackOrder = typeof orderOrId === 'object' ? orderOrId : orders.find(order => Number(order.orderId) === Number(orderId))
    if (!orderId) {
      feedback.warning('订单信息暂时不可用，请刷新后重试。')
      return false
    }
    setPageLoading(true)
    try {
      let detail = fallbackOrder || null
      try {
        detail = await orderApi.detail(orderId, currentUser) || detail
      } catch (error) {
        if (!detail || (!isApiUnavailable(error) && error.status !== 403 && error.status !== 404)) throw error
        feedback.warning('订单详情接口暂时不可用，已先展示订单列表中的档案信息。')
      }
      if (!detail) {
        feedback.warning('订单信息暂时不可用，请刷新后重试。')
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
      setPhotoAuthorizations(authorizations)
      setOrderReviews(reviews)
      setArbitrations(complaints)
      if (!preserveDrafts) {
        deliveryDraft.clearDraft()
        reworkDraft.clearDraft()
        photoAuthorizationDraft.clearDraft()
        authorizationRemarkDraft.clearDraft()
        reviewDraft.clearDraft()
        arbitrationDraft.clearDraft()
        setReworkDialogOpen(false)
        setDeliveryUploadDialogOpen(false)
        setPhotoAuthorizationDialogOpen(false)
        setShowReviewForm(false)
        setShowArbitrationForm(false)
      }
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
      feedback.error(error.message || '订单详情暂时无法打开，请刷新后重试。')
      return false
    } finally {
      setPageLoading(false)
    }
  }

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
    }, '评价投诉已提交')
    if (result) {
      setArbitrations(mergeComplaints([result], arbitrations, getArbitrationsByOrder(selectedOrder.orderId)))
      setShowArbitrationForm(false)
      arbitrationDraft.clearDraft()
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
    setShowReviewForm(false)
    setShowArbitrationForm(false)
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
        message: '当前投诉说明尚未提交，关闭后将丢弃已填写内容。确定关闭吗？'
      })
      if (confirmed) setShowArbitrationForm(false)
      return
    }
    setShowArbitrationForm(true)
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
  const reviewToComplain = orderReviews.find(review => Number(review.targetUserId) === currentUser.userId && review.isVisible !== false)
  const selectedOrderPerspective = selectedOrder ? getOrderPerspective(selectedOrder, currentUser) : ''
  const selectedCounterpartyLabel = selectedOrder ? getCounterpartyLabel(selectedOrder, currentUser) : ''
  const selectedOrderLocation = quoteSnapshot?.location || selectedOrder?.shootLocation || '未填写'
  const selectedOrderServiceContent = sanitizeSeedText(quoteSnapshot?.serviceContent || selectedOrder?.serviceContent, '校园约拍服务')
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
  const canReturnToConversation = Boolean(explicitReturnToConversation)
  const canContactCounterparty = !canReturnToConversation && Boolean(selectedOrderConversationId)
  useEffect(() => {
    if (!location.state?.openReview || !selectedOrder?.orderId || !canReviewSelectedOrder || myReview) return
    setShowReviewForm(true)
    feedback.info('评价功能入口已打开')
  }, [location.state, selectedOrder?.orderId, canReviewSelectedOrder, myReview, feedback])

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
    setSelectedOrder(null)
    setStatusLogs([])
    setDeliveryRecords([])
    setPhotoAuthorizations([])
    setOrderReviews([])
    setArbitrations([])
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

            <OrderSectionCard
              title="展示授权"
              description="客户同意后，摄影师才能将本订单作品作为客片展示。"
              trailing={(
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Chip size="small" label={formatAuthorizationSummary(photoAuthorizations)} />
                  {canRequestPhotoAuthorization && (
                    <Button variant="outlined" size="small" startIcon={<ImageRoundedIcon />} onClick={() => setPhotoAuthorizationDialogOpen(true)}>
                      申请展示授权
                    </Button>
                  )}
                </Stack>
              )}
            >
              <Stack spacing={1}>
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
            </OrderSectionCard>

            <OrderSectionCard
              title="评价与投诉"
              description="订单完成后可评价本次合作；收到对方评价后，可对不实评价发起投诉。"
              trailing={(
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {canReviewSelectedOrder && !myReview && (
                    <Button
                      variant={showReviewForm ? 'contained' : 'outlined'}
                      size="small"
                      startIcon={<RateReviewRoundedIcon />}
                      onClick={toggleReviewForm}
                    >
                      评价
                    </Button>
                  )}
                  <Button
                    variant={showArbitrationForm ? 'contained' : 'outlined'}
                    size="small"
                    color="inherit"
                    startIcon={<GavelRoundedIcon />}
                    onClick={toggleArbitrationForm}
                    disabled={!reviewToComplain}
                  >
                    投诉评价
                  </Button>
                </Stack>
              )}
            >
              <Stack spacing={2}>

                {myReview && (
                  <PortraInfoBanner>你已评价过该订单，可以在历史评价中查看。</PortraInfoBanner>
                )}
                {!reviewToComplain && (
                  <PortraInfoBanner>需收到对方评价后才可发起评价投诉。</PortraInfoBanner>
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
                        label="投诉原因"
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
                        提交投诉记录
                      </Button>
                    </Stack>
                  </Paper>
                )}

                <ReviewList reviews={orderReviews} emptyText="该订单还没有评价" />

                {arbitrations.length > 0 && (
                  <Stack spacing={1}>
                    <Typography variant="overline" sx={overlineSx}>投诉记录</Typography>
                    {arbitrations.map(record => (
                      <Paper key={record.arbitrationId} variant="outlined" sx={warmNoticeSx}>
                        <Stack spacing={0.6}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                            <Typography fontWeight={800}>{record.reason}</Typography>
                            <Chip size="small" color="warning" label={complaintStatusMap[record.status] || '处理记录'} />
                          </Stack>
                          <Typography>{record.description}</Typography>
                          <Typography sx={{ color: PORTRA_SURFACE.muted }} variant="body2">
                            提交时间：{formatTime(record.createdAt)}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </OrderSectionCard>
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
            <PortraInfoBanner>仅可选择图片作品用于展示授权，压缩包不会用于公开展示。</PortraInfoBanner>
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
              <PortraInfoBanner>暂无可授权的图片作品，请先上传图片交付文件。</PortraInfoBanner>
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
  color: PORTRA_SURFACE.ink,
  overflowWrap: 'anywhere',
  overflowX: 'hidden',
  bgcolor: '#f3f6fb',
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
  overflowX: 'hidden'
}

const orderIndexPanelSx = {
  p: { xs: 1.6, md: 2 },
  alignSelf: 'start',
  minWidth: 0,
  minHeight: { lg: 'calc(100dvh - 88px)' },
  bgcolor: '#fff',
  borderColor: 'transparent',
  borderRight: { lg: '1px solid rgba(133, 148, 173, .18)' },
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
  overflowWrap: 'anywhere'
}

function OrderIndexSkeleton() {
  return (
    <Stack spacing={1.2} aria-label="订单索引加载中">
      {[0, 1, 2].map(index => (
        <Paper key={index} variant="outlined" sx={{ p: 1.4, borderRadius: PORTRA_RADIUS.card, borderColor: PORTRA_SURFACE.borderSoft, bgcolor: PORTRA_SURFACE.paper }}>
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
    bgcolor: selected ? '#eaf2ff' : '#fff',
    borderColor: 'transparent',
    borderRadius: 0,
    borderLeft: `4px solid ${selected ? PORTRA_SURFACE.portraBlue : 'transparent'}`,
    boxShadow: 'none',
    transition: 'background-color 140ms ease, border-color 140ms ease',
    '&:hover': {
      bgcolor: selected ? '#eaf2ff' : '#f6f8fc'
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

const returnLinkSx = {
  alignSelf: 'flex-start',
  mb: 0.8,
  ml: -0.4
}

