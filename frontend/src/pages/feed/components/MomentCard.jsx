import { Avatar, Box, Button, Card, CardActions, CardContent, IconButton, Stack, Typography } from '@mui/material'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import { formatTime, roleMap } from '../utils/feedUtils.js'
import { MentionChip } from './MentionChip.jsx'

// 按小红书规则将原始比例匹配到最近的标准展示比例
function matchFeedRatio(naturalWidth, naturalHeight) {
  const r = naturalWidth / naturalHeight
  if (r <= 0.8) return '3/4'
  if (r < 1.25) return '1/1'
  return '4/3'
}

function FeedImage({ src, alt, onClick }) {
  if (!src) return null
  return (
    <Box
      sx={{
        width: '100%',
        overflow: 'hidden',
        bgcolor: 'grey.100',
        cursor: onClick ? 'pointer' : 'default',
        '& img': { aspectRatio: 'var(--feed-ratio, 4/3)', transition: 'aspect-ratio 0s' }
      }}
      onClick={onClick}
    >
      <Box
        component="img"
        src={src}
        alt={alt}
        onLoad={e => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget
          e.currentTarget.style.aspectRatio = matchFeedRatio(w, h)
        }}
        sx={{
          width: '100%',
          aspectRatio: '4/3',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block'
        }}
      />
    </Box>
  )
}

export function MomentCard({
  moment,
  currentUser,
  authorProfile,
  isFollowing,
  onOpenMoment,
  onOpenProfile,
  onOpenMention,
  onLike,
  onFavorite,
  onFollow,
  onDelete
}) {
  const displayName = authorProfile?.nickname || `${roleMap[moment.authorRole] || '用户'} ${moment.authorId}`
  const avatarSrc = authorProfile?.avatarData || undefined

  return (
    <Card variant="outlined">
      {(() => {
        const cover = moment.imageDataList?.[0] || moment.imageData
        const total = moment.imageDataList?.length || (moment.imageData ? 1 : 0)
        if (!cover) return null
        return (
          <Box sx={{ position: 'relative' }}>
            <FeedImage src={cover} alt="动态照片" onClick={() => onOpenMoment(moment.momentId)} />
            {total > 1 && (
              <Box sx={{
                position: 'absolute', top: 8, right: 8,
                bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                borderRadius: 999, px: 1, py: 0.25,
                fontSize: 12, fontWeight: 700, lineHeight: 1.6,
                pointerEvents: 'none'
              }}>
                1/{total}
              </Box>
            )}
          </Box>
        )
      })()}
      <CardContent>
        <Stack spacing={1.2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar
              src={avatarSrc}
              onClick={() => onOpenProfile(moment.authorId)}
              sx={{ cursor: 'pointer' }}
            >
              {displayName.slice(0, 1)}
            </Avatar>
            <Box sx={{ cursor: 'pointer' }} onClick={() => onOpenProfile(moment.authorId)}>
              <Typography fontWeight={800}>{displayName}</Typography>
              <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
            </Box>
          </Stack>
          <Typography
            variant="h6"
            onClick={() => onOpenMoment(moment.momentId)}
            sx={{ cursor: 'pointer' }}
          >
            {moment.title || '未命名动态'}
          </Typography>
          <Typography>{moment.content || '分享了一张照片'}</Typography>
          {!!moment.mentions?.length && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {moment.mentions.map(mention => (
                <MentionChip key={mention} mention={mention} onOpen={onOpenMention(mention)} />
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
      <CardActions>
        <IconButton color={moment.likedByCurrentUser ? 'secondary' : 'default'} onClick={() => onLike(moment.momentId)}>
          {moment.likedByCurrentUser ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}
        </IconButton>
        <Typography color="text.secondary">{moment.likeCount} 个赞</Typography>
        <Button size="small" onClick={() => onFavorite(moment.momentId)}>
          {moment.favoritedByCurrentUser ? '已收藏' : '收藏'} {moment.favoriteCount || 0}
        </Button>
        {Number(moment.authorId) !== currentUser.userId && (
          <Button size="small" onClick={() => onFollow(moment.authorId)}>
            {isFollowing(moment.authorId) ? '已关注' : '关注作者'}
          </Button>
        )}
        <Button size="small" onClick={() => onOpenMoment(moment.momentId)}>详情</Button>
        {Number(moment.authorId) === currentUser.userId && (
          <Button size="small" color="error" startIcon={<DeleteRoundedIcon />} onClick={() => onDelete(moment.momentId)}>
            删除
          </Button>
        )}
      </CardActions>
    </Card>
  )
}
