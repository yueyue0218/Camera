import { Avatar, Box, IconButton, Menu, MenuItem, Paper, Typography } from '@mui/material'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded'
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import { useEffect, useMemo, useRef, useState } from 'react'

function roleLabel(role) {
  return role === 'PROVIDER' ? '摄影师' : '客户'
}

function formatTime(value) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function imageList(moment) {
  return moment.imageDataList?.length
    ? moment.imageDataList
    : moment.imageData ? [moment.imageData] : []
}

export function MomentDetailCard({
  moment,
  authorName,
  authorAvatar,
  isFollowing,
  isSelf,
  menuOpen,
  menuAnchorEl,
  onMenuOpen,
  onMenuClose,
  onOpenProfile,
  onLike,
  onFavorite,
  onFollow,
  onEdit,
  onDelete,
  canFollow = true
}) {
  const momentId = Number(moment.momentId ?? moment.id ?? moment.postId)
  const images = useMemo(() => imageList(moment), [moment])
  const sliderRef = useRef(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (sliderRef.current) {
      sliderRef.current.scrollTo({ left: 0, behavior: 'auto' })
    }
  }, [momentId, images.length])

  function scrollToIndex(nextIndex) {
    if (!sliderRef.current || !images.length) return
    const bounded = Math.max(0, Math.min(nextIndex, images.length - 1))
    const width = sliderRef.current.clientWidth
    sliderRef.current.scrollTo({ left: width * bounded, behavior: 'smooth' })
    setIndex(bounded)
  }

  function handleScroll() {
    if (!sliderRef.current || !images.length) return
    const width = sliderRef.current.clientWidth || 1
    const nextIndex = Math.round(sliderRef.current.scrollLeft / width)
    setIndex(Math.max(0, Math.min(nextIndex, images.length - 1)))
  }

  return (
    <Paper className="moment-detail" elevation={0}>
      <div className="moment-detail__header">
        <div className="moment-detail__serial">No. {String(momentId).padStart(6, '0')}</div>
        <div className="moment-detail__stamp">PORTRA FILE</div>
      </div>

      <div className="moment-detail__author">
        <div className="moment-detail__avatar-chip" onClick={() => onOpenProfile(moment.authorId, moment.authorRole)}>
          <Avatar src={authorAvatar || undefined} className="moment-detail__avatar">
            {(authorName || roleLabel(moment.authorRole)).slice(0, 1)}
          </Avatar>
        </div>
        <Box className="moment-detail__author-meta" onClick={() => onOpenProfile(moment.authorId, moment.authorRole)}>
          <strong>{authorName || `${roleLabel(moment.authorRole)} ${moment.authorId}`}</strong>
        </Box>
        <div className="moment-detail__meta-time">{formatTime(moment.createdAt)}</div>
        {canFollow && !isSelf && (
          <button
            type="button"
            className={`moment-detail__follow ${isFollowing ? 'is-following' : ''}`}
            onClick={() => onFollow(moment.authorId, moment.authorRole)}
            aria-pressed={isFollowing}
          >
            {isFollowing ? '已关注' : '关注'}
          </button>
        )}
        {isSelf && (
          <div className="moment-detail__menu-wrap">
            <IconButton className="moment-detail__menu-btn" onClick={event => onMenuOpen(event, momentId)}>
              <MoreHorizRoundedIcon fontSize="small" />
            </IconButton>
            <Menu
              open={menuOpen}
              anchorEl={menuAnchorEl}
              onClose={onMenuClose}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <MenuItem onClick={() => { onMenuClose(); onEdit(moment); }}>
                <EditRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                编辑动态
              </MenuItem>
              <MenuItem onClick={() => { onMenuClose(); onDelete(moment); }} sx={{ color: 'error.main' }}>
                <DeleteRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                删除动态
              </MenuItem>
            </Menu>
          </div>
        )}
      </div>

      <Typography className="moment-detail__title">{moment.title || '未命名动态'}</Typography>
      <Typography className="moment-detail__content">{moment.content || '分享了一段被放慢的生活。'}</Typography>

      {images.length > 0 && (
        <div className="moment-detail__viewer" aria-label="动态图片">
          <div className="moment-detail__counter">{index + 1}/{images.length}</div>
          {images.length > 1 && (
            <IconButton
              className="moment-detail__nav moment-detail__nav--prev"
              onClick={() => scrollToIndex(index - 1)}
              disabled={index === 0}
              aria-label="上一张"
            >
              <ArrowBackIosNewRoundedIcon fontSize="small" />
            </IconButton>
          )}
          {images.length > 1 && (
            <IconButton
              className="moment-detail__nav moment-detail__nav--next"
              onClick={() => scrollToIndex(index + 1)}
              disabled={index === images.length - 1}
              aria-label="下一张"
            >
              <ArrowForwardIosRoundedIcon fontSize="small" />
            </IconButton>
          )}
          <div ref={sliderRef} className="moment-detail__slides" onScroll={handleScroll}>
            {images.map((src, imageIndex) => (
              <figure key={`${momentId}-${imageIndex}`} className="moment-detail__slide">
                <img src={src} alt={`${moment.title || '动态'} ${imageIndex + 1}`} />
              </figure>
            ))}
          </div>
          <div className="moment-detail__hint">使用左右按钮查看图片</div>
        </div>
      )}

      <div className="moment-detail__actions">
        <button
          type="button"
          className={`moment-action like ${moment.likedByCurrentUser ? 'active' : ''}`}
          onClick={() => onLike(momentId)}
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
      </div>
    </Paper>
  )
}
