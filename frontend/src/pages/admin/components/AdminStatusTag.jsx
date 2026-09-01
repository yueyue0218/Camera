const statusLabels = {
  PUBLIC: '公开展示',
  PENDING: '待处理',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  RESOLVED: '已处理',
  REMOVED: '已下架',
  PENDING_API: '接口待接入'
}

export function AdminStatusTag({ status = 'PENDING_API', label = '' }) {
  const normalizedStatus = String(status || 'PENDING_API').toUpperCase()
  return (
    <span className={`admin-status-tag admin-status-tag--${normalizedStatus.toLowerCase()}`}>
      {label || statusLabels[normalizedStatus] || status}
    </span>
  )
}
