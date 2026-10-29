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
import { PublishPage } from './PublishPage';
import { PortraTheme } from '../theme/PortraTheme';
import { PrivacyConsentPage } from '../privacy/PrivacyConsentPage';

const EMPTY_ROUTE_PARAM: NavigationRouteParam = {};
const PROFILE_LOGIN_PARAM: NavigationRouteParam = { returnRoute: AppRoute.PROFILE };

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
    this.consentError = '';
    this.consentGateState = ConsentGateState.REQUIRED;
  }

  private beginPostConsentBootstrap(): void {
    const bootstrap = this.appClient.bootstrapAfterPrivacyConsent().catch(() => {
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
      } else if (name === AppRoute.HALL) {
        this.AppShell();
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
      } else if (name === AppRoute.MESSAGE) {
        MessagePage({
          onBack: () => this.appPathStack.pop(),
          onOpenConversation: (conversationId: number) =>
            this.openPage(AppRoute.CONVERSATION_DETAIL, { conversationId: conversationId })
        });
      } else if (name === AppRoute.ORDER) {
        OrderPage({ onBack: () => this.appPathStack.pop() });
      } else if (name === AppRoute.PROFILE) {
        ProfilePage({
          onBack: () => this.appPathStack.pop(),
          onSignedOut: () => this.appPathStack.pop(),
          onRequireLogin: () => {
            this.appPathStack.pop();
            this.appPathStack.pushPathByName(AppRoute.LOGIN, PROFILE_LOGIN_PARAM);
          },
          onOpenOrders: () => this.openPage(AppRoute.ORDER),
          onOpenMessages: () => this.openPage(AppRoute.MESSAGE),
          onOpenPublish: () => this.openPage(AppRoute.PUBLISH),
          onPrivacyConsentWithdrawn: () => this.onPrivacyConsentWithdrawn()
        });
      } else {
        this.PlaceholderPage('页面不存在', '未找到对应的导航目标。');
      }
    }
    .hideTitleBar(true)
  }

  @Builder
  AppShell() {
    PortraAppShell({
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

  private validDemandId(param: Object): number {
    return NavigationPolicy.validDemandId(param as NavigationRouteParam) ?? 0;
  }

  private validServiceId(param: Object): number {
    return NavigationPolicy.validServiceId(param as NavigationRouteParam) ?? 0;
  }

  private validConversationId(param: Object): number {
    return NavigationPolicy.validConversationId(param as NavigationRouteParam) ?? 0;
  }

  private pushRoute(route: AppRoute, param: NavigationRouteParam): void {
    this.appPathStack.pushPathByName(route, param);
  }

  private openLoginFor(route: AppRoute, param: NavigationRouteParam): void {
    const loginParam: NavigationRouteParam = {
      returnRoute: route, demandId: param.demandId, serviceId: param.serviceId
    };
    this.pushRoute(AppRoute.LOGIN, loginParam);
  }

  private completeLogin(param: NavigationRouteParam): void {
    this.appPathStack.pop();
    const returnRoute = param.returnRoute;
    if (returnRoute === AppRoute.DEMAND_DETAIL || returnRoute === AppRoute.SERVICE_DETAIL) {
      return;
    }
    if (returnRoute !== undefined && returnRoute !== AppRoute.LOGIN) {
      const returnParam: NavigationRouteParam = {
        demandId: param.demandId,
        serviceId: param.serviceId,
        conversationId: param.conversationId
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
