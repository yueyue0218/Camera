import { OrderEngagementPage } from './OrderEngagementPage';
import { NotificationTarget } from '../features/notifications/NotificationTargetResolver';
import { NotificationPage } from './NotificationPage';
import { CreditPage } from './CreditPage';
import { NotificationMomentPage } from './NotificationMomentPage';
import { AppClient } from '../app/AppClient';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraAppShell } from '../features/shell/PortraAppShell';
import { AppRoute, NavigationRouteParam } from '../model/NavigationModels';
import { NavigationClickGuard, NavigationPolicy } from '../navigation/NavigationPolicy';
import { LoginPage } from './LoginPage';
import { DemandDetailPage } from './DemandDetailPage';
import { ServiceDetailPage } from './ServiceDetailPage';
import { ConversationDetailPage } from './ConversationDetailPage';
import { MessagePage } from './MessagePage';
import { OrderPage } from './OrderPage';
import { ProfilePage } from './ProfilePage';
import { PublicProfilePage } from './PublicProfilePage';
import { PublishPage } from './PublishPage';
import { PortraTheme } from '../theme/PortraTheme';

const EMPTY_ROUTE_PARAM: NavigationRouteParam = {};
const PROFILE_LOGIN_PARAM: NavigationRouteParam = { returnRoute: AppRoute.PROFILE };

@Entry
@Component
struct Index {
  @Provide('appPathStack') appPathStack: NavPathStack = new NavPathStack();
  private readonly appClient: AppClient = AppClient.shared;
  private readonly navigationClickGuard: NavigationClickGuard = new NavigationClickGuard();
  private restorePromise?: Promise<void>;
  @State private orderReloadEpoch: number = 0;

  aboutToAppear(): void {
    this.restorePromise = this.appClient.restoreSession();
  }

  @Builder
  PageMap(name: string, param: Object) {
    NavDestination() {
      if (name === AppRoute.LOGIN) {
        LoginPage({
          contextText: NavigationPolicy.loginDescription(param as NavigationRouteParam),
          onBack: () => this.appPathStack.pop(),
          onSuccess: () => this.completeLogin(param as NavigationRouteParam)
        });
      } else if (name === AppRoute.HALL) {
        this.AppShell((param as NavigationRouteParam).initialTab ?? 0);
      } else if (name === AppRoute.DEMAND_DETAIL) {
        this.DemandDetailDestination(param);
      } else if (name === AppRoute.SERVICE_DETAIL) {
        this.ServiceDetailDestination(param);
      } else if (name === AppRoute.CONVERSATION_DETAIL) {
        this.ConversationDetailDestination(param);
      } else if (name === AppRoute.PUBLISH) {
        PublishPage({
          onBack: () => this.appPathStack.pop(),
          onPublished: (demandId: number) => {
            this.appPathStack.pop();
            this.pushRoute(AppRoute.DEMAND_DETAIL, { demandId: demandId });
          }
        });
      } else if (name === AppRoute.NOTIFICATIONS) {
        NotificationPage({ onBack: () => this.appPathStack.pop(),
          onRequireLogin: () => this.openPage(AppRoute.LOGIN, { returnRoute: AppRoute.NOTIFICATIONS }),
          onOpenMoment: (id: number) => this.openPage(AppRoute.MOMENT_DETAIL, { momentId: id }),
          onOpenCredit: () => this.openPage(AppRoute.CREDIT), onOpenTarget: (target: NotificationTarget) => this.openNotificationTarget(target), onOpenOrders: () => this.openPage(AppRoute.ORDER) });
      } else if (name === AppRoute.ORDER_ENGAGEMENT) {
        OrderEngagementPage({ targetKind: (param as NavigationRouteParam).targetKind ?? 'order',
          targetId: (param as NavigationRouteParam).targetId ?? 0, expectedOrderId: (param as NavigationRouteParam).orderId ?? 0,
          onBack: () => this.appPathStack.pop(),
          onRequireLogin: () => this.openPage(AppRoute.LOGIN, { returnRoute: AppRoute.ORDER_ENGAGEMENT,
            targetKind: (param as NavigationRouteParam).targetKind, targetId: (param as NavigationRouteParam).targetId,
            orderId: (param as NavigationRouteParam).orderId }) });
      } else if (name === AppRoute.CREDIT) {
        CreditPage({ onBack: () => this.appPathStack.pop(),
          onRequireLogin: () => this.openPage(AppRoute.LOGIN, { returnRoute: AppRoute.CREDIT }) });
      } else if (name === AppRoute.MOMENT_DETAIL) {
        NotificationMomentPage({ momentId: (param as NavigationRouteParam).momentId ?? 0,
          onBack: () => this.appPathStack.pop(),
          onRequireLogin: () => this.openPage(AppRoute.LOGIN, { returnRoute: AppRoute.MOMENT_DETAIL,
            momentId: (param as NavigationRouteParam).momentId }) });
      } else if (name === AppRoute.MESSAGE) {
        MessagePage({
          onOpenMoment: (id: number) => this.openPage(AppRoute.MOMENT_DETAIL, { momentId: id }),
          onOpenCredit: () => this.openPage(AppRoute.CREDIT), onOpenTarget: (target: NotificationTarget) => this.openNotificationTarget(target), onOpenOrders: () => this.openPage(AppRoute.ORDER),
          onRequireLogin: () => this.openPage(AppRoute.LOGIN, { returnRoute: AppRoute.MESSAGE }),
          onBack: () => this.appPathStack.pop(),
          onOpenConversation: (conversationId: number) =>
            this.openPage(AppRoute.CONVERSATION_DETAIL, { conversationId: conversationId })
        });
      } else if (name === AppRoute.ORDER) {
        OrderPage({ reloadEpoch: this.orderReloadEpoch, onBack: () => this.appPathStack.pop(),
          onOpenEngagement: (id: number) => this.openPage(AppRoute.ORDER_ENGAGEMENT, { targetKind: 'order', targetId: id }) });
      } else if (name === AppRoute.PUBLIC_PROFILE) {
        this.PublicProfileDestination(param);
      } else if (name === AppRoute.PROFILE) {
        ProfilePage({
          onBack: () => this.appPathStack.pop(),
          onSignedOut: () => this.appPathStack.pop(),
          onRequireLogin: () => {
            this.appPathStack.pop();
            this.appPathStack.pushPathByName(AppRoute.LOGIN, PROFILE_LOGIN_PARAM);
          },
          onOpenCredit: () => this.openPage(AppRoute.CREDIT),
          onOpenOrders: () => this.openPage(AppRoute.ORDER),
          onOpenMessages: () => this.openPage(AppRoute.MESSAGE),
          onOpenPublish: () => this.openPage(AppRoute.PUBLISH)
        });
      } else {
        this.PlaceholderPage('页面不存在', '未找到对应的导航目标。');
      }
    }
    .hideTitleBar(true)
    .onShown(() => {
      if (name === AppRoute.ORDER) { this.orderReloadEpoch++; }
    })
  }

  @Builder
  AppShell(initialTab: number = 0) {
    PortraAppShell({
      initialTab: initialTab,
      onOpenAuthor: (userId: number, role: string) => this.openPage(AppRoute.PUBLIC_PROFILE,
        { userId: userId, userRole: role }),
      onRequireMomentLogin: () => this.openPage(AppRoute.LOGIN, { returnRoute: AppRoute.HALL, initialTab: 1 }),
      onOpenRoute: (route: AppRoute, id?: number) => {
        if (id === undefined) {
          this.openPage(route);
        } else if (route === AppRoute.SERVICE_DETAIL) {
          this.openPage(route, { serviceId: id });
        } else {
          this.openPage(route, { demandId: id });
        }
      }
    })
  }

  @Builder
  PlaceholderPage(title: string, description: string) {
    Column() {
      Text(title)
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)

      PortraEmptyView({ message: description })

      Button('返回')
        .width('72%')
        .height(48)
        .margin({ top: 32 })
        .onClick(() => this.appPathStack.pop())
    }
    .width('100%')
    .height('100%')
    .padding({ left: 24, right: 24 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(PortraTheme.pageBackground)
  }

  @Builder
  DemandDetailDestination(param: Object) {
    if (this.validDemandId(param) === 0) {
      this.PlaceholderPage('需求详情', '无效的需求编号');
    } else {
      DemandDetailPage({
        demandId: this.validDemandId(param),
        onBack: () => this.appPathStack.pop(),
        onRequireLogin: () => this.openLoginFor(AppRoute.DEMAND_DETAIL,
          { demandId: this.validDemandId(param) }),
        onOpenConversation: (conversationId: number) =>
          this.pushRoute(AppRoute.CONVERSATION_DETAIL, { conversationId: conversationId })
      });
    }
  }

  @Builder
  ServiceDetailDestination(param: Object) {
    if (this.validServiceId(param) === 0) {
      this.PlaceholderPage('摄影橱窗', '无效的橱窗编号');
    } else {
      ServiceDetailPage({
        serviceId: this.validServiceId(param),
        onBack: () => this.appPathStack.pop(),
        onRequireLogin: () => this.openLoginFor(AppRoute.SERVICE_DETAIL,
          { serviceId: this.validServiceId(param) }),
        onOpenConversation: (conversationId: number) =>
          this.pushRoute(AppRoute.CONVERSATION_DETAIL, { conversationId: conversationId })
      });
    }
  }

  @Builder
  ConversationDetailDestination(param: Object) {
    if (this.validConversationId(param) === 0) {
      this.PlaceholderPage('约拍会话', '无效的会话编号');
    } else {
      ConversationDetailPage({ conversationId: this.validConversationId(param),
        onBack: () => this.appPathStack.pop() });
    }
  }

  @Builder
  PublicProfileDestination(param: Object) {
    if (this.validPublicUserId(param) === 0 || this.validPublicUserRole(param).length === 0) {
      this.PlaceholderPage('用户主页', '无效的用户身份');
    } else {
      PublicProfilePage({ targetUserId: this.validPublicUserId(param), targetRole: this.validPublicUserRole(param),
        onBack: () => this.appPathStack.pop(), onRequireLogin: () => {
          this.appPathStack.pop();
          this.openPage(AppRoute.PUBLIC_PROFILE, param as NavigationRouteParam);
        } });
    }
  }

  private validPublicUserId(param: Object): number {
    return NavigationPolicy.validPublicUserId(param as NavigationRouteParam) ?? 0;
  }

  private validPublicUserRole(param: Object): string {
    return NavigationPolicy.validPublicUserRole(param as NavigationRouteParam) ?? '';
  }

  private validDemandId(param: Object): number {
    return NavigationPolicy.validDemandId(param as NavigationRouteParam) ?? 0;
  }

  private validServiceId(param: Object): number {
    return NavigationPolicy.validServiceId(param as NavigationRouteParam) ?? 0;
  }

  private validConversationId(param: Object): number {
    return NavigationPolicy.validConversationId(param as NavigationRouteParam) ?? 0;
  }

  private openNotificationTarget(target: NotificationTarget): void {
    this.openPage(AppRoute.ORDER_ENGAGEMENT, { targetKind: target.kind, targetId: target.id, orderId: target.orderId });
  }
  private pushRoute(route: AppRoute, param: NavigationRouteParam): void {
    this.appPathStack.pushPathByName(route, param);
  }

  private openLoginFor(route: AppRoute, param: NavigationRouteParam): void {
    const loginParam: NavigationRouteParam = {
      returnRoute: route, targetKind: param.targetKind, targetId: param.targetId, orderId: param.orderId, momentId: param.momentId, demandId: param.demandId, serviceId: param.serviceId,
      userId: param.userId, userRole: param.userRole, initialTab: param.initialTab
    };
    this.pushRoute(AppRoute.LOGIN, loginParam);
  }

  private completeLogin(param: NavigationRouteParam): void {
    this.appPathStack.pop();
    const returnRoute = param.returnRoute;
    if (returnRoute === AppRoute.DEMAND_DETAIL || returnRoute === AppRoute.SERVICE_DETAIL) {
      return;
    }
    const paths = this.appPathStack.getAllPathName();
    if (returnRoute === AppRoute.HALL && paths.length > 0 && paths[paths.length - 1] === AppRoute.HALL) {
      return;
    }
    if (returnRoute !== undefined && returnRoute !== AppRoute.LOGIN) {
      const returnParam: NavigationRouteParam = {
        targetKind: param.targetKind, targetId: param.targetId, orderId: param.orderId,
        momentId: param.momentId,
        demandId: param.demandId,
        serviceId: param.serviceId,
        conversationId: param.conversationId,
        userId: param.userId, userRole: param.userRole, initialTab: param.initialTab
      };
      this.pushRoute(returnRoute, returnParam);
    }
  }

  private async openPage(route: AppRoute, param: NavigationRouteParam = EMPTY_ROUTE_PARAM): Promise<void> {
    if (!this.navigationClickGuard.accept(Date.now())) {
      return;
    }
    if (this.restorePromise !== undefined) {
      await this.restorePromise;
    }
    const resolution = NavigationPolicy.resolve(route, param, this.appClient.sessionManager.isAuthenticated());
    this.appPathStack.pushPathByName(resolution.route, resolution.param);
  }

  build() {
    Navigation(this.appPathStack) {
      this.AppShell()
    }
    .navDestination(this.PageMap)
    .hideTitleBar(true)
    .mode(NavigationMode.Stack)
  }
}
