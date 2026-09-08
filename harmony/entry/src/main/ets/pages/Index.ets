import { AppClient } from '../app/AppClient';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraAppShell } from '../features/shell/PortraAppShell';
import { AppRoute, NavigationRouteParam } from '../model/NavigationModels';
import { NavigationClickGuard, NavigationPolicy } from '../navigation/NavigationPolicy';
import { PortraTheme } from '../theme/PortraTheme';

const EMPTY_ROUTE_PARAM: NavigationRouteParam = {};

@Entry
@Component
struct Index {
  @Provide('appPathStack') appPathStack: NavPathStack = new NavPathStack();
  private readonly appClient: AppClient = AppClient.shared;
  private readonly navigationClickGuard: NavigationClickGuard = new NavigationClickGuard();

  aboutToAppear(): void {
    this.appClient.restoreSession();
  }

  @Builder
  PageMap(name: string, param: Object) {
    NavDestination() {
      if (name === AppRoute.LOGIN) {
        this.PlaceholderPage('登录', NavigationPolicy.loginDescription(param as NavigationRouteParam));
      } else if (name === AppRoute.HALL) {
        this.AppShell();
      } else if (name === AppRoute.DEMAND_DETAIL) {
        this.DemandDetailPage(param);
      } else if (name === AppRoute.PUBLISH) {
        this.PlaceholderPage('发布需求', '后续接入发布表单和权限校验。');
      } else if (name === AppRoute.MESSAGE) {
        this.PlaceholderPage('消息', '后续接入现有消息接口，不在本步新增实时通信。');
      } else if (name === AppRoute.ORDER) {
        this.PlaceholderPage('订单', '后续接入订单状态和服务流程。');
      } else if (name === AppRoute.PROFILE) {
        this.PlaceholderPage('个人中心', '后续接入个人资料和账号状态。');
      } else {
        this.PlaceholderPage('页面不存在', '未找到对应的导航目标。');
      }
    }
    .hideTitleBar(true)
  }

  @Builder
  AppShell() {
    PortraAppShell({
      onOpenRoute: (route: AppRoute, demandId?: number) => {
        if (demandId === undefined) {
          this.openPage(route);
        } else {
          this.openPage(route, { demandId: demandId });
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
  DemandDetailPage(param: Object) {
    if (param === null) {
      this.PlaceholderPage('需求详情', '缺少 demandId，无法打开详情。');
    } else {
      this.PlaceholderPage('需求详情', this.demandDetailDescription(param));
    }
  }

  private demandDetailDescription(param: Object): string {
    const routeParam = param as NavigationRouteParam;
    const demandId = NavigationPolicy.validDemandId(routeParam);
    if (demandId === undefined) {
      return 'demandId 缺失或无效，无法打开详情。';
    }
    return `当前需求编号：${demandId}`;
  }

  private openPage(route: AppRoute, param: NavigationRouteParam = EMPTY_ROUTE_PARAM): void {
    if (!this.navigationClickGuard.accept(Date.now())) {
      return;
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
