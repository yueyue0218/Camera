export enum AppRoute {
  LOGIN = 'Login',
  HALL = 'Hall',
  DEMAND_DETAIL = 'DemandDetail',
  SERVICE_DETAIL = 'ServiceDetail',
  CONVERSATION_DETAIL = 'ConversationDetail',
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
  /** Protected destination requested before authentication. */
  readonly returnRoute?: AppRoute;
}

export interface NavigationResolution {
  readonly route: AppRoute;
  readonly param: NavigationRouteParam;
}
