import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { useAuth } from '../../AuthContext.jsx'
import {
  demandApi,
  deliveryApi,
  orderApi,
  photoAuthorizationApi,
  reviewApi,
  reviewComplaintApi
} from '../../api.js'
import { centToYuan } from '../../utils/index.js'
import {
  canCustomerConfirm,
  canCustomerPay,
  canCustomerRequestRework,
  canCustomerReviewPhotoAuthorization,
  canProviderRequestPhotoAuthorization,
  canProviderUploadDelivery,
  canShowOrderNormalActions,
  PHOTO_AUTHORIZATION_STATUS_LABELS
} from './orderActions.js'
import { EmptyOrderCard } from './components/EmptyOrderCard.jsx'
import { InfoRows } from './components/InfoRows.jsx'
import { OrdersSectionHeader } from './components/OrdersSectionHeader.jsx'
import { ReviewList } from './components/ReviewList.jsx'
import {
  addDays,
  escrowStatusMap,
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
  saveOrderSnapshots
} from './utils/orderStatusUtils.js'
function parseInputDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getOrderAction(order, currentUser) {
  const isProvider = Number(order.providerUserId) === currentUser.userId
  if (canCustomerPay(order, currentUser)) {
    return {
      kind: 'pay',
      label: '模拟支付',
      icon: <PaidRoundedIcon />,
      allowed: true,
      successText: '模拟支付成功，资金已进入平台托管'
    }
  }
  if (order.status === 'PAID_PENDING_SHOOT') {
    return {
      kind: 'transition',
      targetStatus: 'SHOOTING',
      label: '开始拍摄',
      icon: <CheckCircleRoundedIcon />,
      allowed: isProvider,
      reason: '服务方开始拍摄',
      successText: '订单已进入拍摄中'
    }
  }
  if (order.status === 'SHOOTING') {
    return {
      kind: 'transition',
      targetStatus: 'PENDING_DELIVERY',
      label: '进入待交付',
      icon: <TaskAltRoundedIcon />,
      allowed: isProvider,
      reason: '拍摄完成，进入待交付',
      successText: '订单已进入待交付'
    }
  }
  if (canCustomerConfirm(order, currentUser)) {
    return {
      kind: 'transition',
      targetStatus: 'COMPLETED',
      label: '确认完成',
      icon: <CheckCircleRoundedIcon />,
      allowed: true,
      reason: '需求方确认完成',
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
      description: '订单已支付且拍摄尚未开始，取消后平台托管资金将退回客户。',
      confirmText: '确定取消订单并申请退款吗？平台托管资金将退回客户。',
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
export function OrdersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const queryOrderId = useMemo(() => {
    const value = new URLSearchParams(location.search).get('orderId')
    return value ? Number(value) : null
  }, [location.search])
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [statusLogs, setStatusLogs] = useState([])
  const [deliveryRecords, setDeliveryRecords] = useState([])
  const [deliveryForm, setDeliveryForm] = useState({ file: null, remark: '' })
  const [reworkRequirement, setReworkRequirement] = useState('')
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
    loadOrders(queryOrderId)
  }, [currentUser.userId, currentUser.role, statusFilter, queryOrderId])

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
      const [nextOrders, nextInvitations] = await Promise.all([
        orderApi.list({
          role: currentUser.role === 'PROVIDER' ? 'provider' : 'customer',
          status: statusFilter
        }, currentUser),
        currentUser.role === 'PROVIDER' ? demandApi.sentInvitations(currentUser).catch(() => []) : Promise.resolve([])
      ])
      const roleOrders = (nextOrders || []).filter(order => currentUser.role === 'PROVIDER'
        ? Number(order.providerUserId) === Number(currentUser.userId)
        : Number(order.customerId) === Number(currentUser.userId))
      setOrders(roleOrders)
      saveOrderSnapshots(roleOrders)
      setSentInvitations(nextInvitations)
      if (focusOrderId && roleOrders.some(order => Number(order.orderId) === Number(focusOrderId))) {
        await openOrder(focusOrderId, false)
      } else if (roleOrders.length) {
        await openOrder(roleOrders[0].orderId, false)
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
    const orderId = typeof orderOrId === 'object' ? orderOrId.orderId : orderOrId
    const detail = await orderApi.detail(orderId, currentUser)
    const logs = await orderApi.statusLogs(orderId, currentUser)
    const deliveries = await deliveryApi.listByOrder(orderId, currentUser)
    const authorizations = await photoAuthorizationApi.listByOrder(orderId, currentUser)
    let reviews = getLocalReviewsByOrder(orderId)
    try {
      reviews = mergeReviewLists(await reviewApi.listByOrder(orderId, currentUser), reviews)
    } catch {
      reviews = mergeReviewLists(reviews)
    }
    let complaints = getArbitrationsByOrder(orderId)
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
    if (updateUrl) navigate(`/orders?orderId=${orderId}`, { replace: true })
  }

  async function operateOrder(action) {
    if (!selectedOrder) return
    const result = await run(async () => {
      if (action.kind === 'pay') {
        return orderApi.mockPay(selectedOrder.orderId, selectedOrder.amountCent, currentUser)
      }
      return orderApi.transition(selectedOrder.orderId, action.targetStatus, action.reason, currentUser)
    }, action.successText)
    if (result) {
      await loadOrders(selectedOrder.orderId)
    }
  }

  async function submitDelivery(event) {
    event.preventDefault()
    if (!selectedOrder || !deliveryForm.file) return
    const result = await run(async () => deliveryApi.upload(
      selectedOrder.orderId,
      deliveryForm.file,
      deliveryForm.remark.trim(),
      currentUser
    ), selectedOrder.status === 'REWORK_REQUIRED' ? '返修交付已上传' : '交付文件已上传')
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
      await loadOrders(selectedOrder.orderId)
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
    }, currentUser), '照片展示授权申请已发送')
    if (result) {
      setPhotoAuthorizationForm({ fileIds: [], remark: '' })
      setPhotoAuthorizations(await photoAuthorizationApi.listByOrder(selectedOrder.orderId, currentUser))
    }
  }

  async function handlePhotoAuthorizationDecision(authorization, decision) {
    if (!selectedOrder) return
    const remark = (authorizationRemarks[authorization.id] || '').trim()
    const action = decision === 'approve' ? photoAuthorizationApi.approve : photoAuthorizationApi.reject
    const successText = decision === 'approve' ? '已同意照片展示授权' : '已拒绝照片展示授权'
    const result = await run(async () => action(authorization.id, { remark }, currentUser), successText)
    if (result) {
      setAuthorizationRemarks({ ...authorizationRemarks, [authorization.id]: '' })
      setPhotoAuthorizations(await photoAuthorizationApi.listByOrder(selectedOrder.orderId, currentUser))
    }
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
            fileName: record.fileName || `文件 ${fileId}`,
            uploadTime: record.uploadTime
          })
        }
      })
    return Array.from(map.values())
  }, [deliveryRecords])
  const deliveryFileNameMap = useMemo(() => new Map(
    deliveryFileOptions.map(file => [Number(file.fileId), file.fileName])
  ), [deliveryFileOptions])
  const latestDeliveryUploadTime = useMemo(() => getLatestDeliveryUploadTime(deliveryRecords), [deliveryRecords])
  const estimatedAutoConfirmTime = latestDeliveryUploadTime ? addDays(latestDeliveryUploadTime, 7) : null
  const fulfillmentNotice = selectedOrder
    ? getOrderFulfillmentNotice(selectedOrder, statusLogs, deliveryRecords, latestDeliveryUploadTime, estimatedAutoConfirmTime)
    : null
  const canReviewSelectedOrder = selectedOrder?.status === 'COMPLETED' && isOrderParticipant(selectedOrder, currentUser.userId)
  const currentReviewDirection = selectedOrder ? getOrderReviewDirection(selectedOrder, currentUser.userId) : ''
  const myReview = orderReviews.find(review => Number(review.reviewerId) === currentUser.userId || review.direction === currentReviewDirection)
  const reviewToComplain = orderReviews.find(review => Number(review.targetUserId) === currentUser.userId && review.isVisible !== false)

  return (
    <Stack spacing={2.5}>
      <OrdersSectionHeader title="订单" subtitle="查看成单订单、平台托管状态和每次状态流转日志。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '350px 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, alignSelf: 'start' }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">我的订单</Typography>
              <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => loadOrders()} disabled={loading}>
                刷新
              </Button>
            </Stack>
            <FormControl size="small">
              <InputLabel>状态</InputLabel>
              <Select label="状态" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <MenuItem value="">全部</MenuItem>
                {Object.entries(orderStatusMap).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack spacing={1.2}>
              {orders.map(order => (
                <Card
                  key={order.orderId}
                  variant="outlined"
                  onClick={() => openOrder(order)}
                  sx={{ cursor: 'pointer', borderColor: selectedOrder?.orderId === order.orderId ? 'primary.main' : 'divider' }}
                >
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontWeight={800}>{order.orderNo || `订单 ${order.orderId}`}</Typography>
                        <Chip size="small" label={orderStatusMap[order.status] || order.status} />
                      </Stack>
                      <Typography color="text.secondary">{centToYuan(order.amountCent)} · 对方 {currentUser.role === 'CUSTOMER' ? order.providerUserId : order.customerId}</Typography>
                      <Typography color="text.secondary" variant="body2">{formatTime(order.updatedAt)}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {!orders.length && <EmptyOrderCard text="暂无订单" />}
            </Stack>
            {currentUser.role === 'PROVIDER' && (
              <>
                <Divider />
                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">邀请状态</Typography>
                  {sentInvitations.map(invitation => {
                    const status = invitation.status || 'PENDING'
                    return (
                      <Paper key={invitation.invitationId} variant="outlined" sx={{ p: 1.2, bgcolor: '#fbfdff' }}>
                        <Stack spacing={0.7}>
                          <Typography fontWeight={800}>{invitation.demandScene}</Typography>
                          <Typography color="text.secondary" variant="body2">{invitation.message}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip size="small" label={centToYuan(invitation.expectedPriceCent)} />
                            <Chip
                              size="small"
                              color={status === 'ACCEPTED' ? 'success' : status === 'REJECTED' ? 'default' : 'warning'}
                              label={status === 'ACCEPTED' ? '已接受，可在会话中沟通' : status === 'REJECTED' ? '已被婉拒' : '待处理'}
                            />
                          </Stack>
                        </Stack>
                      </Paper>
                    )
                  })}
                  {!sentInvitations.length && <Typography color="text.secondary">还没有发起过邀请</Typography>}
                </Stack>
              </>
            )}
          </Stack>
        </Paper>

        {!selectedOrder ? (
          <EmptyOrderCard text="选择订单查看详情" />
        ) : (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">{selectedOrder.orderNo || `订单 ${selectedOrder.orderId}`}</Typography>
                    <Typography color="text.secondary">报价 {selectedOrder.quoteId} · 会话 {selectedOrder.conversationId}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip color="primary" label={orderStatusMap[selectedOrder.status] || selectedOrder.status} />
                    <Chip color={selectedOrder.escrowStatus === 'HELD' ? 'success' : 'default'} label={escrowStatusMap[selectedOrder.escrowStatus] || selectedOrder.escrowStatus} />
                  </Stack>
                </Stack>
                <Divider />
                <InfoRows rows={[
                  ['金额', centToYuan(selectedOrder.amountCent)],
                  ['需求方', selectedOrder.customerId],
                  ['服务方', selectedOrder.providerUserId],
                  ['拍摄时间', `${formatTime(selectedOrder.shootStartTime)} 至 ${formatTime(selectedOrder.shootEndTime)}`],
                  ['交付截止', formatTime(selectedOrder.deliveryDeadline)],
                  ['结算/退款', `${selectedOrder.settlementStatus || 'NOT_SETTLED'} / ${selectedOrder.refundStatus || 'NONE'}`]
                ]} />
                {fulfillmentNotice && (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography fontWeight={900}>{fulfillmentNotice.title}</Typography>
                          <Typography color="text.secondary" variant="body2">{fulfillmentNotice.description}</Typography>
                        </Box>
                        <Chip size="small" color={fulfillmentNotice.color} label={orderStatusMap[selectedOrder.status] || selectedOrder.status} />
                      </Stack>
                      <InfoRows rows={fulfillmentNotice.rows} />
                      {fulfillmentNotice.note && <Alert severity={fulfillmentNotice.severity}>{fulfillmentNotice.note}</Alert>}
                    </Stack>
                  </Paper>
                )}
                {quoteSnapshot && (
                  <>
                    <Divider />
                    <InfoRows rows={[
                      ['拍摄地点', quoteSnapshot.location || '未填写'],
                      ['服务内容', quoteSnapshot.serviceContent || '未填写'],
                      ['原片/精修', `${quoteSnapshot.originalCount || 0} / ${quoteSnapshot.refinedCount || 0}`],
                      ['照片用途', quoteSnapshot.photoUsageScope || '未填写']
                    ]} />
                  </>
                )}
                {action && canShowOrderNormalActions(selectedOrder) ? (
                  <Button
                    variant="contained"
                    startIcon={action.icon}
                    onClick={() => operateOrder(action)}
                    disabled={loading || !action.allowed}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {action.label}
                  </Button>
                ) : (
                  <Chip icon={<TaskAltRoundedIcon />} label="当前没有可执行操作" sx={{ alignSelf: 'flex-start' }} />
                )}
                {cancelAction && (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fffaf8' }}>
                    <Stack spacing={1}>
                      <Typography fontWeight={900}>{cancelAction.title}</Typography>
                      <Typography color="text.secondary" variant="body2">{cancelAction.description}</Typography>
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
                  <Alert severity="warning">拍摄开始后不可直接取消，如有争议请走申诉或联系平台处理。</Alert>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">交付作品</Typography>
                    <Typography color="text.secondary">摄影师必须通过上传交付文件推进待确认状态，返修也从这里重新上传。</Typography>
                  </Box>
                  {canUploadDelivery && (
                    <Chip color="secondary" label={selectedOrder.status === 'REWORK_REQUIRED' ? '可上传返修交付' : '可上传交付'} />
                  )}
                </Stack>

                {canUploadDelivery && (
                  <Paper component="form" variant="outlined" onSubmit={submitDelivery} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <Button variant="outlined" component="label" startIcon={<AddPhotoAlternateRoundedIcon />}>
                          选择交付文件
                          <input
                            hidden
                            type="file"
                            onChange={event => setDeliveryForm({ ...deliveryForm, file: event.target.files?.[0] || null })}
                          />
                        </Button>
                        <Typography color="text.secondary" variant="body2">
                          {deliveryForm.file ? deliveryForm.file.name : '尚未选择文件'}
                        </Typography>
                      </Stack>
                      <TextField
                        label="交付说明"
                        value={deliveryForm.remark}
                        onChange={event => setDeliveryForm({ ...deliveryForm, remark: event.target.value })}
                        multiline
                        minRows={2}
                        placeholder="说明本次交付内容、返修修改点或注意事项"
                      />
                      <Button type="submit" variant="contained" startIcon={<TaskAltRoundedIcon />} disabled={loading || !deliveryForm.file}>
                        上传交付
                      </Button>
                    </Stack>
                  </Paper>
                )}

                {canRequestRework && (
                  <Paper component="form" variant="outlined" onSubmit={submitRework} sx={{ p: 1.5, bgcolor: '#fffaf0' }}>
                    <Stack spacing={1.5}>
                      <Typography fontWeight={800}>请写出后续返修要求</Typography>
                      <TextField
                        label="返修要求"
                        value={reworkRequirement}
                        onChange={event => setReworkRequirement(event.target.value)}
                        multiline
                        minRows={3}
                        placeholder="请说明需要返修的照片、问题和期望修改方向"
                        required
                      />
                      <Button type="submit" variant="contained" color="warning" startIcon={<RefreshRoundedIcon />} disabled={loading}>
                        请求返修
                      </Button>
                    </Stack>
                  </Paper>
                )}

                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">交付记录</Typography>
                  {deliveryRecords.map(record => (
                    <Paper key={record.deliveryId || `${record.orderId}-${record.fileId}-${record.uploadTime}`} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                      <Stack spacing={0.7}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                          <Typography fontWeight={800}>
                            {record.fileName || `文件 ${record.fileId || '-'}`}
                          </Typography>
                          <Chip size="small" label={`第 ${record.deliveryRound || 1} 次交付${record.isLatest ? ' · 最新' : ''}`} />
                        </Stack>
                        <Typography color="text.secondary" variant="body2">
                          fileId {record.fileId || '-'} · {record.status || 'DELIVERED'} · {formatTime(record.uploadTime)}
                        </Typography>
                        <Typography>{record.remark || '无交付说明'}</Typography>
                      </Stack>
                    </Paper>
                  ))}
                  {!deliveryRecords.length && <Typography color="text.secondary">暂无交付记录</Typography>}
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">照片展示授权</Typography>
                    <Typography color="text.secondary">客户同意后，摄影师才能把本订单交付照片作为真实客片展示。</Typography>
                  </Box>
                  {selectedOrder.status === 'COMPLETED' && (
                    <Chip color="success" label="订单已完成，可处理授权" />
                  )}
                </Stack>

                {canRequestPhotoAuthorization && (
                  <Paper component="form" variant="outlined" onSubmit={submitPhotoAuthorizationRequest} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <Typography fontWeight={800}>发起展示授权申请</Typography>
                      {deliveryFileOptions.length ? (
                        <>
                          <FormControl size="small">
                            <InputLabel>选择交付文件</InputLabel>
                            <Select
                              multiple
                              label="选择交付文件"
                              value={photoAuthorizationForm.fileIds}
                              onChange={event => {
                                const value = event.target.value
                                setPhotoAuthorizationForm({
                                  ...photoAuthorizationForm,
                                  fileIds: (typeof value === 'string' ? value.split(',') : value).map(Number)
                                })
                              }}
                              renderValue={selected => selected
                                .map(fileId => deliveryFileNameMap.get(Number(fileId)) || `文件 ${fileId}`)
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
                        <Alert severity="info">暂无可授权交付文件，请先完成交付。</Alert>
                      )}
                    </Stack>
                  </Paper>
                )}

                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">授权申请记录</Typography>
                  {photoAuthorizations.map(authorization => {
                    const canReviewAuthorization = canCustomerReviewPhotoAuthorization(selectedOrder, currentUser, authorization)
                    const statusLabel = PHOTO_AUTHORIZATION_STATUS_LABELS[authorization.status] || authorization.status
                    return (
                      <Paper key={authorization.id} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                        <Stack spacing={1}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Box>
                              <Typography fontWeight={800}>授权申请 {authorization.id}</Typography>
                              <Typography color="text.secondary" variant="body2">
                                服务方 {authorization.providerUserId} · 客户 {authorization.customerId}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              color={authorization.status === 'GRANTED' ? 'success' : authorization.status === 'REJECTED' ? 'default' : 'warning'}
                              label={statusLabel}
                            />
                          </Stack>
                          <Typography color="text.secondary" variant="body2">
                            {authorization.status === 'GRANTED'
                              ? '可用于作品集'
                              : authorization.status === 'REJECTED'
                                ? '客户已拒绝'
                                : '等待客户确认'}
                            {authorization.authorizedAt ? ` · ${formatTime(authorization.authorizedAt)}` : ''}
                          </Typography>
                          <Typography>{authorization.remark || '无备注'}</Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {(authorization.files || []).map(file => (
                              <Chip
                                key={file.id || file.fileId}
                                size="small"
                                icon={<ImageRoundedIcon />}
                                label={deliveryFileNameMap.get(Number(file.fileId)) || `文件 ${file.fileId}`}
                              />
                            ))}
                            {!(authorization.files || []).length && (
                              <Typography color="text.secondary" variant="body2">未返回授权文件信息</Typography>
                            )}
                          </Stack>

                          {canReviewAuthorization && (
                            <Stack spacing={1.2}>
                              <TextField
                                size="small"
                                label="处理备注（可选）"
                                value={authorizationRemarks[authorization.id] || ''}
                                onChange={event => setAuthorizationRemarks({
                                  ...authorizationRemarks,
                                  [authorization.id]: event.target.value
                                })}
                              />
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Button
                                  variant="contained"
                                  color="success"
                                  startIcon={<CheckCircleRoundedIcon />}
                                  onClick={() => handlePhotoAuthorizationDecision(authorization, 'approve')}
                                  disabled={loading}
                                >
                                  同意展示
                                </Button>
                                <Button
                                  variant="outlined"
                                  color="inherit"
                                  startIcon={<CloseRoundedIcon />}
                                  onClick={() => handlePhotoAuthorizationDecision(authorization, 'reject')}
                                  disabled={loading}
                                >
                                  拒绝展示
                                </Button>
                              </Stack>
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    )
                  })}
                  {!photoAuthorizations.length && <Typography color="text.secondary">暂无照片授权申请</Typography>}
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">评价与仲裁</Typography>
                    <Typography color="text.secondary">订单完成后双方都可以评价；被评价方可对不实评价发起投诉仲裁。</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
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
                  <Alert severity="success">你已评价过该订单，可以在历史评价中查看。</Alert>
                )}
                {!reviewToComplain && (
                  <Alert severity="info">收到对方评价后，才可以对该评价发起仲裁。</Alert>
                )}

                {showReviewForm && (
                  <Paper component="form" variant="outlined" onSubmit={submitReview} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.2} alignItems="center">
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
                  <Paper component="form" variant="outlined" onSubmit={submitArbitration} sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
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
                    <Typography variant="overline" color="text.secondary">仲裁记录</Typography>
                    {arbitrations.map(record => (
                      <Paper key={record.arbitrationId} variant="outlined" sx={{ p: 1.5, bgcolor: '#fffaf0' }}>
                        <Stack spacing={0.6}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Typography fontWeight={800}>{record.reason}</Typography>
                            <Chip size="small" color="warning" label={record.status === 'PENDING' ? '待处理' : record.status} />
                          </Stack>
                          <Typography>{record.description}</Typography>
                          <Typography color="text.secondary" variant="body2">
                            申请人 {record.applicantId} · 被申请人 {record.respondentId} · {formatTime(record.createdAt)}
                          </Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Typography variant="h6">状态日志</Typography>
                {statusLogs.map(log => (
                  <Paper key={log.logId || `${log.orderId}-${log.createdAt}`} variant="outlined" sx={{ p: 1.5, bgcolor: '#fbfdff' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography fontWeight={800}>
                          {orderStatusMap[log.fromStatus] || log.fromStatus || '创建'} → {orderStatusMap[log.toStatus] || log.toStatus}
                        </Typography>
                        <Typography color="text.secondary">{log.reason || '状态流转'}</Typography>
                      </Box>
                      <Typography color="text.secondary" variant="body2">{formatTime(log.createdAt)}</Typography>
                    </Stack>
                  </Paper>
                ))}
                {!statusLogs.length && <Typography color="text.secondary">暂无状态日志</Typography>}
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>
    </Stack>
  )
}

