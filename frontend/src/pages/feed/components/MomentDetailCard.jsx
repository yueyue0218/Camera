import { Avatar, Box, Button, Paper, Stack, Typography } from '@mui/material'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded'
import { formatTime, roleMap } from '../utils/feedUtils.js'
import { MentionChip } from './MentionChip.jsx'

// 详情页：保留原始比例，全宽展示，不裁剪，白底填充
function DetailImage({ src, alt }) {
  if (!src) return null
  return (
    <Box sx={{ width: '100%', bgcolor: '#fff', lineHeight: 0 }}>
      <Box
        component="img"
        src={src}
        alt={alt}
        sx={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </Box>
  )
}

export function MomentDetailCard({ moment, currentUser, authorProfile, onProfile, onOpenMention, onLike, onFavorite, onDelete }) {
  const displayName = authorProfile?.nickname || `${roleMap[moment.authorRole] || '用户'} ${moment.authorId}`
  const avatarSrc = authorProfile?.avatarData || undefined

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={1.6}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Avatar
            src={avatarSrc}
            onClick={onProfile}
            sx={{ cursor: 'pointer', bgcolor: moment.authorRole === 'PROVIDER' ? 'secondary.main' : 'primary.main' }}
          >
            {displayName.slice(0, 1)}
          </Avatar>
          <Box onClick={onProfile} sx={{ cursor: 'pointer', minWidth: 0 }}>
            <Typography fontWeight={900}>{displayName}</Typography>
            <Typography color="text.secondary" variant="body2">{formatTime(moment.createdAt)}</Typography>
          </Box>
        </Stack>
        <Typography variant="h5">{moment.title || '未命名动态'}</Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{moment.content || '分享了一张照片'}</Typography>
        {(() => {
          const images = moment.imageDataList?.length
            ? moment.imageDataList
            : moment.imageData ? [moment.imageData] : []
          return images.map((src, i) => (
            <DetailImage key={i} src={src} alt={`${moment.title || '动态照片'} ${images.length > 1 ? `(${i + 1}/${images.length})` : ''}`} />
          ))
        })()}
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
