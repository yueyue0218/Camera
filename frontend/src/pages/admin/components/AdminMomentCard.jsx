import { AdminActionBar } from './AdminActionBar.jsx'
import { AdminStatusTag } from './AdminStatusTag.jsx'

const countFormatter = new Intl.NumberFormat('zh-CN')

export function AdminMomentCard({ moment, onOpen, onOpenAuthor, onTakeDown, onRestore }) {
  const status = String(moment?.moderationStatus || 'VISIBLE').toUpperCase()
  const image = moment?.imageDataList?.[0] || moment?.imageData
  const actions = [
    { key: 'detail', label: '查看详情', onClick: onOpen },
    { key: 'author', label: '查看作者', disabled: !onOpenAuthor, hint: onOpenAuthor ? '' : '作者信息不可用', onClick: onOpenAuthor },
    { key: 'take-down', label: '下架动态', danger: true, disabled: status !== 'VISIBLE', onClick: onTakeDown },
    { key: 'restore', label: '恢复展示', disabled: status !== 'HIDDEN', onClick: onRestore }
  ]
  return <article className="admin-moment-card">
    <header className="admin-moment-card-heading"><span>No. {String(moment?.momentId).padStart(6, '0')}</span><AdminStatusTag status={status} /></header>
    <div className="admin-moment-card-body"><div className="admin-moment-content"><h2>{moment?.title || '未命名动态'}</h2><p>{moment?.content || '暂无文字内容。'}</p>
      {image ? <img src={image} alt={moment?.title || '动态图片'} width="640" height="360" loading="lazy" /> : null}
      <div className="admin-moment-counts"><span>{countFormatter.format(Number(moment?.likeCount) || 0)} 个赞</span><span>{countFormatter.format(Number(moment?.favoriteCount) || 0)} 个收藏</span></div><p>作者 #{moment?.authorId} · 待处理举报 {moment?.pendingReportCount ?? 0}</p>
    </div></div><footer className="admin-moment-card-actions"><AdminActionBar actions={actions} /></footer>
  </article>
}
