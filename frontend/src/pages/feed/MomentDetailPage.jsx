import { useEffect, useState } from 'react'
import { Alert, Box, Button, Stack } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { fileApi, momentApi, userApi } from '../../api.js'
import { MomentDetailCard } from './components/MomentDetailCard.jsx'
import { FeedLoadingCard } from './components/FeedLoadingCard.jsx'

function emptyFollowState() {
  return { CUSTOMER: new Set(), PROVIDER: new Set() }
}

export function MomentDetailPage() {
  const { momentId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const currentRoleKey = String(currentUser.role || 'CUSTOMER').toUpperCase()
  const [moment, setMoment] = useState(null)
  const [authorProfile, setAuthorProfile] = useState(null)
  const [followingMap, setFollowingMap] = useState(emptyFollowState)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadAuthorProfile(detail) {
      if (!detail) return null
      if (Number(detail.authorId) === currentUser.userId) {
        return {
          nickname: currentUser.nickname || currentUser.label || `用户 ${currentUser.userId}`,
          avatarData: currentUser.avatarData || ''
        }
      }

      const authorRole = String(detail.authorRole || currentRoleKey).toUpperCase()
      try {
        const profile = await userApi.publicProfile(detail.authorId, currentUser, authorRole)
        let avatarData = ''
        if (profile?.avatarFileId) {
          try {
            avatarData = await fileApi.downloadObjectUrl(profile.avatarFileId, currentUser)
          } catch {
            avatarData = ''
          }
        }
        return { nickname: profile?.nickname || `用户 ${detail.authorId}`, avatarData }
      } catch {
        try {
          const brief = await userApi.brief(detail.authorId, currentUser)
          let avatarData = ''
          if (brief.avatarFileId) {
            try {
              avatarData = await fileApi.downloadObjectUrl(brief.avatarFileId, currentUser)
            } catch {
              avatarData = ''
            }
          }
          return { nickname: brief.nickname || `用户 ${detail.authorId}`, avatarData }
        } catch {
          return { nickname: `用户 ${detail.authorId}`, avatarData: '' }
        }
      }
    }

    async function load() {
      setNotice(null)
      try {
        const [detail, customerFollowing, providerFollowing] = await Promise.all([
          momentApi.detail(momentId, currentUser),
          userApi.following(currentUser.userId, currentUser, 'CUSTOMER'),
          userApi.following(currentUser.userId, currentUser, 'PROVIDER')
        ])
        if (cancelled) return
        setMoment(detail)
        const profile = await loadAuthorProfile(detail)
        if (!cancelled) setAuthorProfile(profile)
        const nextFollowing = emptyFollowState()
        if (Array.isArray(customerFollowing)) {
          customerFollowing.forEach(item => nextFollowing.CUSTOMER.add(Number(item.userId)))
        }
        if (Array.isArray(providerFollowing)) {
          providerFollowing.forEach(item => nextFollowing.PROVIDER.add(Number(item.userId)))
        }
        setFollowingMap(nextFollowing)
      } catch (error) {
        if (!cancelled) setNotice({ type: 'error', text: error.message })
      }
    }

    load()
    return () => { cancelled = true }
  }, [momentId, currentUser, currentRoleKey])

  async function toggleLike() {
    if (!moment) return
    try {
      const next = await momentApi.like(moment.momentId, currentUser)
      setMoment(next)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function toggleFavorite() {
    if (!moment) return
    try {
      const next = await momentApi.favorite(moment.momentId, currentUser)
      setMoment(next)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function deleteMoment() {
    if (!moment) return
    try {
      await momentApi.delete(moment.momentId, currentUser)
      navigate('/feed')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function toggleFollow(authorId, authorRole) {
    const roleKey = String(authorRole || 'CUSTOMER').toUpperCase()
    const followed = followingMap[roleKey]?.has(Number(authorId))
    try {
      if (followed) {
        await userApi.unfollow(authorId, currentUser, roleKey)
      } else {
        await userApi.follow(authorId, currentUser, roleKey)
      }
      setNotice({ type: 'success', text: followed ? '已取消关注' : '已关注' })
      const following = await userApi.following(currentUser.userId, currentUser, roleKey)
      const nextFollowing = emptyFollowState()
      if (Array.isArray(following)) {
        following.forEach(item => nextFollowing[roleKey].add(Number(item.userId)))
      }
      setFollowingMap(prev => ({
        CUSTOMER: roleKey === 'CUSTOMER' ? nextFollowing.CUSTOMER : new Set(prev.CUSTOMER),
        PROVIDER: roleKey === 'PROVIDER' ? nextFollowing.PROVIDER : new Set(prev.PROVIDER)
      }))
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const followed = moment ? followingMap[String(moment.authorRole || 'CUSTOMER').toUpperCase()]?.has(Number(moment.authorId)) : false

  return (
    <Stack spacing={2.5}>
      <Box className="moments-page__head">
        <div>
          <div className="moments-page__eyebrow">动态详情</div>
          <h1>动态详情</h1>
          <p>查看完整图片组，继续点赞、收藏或关注作者。</p>
        </div>
        <Button variant="text" onClick={() => navigate('/feed')}>返回广场</Button>
      </Box>
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      {moment ? (
        <MomentDetailCard
          moment={moment}
          authorName={authorProfile?.nickname}
          authorAvatar={authorProfile?.avatarData}
          isFollowing={followed}
          isSelf={Number(moment.authorId) === currentUser.userId}
          menuOpen={false}
          menuAnchorEl={null}
          onMenuOpen={() => {}}
          onMenuClose={() => {}}
          onOpenProfile={(authorId, authorRole) => {
            if (Number(authorId) === currentUser.userId) navigate('/profile')
            else navigate(`/users/${authorId}${authorRole ? `?role=${String(authorRole).toUpperCase()}` : ''}`)
          }}
          onLike={toggleLike}
          onFavorite={toggleFavorite}
          onFollow={toggleFollow}
          onEdit={() => navigate('/feed')}
          onDelete={deleteMoment}
        />
      ) : (
        <FeedLoadingCard compact />
      )}
    </Stack>
  )
}
