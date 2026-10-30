import { UiPerf } from '../common/performance/UiPerf';
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
import { OrderPage } from './OrderPage';
import { PublicProfilePage } from './PublicProfilePage';
import { PublishPage } from './PublishPage';
import { PortraTheme } from '../theme/PortraTheme';
import { PrivacyConsentPage } from '../privacy/PrivacyConsentPage';

const EMPTY_ROUTE_PARAM: NavigationRouteParam = {};

enum ConsentGateState {
  CHECKING = 'CHECKING',
  REQUIRED = 'REQUIRED',
  ACCEPTED = 'ACCEPTED'
}

@Entry
@Component
struct Index {
  @Provide('appPathStack') appPathStack: NavPathStack = new NavPathStack();
  private readonly appClient: AppClient = AppClient.shared;
  private readonly navigationClickGuard: NavigationClickGuard = new NavigationClickGuard();
  private restorePromise?: Promise<void>;
  @State private consentGateState: ConsentGateState = ConsentGateState.CHECKING;
  @State private consentError: string = '';
  @State private mainTab: number = 0;
  @State private sessionEpoch: number = 0;
  @State private orderReloadEpoch: number = 0;
  @State private detailVisibleEpoch: number = 0;
  @State private detailVisibleRoute: string = '';
  @State private detailVisibleId: number = 0;
  private publishBackHandler?: () => boolean;

  aboutToAppear(): void {
    if (this.appClient.hasRequiredPrivacyConsent()) {
      this.consentGateState = ConsentGateState.ACCEPTED;
      this.beginPostConsentBootstrap();
    } else {
      this.consentGateState = ConsentGateState.REQUIRED;
    }
  }

  private acceptPrivacyConsent(): void {
    this.consentError = '';
    try {
      this.appClient.acceptRequiredPrivacyConsent(Date.now());
      this.consentGateState = ConsentGateState.ACCEPTED;
      this.beginPostConsentBootstrap();
    } catch {
      this.consentError = '同意记录保存失败，请检查设备存储后重试';
    }
  }

  private declinePrivacyConsent(): void {
    this.consentError = '';
    this.appClient.terminateApplication().catch(() => {
      this.consentError = '暂时无法退出应用，请使用系统返回桌面';
    });
  }

  private onPrivacyConsentWithdrawn(): void {
    this.appPathStack.clear();
    this.restorePromise = undefined;
    this.mainTab = 0;
    this.sessionEpoch++;
    this.consentError = '';
    this.consentGateState = ConsentGateState.REQUIRED;
  }

  private beginPostConsentBootstrap(): void {
    const bootstrap = this.appClient.bootstrapAfterPrivacyConsent().then(() => {
      this.sessionEpoch++;
    }).catch(() => {
      this.consentError = '设备信息初始化失败，登录功能暂时不可用';
    });
    this.restorePromise = bootstrap;
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

      } else if (name === AppRoute.DEMAND_DETAIL) {
        this.DemandDetailDestination(param);
      } else if (name === AppRoute.SERVICE_DETAIL) {
        this.ServiceDetailDestination(param);
      } else if (name === AppRoute.CONVERSATION_DETAIL) {
        this.ConversationDetailDestination(param);
      } else if (name === AppRoute.PUBLISH) {
        PublishPage({ demandId: (param as NavigationRouteParam).demandId ?? 0, serviceId: (param as NavigationRouteParam).serviceId ?? 0,
          onBackHandler: (handler: (() => boolean) | undefined) => { this.publishBackHandler = handler; },
          onServicePublished: (id: number) => { this.appPathStack.pop(); if ((param as NavigationRouteParam).returnRoute !== AppRoute.SERVICE_DETAIL) { this.pushRoute(AppRoute.SERVICE_DETAIL, { serviceId: id }); } },
          onBack: () => this.appPathStack.pop(),
          onPublished: (demandId: number) => {
            this.appPathStack.pop();
            if ((param as NavigationRouteParam).returnRoute !== AppRoute.DEMAND_DETAIL) { this.pushRoute(AppRoute.DEMAND_DETAIL, { demandId: demandId }); }
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
      } else if (name === AppRoute.ORDER) {
        OrderPage({ reloadEpoch: this.orderReloadEpoch, onBack: () => this.appPathStack.pop(),
          onOpenEngagement: (id: number) => this.openPage(AppRoute.ORDER_ENGAGEMENT, { targetKind: 'order', targetId: id }) });
      } else if (name === AppRoute.PUBLIC_PROFILE) {
        this.PublicProfileDestination(param);
      } else {
        this.PlaceholderPage('页面不存在', '未找到对应的导航目标。');
      }
    }
    .hideTitleBar(true)
    .onBackPressed(() => name === AppRoute.PUBLISH ? (this.publishBackHandler?.() ?? false) : false)
    .onShown(() => {
      if (name === AppRoute.ORDER) { this.orderReloadEpoch++; }
      if (name === AppRoute.SERVICE_DETAIL || name === AppRoute.DEMAND_DETAIL) {
        this.detailVisibleRoute = name;
        this.detailVisibleId = name === AppRoute.SERVICE_DETAIL ? this.validServiceId(param) : this.validDemandId(param);
        this.detailVisibleEpoch++;
      }
    })
  }

  @Builder
  AppShell() {
    PortraAppShell({
      selectedTab: this.mainTab,
      sessionEpoch: this.sessionEpoch,
      onSignedOut: () => { this.sessionEpoch++; this.mainTab = 0; },
      onRequireTabLogin: (tab: number) => this.openPage(AppRoute.LOGIN, { returnRoute: AppRoute.HALL, initialTab: tab }),
      onOpenTarget: (target: NotificationTarget) => this.openNotificationTarget(target),
      onOpenAuthor: (userId: number, role: string) => this.openPage(AppRoute.PUBLIC_PROFILE,
        { userId: userId, userRole: role }),
      onRequireMomentLogin: () => this.openPage(AppRoute.LOGIN, { returnRoute: AppRoute.HALL, initialTab: 1 }),
      onEditDemand: (id: number) => this.openPage(AppRoute.PUBLISH, { demandId: id }),
      onEditService: (id: number) => this.openPage(AppRoute.PUBLISH, { serviceId: id }),
      onPrivacyConsentWithdrawn: () => this.onPrivacyConsentWithdrawn(),
      onOpenRoute: (route: AppRoute, id?: number) => {
        if (id === undefined) {
          this.openPage(route);
        } else if (route === AppRoute.CONVERSATION_DETAIL) {
          this.openPage(route, { conversationId: id });
        } else if (route === AppRoute.MOMENT_DETAIL) {
          this.openPage(route, { momentId: id });
        } else if (route === AppRoute.SERVICE_DETAIL) {
          this.openPage(route, { serviceId: id });
        } else {
          this.openPage(route, { demandId: id });
        }
      },
      onIdentityChanged: () => { this.sessionEpoch++; }
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
        visibleEpoch: this.detailVisibleRoute === AppRoute.DEMAND_DETAIL && this.detailVisibleId === this.validDemandId(param) ? this.detailVisibleEpoch : 0,
        demandId: this.validDemandId(param),
        onEdit: (id: number) => this.openPage(AppRoute.PUBLISH, { demandId: id, returnRoute: AppRoute.DEMAND_DETAIL }),
        onBack: () => this.appPathStack.pop(),
        onRequireLogin: () => this.openLoginFor(AppRoute.DEMAND_DETAIL,
          { demandId: this.validDemandId(param) }),
        onOpenAuthor: (id: number, role: string) => this.openPage(AppRoute.PUBLIC_PROFILE, { userId: id, userRole: role }),
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
        visibleEpoch: this.detailVisibleRoute === AppRoute.SERVICE_DETAIL && this.detailVisibleId === this.validServiceId(param) ? this.detailVisibleEpoch : 0,
        serviceId: this.validServiceId(param),
        onEdit: (id: number) => this.openPage(AppRoute.PUBLISH, { serviceId: id, returnRoute: AppRoute.SERVICE_DETAIL }),
        onBack: () => this.appPathStack.pop(),
        onRequireLogin: () => this.openLoginFor(AppRoute.SERVICE_DETAIL,
          { serviceId: this.validServiceId(param) }),
        onOpenAuthor: (id: number, role: string) => this.openPage(AppRoute.PUBLIC_PROFILE, { userId: id, userRole: role }),
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
        onBack: () => { this.appPathStack.pop(); this.sessionEpoch++; } });
    }
  }

  @Builder
  PublicProfileDestination(param: Object) {
    if (this.validPublicUserId(param) === 0 || this.validPublicUserRole(param).length === 0) {
      this.PlaceholderPage('用户主页', '无效的用户身份');
    } else {
      PublicProfilePage({
          onOpenSelf: () => { this.appPathStack.clear(); this.mainTab = 3; },
          onOpenMoment: (id: number) => this.openPage(AppRoute.MOMENT_DETAIL, { momentId: id }),
          onOpenDemand: (id: number) => this.openPage(AppRoute.DEMAND_DETAIL, { demandId: id }),
          onOpenService: (id: number) => this.openPage(AppRoute.SERVICE_DETAIL, { serviceId: id }), targetUserId: this.validPublicUserId(param), targetRole: this.validPublicUserRole(param),
        onBack: () => this.appPathStack.pop(), onRequireLogin: () => {
          this.appPathStack.pop();
          this.openLoginFor(AppRoute.PUBLIC_PROFILE, param as NavigationRouteParam);
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
    this.sessionEpoch++;
    const returnRoute = param.returnRoute;
    if (returnRoute === AppRoute.HALL || returnRoute === AppRoute.MESSAGE || returnRoute === AppRoute.PROFILE) {
      this.mainTab = returnRoute === AppRoute.MESSAGE ? 2 : returnRoute === AppRoute.PROFILE ? 3 : (param.initialTab ?? 0);
      return;
    }
    if (returnRoute === AppRoute.DEMAND_DETAIL || returnRoute === AppRoute.SERVICE_DETAIL) {
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
    UiPerf.mark('route.click.' + route);
    if (!this.navigationClickGuard.accept(Date.now())) {
      return;
    }
    if (this.restorePromise !== undefined) {
      await this.restorePromise;
    }
    if (route === AppRoute.HALL || route === AppRoute.MESSAGE || route === AppRoute.PROFILE) {
      this.mainTab = route === AppRoute.MESSAGE ? 2 : route === AppRoute.PROFILE ? 3 : (param.initialTab ?? 0);
      this.appPathStack.clear();
      return;
    }
    const resolution = NavigationPolicy.resolve(route, param, this.appClient.sessionManager.isAuthenticated());
    this.appPathStack.pushPathByName(resolution.route, resolution.param);
  }

  build() {
    if (this.consentGateState === ConsentGateState.CHECKING) {
      Column({ space: 12 }) {
        Text('PORTRA')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primary)
        Text('正在检查本机隐私设置')
          .fontSize(13)
          .fontColor(PortraTheme.secondaryText)
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .backgroundColor(PortraTheme.pageBackground)
    } else if (this.consentGateState === ConsentGateState.REQUIRED) {
      PrivacyConsentPage({
        errorMessage: this.consentError,
        onAccept: () => this.acceptPrivacyConsent(),
        onDecline: () => this.declinePrivacyConsent()
      })
    } else {
      Navigation(this.appPathStack) {
        this.AppShell()
      }
      .navDestination(this.PageMap)
      .hideTitleBar(true)
      .mode(NavigationMode.Stack)
    }
  }
}
