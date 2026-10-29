export enum AppRoute {
  LOGIN = 'Login',
  HALL = 'Hall',
  DEMAND_DETAIL = 'DemandDetail',
  SERVICE_DETAIL = 'ServiceDetail',
  CONVERSATION_DETAIL = 'ConversationDetail',
  QUOTE_FORM = 'QuoteForm',
  QUOTE_DETAIL = 'QuoteDetail',
  ORDER_DETAIL = 'OrderDetail',
  PUBLISH = 'Publish',
  MESSAGE = 'Message',
  ORDER = 'Order',
  PROFILE = 'Profile'
}

export interface DemandDetailRouteParam {
  readonly demandId: number;
}

export interface NavigationRouteParam {
  readonly demandId?: number;
  readonly serviceId?: number;
  readonly conversationId?: number;
  readonly quoteId?: number;
  readonly orderId?: number;
  readonly fromConversation?: boolean;
  /** Protected destination requested before authentication. */
  readonly returnRoute?: AppRoute;
}

export interface NavigationResolution {
  readonly route: AppRoute;
  readonly param: NavigationRouteParam;
}
