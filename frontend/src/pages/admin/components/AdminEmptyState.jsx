export function AdminEmptyState({
  title = '暂无内容',
  description = '',
  pending = false,
  action = null
}) {
  return (
    <div className={`admin-empty-state${pending ? ' admin-empty-state--pending' : ''}`} role="status">
      <span className="admin-empty-mark" aria-hidden="true">{pending ? '…' : '○'}</span>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        {action}
      </div>
    </div>
  )
}
