import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { userApi } from '../../api/userApi.js'
import { parseExactUserId } from './adminData.js'
import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'
import { AdminUserCard } from './components/AdminUserCard.jsx'

const pendingFilters = [
  { key: 'nickname', label: '昵称', placeholder: '按昵称搜索…' },
  { key: 'phone', label: '手机号后四位', placeholder: '例如：1234…' },
  { key: 'role', label: '角色', type: 'select', options: ['全部角色'] },
  { key: 'certification', label: '认证状态', type: 'select', options: ['全部状态'] },
  { key: 'report', label: '举报状态', type: 'select', options: ['全部状态'] },
  { key: 'restriction', label: '账号限制', type: 'select', options: ['全部状态'] }
]

export function AdminUsersPage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [userIdValue, setUserIdValue] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submitLookup(event) {
    event.preventDefault()
    const userId = parseExactUserId(userIdValue)
    if (!userId) {
      setResult(null)
      setError('请输入有效的正整数用户 ID。')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    try {
      const brief = await userApi.brief(userId, currentUser)
      setResult({ ...brief, userId: brief?.userId || userId })
    } catch (requestError) {
      setError(requestError?.message || `未能读取用户 #${userId} 的公开概要。`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-page">
      <AdminModeBanner
        title="用户管理"
        description="当前只支持按用户 ID 精确读取公开概要；用户列表、组合搜索和管理筛选等待后端接口接入。"
      />

      <section className="admin-user-lookup" aria-labelledby="admin-user-lookup-title">
        <div>
          <span className="admin-user-section-kicker">精确查询</span>
          <h2 id="admin-user-lookup-title">按用户 ID 查看管理员主页</h2>
          <p>此操作只调用公开用户概要接口，不请求管理员用户列表。</p>
        </div>
        <form onSubmit={submitLookup}>
          <label htmlFor="admin-user-id">用户 ID</label>
          <div>
            <input
              id="admin-user-id"
              name="admin-user-id"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck="false"
              placeholder="例如：42…"
              value={userIdValue}
              onChange={event => setUserIdValue(event.target.value)}
            />
            <button className="admin-button" type="submit" disabled={loading}>
              {loading ? '查询中…' : '查询用户'}
            </button>
          </div>
        </form>
      </section>

      {error ? <div className="admin-inline-error" role="alert">{error}</div> : null}

      {result ? (
        <section className="admin-user-result" aria-label="用户查询结果">
          <AdminUserCard
            user={result}
            onOpen={() => navigate(`/admin/users/${result.userId}`)}
          />
        </section>
      ) : null}

      {!result && !error && !loading ? (
        <AdminEmptyState title="等待精确用户 ID" description="输入用户 ID 后读取真实公开概要。" />
      ) : null}

      <section className="admin-pending-filters" aria-labelledby="admin-user-filters-title">
        <header>
          <div>
            <span className="admin-user-section-kicker">用户列表筛选</span>
            <h2 id="admin-user-filters-title">组合查询</h2>
          </div>
          <span className="admin-mode-badge">接口待接入</span>
        </header>
        <fieldset disabled>
          <legend>以下筛选需要管理员用户列表接口</legend>
          <div className="admin-pending-filter-grid">
            {pendingFilters.map(filter => (
              <label key={filter.key}>
                <span>{filter.label}</span>
                {filter.type === 'select' ? (
                  <select name={`admin-user-${filter.key}`} defaultValue="">
                    <option value="">{filter.options[0]}</option>
                  </select>
                ) : (
                  <input
                    name={`admin-user-${filter.key}`}
                    type="text"
                    autoComplete="off"
                    placeholder={filter.placeholder}
                  />
                )}
                <small>接口待接入</small>
              </label>
            ))}
          </div>
        </fieldset>
      </section>
    </main>
  )
}
