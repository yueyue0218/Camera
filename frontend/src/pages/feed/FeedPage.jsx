import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { momentApi, userApi, fileApi } from '../../api.js'
import { compressImageToDataUrl } from '../../utils/index.js'
import { EmptyFeedCard } from './components/EmptyFeedCard.jsx'
import { FeedLoadingCard } from './components/FeedLoadingCard.jsx'
import { MomentCard } from './components/MomentCard.jsx'
import { MomentComposer } from './components/MomentComposer.jsx'
import { MomentDetailCard } from './components/MomentDetailCard.jsx'
import './feed.css'

const roleLabel = {
  CUSTOMER: '客户',
  PROVIDER: '摄影师'
}

function emptyFollowState() {
  return { CUSTOMER: new Set(), PROVIDER: new Set() }
}

function normalizeMoments(list) {
  return Array.isArray(list) ? list.filter(Boolean) : []
}

function getMomentId(momentOrMomentId) {
  if (typeof momentOrMomentId === 'object' && momentOrMomentId !== null) {
    return Number(
      momentOrMomentId.momentId ??
      momentOrMomentId.id ??
      momentOrMomentId.postId
    )
  }

  return Number(momentOrMomentId)
}

function uniqueAuthorIds(list, currentUserId) {
  return [...new Set(list.map(item => Number(item.authorId)).filter(id => Number.isFinite(id) && id !== currentUserId))]
}

export function FeedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const { currentUser } = useAuth()
  const currentRoleKey = String(currentUser.role || 'CUSTOMER').toUpperCase()
  const avatarUrlsRef = useRef([])
  const authorProfilesRef = useRef({})
  const likePendingRef = useRef(new Set())
  const favoritePendingRef = useRef(new Set())
  const followPendingRef = useRef(new Set())
  const drawerRequestRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [scope, setScope] = useState('latest')
  const [viewMode, setViewMode] = useState('square')
  const [moments, setMoments] = useState([])
  const [authorProfiles, setAuthorProfiles] = useState({})
  const [followingMap, setFollowingMap] = useState(emptyFollowState)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerMode, setComposerMode] = useState('create')
  const [composerMomentId, setComposerMomentId] = useState(null)
  const [composerDraft, setComposerDraft] = useState({ title: '', content: '' })
  const [composerImages, setComposerImages] = useState([])
  const [composerSubmitting, setComposerSubmitting] = useState(false)
  const [drawerMomentId, setDrawerMomentId] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [menuState, setMenuState] = useState({ momentId: null, anchorEl: null })
  const initialView = searchParams.get('view')
  const initialScope = searchParams.get('scope')

  const myMoments = useMemo(
    () => moments.filter(moment => (
      Number(moment.authorId) === currentUser.userId &&
      String(moment.authorRole || currentRoleKey).toUpperCase() === currentRoleKey
    )),
    [moments, currentUser.userId, currentRoleKey]
  )
  const activeMoments = viewMode === 'mine' ? myMoments : moments
  const drawerMoment = useMemo(
    () => moments.find(moment => getMomentId(moment) === getMomentId(drawerMomentId)) || null,
    [moments, drawerMomentId]
  )

  useEffect(() => {
    authorProfilesRef.current = authorProfiles
  }, [authorProfiles])

  useEffect(() => {
    if (initialView === 'mine') {
      setViewMode('mine')
    }
    if (initialScope && ['latest', 'hot', 'following'].includes(initialScope)) {
      setScope(initialScope)
    }
    if (searchParams.get('compose') === 'true') {
      setComposerOpen(true)
      setComposerMode('create')
      setComposerDraft({ title: '', content: '' })
      setComposerImages([])
    }
  }, [])

  function upsertAuthorProfiles(entries = {}) {
    setAuthorProfiles(prev => {
      const next = { ...prev, ...entries }
      authorProfilesRef.current = next
      return next
    })
  }

  function currentUserProfile() {
    return {
      nickname: currentUser.nickname || currentUser.label || `用户 ${currentUser.userId}`,
      avatarData: currentUser.avatarData || ''
    }
  }

  async function hydrateFollowingState(cancelled = () => false) {
    const [customerFollowingResult, providerFollowingResult] = await Promise.allSettled([
      userApi.following(currentUser.userId, currentUser, 'CUSTOMER'),
      userApi.following(currentUser.userId, currentUser, 'PROVIDER')
    ])
    if (cancelled()) return
    const nextFollowing = emptyFollowState()
    if (customerFollowingResult.status === 'fulfilled') {
      customerFollowingResult.value.forEach(item => nextFollowing.CUSTOMER.add(Number(item.userId)))
    }
    if (providerFollowingResult.status === 'fulfilled') {
      providerFollowingResult.value.forEach(item => nextFollowing.PROVIDER.add(Number(item.userId)))
    }
    setFollowingMap(nextFollowing)
  }

  async function hydrateAuthorProfiles(list, cancelled = () => false) {
    const ids = uniqueAuthorIds(list, currentUser.userId).filter(id => !authorProfilesRef.current[id])
    if (!ids.length) {
      upsertAuthorProfiles({ [currentUser.userId]: currentUserProfile() })
      return
    }
    const rolesById = new Map()
    list.forEach(item => {
      const authorId = Number(item.authorId)
      if (!rolesById.has(authorId) && item.authorRole) {
        rolesById.set(authorId, String(item.authorRole).toUpperCase())
      }
    })
    const entries = await Promise.all(ids.map(async id => {
      const authorRole = rolesById.get(id) || currentRoleKey
      try {
        const profile = await userApi.publicProfile(id, currentUser, authorRole)
        let avatarData = ''
        if (profile?.avatarFileId) {
          try {
            avatarData = await fileApi.downloadObjectUrl(profile.avatarFileId, currentUser)
            avatarUrlsRef.current.push(avatarData)
          } catch {
            avatarData = ''
          }
        }
        return [id, { nickname: profile?.nickname || `用户 ${id}`, avatarData }]
      } catch {
        try {
          const brief = await userApi.brief(id, currentUser)
          let avatarData = ''
          if (brief.avatarFileId) {
            try {
              avatarData = await fileApi.downloadObjectUrl(brief.avatarFileId, currentUser)
              avatarUrlsRef.current.push(avatarData)
            } catch {
              avatarData = ''
            }
          }
          return [id, { nickname: brief.nickname || `用户 ${id}`, avatarData }]
        } catch {
          return [id, { nickname: `用户 ${id}`, avatarData: '' }]
        }
      }
    }))
    if (cancelled()) return
    const nextProfiles = { [currentUser.userId]: currentUserProfile() }
    entries.forEach(([id, profile]) => {
      nextProfiles[id] = profile
    })
    upsertAuthorProfiles(nextProfiles)
  }

  async function loadFeed({ showLoading = true, cancelled = () => false } = {}) {
    if (showLoading) {
      setLoading(true)
    }
    setNotice(null)
    const params = viewMode === 'mine'
      ? { authorId: currentUser.userId, authorRole: currentRoleKey }
      : { scope }

    try {
      const nextMoments = normalizeMoments(await momentApi.list(params, currentUser))
      if (cancelled()) return
      setMoments(nextMoments)
      if (Number.isFinite(getMomentId(drawerMomentId)) && !nextMoments.some(moment => getMomentId(moment) === getMomentId(drawerMomentId))) {
        setDrawerMomentId(null)
      }
      if (showLoading) {
        setLoading(false)
      }
      void hydrateFollowingState(cancelled).catch(() => {})
      void hydrateAuthorProfiles(nextMoments, cancelled).catch(() => {})
    } catch (error) {
      if (cancelled()) return
      setMoments([])
      setNotice({ type: 'error', text: error.message || '动态加载失败' })
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    void loadFeed({ cancelled: () => cancelled })
    return () => {
      cancelled = true
    }
  }, [currentUser.userId, currentRoleKey, currentUser.nickname, currentUser.label, currentUser.avatarData, scope, viewMode])

  useEffect(() => () => {
    avatarUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    avatarUrlsRef.current = []
  }, [])

  useEffect(() => {
    const currentDrawerMomentId = getMomentId(drawerMomentId)
    if (!Number.isFinite(currentDrawerMomentId)) return
    const selected = moments.find(moment => getMomentId(moment) === currentDrawerMomentId)
    if (!selected) {
      setDrawerMomentId(null)
    }
  }, [moments, drawerMomentId])

  function authorProfileFor(moment) {
    const stored = authorProfiles[Number(moment.authorId)]
    return stored || {
      nickname: Number(moment.authorId) === currentUser.userId
        ? (currentUser.nickname || currentUser.label || `用户 ${currentUser.userId}`)
        : `用户 ${moment.authorId}`,
      avatarData: Number(moment.authorId) === currentUser.userId ? currentUser.avatarData || '' : ''
    }
  }

  function isFollowing(authorId) {
    const id = Number(authorId)
    return followingMap.CUSTOMER?.has(id) || followingMap.PROVIDER?.has(id) || false
  }

  function mergeMoment(nextMoment) {
    if (!nextMoment) return
    const nextMomentId = getMomentId(nextMoment)
    setMoments(prev => {
      const found = prev.some(moment => getMomentId(moment) === nextMomentId)
      const next = prev.map(moment => (
        getMomentId(moment) === nextMomentId
          ? { ...moment, ...nextMoment }
          : moment
      ))
      if (!found) {
        next.unshift(nextMoment)
      }
      return next
    })
    if (getMomentId(drawerMomentId) === nextMomentId) {
      setDrawerMomentId(nextMomentId)
    }
  }

  function removeMoment(momentId) {
    const normalizedMomentId = getMomentId(momentId)
    setMoments(prev => prev.filter(moment => getMomentId(moment) !== normalizedMomentId))
    if (getMomentId(drawerMomentId) === normalizedMomentId) {
      setDrawerMomentId(null)
    }
  }

  function syncFollowState(authorId, authorRole, followed) {
    const roleKey = (authorRole || 'CUSTOMER').toUpperCase()
    setFollowingMap(prev => {
      const next = {
        CUSTOMER: new Set(prev.CUSTOMER),
        PROVIDER: new Set(prev.PROVIDER)
      }
      if (followed) {
        next[roleKey].add(Number(authorId))
      } else {
        next[roleKey].delete(Number(authorId))
      }
      return next
    })
  }

  async function refreshPage() {
    await loadFeed()
  }

  async function openComposer(moment = null) {
    if (moment) {
      let nextMoment = moment
      const momentId = getMomentId(moment)
      if (!Number.isFinite(momentId)) {
        setNotice({ type: 'error', text: '动态 ID 缺失，无法编辑' })
        return
      }
      try {
        nextMoment = await momentApi.detail(momentId, currentUser)
        mergeMoment(nextMoment)
      } catch (error) {
        setNotice({ type: 'error', text: error.message || '动态详情加载失败' })
        return
      }
      setComposerMode('edit')
      setComposerMomentId(momentId)
      setComposerDraft({ title: nextMoment.title || '', content: nextMoment.content || '' })
      setComposerImages((nextMoment.imageDataList?.length ? nextMoment.imageDataList : nextMoment.imageData ? [nextMoment.imageData] : []).slice(0, 9))
    } else {
      setComposerMode('create')
      setComposerMomentId(null)
      setComposerDraft({ title: '', content: '' })
      setComposerImages([])
    }
    setComposerOpen(true)
  }

  async function openDrawer(momentOrMomentId) {
    const momentId = getMomentId(momentOrMomentId)
    setDrawerMomentId(momentId)
    if (!Number.isFinite(momentId)) return
    const requestId = drawerRequestRef.current + 1
    drawerRequestRef.current = requestId
    setDrawerLoading(true)
    try {
      const nextMoment = await momentApi.detail(momentId, currentUser)
      if (drawerRequestRef.current !== requestId) return
      mergeMoment(nextMoment)
    } catch (error) {
      if (drawerRequestRef.current !== requestId) return
      setNotice({ type: 'error', text: error.message || '动态详情加载失败' })
    } finally {
      if (drawerRequestRef.current === requestId) {
        setDrawerLoading(false)
      }
    }
  }

  async function handleComposerSubmit() {
    setComposerSubmitting(true)
    try {
      const payload = {
        title: composerDraft.title,
        content: composerDraft.content,
        imageDataList: composerImages,
        mentions: []
      }
      let savedMoment = null
      if (composerMode === 'edit') {
        savedMoment = await momentApi.update(composerMomentId, payload, currentUser)
      } else {
        savedMoment = await momentApi.create(payload, currentUser)
      }
      setComposerOpen(false)
      if (savedMoment) {
        mergeMoment(savedMoment)
      }
      if (composerMode === 'create') {
        await refreshPage()
      }
      setNotice({ type: 'success', text: composerMode === 'create' ? '发布成功' : '动态已保存' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setComposerSubmitting(false)
    }
  }

  async function chooseImages(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const slots = 9 - composerImages.length
    if (slots <= 0) return
    try {
      const compressed = await Promise.all(files.slice(0, slots).map(file => compressImageToDataUrl(file)))
      setComposerImages(prev => [...prev, ...compressed].slice(0, 9))
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
    event.target.value = ''
  }

  function removeImage(index) {
    setComposerImages(prev => prev.filter((_, i) => i !== index))
  }

  async function toggleLike(momentOrMomentId) {
    const momentId = getMomentId(momentOrMomentId)
    if (!Number.isFinite(momentId)) {
      setNotice({ type: 'error', text: '动态 ID 缺失，无法点赞' })
      return
    }
    if (likePendingRef.current.has(momentId)) return
    const target = moments.find(moment => getMomentId(moment) === momentId)
    if (!target) return
    const wasLiked = Boolean(target.likedByCurrentUser)
    const previousCount = Number(target.likeCount || 0)
    mergeMoment({
      ...target,
      likedByCurrentUser: !wasLiked,
      likeCount: Math.max(0, previousCount + (wasLiked ? -1 : 1))
    })
    likePendingRef.current.add(momentId)
    try {
      const nextMoment = wasLiked
        ? await momentApi.unlike(momentId, currentUser)
        : await momentApi.like(momentId, currentUser)
      mergeMoment(nextMoment)
    } catch (error) {
      mergeMoment({
        ...target,
        likedByCurrentUser: wasLiked,
        likeCount: previousCount
      })
      setNotice({ type: 'error', text: error.message })
    } finally {
      likePendingRef.current.delete(momentId)
    }
  }

  async function toggleFavorite(momentOrMomentId) {
    const momentId = getMomentId(momentOrMomentId)
    if (!Number.isFinite(momentId)) {
      setNotice({ type: 'error', text: '动态 ID 缺失，无法收藏' })
      return
    }
    if (favoritePendingRef.current.has(momentId)) return
    const target = moments.find(moment => getMomentId(moment) === momentId)
    if (!target) return
    const wasFavorited = Boolean(target.favoritedByCurrentUser)
    const previousCount = Number(target.favoriteCount || 0)
    mergeMoment({
      ...target,
      favoritedByCurrentUser: !wasFavorited,
      favoriteCount: Math.max(0, previousCount + (wasFavorited ? -1 : 1))
    })
    favoritePendingRef.current.add(momentId)
    try {
      const nextMoment = wasFavorited
        ? await momentApi.unfavorite(momentId, currentUser)
        : await momentApi.favorite(momentId, currentUser)
      mergeMoment(nextMoment)
    } catch (error) {
      mergeMoment({
        ...target,
        favoritedByCurrentUser: wasFavorited,
        favoriteCount: previousCount
      })
      setNotice({ type: 'error', text: error.message })
    } finally {
      favoritePendingRef.current.delete(momentId)
    }
  }

  async function toggleFollow(authorId, authorRole) {
    const roleKey = (authorRole || 'CUSTOMER').toUpperCase()
    const followed = isFollowing(authorId)
    const requestKey = `${roleKey}:${Number(authorId)}`
    if (followPendingRef.current.has(requestKey)) return
    followPendingRef.current.add(requestKey)
    syncFollowState(authorId, authorRole, !followed)
    try {
      if (followed) {
        await userApi.unfollow(authorId, currentUser, roleKey)
      } else {
        await userApi.follow(authorId, currentUser, roleKey)
      }
      setNotice({ type: 'success', text: followed ? '已取消关注' : '已关注' })
    } catch (error) {
      syncFollowState(authorId, authorRole, followed)
      setNotice({ type: 'error', text: error.message })
    } finally {
      followPendingRef.current.delete(requestKey)
    }
  }

  function requestDelete(momentOrMomentId) {
    const momentId = getMomentId(momentOrMomentId)
    if (!Number.isFinite(momentId)) {
      setNotice({ type: 'error', text: '动态 ID 缺失，无法删除' })
      return
    }
    setDeleteTarget(momentId)
  }

  async function confirmDelete() {
    const momentId = getMomentId(deleteTarget)
    if (!Number.isFinite(momentId)) {
      setNotice({ type: 'error', text: '动态 ID 缺失，无法删除' })
      setDeleteTarget(null)
      return
    }
    try {
      await momentApi.delete(momentId, currentUser)
      removeMoment(momentId)
      setDrawerMomentId(null)
      setDeleteTarget(null)
      await refreshPage()
      setNotice({ type: 'success', text: '动态已删除' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message || '删除动态失败' })
    }
  }

  const currentDrawerMoment = drawerMoment ? {
    ...drawerMoment,
    authorProfile: authorProfileFor(drawerMoment)
  } : null

  return (
    <div className="moments-page">
      <header className="moments-page__head">
        <div>
          <div className="moments-page__eyebrow">动态广场</div>
          <h1>{viewMode === 'square' ? '动态广场' : '我的动态'}</h1>
          <p>
            {viewMode === 'square'
              ? '记录光影、分享生活，也保留那些真正值得回看的片段。'
              : '这里只显示你自己发布过的动态，编辑和删除都走真实接口。'}
          </p>
        </div>
        <div className="moments-page__actions">
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={refreshPage}>
            刷新
          </Button>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openComposer()}>
            发布动态
          </Button>
        </div>
      </header>

      <div className={`moments-page__manage${viewMode === 'mine' ? ' is-open' : ''}`}>
        <div>
          <strong>动态归档 · 我的动态</strong>
          <span>整理、更新或删除自己发布过的记录。</span>
        </div>
        <Button variant="text" onClick={() => setViewMode(prev => (prev === 'square' ? 'mine' : 'square'))}>
          {viewMode === 'square' ? '查看我的动态' : '返回广场'}
        </Button>
      </div>

      {viewMode === 'square' && (
        <div className="moments-page__band">
          <ToggleButtonGroup
            exclusive
            value={scope}
            onChange={(_, value) => value && setScope(value)}
            className="moments-page__scope"
            size="small"
          >
            <ToggleButton value="latest">最新</ToggleButton>
            <ToggleButton value="hot">热门</ToggleButton>
            <ToggleButton value="following">关注</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="text" onClick={() => setViewMode(prev => (prev === 'square' ? 'mine' : 'square'))}>
            我的动态
          </Button>
        </div>
      )}

      {notice && <Alert severity={notice.type} sx={{ mb: 2 }}>{notice.text}</Alert>}

      {loading ? (
        <FeedLoadingCard />
      ) : activeMoments.length ? (
        <Box className="moments-grid">
          {activeMoments.map(moment => {
            const author = authorProfileFor(moment)
            const momentId = getMomentId(moment)
            const isSelf = Number(moment.authorId) === currentUser.userId
            const menuOpen = getMomentId(menuState.momentId) === momentId
            const followed = isFollowing(moment.authorId)
            return (
              <MomentCard
                key={momentId}
                moment={moment}
                authorName={author.nickname}
                authorAvatar={author.avatarData}
                isFollowing={followed}
                isSelf={isSelf}
                menuOpen={menuOpen}
                menuAnchorEl={menuState.anchorEl}
                onMenuOpen={(event, nextMomentId) => setMenuState({ momentId: getMomentId(nextMomentId), anchorEl: event.currentTarget })}
                onMenuClose={() => setMenuState({ momentId: null, anchorEl: null })}
                onOpenMoment={openDrawer}
                onOpenProfile={(authorId, authorRole) => {
                  if (Number(authorId) === currentUser.userId) navigate('/profile')
                  else navigate(`/users/${authorId}${authorRole ? `?role=${String(authorRole).toUpperCase()}` : ''}`)
                }}
                onLike={toggleLike}
                onFavorite={toggleFavorite}
                onFollow={toggleFollow}
                onEdit={openComposer}
                onDelete={requestDelete}
              />
            )
          })}
        </Box>
      ) : (
        <EmptyFeedCard text={viewMode === 'square' ? '暂无动态' : '还没有发布过动态'} />
      )}

      <Drawer
        anchor="right"
        open={Boolean(drawerMoment)}
        onClose={() => setDrawerMomentId(null)}
        PaperProps={{ className: 'moment-drawer' }}
      >
        <div className="moment-drawer__head">
          <div>
            <div className="moment-drawer__eyebrow">动态详情</div>
            <h3>{currentDrawerMoment ? `No. ${String(getMomentId(currentDrawerMoment)).padStart(6, '0')}` : '动态详情'}</h3>
          </div>
          <Button onClick={() => setDrawerMomentId(null)} startIcon={<CloseRoundedIcon />}>关闭</Button>
        </div>
        <div className="moment-drawer__body">
          {drawerLoading && !currentDrawerMoment ? (
            <Paper variant="outlined" sx={{ p: 3 }}>加载中...</Paper>
          ) : currentDrawerMoment ? (
            <MomentDetailCard
              moment={currentDrawerMoment}
              authorName={currentDrawerMoment.authorProfile.nickname}
              authorAvatar={currentDrawerMoment.authorProfile.avatarData}
              isFollowing={isFollowing(currentDrawerMoment.authorId)}
              isSelf={Number(currentDrawerMoment.authorId) === currentUser.userId}
              menuOpen={getMomentId(menuState.momentId) === getMomentId(currentDrawerMoment)}
              menuAnchorEl={menuState.anchorEl}
              onMenuOpen={(event, nextMomentId) => setMenuState({ momentId: getMomentId(nextMomentId), anchorEl: event.currentTarget })}
              onMenuClose={() => setMenuState({ momentId: null, anchorEl: null })}
              onOpenProfile={(authorId, authorRole) => {
                if (Number(authorId) === currentUser.userId) navigate('/profile')
                else navigate(`/users/${authorId}${authorRole ? `?role=${String(authorRole).toUpperCase()}` : ''}`)
              }}
              onLike={toggleLike}
              onFavorite={toggleFavorite}
              onFollow={toggleFollow}
              onEdit={openComposer}
              onDelete={requestDelete}
            />
          ) : null}
        </div>
      </Drawer>

      <MomentComposer
        open={composerOpen}
        mode={composerMode}
        draft={composerDraft}
        imageDataList={composerImages}
        onDraftChange={setComposerDraft}
        onChooseImages={chooseImages}
        onRemoveImage={removeImage}
        onCancel={() => setComposerOpen(false)}
        onPublish={handleComposerSubmit}
        submitting={composerSubmitting}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>删除动态</DialogTitle>
        <DialogContent>
          删除后不可恢复，确认删除吗？
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}




