import { AdminActionBar } from './AdminActionBar.jsx'

function roleLabel(role) {
  const normalizedRole = String(role || '').toUpperCase()
  if (normalizedRole === 'PROVIDER') return '摄影师'
  if (normalizedRole === 'ADMIN') return '管理员'
  return '客户'
}

export function AdminUserCard({ user, onOpen }) {
  const userId = Number(user?.userId ?? user?.id)
  const nickname = user?.nickname || user?.username || user?.displayName || `用户 ${userId}`
  const avatar = user?.avatarData || user?.avatarUrl || ''

  return (
    <article className="admin-user-card">
      <div className="admin-user-card-avatar" aria-hidden="true">
        {avatar ? (
          <img src={avatar} alt="" width="76" height="76" loading="lazy" />
        ) : <span>{nickname.slice(0, 1)}</span>}
      </div>
      <div className="admin-user-card-main">
        <span className="admin-user-card-id">用户 #{userId}</span>
        <h2>{nickname}</h2>
        <p>{roleLabel(user?.currentRole || user?.role)}</p>
      </div>
      <AdminActionBar actions={[{ key: 'open', label: '查看主页', onClick: onOpen }]} />
    </article>
  )
}
