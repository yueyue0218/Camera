import { useEffect, useState } from 'react'
import {
  demandApi,
  deliveryApi,
  orderApi,
  photoAuthorizationApi,
  reviewApi,
  reviewComplaintApi
} from '../../../api.js'
import { buildOrderNavigationTarget, normalizeOrderId } from '../../../utils/orderNavigation.js'
import { ORDER_SURFACES, WORKFLOW_SOURCES } from '../../../utils/workflowNavigation.js'
import { getNextOrderWorkflowRefreshDelay } from '../../../utils/orderWorkflowModel.js'
import { buildWorkflowCacheKey, readWorkflowViewState, writeWorkflowViewState } from '../../../utils/workflowViewCache.js'
import {
  getArbitrationsByOrder,
  getLocalReviewsByOrder,
  isApiUnavailable,
  mergeComplaints,
  mergeReviewLists,
  saveOrderSnapshots
} from '../utils/orderStatusUtils.js'

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

export function useOrdersData({
  currentUser,
  focusOrderId,
  statusFilter = '',
  orderListSurface,
  location,
  navigate,
  explicitReturnToConversation,
  feedback,
  run,
  onResetOrderUi
}) {
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [statusLogs, setStatusLogs] = useState([])
  const [deliveryRecords, setDeliveryRecords] = useState([])
  const [photoAuthorizations, setPhotoAuthorizations] = useState([])
  const [orderReviews, setOrderReviews] = useState([])
  const [arbitrations, setArbitrations] = useState([])
  const [sentInvitations, setSentInvitations] = useState([])
  const [pageLoading, setPageLoading] = useState(false)
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

  async function loadOrders(nextFocusOrderId = selectedOrder?.orderId, options = {}) {
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
      if (nextFocusOrderId && roleOrders.some(order => Number(order.orderId) === Number(nextFocusOrderId))) {
        const focusedOrder = roleOrders.find(order => Number(order.orderId) === Number(nextFocusOrderId))
        await openOrder(focusedOrder || nextFocusOrderId, false, { preserveDrafts })
      } else if (roleOrders.length && !orderListSurface) {
        await openOrder(roleOrders[0], false, { preserveDrafts })
      } else {
        clearOrderSelection()
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
        onResetOrderUi?.()
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

  function clearOrderSelection() {
    setSelectedOrder(null)
    setStatusLogs([])
    setDeliveryRecords([])
    setPhotoAuthorizations([])
    setOrderReviews([])
    setArbitrations([])
  }

  return {
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
    setPageLoading,
    loadOrders,
    openOrder,
    clearOrderSelection
  }
}
