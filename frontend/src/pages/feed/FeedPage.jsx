import { useEffect, useState } from 'react'
import { Box, Alert, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { USERS, useAuth } from '../../AuthContext.jsx'
import { momentApi, readFileAsDataUrl } from '../../api.js'
import { EmptyFeedCard } from './components/EmptyFeedCard.jsx'
import { FeedSectionHeader } from './components/FeedSectionHeader.jsx'
import { FeedToolbar } from './components/FeedToolbar.jsx'
import { MomentCard } from './components/MomentCard.jsx'
import { MomentComposer } from './components/MomentComposer.jsx'
import { parseMentions } from './utils/feedUtils.js'

const FOLLOW_STORAGE_KEY = 'camera-p4-follows'
const USER_PROFILE_STORAGE_KEY = 'camera-p4-user-profiles'

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function readFollows() {
  return readJsonStorage(FOLLOW_STORAGE_KEY, [])
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

function isFollowing(authorId) {
  return readFollows().some(follow => Number(follow.authorId) === Number(authorId))
}

function toggleFollow(authorId) {
  const id = Number(authorId)
  const follows = readFollows()
  const exists = follows.some(follow => Number(follow.authorId) === id)
  const nextFollows = exists
    ? follows.filter(follow => Number(follow.authorId) !== id)
    : [{ authorId: id, followedAt: new Date().toISOString() }, ...follows]
  writeJsonStorage(FOLLOW_STORAGE_KEY, nextFollows)
  return !exists
}

export function FeedPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [moments, setMoments] = useState([])
  const [query, setQuery] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [draft, setDraft] = useState({ title: '', content: '' })
  const [mentionsText, setMentionsText] = useState('')
  const [imageData, setImageData] = useState('')
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    loadMoments()
  }, [currentUser.userId])

  async function loadMoments() {
    try {
      setMoments(await momentApi.list({ keyword: query }, currentUser))
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function chooseImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setImageData(await readFileAsDataUrl(file))
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function publishMoment() {
    setNotice(null)
    try {
      await momentApi.create({
        title: draft.title,
        content: draft.content,
        imageData,
        mentions: parseMentions(mentionsText)
      }, currentUser)
      setDraft({ title: '', content: '' })
      setMentionsText('')
      setImageData('')
      setShowComposer(false)
      setNotice({ type: 'success', text: '动态已发布' })
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function likeMoment(momentId) {
    try {
      await momentApi.like(momentId, currentUser)
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function favoriteMoment(momentId) {
    try {
      await momentApi.favorite(momentId, currentUser)
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function deleteMoment(momentId) {
    try {
      await momentApi.delete(momentId, currentUser)
      setNotice({ type: 'success', text: '动态已删除' })
      await loadMoments()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  function followAuthor(authorId) {
    toggleFollow(authorId)
    setNotice({ type: 'success', text: '关注列表已更新' })
  }

  function openMention(mention) {
    const userId = resolveMentionUserId(mention)
    return userId ? () => openUserProfile(userId) : undefined
  }

  return (
    <Stack spacing={2.5}>
      <FeedSectionHeader title="动态" subtitle="搜索动态标题和文案，发布带标题、文案和照片的动态。" />
      {notice && <Alert severity={notice.type}>{notice.text}</Alert>}
      <FeedToolbar
        query={query}
        onQueryChange={setQuery}
        onSearch={loadMoments}
        onToggleComposer={() => setShowComposer(value => !value)}
      />

      {showComposer && (
        <MomentComposer
          draft={draft}
          mentionsText={mentionsText}
          imageData={imageData}
          onDraftChange={setDraft}
          onMentionsChange={setMentionsText}
          onChooseImage={chooseImage}
          onCancel={() => setShowComposer(false)}
          onPublish={publishMoment}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {moments.map(moment => (
          <MomentCard
            key={moment.momentId}
            moment={moment}
            currentUser={currentUser}
            isFollowing={isFollowing}
            onOpenMoment={momentId => navigate(`/moments/${momentId}`)}
            onOpenProfile={openUserProfile}
            onOpenMention={openMention}
            onLike={likeMoment}
            onFavorite={favoriteMoment}
            onFollow={followAuthor}
            onDelete={deleteMoment}
          />
        ))}
      </Box>
      {!moments.length && <EmptyFeedCard text="暂无动态" />}
    </Stack>
  )
}
