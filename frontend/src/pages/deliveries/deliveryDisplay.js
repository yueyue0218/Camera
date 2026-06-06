import {
  formatDeliveryDescription,
  formatDeliveryTitle,
  formatFileDisplayName
} from '../../utils/displayFormatters.js'
import { formatTime } from '../messages/utils/conversationUtils.js'
import { formatOrderStatus } from '../orders/utils/orderStatusUtils.js'

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|avif)$/i

export function buildDeliveryBatches(deliveries = [], order) {
  const groups = new Map()
  deliveries.filter(Boolean).forEach((delivery, index) => {
    const key = getBatchKey(delivery, index)
    const round = delivery.deliveryRound || delivery.round || delivery.batchId || index + 1
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        orderId: delivery.orderId || order?.orderId,
        deliveryId: getDeliveryId(delivery),
        round,
        title: Number(round) > 1 ? '摄影师重新上传了作品' : '摄影师上传了作品',
        description: formatDeliveryDescription(delivery),
        latestUploadTime: delivery.uploadTime || delivery.createdAt,
        files: []
      })
    }
    const batch = groups.get(key)
    batch.latestUploadTime = pickLatestTime(batch.latestUploadTime, delivery.uploadTime || delivery.createdAt)
    batch.files.push(normalizeDeliveryFile(delivery, batch.files.length))
  })
  return Array.from(groups.values()).map((batch, index) => ({
    ...batch,
    fileCount: batch.files.length,
    subtitle: `第 ${batch.round || index + 1} 次交付 · 最近交付：${formatTime(batch.latestUploadTime)}`,
    statusLabel: getDeliveryBatchStatusLabel(order)
  }))
}

export function findDeliveryBatch(batches = [], deliveryId) {
  const id = Number(deliveryId)
  return batches.find(batch =>
    Number(batch.deliveryId) === id
    || batch.files.some(file => Number(file.deliveryId) === id || Number(file.fileId) === id)
  ) || null
}

export function getDeliveryBatchStatusLabel(order) {
  if (!order) return '已交付'
  if (order.status === 'DELIVERED_PENDING_CONFIRM') return '待客户确认'
  if (order.status === 'REWORK_REQUIRED') return '客户已要求返修'
  if (order.status === 'COMPLETED') return '订单已完成'
  return formatOrderStatus(order.status)
}

export function normalizeDeliveryFile(delivery, index = 0) {
  const fileId = getDeliveryFileId(delivery)
  return {
    id: delivery.deliveryId || fileId || `${delivery.orderId || 'delivery'}-${index}`,
    deliveryId: delivery.deliveryId,
    orderId: delivery.orderId,
    fileId,
    fileName: formatFileDisplayName(delivery, `交付作品 ${index + 1}`),
    rawFileName: delivery.fileName || delivery.name || delivery.originalName || '',
    mimeType: delivery.mimeType || delivery.contentType || '',
    uploadTime: delivery.uploadTime || delivery.createdAt,
    remark: formatDeliveryDescription(delivery),
    source: delivery
  }
}

export function getDeliveryId(delivery) {
  return delivery?.deliveryId || delivery?.id || delivery?.fileId || null
}

export function getDeliveryFileId(fileOrDelivery) {
  const id = Number(fileOrDelivery?.fileId)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function isImageDeliveryFile(file) {
  const type = String(file?.mimeType || file?.contentType || '').toLowerCase()
  const name = String(file?.fileName || file?.rawFileName || '').toLowerCase()
  return type.startsWith('image/') || IMAGE_EXTENSIONS.test(name)
}

export function getDeliveryDownloadName(file, index = 0) {
  return formatFileDisplayName(file, `交付作品 ${index + 1}`)
}

export function getDeliveryTitleForRecord(delivery, index = 0) {
  return formatDeliveryTitle(delivery, index)
}

function getBatchKey(delivery, index) {
  if (delivery.batchId) return `batch-${delivery.batchId}`
  if (delivery.deliveryRound || delivery.round) return `round-${delivery.deliveryRound || delivery.round}`
  return `single-${delivery.deliveryId || delivery.fileId || index}`
}

function pickLatestTime(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return rightTime > leftTime ? right : left
}
