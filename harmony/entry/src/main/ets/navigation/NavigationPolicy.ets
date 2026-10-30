import { AppRoute, NavigationResolution, NavigationRouteParam } from '../model/NavigationModels';

const EMPTY_PARAM: NavigationRouteParam = {};

/**
 * Navigation rules independent of ArkUI, so routes stay consistent across pages.
 * Authentication here only controls entry; authorization remains server-owned.
 */
export class NavigationPolicy {
  static readonly routes: AppRoute[] = [
    AppRoute.ORDER_ENGAGEMENT,
    AppRoute.LOGIN,
    AppRoute.HALL,
    AppRoute.DEMAND_DETAIL,
    AppRoute.SERVICE_DETAIL,
    AppRoute.CONVERSATION_DETAIL,
    AppRoute.QUOTE_FORM,
    AppRoute.QUOTE_DETAIL,
    AppRoute.ORDER_DETAIL,
    AppRoute.DELIVERY_GALLERY,
    AppRoute.DELIVERY_UPLOAD,
    AppRoute.PUBLISH,
    AppRoute.MESSAGE,
    AppRoute.ORDER,
    AppRoute.PROFILE,
    AppRoute.PUBLIC_PROFILE, AppRoute.NOTIFICATIONS, AppRoute.CREDIT, AppRoute.MOMENT_DETAIL
  ];

  static requiresAuthentication(route: AppRoute): boolean {
    return route === AppRoute.ORDER_ENGAGEMENT || route === AppRoute.PUBLISH || route === AppRoute.CONVERSATION_DETAIL || route === AppRoute.MESSAGE ||
      route === AppRoute.QUOTE_FORM || route === AppRoute.QUOTE_DETAIL || route === AppRoute.ORDER_DETAIL ||
      route === AppRoute.DELIVERY_GALLERY || route === AppRoute.DELIVERY_UPLOAD ||
      route === AppRoute.ORDER || route === AppRoute.PROFILE || route === AppRoute.NOTIFICATIONS ||
      route === AppRoute.CREDIT || route === AppRoute.MOMENT_DETAIL;
  }

  static resolve(route: AppRoute, param: NavigationRouteParam = EMPTY_PARAM,
    authenticated: boolean = false): NavigationResolution {
    if (!authenticated && NavigationPolicy.requiresAuthentication(route)) {
      return {
        route: AppRoute.LOGIN,
        param: {
          returnRoute: route, demandId: param.demandId, serviceId: param.serviceId, targetKind: param.targetKind, targetId: param.targetId, orderId: param.orderId,
          conversationId: param.conversationId, momentId: param.momentId,
          userId: param.userId, userRole: param.userRole, initialTab: param.initialTab,
          quoteId: param.quoteId, deliveryId: param.deliveryId, openPayment: param.openPayment
        }
      };
    }
    return { route: route, param: param };
  }

  static validPublicUserId(param: NavigationRouteParam): number | undefined {
    return NavigationPolicy.positiveId(param.userId);
  }

  static validPublicUserRole(param: NavigationRouteParam): string | undefined {
    const role = param.userRole?.trim().toUpperCase();
    return role === 'CUSTOMER' || role === 'PROVIDER' ? role : undefined;
  }

  static validDemandId(param: NavigationRouteParam): number | undefined {
    const demandId = param.demandId;
    if (typeof demandId !== 'number' || !Number.isSafeInteger(demandId) || demandId <= 0) {
      return undefined;
    }
    return demandId;
  }

  static loginDescription(param: NavigationRouteParam): string {
    if (param.returnRoute === AppRoute.HALL && param.initialTab === 1) {
      return '登录后继续查看动态';
    }
    if (param.returnRoute === undefined) {
      return '';
    }
    return `登录后继续前往${NavigationPolicy.label(param.returnRoute)}`;
  }

  static validServiceId(param: NavigationRouteParam): number | undefined {
    return NavigationPolicy.positiveId(param.serviceId);
  }

  static validConversationId(param: NavigationRouteParam): number | undefined {
    return NavigationPolicy.positiveId(param.conversationId);
  }

  static validQuoteId(param: NavigationRouteParam): number | undefined {
    return NavigationPolicy.positiveId(param.quoteId);
  }

  static validOrderId(param: NavigationRouteParam): number | undefined {
    return NavigationPolicy.positiveId(param.orderId);
  }

  static conversationPathIndex(pathNames: string[],
    paramAt: (index: number) => NavigationRouteParam | undefined, conversationId: number): number {
    for (let index = pathNames.length - 1; index >= 0; index--) {
      if (pathNames[index] === AppRoute.CONVERSATION_DETAIL &&
        paramAt(index)?.conversationId === conversationId) {
        return index;
      }
    }
    return -1;
  }

  private static positiveId(id: number | undefined): number | undefined {
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : undefined;
  }

  static label(route: AppRoute): string {
    switch (route) {
      case AppRoute.ORDER_ENGAGEMENT: return '本次约拍的评价与申诉';
      case AppRoute.NOTIFICATIONS: return '通知';
      case AppRoute.CREDIT: return '信用分';
      case AppRoute.MOMENT_DETAIL: return '动态详情';
      case AppRoute.LOGIN:
        return '登录';
      case AppRoute.HALL:
        return '大厅';
      case AppRoute.DEMAND_DETAIL:
        return '需求详情';
      case AppRoute.SERVICE_DETAIL:
        return '摄影橱窗';
      case AppRoute.CONVERSATION_DETAIL:
        return '会话';
      case AppRoute.QUOTE_FORM:
      case AppRoute.QUOTE_DETAIL:
        return '报价';
      case AppRoute.ORDER_DETAIL:
        return '订单详情';
      case AppRoute.DELIVERY_GALLERY:
        return '作品相册';
      case AppRoute.DELIVERY_UPLOAD:
        return '上传照片';
      case AppRoute.PUBLISH:
        return '发布需求';
      case AppRoute.MESSAGE:
        return '消息';
      case AppRoute.ORDER:
        return '订单';
      case AppRoute.PUBLIC_PROFILE:
        return '用户主页';
      case AppRoute.PROFILE:
        return '个人中心';
      default:
        return '目标页面';
    }
  }
}

export class NavigationClickGuard {
  private lastAcceptedAt: number = -1;
  private readonly cooldownMs: number;

  constructor(cooldownMs: number = 350) {
    this.cooldownMs = cooldownMs;
  }

  accept(timestampMs: number): boolean {
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
      return false;
    }
    if (this.lastAcceptedAt >= 0 && timestampMs - this.lastAcceptedAt < this.cooldownMs) {
      return false;
    }
    this.lastAcceptedAt = timestampMs;
    return true;
  }
}
