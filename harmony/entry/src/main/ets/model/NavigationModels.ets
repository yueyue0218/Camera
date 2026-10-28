export enum AppRoute {
  LOGIN = 'Login',
  HALL = 'Hall',
  DEMAND_DETAIL = 'DemandDetail',
  SERVICE_DETAIL = 'ServiceDetail',
  CONVERSATION_DETAIL = 'ConversationDetail',
  PUBLISH = 'Publish',
  MESSAGE = 'Message',
  ORDER = 'Order',
  PROFILE = 'Profile',
  PUBLIC_PROFILE = 'PublicProfile',
  NOTIFICATIONS = 'Notifications',
  CREDIT = 'Credit',
  MOMENT_DETAIL = 'MomentDetail'
}

export interface DemandDetailRouteParam {
  readonly demandId: number;
}

export interface NavigationRouteParam {
  readonly momentId?: number;
  readonly userId?: number;
  readonly userRole?: string;
  /** Existing HALL destination can return a successful Moments login to tab 1. */
  readonly initialTab?: number;
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
