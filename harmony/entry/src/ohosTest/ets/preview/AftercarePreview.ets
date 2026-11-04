import { image } from '@kit.ImageKit';
import { PhotoAuthorizationEventCard } from '../../../main/ets/features/aftercare/PhotoAuthorizationEventCard';
import { OrderReviewsPage, OrderReviewsPreviewState } from '../../../main/ets/pages/OrderReviewsPage';
import { PhotoAuthorizationPage, PhotoAuthorizationPreviewState } from '../../../main/ets/pages/PhotoAuthorizationPage';
import { DeliverySummary, OrderEngagementSummary, OrderSummary, PhotoAuthorizationSummary,
  ReviewSummary } from '../../../main/ets/model/ApiModels';
import { PortraTheme } from '../../../main/ets/theme/PortraTheme';

const ORDER: OrderSummary = { orderId: 18, customerId: 1, providerUserId: 2, status: 'COMPLETED' };
const REVIEW_ORDER: OrderEngagementSummary = { orderId: 18, customerId: 1, providerUserId: 2,
  customerNickname: '可可', providerNickname: '木禾', status: 'COMPLETED' };
const DELIVERY: DeliverySummary = { deliveryId: 8, orderId: 18, deliveryRound: 1, files: [
  { fileId: 21, fileName: '公园写真.jpg', fileType: 'IMAGE' },
  { fileId: 22, fileName: '合影.jpg', fileType: 'IMAGE' },
  { fileId: 23, fileName: '肖像.jpg', fileType: 'IMAGE' }
] };
const APPLICATION: PhotoAuthorizationSummary = { id: 31, orderId: 18, customerId: 1,
  providerUserId: 2, photoUsageScope: 'PORTFOLIO_DISPLAY', status: 'PENDING', remark: '仅用于个人作品集',
  files: [{ fileId: 21, fileName: '公园写真.jpg', fileType: 'IMAGE' },
    { fileId: 22, fileName: '合影.jpg', fileType: 'IMAGE' }] };
const REVIEW: ReviewSummary = { reviewId: 41, orderId: 18, reviewerId: 1, targetUserId: 2,
  reviewerNickname: '可可', targetUserNickname: '木禾', rating: 5, content: '拍摄过程很轻松，成片也很喜欢。',
  isVisible: true, createdAt: '2026-10-20T14:30:00' };
const EMPTY_THUMBNAILS: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();

@Component
export struct AuthorizationCardPreview {
  build() {
    Column() { PhotoAuthorizationEventCard({ authorization: APPLICATION, actorId: 1,
      thumbnails: EMPTY_THUMBNAILS }) }
      .width('100%').padding(16).backgroundColor(PortraTheme.pageBackground)
  }
}

@Component
export struct AuthorizationSelectionPreview {
  private readonly state: PhotoAuthorizationPreviewState = { order: ORDER, actorId: 2,
    deliveries: [DELIVERY], authorizations: [], selecting: true, selected: [21] };
  build() { PhotoAuthorizationPage({ orderId: 18, previewState: this.state }) }
}

@Component
export struct AuthorizationDetailPreview {
  private readonly state: PhotoAuthorizationPreviewState = { order: ORDER, actorId: 1,
    deliveries: [DELIVERY], authorizations: [APPLICATION], detailId: 31 };
  build() { PhotoAuthorizationPage({ orderId: 18, previewState: this.state }) }
}

@Component
export struct ReviewFormPreview {
  private readonly state: OrderReviewsPreviewState = { order: REVIEW_ORDER, actorId: 1,
    reviews: [], complaints: [], mode: 'review', targetId: 18 };
  build() { OrderReviewsPage({ orderId: 18, previewState: this.state }) }
}

@Component
export struct ReviewDetailPreview {
  private readonly state: OrderReviewsPreviewState = { order: REVIEW_ORDER, actorId: 2,
    reviews: [REVIEW], complaints: [] };
  build() { OrderReviewsPage({ orderId: 18, previewState: this.state }) }
}

@Component
export struct ComplaintFormPreview {
  private readonly state: OrderReviewsPreviewState = { order: REVIEW_ORDER, actorId: 2,
    reviews: [REVIEW], complaints: [], mode: 'complaint', targetId: 41 };
  build() { OrderReviewsPage({ orderId: 18, previewState: this.state }) }
}
