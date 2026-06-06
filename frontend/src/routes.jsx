import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginChoicePage, LoginInfoPage, RegisterPage } from './pages/auth/index.js'
import { DemandDetailPage, HallPage, ServicePackageDetailPage } from './pages/hall/index.js'
import { PublishPage, PublishServicePackagePage } from './pages/demand/index.js'
import { FeedPage, MomentDetailPage } from './pages/feed/index.js'
import { ConversationDetailPage, MessagesPage } from './pages/messages/index.js'
import { OrdersPage } from './pages/orders/index.js'
import { DeliveryGalleryPage } from './pages/deliveries/index.js'
import { ProfilePage, PublicProfilePage } from './pages/profile/index.js'

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
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/messages/:conversationId" element={<ConversationDetailPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:orderId/deliveries/:deliveryId" element={<DeliveryGalleryPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/users/:userId" element={<PublicProfilePage />} />
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
