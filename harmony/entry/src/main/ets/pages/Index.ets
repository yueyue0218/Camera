import { AppClient } from '../app/AppClient';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraAppShell } from '../features/shell/PortraAppShell';
import { ConversationVisibility } from '../features/conversation/ConversationVisibility';
import { AppRoute, NavigationRouteParam } from '../model/NavigationModels';
import { NavigationClickGuard, NavigationPolicy } from '../navigation/NavigationPolicy';
import { LoginPage } from './LoginPage';
import { DemandDetailPage } from './DemandDetailPage';
import { ServiceDetailPage } from './ServiceDetailPage';
import { ConversationDetailPage } from './ConversationDetailPage';
import { MessagePage } from './MessagePage';
import { OrderPage } from './OrderPage';
import { OrderDetailPage } from './OrderDetailPage';
import { DeliveryGalleryPage } from './DeliveryGalleryPage';
import { DeliveryUploadPage } from './DeliveryUploadPage';
import { QuoteDetailPage } from './QuoteDetailPage';
import { QuoteFormPage } from './QuoteFormPage';
import { ProfilePage } from './ProfilePage';
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
        this.AppShell();
      } else if (name === AppRoute.DEMAND_DETAIL) {
        this.DemandDetailDestination(param);
      } else if (name === AppRoute.SERVICE_DETAIL) {
        this.ServiceDetailDestination(param);
      } else if (name === AppRoute.CONVERSATION_DETAIL) {
        this.ConversationDetailDestination(param);
      } else if (name === AppRoute.QUOTE_FORM) {
        this.QuoteFormDestination(param);
      } else if (name === AppRoute.QUOTE_DETAIL) {
        this.QuoteDetailDestination(param);
      } else if (name === AppRoute.ORDER_DETAIL) {
        this.OrderDetailDestination(param);
      } else if (name === AppRoute.DELIVERY_GALLERY) {
        this.DeliveryGalleryDestination(param);
      } else if (name === AppRoute.DELIVERY_UPLOAD) {
        this.DeliveryUploadDestination(param);
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
        OrderPage({ onBack: () => this.appPathStack.pop(),
          onOpenOrder: (orderId: number) => this.openPage(AppRoute.ORDER_DETAIL, { orderId: orderId }) });
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
          onOpenPublish: () => this.openPage(AppRoute.PUBLISH)
        });
      } else {
        this.PlaceholderPage('页面不存在', '未找到对应的导航目标。');
      }
    }
    .hideTitleBar(true)
    .onShown(() => ConversationVisibility.show(name, param as NavigationRouteParam))
    .onHidden(() => ConversationVisibility.hide(name, param as NavigationRouteParam))
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
        onBack: () => this.appPathStack.pop(),
        onCreateQuote: () => this.openPage(AppRoute.QUOTE_FORM,
          { conversationId: this.validConversationId(param) }),
        onOpenQuote: (quoteId: number) => this.openPage(AppRoute.QUOTE_DETAIL,
          { conversationId: this.validConversationId(param), quoteId: quoteId }),
        onOpenOrder: (orderId: number) => this.openPage(AppRoute.ORDER_DETAIL,
          { orderId: orderId, conversationId: this.validConversationId(param) }),
        onPayOrder: (orderId: number) => this.openPage(AppRoute.ORDER_DETAIL,
          { orderId: orderId, conversationId: this.validConversationId(param), openPayment: true }),
        onOpenGallery: (orderId: number) => this.openPage(AppRoute.DELIVERY_GALLERY,
          { orderId: orderId }),
        onOpenUpload: (orderId: number) => this.openPage(AppRoute.DELIVERY_UPLOAD,
          { orderId: orderId }) });
    }
  }

  @Builder
  QuoteFormDestination(param: Object) {
    if (!this.validConversationId(param) ||
      ((param as NavigationRouteParam).quoteId !== undefined &&
        !NavigationPolicy.validQuoteId(param as NavigationRouteParam))) {
      this.PlaceholderPage('报价', '无法打开这份报价');
    } else {
      QuoteFormPage({ conversationId: this.validConversationId(param),
        quoteId: (param as NavigationRouteParam).quoteId ?? 0,
        onBack: () => this.appPathStack.pop(),
        onSaved: () => {
          this.appPathStack.pop();
          if ((param as NavigationRouteParam).quoteId !== undefined) this.appPathStack.pop();
        } });
    }
  }

  @Builder
  QuoteDetailDestination(param: Object) {
    if (!this.validConversationId(param) || !NavigationPolicy.validQuoteId(param as NavigationRouteParam)) {
      this.PlaceholderPage('报价', '无法打开这份报价');
    } else {
      QuoteDetailPage({ conversationId: this.validConversationId(param),
        quoteId: (param as NavigationRouteParam).quoteId!,
        onBack: () => this.appPathStack.pop(),
        onEdit: () => this.openPage(AppRoute.QUOTE_FORM, param as NavigationRouteParam),
        onConfirmed: () => this.appPathStack.pop(),
        onOpenOrder: (orderId: number) => this.openPage(AppRoute.ORDER_DETAIL,
          { orderId: orderId, conversationId: this.validConversationId(param) }) });
    }
  }

  @Builder
  OrderDetailDestination(param: Object) {
    if (!NavigationPolicy.validOrderId(param as NavigationRouteParam)) {
      this.PlaceholderPage('订单', '无法打开这笔订单');
    } else {
      OrderDetailPage({ orderId: (param as NavigationRouteParam).orderId!,
        openPayment: (param as NavigationRouteParam).openPayment === true,
        onBack: () => this.appPathStack.pop(),
        onOpenConversation: (conversationId: number) => {
          this.returnToConversation(conversationId);
        },
        onOpenGallery: () => this.openPage(AppRoute.DELIVERY_GALLERY,
          { orderId: (param as NavigationRouteParam).orderId! }),
        onOpenUpload: () => this.openPage(AppRoute.DELIVERY_UPLOAD,
          { orderId: (param as NavigationRouteParam).orderId! }) });
    }
  }

  @Builder
  DeliveryGalleryDestination(param: Object) {
    if (!NavigationPolicy.validOrderId(param as NavigationRouteParam)) {
      this.PlaceholderPage('作品相册', '无法打开这次约拍的照片');
    } else {
      DeliveryGalleryPage({ orderId: (param as NavigationRouteParam).orderId!,
        onBack: () => this.appPathStack.pop(),
        onOpenUpload: () => this.openPage(AppRoute.DELIVERY_UPLOAD,
          { orderId: (param as NavigationRouteParam).orderId! }) });
    }
  }

  @Builder
  DeliveryUploadDestination(param: Object) {
    if (!NavigationPolicy.validOrderId(param as NavigationRouteParam)) {
      this.PlaceholderPage('上传照片', '无法打开这次约拍');
    } else {
      DeliveryUploadPage({ orderId: (param as NavigationRouteParam).orderId!,
        onBack: () => this.appPathStack.pop(),
        onUploaded: () => {
          this.appPathStack.pop();
          this.openGallery((param as NavigationRouteParam).orderId!);
        } });
    }
  }

  private openGallery(orderId: number): void {
    const names = this.appPathStack.getAllPathName();
    for (let index = names.length - 1; index >= 0; index--) {
      const routeParam = this.appPathStack.getParamByIndex(index) as NavigationRouteParam | undefined;
      if (names[index] === AppRoute.DELIVERY_GALLERY && routeParam?.orderId === orderId) {
        this.appPathStack.popToIndex(index);
        return;
      }
    }
    this.openPage(AppRoute.DELIVERY_GALLERY, { orderId: orderId });
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

  private returnToConversation(conversationId: number): void {
    const index = NavigationPolicy.conversationPathIndex(this.appPathStack.getAllPathName(),
      (pathIndex: number) => this.appPathStack.getParamByIndex(pathIndex) as NavigationRouteParam | undefined,
      conversationId);
    if (index >= 0) {
      this.appPathStack.popToIndex(index);
      return;
    }
    this.openPage(AppRoute.CONVERSATION_DETAIL, { conversationId: conversationId });
  }

  private openLoginFor(route: AppRoute, param: NavigationRouteParam): void {
    const loginParam: NavigationRouteParam = {
      returnRoute: route, demandId: param.demandId, serviceId: param.serviceId,
      conversationId: param.conversationId, quoteId: param.quoteId, orderId: param.orderId,
      openPayment: param.openPayment
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
        conversationId: param.conversationId,
        quoteId: param.quoteId, orderId: param.orderId,
        openPayment: param.openPayment
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
