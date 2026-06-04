import { Avatar, Box, Button, Paper, Stack, Typography } from '@mui/material'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import { formatTime, roleMap } from '../utils/feedUtils.js'
import { MentionChip } from './MentionChip.jsx'

export function MomentDetailCard({ moment, currentUser, onProfile, onOpenMention, onLike, onFavorite, onDelete }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={1.6}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Avatar onClick={onProfile} sx={{ cursor: 'pointer', bgcolor: moment.authorRole === 'PROVIDER' ? 'secondary.main' : 'primary.main' }}>
            {roleMap[moment.authorRole]?.slice(0, 1) || '用'}
          </Avatar>
          <Box onClick={onProfile} sx={{ cursor: 'pointer', minWidth: 0 }}>
            <Typography fontWeight={900}>{roleMap[moment.authorRole] || '用户'} {moment.authorId}</Typography>
            <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
          </Box>
        </Stack>
        <Typography variant="h5">{moment.title || '未命名动态'}</Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{moment.content || '分享了一张照片'}</Typography>
        {moment.imageData && <img className="feed-image" src={moment.imageData} alt={moment.title || '动态照片'} />}
        {!!moment.mentions?.length && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {moment.mentions.map(mention => (
              <MentionChip key={mention} mention={mention} onOpen={onOpenMention(mention)} />
            ))}
          </Stack>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button variant="outlined" startIcon={moment.likedByCurrentUser ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />} onClick={onLike}>
            {moment.likeCount || 0} 个赞
          </Button>
          <Button variant="outlined" onClick={onFavorite}>
            {moment.favoritedByCurrentUser ? '已收藏' : '收藏'} {moment.favoriteCount || 0}
          </Button>
          {Number(moment.authorId) === currentUser.userId && (
            <Button variant="outlined" color="error" startIcon={<DeleteRoundedIcon />} onClick={onDelete}>
              删除
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  )
}
