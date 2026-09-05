import { Navigate, useLocation } from 'react-router-dom'
import { getLegacyAdminTarget } from './adminSurfaceConfig.js'
import { AdminHomePage } from './AdminHomePage.jsx'

export function AdminLegacyEntry() {
  const location = useLocation()
  const target = getLegacyAdminTarget(location.search)

  return target ? <Navigate to={target} replace /> : <AdminHomePage />
}

export { AdminLayout } from './AdminLayout.jsx'
export { AdminHomePage } from './AdminHomePage.jsx'
export { AdminHallPage } from './AdminHallPage.jsx'
export { AdminFeedPage } from './AdminFeedPage.jsx'
export { AdminUsersPage } from './AdminUsersPage.jsx'
export { AdminUserProfilePage } from './AdminUserProfilePage.jsx'
export { AdminReportsPage } from './AdminReportsPage.jsx'
export { AdminCertificationPage } from './AdminCertificationPage.jsx'
export { AdminComplaintPage } from './AdminComplaintPage.jsx'
