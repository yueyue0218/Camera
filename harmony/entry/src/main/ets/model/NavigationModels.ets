export enum AppRoute {
  LOGIN = 'Login',
  HALL = 'Hall',
  DEMAND_DETAIL = 'DemandDetail',
  SERVICE_DETAIL = 'ServiceDetail',
  CONVERSATION_DETAIL = 'ConversationDetail',
  QUOTE_FORM = 'QuoteForm',
  QUOTE_DETAIL = 'QuoteDetail',
  ORDER_DETAIL = 'OrderDetail',
  DELIVERY_GALLERY = 'DeliveryGallery',
  DELIVERY_UPLOAD = 'DeliveryUpload',
  PHOTO_AUTHORIZATION = 'PhotoAuthorization',
  ORDER_REVIEWS = 'OrderReviews',
  PUBLISH = 'Publish',
  MESSAGE = 'Message',
  ORDER = 'Order',
  PROFILE = 'Profile',
  PUBLIC_PROFILE = 'PublicProfile',
  NOTIFICATIONS = 'Notifications',
  CREDIT = 'Credit',
  ORDER_ENGAGEMENT = 'OrderEngagement',
  MOMENT_DETAIL = 'MomentDetail'
}

export interface DemandDetailRouteParam {
  readonly demandId: number;
}

export interface NavigationRouteParam {
  readonly targetKind?: string;
  readonly targetId?: number;
  readonly orderId?: number;
  readonly momentId?: number;
  readonly userId?: number;
  readonly userRole?: string;
  /** Existing HALL destination can return a successful Moments login to tab 1. */
  readonly initialTab?: number;
  readonly demandId?: number;
  readonly serviceId?: number;
  readonly conversationId?: number;
  readonly quoteId?: number;
  readonly deliveryId?: number;
  readonly authorizationId?: number;
  readonly openPayment?: boolean;
  /** Protected destination requested before authentication. */
  readonly returnRoute?: AppRoute;
}

export interface NavigationResolution {
  readonly route: AppRoute;
  readonly param: NavigationRouteParam;
}
