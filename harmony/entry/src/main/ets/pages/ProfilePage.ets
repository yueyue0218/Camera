import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraButton } from '../common/components/PortraButton';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { SessionSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct ProfilePage {
  @State private loading: boolean = true;
  @State private signingOut: boolean = false;
  @State private nickname: string = '';
  @State private role: string = '';
  @State private userId: number = 0;
  @State private errorMessage: string = '';
  @State private requiresLogin: boolean = false;
  @State private signOutCleanupFailed: boolean = false;
  private readonly appClient: AppClient = AppClient.shared;
  private loadVersion: number = 0;
  onBack?: () => void;
  onSignedOut?: () => void;
  onRequireLogin?: () => void;
  onOpenOrders?: () => void;
  onOpenMessages?: () => void;
  onOpenPublish?: () => void;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.loadVersion++;
    this.appClient.apiService.cancelCurrentSession();
  }

  private async load(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading = true;
    this.errorMessage = '';
    this.requiresLogin = false;
    this.signOutCleanupFailed = false;
    try {
      const session: SessionSummary = await this.appClient.apiService.currentSession();
      if (version !== this.loadVersion) {
        return;
      }
      this.nickname = session.nickname.trim().length > 0 ? session.nickname : 'Portra 用户';
      this.role = session.role;
      this.userId = session.userId;
    } catch (error) {
      if (version === this.loadVersion) {
        const mapped = error as PortraError;
        this.requiresLogin = mapped.httpStatus === 401 || mapped.businessCode === 40101;
        this.errorMessage = mapped.message || '资料加载失败，请稍后重试';
      }
    } finally {
      if (version === this.loadVersion) {
        this.loading = false;
      }
    }
  }

  private roleLabel(): string {
    if (this.role === 'PROVIDER') {
      return '摄影师';
    }
    if (this.role === 'CUSTOMER') {
      return '约拍用户';
    }
    return '用户';
  }

  private async signOut(): Promise<void> {
    if (this.signingOut) {
      return;
    }
    this.signingOut = true;
    const cleared = await this.appClient.sessionManager.signOut();
    if (cleared) {
      this.onSignedOut?.();
      return;
    }
    this.errorMessage = '本机登录信息未能清除，请重试退出';
    this.signOutCleanupFailed = true;
    this.signingOut = false;
  }

  @Builder
  private MenuRow(title: string, subtitle: string, onAction: () => void) {
    Row({ space: 10 }) {
      Column({ space: 3 }) {
        Text(title)
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.primaryText)
        Text(subtitle)
          .fontSize(11)
          .fontColor(PortraTheme.secondaryText)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      Text('›')
        .fontSize(22)
        .fontColor(PortraTheme.mutedText)
    }
    .width('100%')
    .height(67)
    .padding({ left: 18, right: 18 })
    .backgroundColor(PortraTheme.surface)
    .onClick(() => onAction())
  }

  build() {
    Column() {
      PortraPageHeading({ title: '我的主页', eyebrow: 'PERSONAL ARCHIVE', onBack: this.onBack })

      if (this.loading) {
        PortraLoading({ label: '正在加载账号' })
      } else if (this.signOutCleanupFailed) {
        Column({ space: 16 }) {
          Text(this.errorMessage)
            .fontSize(14)
            .fontColor(PortraTheme.danger)
          PortraButton({ label: '重试退出', loading: this.signingOut,
            onAction: () => this.signOut() })
        }
        .width('100%')
        .padding(24)
      } else if (this.requiresLogin) {
        Column({ space: 16 }) {
          Text('登录状态已失效')
            .fontSize(16)
            .fontColor(PortraTheme.primaryText)
          Button('重新登录')
            .height(44)
            .fontColor(PortraTheme.white)
            .backgroundColor(PortraTheme.primary)
            .borderRadius(PortraTheme.radius)
            .onClick(() => this.onRequireLogin?.())
        }
        .width('100%')
        .padding(24)
      } else if (this.errorMessage.length > 0 && this.nickname.length === 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() })
      } else {
        Scroll() {
          Column({ space: 18 }) {
            Column({ space: 18 }) {
              Row({ space: 14 }) {
                PortraAvatar({ displayName: this.nickname, avatarSize: 68 })
                Column({ space: 7 }) {
                  Text(this.nickname)
                    .fontSize(22)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(PortraTheme.primaryText)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text(`用户编号 ${this.userId}`)
                    .fontSize(12)
                    .fontColor(PortraTheme.secondaryText)
                }
                .layoutWeight(1)
                .alignItems(HorizontalAlign.Start)
              }
              .width('100%')
              Divider().color(PortraTheme.border)
              Row() {
                Text(this.roleLabel())
                  .fontSize(12)
                  .fontWeight(FontWeight.Medium)
                  .fontColor(PortraTheme.primary)
                  .padding({ left: 10, right: 10, top: 6, bottom: 6 })
                  .backgroundColor(PortraTheme.primarySoft)
                  .borderRadius(6)
                Blank()
                Text('PORTRA MEMBER')
                  .fontSize(10)
                  .fontColor(PortraTheme.mutedText)
              }
              .width('100%')
            }
            .width('100%')
            .padding(18)
            .alignItems(HorizontalAlign.Start)
            .backgroundColor(PortraTheme.surface)
            .borderRadius(8)
            .border({ width: 1, color: PortraTheme.border })

            Text('我的约拍')
              .width('100%')
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor(PortraTheme.primaryText)
              .margin({ top: 9 })

            Column() {
              this.MenuRow('我的订单', '查看合作进度', () => this.onOpenOrders?.())
              Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
              this.MenuRow('消息', '与约拍对象保持联系', () => this.onOpenMessages?.())
              Divider().color(PortraTheme.border).padding({ left: 18, right: 18 })
              this.MenuRow('发布需求', '记录新的拍摄想法', () => this.onOpenPublish?.())
            }
            .width('100%')
            .backgroundColor(PortraTheme.surface)
            .borderRadius(8)
            .clip(true)
            .border({ width: 1, color: PortraTheme.border })

            if (this.errorMessage.length > 0) {
              Text(this.errorMessage)
                .width('100%')
                .fontSize(13)
                .fontColor(PortraTheme.danger)
            }

            Button(this.signingOut ? '退出中…' : '退出登录')
              .width('100%')
              .height(48)
              .fontSize(14)
              .fontColor(PortraTheme.danger)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .enabled(!this.signingOut)
              .margin({ top: 12 })
              .onClick(() => this.signOut())
          }
          .width('100%')
          .padding({ left: 20, right: 20, top: 16, bottom: 32 })
          .alignItems(HorizontalAlign.Start)
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
