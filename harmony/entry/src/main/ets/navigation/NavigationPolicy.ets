import { AppRoute, NavigationResolution, NavigationRouteParam } from '../model/NavigationModels';

const EMPTY_PARAM: NavigationRouteParam = {};

/**
 * Navigation rules independent of ArkUI, so routes stay consistent across pages.
 * Authentication here only controls entry; authorization remains server-owned.
 */
export class NavigationPolicy {
  static readonly routes: AppRoute[] = [
    AppRoute.LOGIN,
    AppRoute.HALL,
    AppRoute.DEMAND_DETAIL,
    AppRoute.PUBLISH,
    AppRoute.MESSAGE,
    AppRoute.ORDER,
    AppRoute.PROFILE
  ];

  static requiresAuthentication(route: AppRoute): boolean {
    return route === AppRoute.PUBLISH || route === AppRoute.MESSAGE ||
      route === AppRoute.ORDER || route === AppRoute.PROFILE;
  }

  static resolve(route: AppRoute, param: NavigationRouteParam = EMPTY_PARAM,
    authenticated: boolean = false): NavigationResolution {
    if (!authenticated && NavigationPolicy.requiresAuthentication(route)) {
      return {
        route: AppRoute.LOGIN,
        param: {
          returnRoute: route
        }
      };
    }
    return { route: route, param: param };
  }

  static validDemandId(param: NavigationRouteParam): number | undefined {
    const demandId = param.demandId;
    if (typeof demandId !== 'number' || !Number.isSafeInteger(demandId) || demandId <= 0) {
      return undefined;
    }
    return demandId;
  }

  static loginDescription(param: NavigationRouteParam): string {
    if (param.returnRoute === undefined) {
      return '登录入口已预留，认证协议确认后接入。';
    }
    return `请先登录，再继续前往${NavigationPolicy.label(param.returnRoute)}。`;
  }

  static label(route: AppRoute): string {
    switch (route) {
      case AppRoute.LOGIN:
        return '登录';
      case AppRoute.HALL:
        return '大厅';
      case AppRoute.DEMAND_DETAIL:
        return '需求详情';
      case AppRoute.PUBLISH:
        return '发布需求';
      case AppRoute.MESSAGE:
        return '消息';
      case AppRoute.ORDER:
        return '订单';
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
