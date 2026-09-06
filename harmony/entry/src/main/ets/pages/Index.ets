import { EnvironmentConfig } from '../common/config/EnvironmentConfig';

const ROUTE_LOGIN: string = 'Login';
const ROUTE_HALL: string = 'Hall';
const ROUTE_DEMAND_DETAIL: string = 'DemandDetail';
const ROUTE_PUBLISH: string = 'Publish';
const ROUTE_MESSAGE: string = 'Message';
const ROUTE_ORDER: string = 'Order';
const ROUTE_PROFILE: string = 'Profile';

@Entry
@Component
struct Index {
  @Provide('appPathStack') appPathStack: NavPathStack = new NavPathStack();

  @Builder
  PageMap(name: string) {
    NavDestination() {
      if (name === ROUTE_LOGIN) {
        this.PlaceholderPage('登录', '登录入口已预留，认证协议确认后接入。');
      } else if (name === ROUTE_HALL) {
        this.PlaceholderPage('大厅', '后续接入需求和服务套餐真实列表。');
      } else if (name === ROUTE_DEMAND_DETAIL) {
        this.PlaceholderPage('需求详情', '后续接入 demandId 参数和需求详情接口。');
      } else if (name === ROUTE_PUBLISH) {
        this.PlaceholderPage('发布需求', '后续接入发布表单和权限校验。');
      } else if (name === ROUTE_MESSAGE) {
        this.PlaceholderPage('消息', '后续接入现有消息接口，不在本步新增实时通信。');
      } else if (name === ROUTE_ORDER) {
        this.PlaceholderPage('订单', '后续接入订单状态和服务流程。');
      } else if (name === ROUTE_PROFILE) {
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

      Text(description)
        .fontSize(16)
        .fontColor('#666666')
        .margin({ top: 16 })
        .textAlign(TextAlign.Center)

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

  private openPage(route: string): void {
    this.appPathStack.pushPathByName(route, null);
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

        Text('当前为导航骨架，尚未接入真实数据。')
          .fontSize(14)
          .fontColor('#8A817A')
          .margin({ top: 20 })

        Button('进入大厅')
          .width('80%')
          .height(48)
          .margin({ top: 32 })
          .onClick(() => this.openPage(ROUTE_HALL))

        Row() {
          Button('登录')
            .layoutWeight(1)
            .margin({ right: 8 })
            .onClick(() => this.openPage(ROUTE_LOGIN))
          Button('个人中心')
            .layoutWeight(1)
            .margin({ left: 8 })
            .onClick(() => this.openPage(ROUTE_PROFILE))
        }
        .width('80%')
        .margin({ top: 16 })

        Row() {
          Button('发布需求')
            .layoutWeight(1)
            .margin({ right: 8 })
            .onClick(() => this.openPage(ROUTE_PUBLISH))
          Button('消息')
            .layoutWeight(1)
            .margin({ left: 8, right: 8 })
            .onClick(() => this.openPage(ROUTE_MESSAGE))
          Button('订单')
            .layoutWeight(1)
            .margin({ left: 8 })
            .onClick(() => this.openPage(ROUTE_ORDER))
        }
        .width('80%')
        .margin({ top: 16 })
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
