import { EnvironmentConfig } from '../common/config/EnvironmentConfig';
import { PortraButton } from '../common/components/PortraButton';
import { PortraCard } from '../common/components/PortraCard';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { AppRoute, NavigationRouteParam } from '../model/NavigationModels';
import { NavigationClickGuard, NavigationPolicy } from '../navigation/NavigationPolicy';

const EMPTY_ROUTE_PARAM: NavigationRouteParam = {};

@Entry
@Component
struct Index {
  @Provide('appPathStack') appPathStack: NavPathStack = new NavPathStack();
  private readonly navigationClickGuard: NavigationClickGuard = new NavigationClickGuard();

  @Builder
  PageMap(name: string, param: Object) {
    NavDestination() {
      if (name === AppRoute.LOGIN) {
        this.PlaceholderPage('登录', NavigationPolicy.loginDescription(param as NavigationRouteParam));
      } else if (name === AppRoute.HALL) {
        this.PlaceholderPage('大厅', '后续接入需求和服务套餐真实列表。');
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
  PlaceholderPage(title: string, description: string) {
    Column() {
      Text(title)
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor('#252525')

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
    .backgroundColor('#F7F5F2')
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
    // The real session manager will supply this value when D10 is connected.
    const resolution = NavigationPolicy.resolve(route, param, false);
    this.appPathStack.pushPathByName(resolution.route, resolution.param);
  }

  build() {
    Navigation(this.appPathStack) {
      Column() {
        Text('Portra')
          .fontSize(32)
          .fontWeight(FontWeight.Bold)
          .fontColor('#252525')

        Text('HarmonyOS 客户端底座')
          .fontSize(18)
          .fontColor('#6B625C')
          .margin({ top: 8 })

        Text(`当前环境：${EnvironmentConfig.displayName()}`)
          .fontSize(14)
          .fontColor('#8A817A')
          .margin({ top: 12 })

        PortraCard({
          title: '客户端底座',
          description: '当前为导航骨架，尚未接入真实数据。'
        })
          .width('80%')
          .margin({ top: 20 })

        PortraButton({
          label: '进入大厅',
          onAction: () => this.openPage(AppRoute.HALL)
        })
          .width('80%')
          .margin({ top: 32 })

        Row() {
          Button('登录')
            .layoutWeight(1)
            .margin({ right: 8 })
            .onClick(() => this.openPage(AppRoute.LOGIN))
          Button('个人中心')
            .layoutWeight(1)
            .margin({ left: 8 })
            .onClick(() => this.openPage(AppRoute.PROFILE))
        }
        .width('80%')
        .margin({ top: 16 })

        Row() {
          Button('发布需求')
            .layoutWeight(1)
            .margin({ right: 8 })
            .onClick(() => this.openPage(AppRoute.PUBLISH))
          Button('消息')
            .layoutWeight(1)
            .margin({ left: 8, right: 8 })
            .onClick(() => this.openPage(AppRoute.MESSAGE))
          Button('订单')
            .layoutWeight(1)
            .margin({ left: 8 })
            .onClick(() => this.openPage(AppRoute.ORDER))
        }
        .width('80%')
        .margin({ top: 16 })

        Button('打开示例需求详情')
          .width('80%')
          .height(44)
          .margin({ top: 16 })
          .onClick(() => this.openPage(AppRoute.DEMAND_DETAIL, { demandId: 1 }))
      }
      .width('100%')
      .height('100%')
      .padding({ left: 24, right: 24 })
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor('#F7F5F2')
    }
    .navDestination(this.PageMap)
    .hideTitleBar(true)
    .mode(NavigationMode.Stack)
  }
}
