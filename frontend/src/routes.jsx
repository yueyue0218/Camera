import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { LoginChoicePage, LoginInfoPage, RegisterPage } from './pages/auth/index.js'
import { DemandDetailPage, HallPage, ServicePackageDetailPage } from './pages/hall/index.js'
import { PublishPage, PublishServicePackagePage } from './pages/demand/index.js'
import { FeedPage, MomentDetailPage } from './pages/feed/index.js'
import { ConversationDetailPage, MessagesPage } from './pages/messages/index.js'
import { OrdersPage } from './pages/orders/index.js'
import { DeliveryGalleryPage } from './pages/deliveries/index.js'
import { ProfilePage, PublicProfilePage } from './pages/profile/index.js'
import { AdminPage } from './pages/admin/index.jsx'
import { DeliveryPage } from './pages/delivery/DeliveryPage.jsx'
import { CreditDetailPage } from './pages/credit/index.jsx'
import { NotificationListPage } from './pages/notifications/NotificationListPage.jsx'
import { ReviewPage, UserReviewsPage } from './pages/reviews/ReviewPage.jsx'
import { ReviewDetailPage } from './pages/reviews/ReviewDetailPage.jsx'
import { ReviewComplaintDetailPage } from './pages/review-complaints/ReviewComplaintDetailPage.jsx'
import { PortraRouteTransition } from './components/portra/index.js'

const DevDLineUiPreview = import.meta.env.DEV
  ? lazy(() => import('./pages/dev/index.jsx').then(module => ({ default: module.DLineUiPreview })))
  : null

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
      <Route path="/messages" element={<PortraRouteTransition><MessagesPage /></PortraRouteTransition>} />
      <Route path="/messages/:conversationId" element={<PortraRouteTransition><ConversationDetailPage /></PortraRouteTransition>} />
      <Route path="/orders" element={<PortraRouteTransition><OrdersPage /></PortraRouteTransition>} />
      <Route path="/orders/:orderId/deliveries/:deliveryId" element={<PortraRouteTransition><DeliveryGalleryPage /></PortraRouteTransition>} />
      <Route path="/orders/:orderId/delivery" element={<DeliveryPage />} />
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
      <Route path="/admin" element={<RequireAdminRoute><AdminPage /></RequireAdminRoute>} />
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
