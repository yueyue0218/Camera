import { AdminActionBar } from './AdminActionBar.jsx'
import { AdminStatusTag } from './AdminStatusTag.jsx'

const countFormatter = new Intl.NumberFormat('zh-CN')

function momentIdOf(moment) {
  return Number(moment?.momentId ?? moment?.id ?? moment?.postId)
}

function roleLabel(role) {
  return String(role || '').toUpperCase() === 'PROVIDER' ? '摄影师' : '客户'
}

function formatTime(value) {
  if (!value) return '时间未知'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '时间未知'
    : date.toLocaleString('zh-CN', { hour12: false })
}

function firstImage(moment) {
  if (Array.isArray(moment?.imageDataList) && moment.imageDataList.length) {
    return moment.imageDataList[0]
  }
  return moment?.imageData || ''
}

export function AdminMomentCard({ moment, author = {}, onOpen, onOpenAuthor }) {
  const momentId = momentIdOf(moment)
  const authorName = author.nickname || `用户 ${moment.authorId}`
  const coverImage = firstImage(moment)
  const actions = [
    { key: 'detail', label: '查看详情', onClick: onOpen },
    {
      key: 'author',
      label: '查看作者',
      disabled: !onOpenAuthor,
      hint: onOpenAuthor ? '' : '作者信息不可用',
      onClick: onOpenAuthor
    },
    { key: 'take-down', label: '下架动态', disabled: true, hint: '接口待接入', danger: true },
    { key: 'restore', label: '恢复展示', disabled: true, hint: '接口待接入' }
  ]

  return (
    <article className="admin-moment-card">
      <header className="admin-moment-card-heading">
        <span>No. {String(momentId).padStart(6, '0')}</span>
        <AdminStatusTag status="PUBLIC" />
      </header>

      <div className="admin-moment-card-body">
        <aside className="admin-moment-author">
          <div className="admin-moment-avatar" aria-hidden="true">
            {author.avatarData ? (
              <img src={author.avatarData} alt="" width="72" height="72" loading="lazy" />
            ) : <span>{authorName.slice(0, 1)}</span>}
          </div>
          <strong>{authorName}</strong>
          <span>{roleLabel(moment.authorRole)}</span>
          <time dateTime={moment.createdAt || undefined}>{formatTime(moment.createdAt)}</time>
        </aside>

        <div className="admin-moment-content">
          <div className="admin-moment-stamp">PORTRA FILE</div>
          <h2>{moment.title || '未命名动态'}</h2>
          <p>{moment.content || '暂无文字内容。'}</p>
          <div className={coverImage ? 'admin-moment-cover' : 'admin-moment-cover is-empty'}>
            {coverImage ? (
              <img
                src={coverImage}
                alt={moment.title || '动态图片'}
                width="640"
                height="360"
                loading="lazy"
              />
            ) : (
              <span>暂无图片</span>
            )}
          </div>
          <div className="admin-moment-counts" aria-label="互动数据">
            <span>{countFormatter.format(Number(moment.likeCount) || 0)} 个赞</span>
            <span>{countFormatter.format(Number(moment.favoriteCount) || 0)} 个收藏</span>
          </div>
        </div>
      </div>

      <footer className="admin-moment-card-actions">
        <AdminActionBar actions={actions} />
      </footer>
    </article>
  )
}
