import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { momentApi } from '../../api/momentApi.js'
import { userApi } from '../../api/userApi.js'
import {
  buildAdminFeedRequestParams,
  filterAdminMoments,
  parseExactUserId
} from './adminData.js'
import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'
import { AdminMomentCard } from './components/AdminMomentCard.jsx'

const viewFilters = [
  { key: 'all', label: '全部' },
  { key: 'PUBLIC', label: '正常展示' },
  { key: 'latest', label: '最近发布' },
  { key: 'REMOVED', label: '已下架', disabled: true, hint: '接口待接入' },
  { key: 'REPORTED', label: '被举报', disabled: true, hint: '接口待接入' }
]

function normalizeMoments(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (Array.isArray(value?.records)) return value.records.filter(Boolean)
  if (Array.isArray(value?.items)) return value.items.filter(Boolean)
  if (Array.isArray(value?.content)) return value.content.filter(Boolean)
  return []
}

function momentIdOf(moment) {
  return Number(moment?.momentId ?? moment?.id ?? moment?.postId)
}

function authorRoleOf(moment) {
  return String(moment?.authorRole || 'CUSTOMER').toUpperCase()
}

async function loadAuthor(moment, currentUser) {
  const authorId = Number(moment?.authorId)
  if (!Number.isSafeInteger(authorId) || authorId <= 0) return null
  const role = authorRoleOf(moment)

  try {
    const profile = await userApi.publicProfile(authorId, currentUser, role)
    return {
      nickname: profile?.nickname || `用户 ${authorId}`,
      avatarData: profile?.avatarData || profile?.avatarUrl || ''
    }
  } catch {
    try {
      const brief = await userApi.brief(authorId, currentUser, role)
      return {
        nickname: brief?.nickname || `用户 ${authorId}`,
        avatarData: brief?.avatarData || brief?.avatarUrl || ''
      }
    } catch {
      return { nickname: `用户 ${authorId}`, avatarData: '' }
    }
  }
}

async function hydrateAuthors(moments, currentUser) {
  const uniqueMoments = []
  const seen = new Set()
  moments.forEach(moment => {
    const authorId = Number(moment?.authorId)
    if (Number.isSafeInteger(authorId) && authorId > 0 && !seen.has(authorId)) {
      seen.add(authorId)
      uniqueMoments.push(moment)
    }
  })

  const entries = await Promise.all(uniqueMoments.map(async moment => (
    [Number(moment.authorId), await loadAuthor(moment, currentUser)]
  )))
  return Object.fromEntries(entries.filter(([, profile]) => profile))
}

function detailImages(moment) {
  if (Array.isArray(moment?.imageDataList) && moment.imageDataList.length) return moment.imageDataList
  return moment?.imageData ? [moment.imageData] : []
}

export function AdminFeedPage() {
  const { currentUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [moments, setMoments] = useState([])
  const [profiles, setProfiles] = useState({})
  const [searchValue, setSearchValue] = useState('')
  const [keyword, setKeyword] = useState('')
  const [viewFilter, setViewFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [detailState, setDetailState] = useState({ open: false, loading: false, moment: null, error: '' })

  const rawAuthorId = useMemo(() => new URLSearchParams(location.search).get('authorId'), [location.search])
  const authorId = parseExactUserId(rawAuthorId)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    momentApi.list(buildAdminFeedRequestParams(), currentUser)
      .then(async result => {
        const nextMoments = normalizeMoments(result)
        const nextProfiles = await hydrateAuthors(nextMoments, currentUser)
        if (!active) return
        setMoments(nextMoments)
        setProfiles(nextProfiles)
        setLoading(false)
      })
      .catch(requestError => {
        if (!active) return
        setMoments([])
        setProfiles({})
        setError(requestError?.message || '公开动态加载失败，请重试。')
        setLoading(false)
      })

    return () => { active = false }
  }, [currentUser, retryKey])

  const filteredMoments = useMemo(() => {
    const filtered = filterAdminMoments(moments, profiles, keyword, authorId)
    if (viewFilter !== 'latest') return filtered
    return [...filtered].sort((left, right) => (
      new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    ))
  }, [authorId, keyword, moments, profiles, viewFilter])

  async function openDetail(moment) {
    const momentId = momentIdOf(moment)
    if (!Number.isSafeInteger(momentId) || momentId <= 0) return
    setDetailState({ open: true, loading: true, moment: null, error: '' })
    try {
      const detail = await momentApi.detail(momentId, currentUser)
      setDetailState({ open: true, loading: false, moment: detail, error: '' })
    } catch (detailError) {
      setDetailState({
        open: true,
        loading: false,
        moment: null,
        error: detailError?.message || '公开动态详情加载失败。'
      })
    }
  }

  function openAuthor(moment) {
    const authorIdValue = Number(moment?.authorId)
    if (!Number.isSafeInteger(authorIdValue) || authorIdValue <= 0) return
    navigate(`/admin/users/${authorIdValue}?role=${authorRoleOf(moment)}`)
  }

  const detailMoment = detailState.moment
  const detailAuthor = detailMoment
    ? profiles[Number(detailMoment.authorId)] || { nickname: `用户 ${detailMoment.authorId}` }
    : null
  const images = detailImages(detailMoment)

  return (
    <main className="admin-page">
      <AdminModeBanner
        title="动态管理"
        description="以管理员模式浏览平台当前公开动态；互动数据只读，管理操作等待后端接口接入。"
      />

      <section className="admin-feed-toolbar" aria-label="动态筛选">
        <form
          className="admin-feed-search"
          onSubmit={event => {
            event.preventDefault()
            setKeyword(searchValue.trim())
          }}
        >
          <label htmlFor="admin-feed-keyword">搜索公开动态</label>
          <div>
            <input
              id="admin-feed-keyword"
              name="admin-feed-keyword"
              type="search"
              value={searchValue}
              autoComplete="off"
              placeholder="作者、标题或正文…"
              onChange={event => setSearchValue(event.target.value)}
            />
            <button className="admin-button" type="submit">搜索</button>
          </div>
        </form>

        <div className="admin-filter-group" aria-label="展示范围">
          <span>展示范围</span>
          <div>
            {viewFilters.map(filter => (
              <span className="admin-filter-option" key={filter.key}>
                <button
                  className={viewFilter === filter.key ? 'admin-filter-button is-active' : 'admin-filter-button'}
                  type="button"
                  disabled={filter.disabled}
                  aria-pressed={viewFilter === filter.key}
                  onClick={filter.disabled ? undefined : () => setViewFilter(filter.key)}
                >
                  {filter.label}
                </button>
                {filter.hint ? <small>{filter.hint}</small> : null}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-feed-summary" aria-live="polite">
        <p>
          当前展示 <strong>{filteredMoments.length}</strong> 条公开动态
          {keyword ? <span> · 关键词“{keyword}”</span> : null}
        </p>
        {authorId ? (
          <span>仅查看用户 #{authorId} · <button type="button" onClick={() => navigate('/admin/feed')}>清除作者筛选</button></span>
        ) : rawAuthorId ? (
          <span>作者 ID 无效，当前展示全部公开动态</span>
        ) : (
          <span>公开列表范围：最近发布</span>
        )}
      </section>

      {error ? (
        <div className="admin-inline-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryKey(value => value + 1)}>重试公开列表</button>
        </div>
      ) : null}

      {loading ? (
        <AdminEmptyState title="正在读取公开动态…" description="只调用公开动态列表和作者公开资料接口。" />
      ) : null}

      {!loading && !filteredMoments.length && !error ? (
        <AdminEmptyState
          title={authorId ? `用户 #${authorId} 暂无公开动态` : '暂无符合条件的公开动态'}
          description="可以调整展示范围或搜索关键词。"
        />
      ) : null}

      {!loading && filteredMoments.length ? (
        <section className="admin-feed-list" aria-label="公开动态列表">
          {filteredMoments.map(moment => (
            <AdminMomentCard
              key={momentIdOf(moment)}
              moment={moment}
              author={profiles[Number(moment.authorId)] || { nickname: `用户 ${moment.authorId}` }}
              onOpen={() => openDetail(moment)}
              onOpenAuthor={Number(moment.authorId) > 0 ? () => openAuthor(moment) : undefined}
            />
          ))}
        </section>
      ) : null}

      {detailState.open ? (
        <div className="admin-feed-detail-backdrop" role="presentation">
          <section className="admin-feed-detail" role="dialog" aria-modal="true" aria-labelledby="admin-feed-detail-title">
            <header>
              <div>
                <span>公开动态详情</span>
                <h2 id="admin-feed-detail-title">{detailMoment?.title || '动态详情'}</h2>
              </div>
              <button
                className="admin-button"
                type="button"
                onClick={() => setDetailState({ open: false, loading: false, moment: null, error: '' })}
              >
                关闭
              </button>
            </header>

            {detailState.loading ? (
              <AdminEmptyState title="正在读取公开详情…" description="通过公开动态详情接口读取。" />
            ) : null}
            {detailState.error ? <div className="admin-inline-error" role="alert">{detailState.error}</div> : null}
            {detailMoment ? (
              <div className="admin-feed-detail-body">
                <p className="admin-feed-detail-meta">
                  <strong>{detailAuthor?.nickname}</strong>
                  <span>用户 #{detailMoment.authorId}</span>
                  <span>{detailMoment.createdAt ? new Date(detailMoment.createdAt).toLocaleString('zh-CN', { hour12: false }) : '时间未知'}</span>
                </p>
                <p>{detailMoment.content || '暂无文字内容。'}</p>
                {images.length ? (
                  <div className="admin-feed-detail-images">
                    {images.map((source, index) => (
                      <img
                        src={source}
                        alt={`${detailMoment.title || '动态'} ${index + 1}`}
                        width="800"
                        height="600"
                        loading="lazy"
                        key={`${source}-${index}`}
                      />
                    ))}
                  </div>
                ) : <div className="admin-feed-detail-placeholder">暂无图片</div>}
                <div className="admin-moment-counts" aria-label="互动数据">
                  <span>{Number(detailMoment.likeCount) || 0} 个赞</span>
                  <span>{Number(detailMoment.favoriteCount) || 0} 个收藏</span>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  )
}
