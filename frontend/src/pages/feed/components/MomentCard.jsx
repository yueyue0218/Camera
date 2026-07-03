import { Avatar, IconButton, Menu, MenuItem, Paper } from '@mui/material'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded'
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'

function roleLabel(role) {
  return role === 'PROVIDER' ? '摄影师' : '客户'
}

function formatTime(value) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function MomentCard({
  moment,
  authorName,
  authorAvatar,
  isFollowing,
  isSelf,
  menuOpen,
  menuAnchorEl,
  onMenuOpen,
  onMenuClose,
  onOpenMoment,
  onOpenProfile,
  onLike,
  onFavorite,
  onFollow,
  onEdit,
  onDelete,
  canFollow = true
}) {
  const momentId = Number(moment.momentId ?? moment.id ?? moment.postId)
  const images = moment.imageDataList?.length
    ? moment.imageDataList
    : moment.imageData ? [moment.imageData] : []
  const coverImage = images[0] || ''

  return (
    <Paper className="moment-card" elevation={0}>
      <div className="moment-card__side">
        <div className="moment-card__serial">No. {String(momentId).padStart(6, '0')}</div>
        <div className="moment-card__avatar-shell" onClick={() => onOpenProfile(moment.authorId, moment.authorRole)}>
          <Avatar src={authorAvatar || undefined} className="moment-card__avatar">
            {(authorName || roleLabel(moment.authorRole)).slice(0, 1)}
          </Avatar>
        </div>
        <div className="moment-card__author" onClick={() => onOpenProfile(moment.authorId, moment.authorRole)}>
          <strong>{authorName || `${roleLabel(moment.authorRole)} ${moment.authorId}`}</strong>
        </div>
        <div className="moment-card__meta-time">{formatTime(moment.createdAt)}</div>
        {canFollow && !isSelf && (
          <button
            type="button"
            className={`moment-card__follow ${isFollowing ? 'is-following' : ''}`}
            onClick={() => onFollow(moment.authorId, moment.authorRole)}
            aria-pressed={isFollowing}
          >
            {isFollowing ? '已关注' : '关注'}
          </button>
        )}
      </div>

      <div className="moment-card__main">
        <div className="moment-card__stamp">PORTRA FILE</div>
        <h2 onClick={() => onOpenMoment(moment)}>{moment.title || '未命名动态'}</h2>
        <p>{moment.content || '分享了一段被放慢的生活。'}</p>

        <div className={`moment-card__image ${coverImage ? '' : 'is-empty'}`} onClick={() => onOpenMoment(moment)}>
          {coverImage ? (
            <img src={coverImage} alt={moment.title || '动态封面'} />
          ) : (
            <div className="moment-card__image-placeholder">
              <span>PORTRA FILE</span>
              <strong>暂无图片</strong>
            </div>
          )}
        </div>

        <div className="moment-card__actions">
          <button
            type="button"
            className={`moment-action like ${moment.likedByCurrentUser ? 'active' : ''}`}
            onClick={() => onLike(momentId)}
            aria-pressed={moment.likedByCurrentUser}
          >
            {moment.likedByCurrentUser ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}
            <span>{moment.likeCount || 0}</span>
          </button>
          <button
            type="button"
            className={`moment-action save ${moment.favoritedByCurrentUser ? 'active' : ''}`}
            onClick={() => onFavorite(momentId)}
          >
            {moment.favoritedByCurrentUser ? <BookmarkRoundedIcon /> : <BookmarkBorderRoundedIcon />}
            <span>{moment.favoriteCount || 0}</span>
          </button>

          <div className="moment-card__menu-wrap">
            <IconButton
              className="moment-card__menu-btn"
              onClick={event => onMenuOpen(event, momentId)}
              aria-label="更多"
            >
              <MoreHorizRoundedIcon fontSize="small" />
            </IconButton>
            <Menu
              open={menuOpen}
              anchorEl={menuAnchorEl}
              onClose={onMenuClose}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              {isSelf && (
                <MenuItem onClick={() => { onMenuClose(); onEdit(moment) }}>
                  <EditRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                  编辑动态
                </MenuItem>
              )}
              {isSelf && (
                <MenuItem onClick={() => { onMenuClose(); onDelete(moment) }} sx={{ color: 'error.main' }}>
                  <DeleteRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                  删除动态
                </MenuItem>
              )}
              {!isSelf && <MenuItem onClick={() => onOpenMoment(moment)}>查看详情</MenuItem>}
            </Menu>
          </div>
        </div>
      </div>
    </Paper>
  )
}
