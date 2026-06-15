import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, MenuItem, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
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
    () => moments.find(moment => Number(moment.momentId) === Number(drawerMomentId)) || null,
    [moments, drawerMomentId]
  )

  useEffect(() => {
    if (initialView === 'mine') {
      setViewMode('mine')
    }
    if (initialScope && ['latest', 'hot', 'following'].includes(initialScope)) {
      setScope(initialScope)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setNotice(null)
      const params = viewMode === 'mine'
        ? { authorId: currentUser.userId, authorRole: currentRoleKey }
        : { scope }

      const [momentsResult, customerFollowingResult, providerFollowingResult] = await Promise.allSettled([
        momentApi.list(params, currentUser),
        userApi.following(currentUser.userId, currentUser, 'CUSTOMER'),
        userApi.following(currentUser.userId, currentUser, 'PROVIDER')
      ])

      if (cancelled) return

      const nextMoments = normalizeMoments(momentsResult.status === 'fulfilled' ? momentsResult.value : [])
      setMoments(nextMoments)
      setNotice(momentsResult.status === 'rejected' ? { type: 'error', text: momentsResult.reason?.message || '动态加载失败' } : null)

      const nextFollowing = emptyFollowState()
      if (customerFollowingResult.status === 'fulfilled') {
        customerFollowingResult.value.forEach(item => nextFollowing.CUSTOMER.add(Number(item.userId)))
      }
      if (providerFollowingResult.status === 'fulfilled') {
        providerFollowingResult.value.forEach(item => nextFollowing.PROVIDER.add(Number(item.userId)))
      }
      setFollowingMap(nextFollowing)

      await loadAuthorProfiles(nextMoments, cancelled)
      setLoading(false)
    }

    async function loadAuthorProfiles(list, cancelledFlag) {
      avatarUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      avatarUrlsRef.current = []
      const ids = uniqueAuthorIds(list, currentUser.userId)
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
      if (!cancelledFlag) {
        const nextProfiles = {}
        entries.forEach(([id, profile]) => {
          nextProfiles[id] = profile
        })
        nextProfiles[currentUser.userId] = {
          nickname: currentUser.nickname || currentUser.label || `用户 ${currentUser.userId}`,
          avatarData: currentUser.avatarData || ''
        }
        setAuthorProfiles(nextProfiles)
      }
    }

    load()
    return () => {
      cancelled = true
      avatarUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      avatarUrlsRef.current = []
    }
  }, [currentUser.userId, currentRoleKey, currentUser.nickname, currentUser.label, currentUser.avatarData, scope, viewMode])

  useEffect(() => {
    if (!drawerMomentId) return
    const selected = moments.find(moment => Number(moment.momentId) === Number(drawerMomentId))
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

  function isFollowing(authorId, authorRole) {
    const roleKey = (authorRole || 'CUSTOMER').toUpperCase()
    return followingMap[roleKey]?.has(Number(authorId)) || false
  }

  function mergeMoment(nextMoment) {
    if (!nextMoment) return
    setMoments(prev => {
      const found = prev.some(moment => Number(moment.momentId) === Number(nextMoment.momentId))
      const next = prev.map(moment => (
        Number(moment.momentId) === Number(nextMoment.momentId)
          ? { ...moment, ...nextMoment }
          : moment
      ))
      if (!found) {
        next.unshift(nextMoment)
      }
      return next
    })
    if (drawerMomentId && Number(drawerMomentId) === Number(nextMoment.momentId)) {
      setDrawerMomentId(Number(nextMoment.momentId))
    }
  }

  function removeMoment(momentId) {
    setMoments(prev => prev.filter(moment => Number(moment.momentId) !== Number(momentId)))
    if (drawerMomentId && Number(drawerMomentId) === Number(momentId)) {
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
    setNotice(null)
    const params = viewMode === 'mine'
      ? { authorId: currentUser.userId, authorRole: currentRoleKey }
      : { scope }
    setLoading(true)
    const [momentsResult, customerFollowingResult, providerFollowingResult] = await Promise.allSettled([
      momentApi.list(params, currentUser),
      userApi.following(currentUser.userId, currentUser, 'CUSTOMER'),
      userApi.following(currentUser.userId, currentUser, 'PROVIDER')
    ])
    const nextMoments = normalizeMoments(momentsResult.status === 'fulfilled' ? momentsResult.value : [])
    setMoments(nextMoments)
    if (momentsResult.status === 'rejected') {
      setNotice({ type: 'error', text: momentsResult.reason?.message || '动态加载失败' })
    }
    const nextFollowing = emptyFollowState()
    if (customerFollowingResult.status === 'fulfilled') {
      customerFollowingResult.value.forEach(item => nextFollowing.CUSTOMER.add(Number(item.userId)))
    }
    if (providerFollowingResult.status === 'fulfilled') {
      providerFollowingResult.value.forEach(item => nextFollowing.PROVIDER.add(Number(item.userId)))
    }
    setFollowingMap(nextFollowing)
    await (async () => {
      avatarUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      avatarUrlsRef.current = []
      const ids = uniqueAuthorIds(nextMoments, currentUser.userId)
      const rolesById = new Map()
      nextMoments.forEach(item => {
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
      const nextProfiles = {
        [currentUser.userId]: {
          nickname: currentUser.nickname || currentUser.label || `鐢ㄦ埛 ${currentUser.userId}`,
          avatarData: currentUser.avatarData || ''
        }
      }
      entries.forEach(([id, profile]) => {
        nextProfiles[id] = profile
      })
      setAuthorProfiles(nextProfiles)
    })()
    if (drawerMomentId && !nextMoments.some(moment => Number(moment.momentId) === Number(drawerMomentId))) {
      setDrawerMomentId(null)
    }
    setLoading(false)
  }

  function openComposer(moment = null) {
    if (moment) {
      setComposerMode('edit')
      setComposerMomentId(moment.momentId)
      setComposerDraft({ title: moment.title || '', content: moment.content || '' })
      setComposerImages((moment.imageDataList?.length ? moment.imageDataList : moment.imageData ? [moment.imageData] : []).slice(0, 9))
    } else {
      setComposerMode('create')
      setComposerMomentId(null)
      setComposerDraft({ title: '', content: '' })
      setComposerImages([])
    }
    setComposerOpen(true)
  }

  function openDrawer(momentId) {
    setDrawerMomentId(momentId)
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

  async function toggleLike(momentId) {
    try {
      const nextMoment = await momentApi.like(momentId, currentUser)
      mergeMoment(nextMoment)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function toggleFavorite(momentId) {
    try {
      const nextMoment = await momentApi.favorite(momentId, currentUser)
      mergeMoment(nextMoment)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  async function toggleFollow(authorId, authorRole) {
    const roleKey = (authorRole || 'CUSTOMER').toUpperCase()
    const followed = isFollowing(authorId, authorRole)
    try {
      if (followed) {
        await userApi.unfollow(authorId, currentUser, roleKey)
      } else {
        await userApi.follow(authorId, currentUser, roleKey)
      }
      setNotice({ type: 'success', text: followed ? '已取消关注' : '已关注' })
      syncFollowState(authorId, authorRole, !followed)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  function requestDelete(momentOrMomentId) {
    const rawMomentId = typeof momentOrMomentId === 'object' && momentOrMomentId !== null
      ? momentOrMomentId.momentId
      : momentOrMomentId
    const momentId = Number(rawMomentId)
    if (!Number.isFinite(momentId)) {
      setNotice({ type: 'error', text: '动态 ID 缺失，无法删除' })
      return
    }
    setDeleteTarget(momentId)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      const momentId = Number(deleteTarget)
      if (!Number.isFinite(momentId)) {
        setNotice({ type: 'error', text: '动态 ID 缺失，无法删除' })
        return
      }
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
          <strong>PORTRA POST ARCHIVE · 我的动态</strong>
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
            const isSelf = Number(moment.authorId) === currentUser.userId
            const menuOpen = menuState.momentId === moment.momentId
            const followed = isFollowing(moment.authorId, moment.authorRole)
            return (
              <MomentCard
                key={moment.momentId}
                moment={moment}
                authorName={author.nickname}
                authorAvatar={author.avatarData}
                isFollowing={followed}
                isSelf={isSelf}
                menuOpen={menuOpen}
                menuAnchorEl={menuState.anchorEl}
                onMenuOpen={(event, momentId) => setMenuState({ momentId, anchorEl: event.currentTarget })}
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
            <h3>{currentDrawerMoment ? `No. ${String(currentDrawerMoment.momentId).padStart(6, '0')}` : '动态详情'}</h3>
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
              isFollowing={isFollowing(currentDrawerMoment.authorId, currentDrawerMoment.authorRole)}
              isSelf={Number(currentDrawerMoment.authorId) === currentUser.userId}
              menuOpen={menuState.momentId === currentDrawerMoment.momentId}
              menuAnchorEl={menuState.anchorEl}
              onMenuOpen={(event, momentId) => setMenuState({ momentId, anchorEl: event.currentTarget })}
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




