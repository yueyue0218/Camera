import { Outlet } from 'react-router-dom'
import './admin.css'

export function AdminLayout() {
  return (
    <div className="admin-surface">
      <Outlet />
    </div>
  )
}
