import { useCallback, useEffect, useState } from 'react'
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { useParams } from 'react-router-dom'
import { deliveryApi, orderApi } from '../../api/index.js'
import { useAuth } from '../../AuthContext.jsx'
import { EmptyState, Feedback, PageHeader, StatusChip, formatDateTime, panelSx } from '../dline/shared.jsx'

export function DeliveryPage() {
  const { orderId } = useParams()
  const { currentUser } = useAuth()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [file, setFile] = useState(null)
  const [remark, setRemark] = useState('')
  const [feedback, setFeedback] = useState({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [orderDetail, deliveries] = await Promise.all([
        orderApi.detail(orderId, currentUser),
        deliveryApi.listByOrder(orderId, currentUser)
      ])
      setOrder(orderDetail)
      setItems(Array.isArray(deliveries) ? deliveries : [])
      setFeedback({})
    } catch (error) {
      setFeedback({ error: error.message })
    } finally {
      setLoading(false)
    }
  }, [currentUser, orderId])

  useEffect(() => {
    load()
  }, [load])

  const canUpload = currentUser.role === 'PROVIDER' && ['PENDING_DELIVERY', 'REWORK_REQUIRED'].includes(order?.status)

  async function upload(event) {
    event.preventDefault()
    if (!file) {
      setFeedback({ error: '请先选择要上传的交付文件' })
      return
    }
    setUploading(true)
    try {
      await deliveryApi.upload(orderId, file, remark, currentUser)
      setFile(null)
      setRemark('')
      setFeedback({ success: '交付文件已上传' })
      const deliveries = await deliveryApi.listByOrder(orderId, currentUser)
      setItems(Array.isArray(deliveries) ? deliveries : [])
    } catch (error) {
      setFeedback({ error: error.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box>
      <PageHeader
        eyebrow="PORTRA DELIVERY"
        title={`订单 #${orderId} 交付`}
        description={order ? `当前状态：${order.status}` : '查看并上传订单交付文件。'}
        action={<Button startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading || uploading}>刷新</Button>}
      />
      <Feedback {...feedback} />

      {loading ? <EmptyState>正在加载交付信息...</EmptyState> : null}

      {order ? (
        <Paper sx={{ ...panelSx, p: 2, mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography fontWeight={900}>{order.orderNo || `订单 ${order.orderId}`}</Typography>
            <StatusChip value={order.status} />
          </Stack>
          <Typography color="text.secondary">
            服务方 {order.providerUserId} · 需求方 {order.customerId} · 截止 {formatDateTime(order.deliveryDeadline)}
          </Typography>
        </Paper>
      ) : null}

      {canUpload ? (
        <Paper component="form" onSubmit={upload} sx={{ ...panelSx, p: 3, mb: 3, border: `2px dashed ${'#0d2fb2'}` }}>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={900}>上传交付文件</Typography>
            <Button component="label" variant="contained" startIcon={<CloudUploadRoundedIcon />}>
              选择文件
              <input hidden type="file" onChange={event => setFile(event.target.files?.[0] || null)} />
            </Button>
            <Typography color="text.secondary">{file ? `已选择：${file.name}` : '尚未选择文件'}</Typography>
            <TextField label="交付备注" value={remark} onChange={event => setRemark(event.target.value)} multiline minRows={2} />
            <Button type="submit" variant="contained" disabled={uploading || !file}>
              {uploading ? '上传中' : '上传并提交'}
            </Button>
          </Stack>
        </Paper>
      ) : order ? (
        <Paper sx={{ ...panelSx, p: 2, mb: 3 }}>
          <Typography color="text.secondary">当前身份或订单状态不允许上传交付文件。</Typography>
        </Paper>
      ) : null}

      <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>历史交付</Typography>
      {!loading && !items.length ? <EmptyState>当前订单还没有交付记录。</EmptyState> : null}
      {items.length ? (
        <Stack gap={1.5}>
          {items.map(item => (
            <Paper key={item.deliveryId} sx={{ ...panelSx, p: 2 }}>
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography fontWeight={900}>{item.fileName || `交付文件 #${item.deliveryId}`}</Typography>
                  <Typography color="text.secondary">第 {item.deliveryRound} 轮 · {formatDateTime(item.uploadTime)}</Typography>
                  <Typography mt={0.5}>{item.remark || '暂无备注'}</Typography>
                </Box>
                <StatusChip value={item.status} />
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : null}
    </Box>
  )
}
