import { useEffect, useState } from 'react'
import { Alert, Button, Stack } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { USERS, useAuth } from '../../AuthContext.jsx'
import { momentApi } from '../../api.js'
import { EmptyFeedCard } from './components/EmptyFeedCard.jsx'
import { FeedSectionHeader } from './components/FeedSectionHeader.jsx'
import { MomentDetailCard } from './components/MomentDetailCard.jsx'

const USER_PROFILE_STORAGE_KEY = 'camera-p4-user-profiles'

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function readUserProfiles() {
  return readJsonStorage(USER_PROFILE_STORAGE_KEY, {})
}

function openUserProfile(userId) {
  const id = Number(userId)
  if (!id) return
  window.open(new URL(`/users/${id}`, window.location.origin).toString(), '_blank', 'noopener,noreferrer')
}

function resolveMentionUserId(mention) {
  const value = String(mention || '').replace(/^@+/, '').trim()
  if (!value) return null
  if (/^\d+$/.test(value)) return Number(value)
  const profiles = readUserProfiles()
  const storedMatch = Object.entries(profiles).find(([, profile]) => profile?.nickname === value)
  if (storedMatch) return Number(storedMatch[0])
  const demoMatch = Object.values(USERS).find(user => user.nickname === value || user.label === value)
  return demoMatch?.userId || null
}

export function MomentDetailPage() {
  const { momentId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [moments, setMoments] = useState([])
  const [receivedReviews, setReceivedReviews] = useState([])
  const [showReviews, setShowReviews] = useState(false)
  const [creditSummary, setCreditSummary] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    loadMoments()
  }, [momentId, currentUser.userId])

  async function loadMoments() {
    try {
      const [detail, list] = await Promise.all([
        momentApi.detail(momentId, currentUser).catch(() => null),
        momentApi.list({}, currentUser)
      ])
      const selectedId = Number(momentId)
      const selected = detail || list.find(moment => Number(moment.momentId) === selectedId)
      setMoments(selected ? [selected, ...list.filter(moment => Number(moment.momentId) !== Number(selected.momentId))] : list)
      setNotice(null)
      if (!selected) setNotice({ type: 'warning', text: '该动态不存在或已被删除，先展示最新动态。' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function likeMoment(id) {
    try {
      await momentApi.like(id, currentUser)
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function favoriteMoment(id) {
    try {
      await momentApi.favorite(id, currentUser)
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function deleteMoment(id) {
    try {
      await momentApi.delete(id, currentUser)
      setNotice({ type: 'success', text: '动态已删除' })
      navigate('/feed')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  function openMention(mention) {
    const userId = resolveMentionUserId(mention)
    return userId ? () => openUserProfile(userId) : undefined
  }

  return (
    <Stack spacing={2.5}>
      <FeedSectionHeader title="动态详情" subtitle="查看完整动态，继续下滑浏览更多人的动态详情。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <Button variant="text" color="inherit" onClick={() => navigate('/feed')} sx={{ alignSelf: 'flex-start' }}>返回动态</Button>
      <Stack spacing={2.5}>
        {moments.map(moment => {
          const isSelf = Number(moment.authorId) === currentUser.userId
          const stored = readUserProfiles()[String(moment.authorId)] || {}
          const authorProfile = {
            nickname: isSelf
              ? (currentUser.nickname || currentUser.label)
              : (stored.nickname || moment.authorNickname),
            avatarData: isSelf
              ? currentUser.avatarData
              : (stored.avatarData || moment.authorAvatarData)
          }
          return (
            <MomentDetailCard
              key={moment.momentId}
              moment={moment}
              currentUser={currentUser}
              authorProfile={authorProfile}
              onProfile={() => openUserProfile(moment.authorId)}
              onOpenMention={openMention}
              onLike={() => likeMoment(moment.momentId)}
              onFavorite={() => favoriteMoment(moment.momentId)}
              onDelete={() => deleteMoment(moment.momentId)}
            />
          )
        })}
      </Stack>
      {!moments.length && <EmptyFeedCard text="暂无动态" />}
    </Stack>
  )
}
