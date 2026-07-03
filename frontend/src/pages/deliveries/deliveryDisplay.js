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
        title: Number(round) > 1 ? `第 ${round} 次作品` : '交付作品',
        description: formatDeliveryDescription(delivery),
        latestUploadTime: delivery.uploadTime || delivery.createdAt,
        files: []
      })
    }
    const batch = groups.get(key)
    batch.latestUploadTime = pickLatestTime(batch.latestUploadTime, delivery.uploadTime || delivery.createdAt)
    flattenFilesFromDelivery(delivery).forEach(file => {
      batch.files.push(normalizeDeliveryFile(file, batch.files.length))
    })
  })
  return Array.from(groups.values()).map((batch, index) => {
    const round = batch.round || index + 1
    const fileCount = batch.files.length
    const imageCount = batch.files.filter(isImageDeliveryFile).length
    const zipCount = batch.files.filter(isZipDeliveryFile).length
    const latest = formatTime(batch.latestUploadTime)
    const countText = formatDeliveryFileCount(imageCount, zipCount, fileCount)
    return {
      ...batch,
      round,
      fileCount,
      imageCount,
      zipCount,
      subtitle: `最近上传：${latest} · ${countText}`,
      orderSubtitle: `最近上传：${latest} · ${countText}`,
      messageSubtitle: `最近上传：${latest} · ${countText}`,
      statusLabel: getDeliveryBatchStatusLabel(order)
    }
  })
}

export function findDeliveryBatch(batches = [], deliveryId) {
  const id = Number(deliveryId)
  return batches.find(batch =>
    Number(batch.deliveryId) === id
    || batch.files.some(file => Number(file.deliveryId) === id || Number(file.fileId) === id)
  ) || null
}

export function getDeliveryBatchStatusLabel(order) {
  if (!order) return '已上传作品'
  if (order.status === 'DELIVERED_PENDING_CONFIRM') return '待客户确认'
  if (order.status === 'REWORK_REQUIRED') return '客户已要求返修'
  if (order.status === 'COMPLETED') return '订单已完成'
  return formatOrderStatus(order.status)
}

export function normalizeDeliveryFile(delivery, index = 0) {
  const fileId = getDeliveryFileId(delivery)
  return {
    id: delivery.id || `${delivery.deliveryId || delivery.orderId || 'delivery'}-${fileId || index}`,
    deliveryId: delivery.deliveryId,
    orderId: delivery.orderId,
    fileId,
    fileName: formatFileDisplayName(delivery, `作品 ${index + 1}`),
    rawFileName: delivery.fileName || delivery.name || delivery.originalName || '',
    mimeType: delivery.mimeType || delivery.contentType || '',
    fileSize: delivery.fileSize,
    fileType: delivery.fileType,
    sortOrder: delivery.sortOrder,
    uploadTime: delivery.uploadTime || delivery.createdAt,
    remark: formatDeliveryDescription(delivery),
    source: delivery
  }
}

export function flattenDeliveryFiles(deliveries = []) {
  return deliveries.filter(Boolean).flatMap((delivery, index) => flattenFilesFromDelivery(delivery, index))
}

export function getDeliveryId(delivery) {
  return delivery?.deliveryId || delivery?.id || delivery?.fileId || null
}

export function getDeliveryFileId(fileOrDelivery) {
  const id = Number(fileOrDelivery?.fileId)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function isImageDeliveryFile(file) {
  if (String(file?.fileType || '').toUpperCase() === 'IMAGE') return true
  if (String(file?.fileType || '').toUpperCase() === 'ZIP') return false
  const type = String(file?.mimeType || file?.contentType || '').toLowerCase()
  const name = String(file?.fileName || file?.rawFileName || '').toLowerCase()
  return type.startsWith('image/') || IMAGE_EXTENSIONS.test(name)
}

export function isZipDeliveryFile(file) {
  const fileType = String(file?.fileType || '').toUpperCase()
  const type = String(file?.mimeType || file?.contentType || '').toLowerCase()
  const name = String(file?.fileName || file?.rawFileName || '').toLowerCase()
  return fileType === 'ZIP' || type.includes('zip') || /\.zip$/i.test(name)
}

export function isAuthorizableDeliveryFile(file) {
  return isImageDeliveryFile(file)
}

export function getDeliveryDownloadName(file, index = 0) {
  return formatFileDisplayName(file, `作品 ${index + 1}`)
}

export function getDeliveryTitleForRecord(delivery, index = 0) {
  return formatDeliveryTitle(delivery, index)
}

function getBatchKey(delivery, index) {
  if (delivery.deliveryId || delivery.id) return `delivery-${delivery.deliveryId || delivery.id}`
  if (delivery.batchId) return `batch-${delivery.batchId}`
  if (delivery.deliveryRound || delivery.round) return `round-${delivery.deliveryRound || delivery.round}`
  return `single-${delivery.deliveryId || delivery.fileId || index}`
}

function pickLatestTime(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return rightTime > leftTime ? right : left
}

function flattenFilesFromDelivery(delivery, fallbackIndex = 0) {
  if (Array.isArray(delivery?.files) && delivery.files.length) {
    return delivery.files.map((file, index) => ({
      ...delivery,
      ...file,
      deliveryId: delivery.deliveryId || delivery.id,
      orderId: delivery.orderId,
      uploadTime: delivery.uploadTime || delivery.createdAt,
      remark: delivery.remark,
      id: file.id || `${delivery.deliveryId || delivery.id || fallbackIndex}-${file.fileId || index}`
    }))
  }
  return [delivery]
}

function formatDeliveryFileCount(imageCount, zipCount, totalCount) {
  const parts = []
  if (imageCount) parts.push(`${imageCount} 张图片`)
  if (zipCount) parts.push(`${zipCount} 个压缩包`)
  const otherCount = Math.max(0, totalCount - imageCount - zipCount)
  if (otherCount) parts.push(`${otherCount} 个文件`)
  return parts.length ? parts.join(' / ') : '暂无文件'
}
