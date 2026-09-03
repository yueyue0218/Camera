import { AdminActionBar } from './AdminActionBar.jsx'
import { AdminStatusTag } from './AdminStatusTag.jsx'

export function AdminHallCard({ item, onOpen, onOpenPublisher, onTakeDown, onRestore }) {
  const type = String(item?.type || '').toUpperCase()
  const status = String(item?.moderationStatus || item?.status || 'VISIBLE').toUpperCase()
  const actions = [
    { key: 'detail', label: '查看详情', onClick: onOpen },
    { key: 'publisher', label: '查看发布者', disabled: !onOpenPublisher, hint: onOpenPublisher ? '' : '发布者信息不可用', onClick: onOpenPublisher },
    { key: 'take-down', label: '下架', danger: true, disabled: status !== 'VISIBLE', onClick: onTakeDown },
    { key: 'restore', label: '恢复展示', disabled: status !== 'HIDDEN', onClick: onRestore }
  ]
  return (
    <article className="admin-hall-card" data-content-type={type}>
      <header className="admin-hall-card-heading"><span>{type === 'DEMAND' ? '约拍需求' : '服务橱窗'} · #{item.id}</span><AdminStatusTag status={status} /></header>
      <div className="admin-hall-card-content">
        {item.coverImage ? <img src={item.coverImage} alt="" width="640" height="360" loading="lazy" /> : null}
        <h2>{item.title || '未命名内容'}</h2><p>{item.description || '暂无内容说明。'}</p>
        <p>发布者 #{item.publisherId} · {item.cityCode || '地点未提供'} · {item.scene || '场景未提供'}</p><p>待处理举报 {item.pendingReportCount ?? 0}</p>
      </div>
      <footer className="admin-hall-card-actions"><AdminActionBar actions={actions} /></footer>
    </article>
  )
}
