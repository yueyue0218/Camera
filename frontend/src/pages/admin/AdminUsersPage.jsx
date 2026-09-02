import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { adminApi } from '../../api/adminApi.js'
import { resetAdminPage } from './adminData.js'
import { AdminEmptyState } from './components/AdminEmptyState.jsx'
import { AdminModeBanner } from './components/AdminModeBanner.jsx'
import { AdminUserCard } from './components/AdminUserCard.jsx'

const asPage = (v, f) => Array.isArray(v) ? { records: v, ...f, total: v.length } : { records: v?.records || [], page: v?.page || f.page, size: v?.size || f.size, total: v?.total || 0 }
function Pager({ data, onPage }) { const pages = Math.max(1, Math.ceil(data.total / data.size)); return <nav className="admin-pagination"><button type="button" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>上一页</button><span>{data.page} / {pages}</span><button type="button" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>下一页</button></nav> }
export function AdminUsersPage() {
  const { currentUser } = useAuth(); const navigate = useNavigate(); const requestId = useRef(0); const [keyword, setKeyword] = useState(''); const [role, setRole] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [data, setData] = useState({ records: [], page: 1, size: 20, total: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(() => adminApi.listUsers({ page, size: 20, ...(keyword.trim() ? { keyword: keyword.trim() } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}) }, currentUser), [currentUser, keyword, page, role, status])
  const refresh = useCallback(async () => { const token = ++requestId.current; const value = asPage(await load(), { page, size: 20 }); if (token === requestId.current) setData(value); return value }, [load, page])
  useEffect(() => { const token = ++requestId.current; setLoading(true); setError(''); setData({ records: [], page, size: 20, total: 0 }); load().then(v => { if (token === requestId.current) setData(asPage(v, { page, size: 20 })) }).catch(e => { if (token === requestId.current) { setData({ records: [], page, size: 20, total: 0 }); setError(e.message || '用户列表加载失败。') } }).finally(() => { if (token === requestId.current) setLoading(false) }) }, [load, page])
  const filter = (next = {}) => { setPage(resetAdminPage()); if ('keyword' in next) setKeyword(next.keyword); if ('role' in next) setRole(next.role); if ('status' in next) setStatus(next.status) }
  return <main className="admin-page"><AdminModeBanner title="用户管理" description="读取真实管理员用户分页列表。" /><section className="admin-user-lookup"><label>关键词<input value={keyword} onChange={e => filter({ keyword: e.target.value })} /></label><label>角色<select value={role} onChange={e => filter({ role: e.target.value })}><option value="">全部</option><option value="CUSTOMER">客户</option><option value="PROVIDER">摄影师</option><option value="ADMIN">管理员</option></select></label><label>状态<select value={status} onChange={e => filter({ status: e.target.value })}><option value="">全部</option><option value="ACTIVE">正常</option><option value="DISABLED">已限制</option></select></label></section>{error ? <div className="admin-inline-error">{error}<button type="button" onClick={() => refresh().catch(() => {})}>重试</button></div> : null}{loading ? <AdminEmptyState title="正在读取用户…" /> : null}{!loading && !error && !data.records.length ? <AdminEmptyState title="暂无符合条件的用户" /> : null}<section className="admin-user-result">{data.records.map(user => <AdminUserCard key={user.userId} user={user} onOpen={() => navigate(`/admin/users/${user.userId}`)} />)}</section><Pager data={data} onPage={setPage} /></main>
}
