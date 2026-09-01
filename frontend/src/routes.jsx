import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { LoginChoicePage, LoginInfoPage, RegisterPage } from './pages/auth/index.js'
import { DemandDetailPage, HallPage, ServicePackageDetailPage } from './pages/hall/index.js'
import { PublishPage, PublishServicePackagePage } from './pages/demand/index.js'
import { FeedPage, MomentDetailPage } from './pages/feed/index.js'
import { ProfilePage, PublicProfilePage } from './pages/profile/index.js'
import {
  AdminCertificationPage,
  AdminComplaintPage,
  AdminFeedPage,
  AdminHallPage,
  AdminLayout,
  AdminLegacyEntry,
  AdminReportsPage,
  AdminUserProfilePage,
  AdminUsersPage
} from './pages/admin/index.jsx'
import { CreditDetailPage } from './pages/credit/index.jsx'
import { NotificationListPage } from './pages/notifications/NotificationListPage.jsx'
import { ReviewPage, UserReviewsPage } from './pages/reviews/ReviewPage.jsx'
import { ReviewDetailPage } from './pages/reviews/ReviewDetailPage.jsx'
import { ReviewComplaintDetailPage } from './pages/review-complaints/ReviewComplaintDetailPage.jsx'
import { PortraRouteTransition } from './components/portra/index.js'

const DevDLineUiPreview = import.meta.env.DEV
  ? lazy(() => import('./pages/dev/index.jsx').then(module => ({ default: module.DLineUiPreview })))
  : null
const MessagesPage = lazy(() => loadNamedRoute(() => import('./pages/messages/index.js'), 'MessagesPage'))
const ConversationDetailPage = lazy(() => loadNamedRoute(() => import('./pages/messages/index.js'), 'ConversationDetailPage'))
const OrdersPage = lazy(() => loadNamedRoute(() => import('./pages/orders/index.js'), 'OrdersPage'))
const DeliveryGalleryPage = lazy(() => loadNamedRoute(() => import('./pages/deliveries/index.js'), 'DeliveryGalleryPage'))
const DeliveryPage = lazy(() => loadNamedRoute(() => import('./pages/delivery/DeliveryPage.jsx'), 'DeliveryPage'))

function loadNamedRoute(loader, exportName) {
  return loader().then(module => ({ default: module[exportName] }))
}

function RouteLoadingFallback() {
  return <div className="portra-route-loading" role="status" aria-label="页面加载中">页面加载中...</div>
}

function withRouteSuspense(element) {
  return <Suspense fallback={<RouteLoadingFallback />}>{element}</Suspense>
}

function RequireAdminRoute({ children }) {
  const { isAuthenticated, currentUser } = useAuth()
  const hasAdminAccess = currentUser?.role === 'ADMIN' || currentUser?.adminCapable

  if (!isAuthenticated) {
    return <Navigate to="/login/admin" replace />
  }

  if (!hasAdminAccess) {
    return <Navigate to="/hall" replace />
  }

  return children
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/hall" replace />} />
      <Route path="/hall" element={<HallPage />} />
      <Route path="/demands/:demandId" element={<DemandDetailPage />} />
      <Route path="/demands/:demandId/edit" element={<PublishPage />} />
      <Route path="/service-packages/:serviceId" element={<ServicePackageDetailPage />} />
      <Route path="/service-packages/:serviceId/edit" element={<PublishServicePackagePage />} />
      <Route path="/publish" element={<PublishPage />} />
      <Route path="/publish/service-package" element={<PublishServicePackagePage />} />
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/moments/:momentId" element={<MomentDetailPage />} />
      <Route path="/messages" element={withRouteSuspense(<PortraRouteTransition><MessagesPage /></PortraRouteTransition>)} />
      <Route path="/messages/:conversationId" element={withRouteSuspense(<PortraRouteTransition><ConversationDetailPage /></PortraRouteTransition>)} />
      <Route path="/orders" element={withRouteSuspense(<PortraRouteTransition><OrdersPage /></PortraRouteTransition>)} />
      <Route path="/orders/:orderId/deliveries/:deliveryId" element={withRouteSuspense(<PortraRouteTransition><DeliveryGalleryPage /></PortraRouteTransition>)} />
      <Route path="/orders/:orderId/delivery" element={withRouteSuspense(<DeliveryPage />)} />
      <Route path="/orders/:orderId/reviews" element={<ReviewPage />} />
      <Route path="/reviews/:reviewId" element={<ReviewDetailPage />} />
      <Route path="/reviews" element={<UserReviewsPage />} />
      <Route path="/review-complaints/:complaintId" element={<ReviewComplaintDetailPage />} />
      <Route path="/notifications" element={<NotificationListPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/credit" element={<CreditDetailPage />} />
      <Route path="/users/:userId" element={<PublicProfilePage />} />
      <Route path="/users/:userId/credit" element={<CreditDetailPage />} />
      <Route path="/users/:userId/reviews" element={<UserReviewsPage />} />
      <Route path="/admin" element={<RequireAdminRoute><AdminLayout /></RequireAdminRoute>}>
        <Route index element={<AdminLegacyEntry />} />
        <Route path="hall" element={<AdminHallPage />} />
        <Route path="feed" element={<AdminFeedPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:userId" element={<AdminUserProfilePage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="certifications" element={<AdminCertificationPage />} />
        <Route path="complaints" element={<AdminComplaintPage />} />
      </Route>
      {import.meta.env.DEV && DevDLineUiPreview ? (
        <Route path="/dev/dline-ui-preview" element={<Suspense fallback={null}><DevDLineUiPreview /></Suspense>} />
      ) : null}
      <Route path="*" element={<Navigate to="/hall" replace />} />
    </Routes>
  )
}

export function LoginRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginChoicePage />}>
        <Route path="sign-in" element={<LoginInfoPage />} />
        <Route path="admin" element={<LoginInfoPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route path="/login/customer" element={<Navigate to="/login/sign-in" replace />} />
      <Route path="/login/provider" element={<Navigate to="/login/sign-in" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
