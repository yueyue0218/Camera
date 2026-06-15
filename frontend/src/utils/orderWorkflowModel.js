import { formatDateTime } from './displayFormatters.js'

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'REFUNDED'])

export function deriveOrderWorkflowState(order, options = {}) {
  if (!order) {
    return {
      phase: 'NO_ORDER',
      title: '订单待生成',
      description: '确认报价后会进入平台担保订单。',
      nextStep: '继续沟通拍摄方案。',
      tone: 'neutral'
    }
  }

  const now = options.now ? new Date(options.now) : new Date()
  const role = options.currentUserRole || ''
  const deliveries = Array.isArray(options.deliveries) ? options.deliveries : []
  const startAt = getShootStartTime(order)
  const endAt = getShootEndTime(order)
  const status = order.status || ''
  const afterStart = startAt && now >= startAt
  const afterEnd = endAt && now >= endAt
  const withinShoot = startAt && endAt && now >= startAt && now < endAt

  if (status === 'PENDING_PAYMENT') {
    return buildState('BEFORE_PAYMENT', '等待客户支付', '支付后资金将进入平台担保。', role === 'CUSTOMER' ? '去支付订单。' : '等待客户完成付款。', 'waiting')
  }

  if (status === 'PAID_PENDING_SHOOT' && withinShoot) {
    return buildState('SHOOTING_NOW', '按约定拍摄中', '当前已进入约定拍摄时间，页面会定时同步最新订单状态。', '按拍摄安排完成本次约拍。', 'primary')
  }

  if (status === 'PAID_PENDING_SHOOT' && afterEnd) {
    return buildState('WAITING_SYSTEM_SHOOT_SYNC', '拍摄状态同步中', '约定拍摄时间已结束，系统会按定时任务自动推进到待交付。', role === 'PROVIDER' ? '状态同步到待交付后再上传作品。' : '等待系统同步拍摄状态。', 'primary')
  }

  if (status === 'PAID_PENDING_SHOOT') {
    return buildState('BEFORE_SHOOT', '等待拍摄', buildShootDescription(startAt, endAt), role === 'CUSTOMER' ? '按约定时间到场拍摄。' : '按约定时间准备拍摄。', 'waiting')
  }

  if (status === 'SHOOTING') {
    return buildState('SHOOTING_NOW', '按约定拍摄中', '订单正在拍摄履约阶段，结束后等待摄影师上传作品。', '拍摄结束后上传作品。', 'primary')
  }

  if (status === 'PENDING_DELIVERY') {
    return buildState('WAITING_DELIVERY', role === 'PROVIDER' ? '请上传作品' : '等待摄影师上传作品', '拍摄结束后由摄影师上传作品，客户确认后订单完成。', role === 'PROVIDER' ? '上传本次拍摄作品。' : '等待作品上传。', 'primary')
  }

  if (status === 'DELIVERED_PENDING_CONFIRM') {
    return buildState('WAITING_CUSTOMER_CONFIRM', '作品待确认', deliveries.length ? '摄影师已上传作品，等待客户确认接收或提交返修要求。' : '订单已进入待确认，但作品记录仍在同步。', role === 'CUSTOMER' ? '确认接收或提交返修要求。' : '等待客户确认作品。', 'primary')
  }

  if (status === 'REWORK_REQUIRED') {
    return buildState('REWORKING', '返修中', '客户已提出返修要求，等待摄影师重新上传作品。', role === 'PROVIDER' ? '重新上传作品。' : '等待返修作品。', 'warning')
  }

  if (status === 'COMPLETED') {
    return buildState('COMPLETED', '订单已完成', '作品已确认，本次校园约拍合作完成。', '可以评价本次合作或处理作品授权。', 'completed')
  }

  if (status === 'CANCELLED') {
    return buildState('CANCELLED', '订单已取消', '本次订单已经结束。', '查看订单记录。', 'cancelled')
  }

  if (status === 'REFUNDED') {
    return buildState('REFUNDED', '订单已退款', '本次订单已退款结束。', '查看退款和订单记录。', 'cancelled')
  }

  if (status === 'APPEALING') {
    return buildState('DISPUTE', '争议处理中', '订单处于争议处理阶段，正常履约动作暂停。', '等待平台处理结果。', 'danger')
  }

  return buildState(TERMINAL_STATUSES.has(status) ? status : 'UNKNOWN', '订单进展已更新', '可以继续查看订单详情和状态日志。', '查看订单记录。', 'neutral')
}

export function getNextOrderWorkflowRefreshDelay(order, nowValue = new Date()) {
  const now = new Date(nowValue).getTime()
  const candidates = [getShootStartTime(order), getShootEndTime(order)]
    .map(date => date?.getTime())
    .filter(timestamp => Number.isFinite(timestamp) && timestamp > now)
    .map(timestamp => timestamp - now)
    .sort((left, right) => left - right)
  const nextDelay = candidates[0]
  if (!Number.isFinite(nextDelay) || nextDelay > 60 * 1000) return null
  return Math.max(1000, nextDelay + 250)
}

export function getShootStartTime(order) {
  return parseDate(order?.shootStartTime || order?.startTime || order?.appointmentStartTime || order?.scheduledStartTime)
}

export function getShootEndTime(order) {
  return parseDate(order?.shootEndTime || order?.endTime || order?.appointmentEndTime || order?.scheduledEndTime)
}

function buildState(phase, title, description, nextStep, tone) {
  return { phase, title, description, nextStep, tone }
}

function buildShootDescription(startAt, endAt) {
  if (!startAt && !endAt) return '平台担保资金已建立，等待双方按约定时间拍摄。'
  const startText = startAt ? formatDateTime(startAt, '') : '待同步'
  const endText = endAt ? formatDateTime(endAt, '') : '待同步'
  return `平台担保资金已建立，拍摄时间为 ${startText} 至 ${endText}。`
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
