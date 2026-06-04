import { Avatar, Box, Button, Card, CardActions, CardContent, IconButton, Stack, Typography } from '@mui/material'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import { formatTime, roleMap } from '../utils/feedUtils.js'
import { MentionChip } from './MentionChip.jsx'

export function MomentCard({
  moment,
  currentUser,
  isFollowing,
  onOpenMoment,
  onOpenProfile,
  onOpenMention,
  onLike,
  onFavorite,
  onFollow,
  onDelete
}) {
  return (
    <Card variant="outlined">
      {moment.imageData && (
        <Box
          component="img"
          className="feed-image"
          src={moment.imageData}
          alt="动态照片"
          onClick={() => onOpenMoment(moment.momentId)}
          sx={{ cursor: 'pointer' }}
        />
      )}
      <CardContent>
        <Stack spacing={1.2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar
              onClick={() => onOpenProfile(moment.authorId)}
              sx={{ cursor: 'pointer' }}
            >
              {roleMap[moment.authorRole]?.slice(0, 1) || '用'}
            </Avatar>
            <Box sx={{ cursor: 'pointer' }} onClick={() => onOpenProfile(moment.authorId)}>
              <Typography fontWeight={800}>{roleMap[moment.authorRole] || '用户'} {moment.authorId}</Typography>
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
        <Button size="small" onClick={() => onFollow(moment.authorId)}>
          {isFollowing(moment.authorId) ? '已关注' : '关注作者'}
        </Button>
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
