import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginChoicePage, LoginInfoPage, RegisterPage } from './pages/auth/index.js'
import { DemandDetailPage, HallPage, ServicePackageDetailPage } from './pages/hall/index.js'
import { PublishPage, PublishServicePackagePage } from './pages/demand/index.js'
import { FeedPage, MomentDetailPage } from './pages/feed/index.js'
import { ConversationDetailPage, MessagesPage } from './pages/messages/index.js'
import { OrdersPage } from './pages/orders/index.js'
import { ProfilePage, PublicProfilePage } from './pages/profile/index.js'
import { AdminPage } from './pages/admin/index.jsx'
import { DeliveryPage } from './pages/delivery/DeliveryPage.jsx'
import { CreditDetailPage } from './pages/credit/index.jsx'
import { NotificationListPage } from './pages/notifications/NotificationListPage.jsx'
import { ReviewPage, UserReviewsPage } from './pages/reviews/ReviewPage.jsx'
import { ReviewComplaintDetailPage } from './pages/review-complaints/ReviewComplaintDetailPage.jsx'

const DevDLineUiPreview = import.meta.env.DEV
  ? lazy(() => import('./pages/dev/index.jsx').then(module => ({ default: module.DLineUiPreview })))
  : null

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/hall" replace />} />
      <Route path="/hall" element={<HallPage />} />
      <Route path="/demands/:demandId" element={<DemandDetailPage />} />
      <Route path="/service-packages/:serviceId" element={<ServicePackageDetailPage />} />
      <Route path="/publish" element={<PublishPage />} />
      <Route path="/publish/service-package" element={<PublishServicePackagePage />} />
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/moments/:momentId" element={<MomentDetailPage />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/messages/:conversationId" element={<ConversationDetailPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:orderId/delivery" element={<DeliveryPage />} />
      <Route path="/orders/:orderId/reviews" element={<ReviewPage />} />
      <Route path="/reviews" element={<ReviewPage />} />
      <Route path="/review-complaints/:complaintId" element={<ReviewComplaintDetailPage />} />
      <Route path="/notifications" element={<NotificationListPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/credit" element={<CreditDetailPage />} />
      <Route path="/users/:userId" element={<PublicProfilePage />} />
      <Route path="/users/:userId/credit" element={<CreditDetailPage />} />
      <Route path="/users/:userId/reviews" element={<UserReviewsPage />} />
      <Route path="/admin" element={<AdminPage />} />
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
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route path="/login/customer" element={<Navigate to="/login/sign-in" replace />} />
      <Route path="/login/provider" element={<Navigate to="/login/sign-in" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
