import { DemandCard } from '../../hall/components/DemandCard.jsx'
import { ServicePackageCard } from '../../hall/components/ServicePackageCard.jsx'
import { AdminActionBar } from './AdminActionBar.jsx'
import { AdminStatusTag } from './AdminStatusTag.jsx'

export function AdminHallCard({ item, currentUser, onOpen, onOpenPublisher }) {
  const isDemand = item.type === 'demand'
  const contentLabel = isDemand ? '约拍需求' : '服务橱窗'
  const actions = [
    { key: 'detail', label: '查看详情', onClick: onOpen },
    {
      key: 'publisher',
      label: '查看发布者',
      disabled: !onOpenPublisher,
      hint: onOpenPublisher ? '' : '发布者信息不可用',
      onClick: onOpenPublisher
    },
    { key: 'take-down', label: '下架', disabled: true, hint: '接口待接入' },
    { key: 'restore', label: '恢复展示', disabled: true, hint: '接口待接入' }
  ]

  return (
    <article className="admin-hall-card" data-content-type={item.type}>
      <header className="admin-hall-card-heading">
        <span>{contentLabel} · #{item.id}</span>
        <AdminStatusTag status="PUBLIC" />
      </header>
      <div className="admin-hall-card-content">
        {isDemand ? (
          <DemandCard demand={item.record} currentUser={currentUser} onOpen={onOpen} />
        ) : (
          <ServicePackageCard service={item.record} currentUser={currentUser} onDetail={onOpen} />
        )}
      </div>
      <footer className="admin-hall-card-actions">
        <AdminActionBar actions={actions} />
      </footer>
    </article>
  )
}
