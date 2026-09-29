import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraButton } from '../common/components/PortraButton';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { SessionSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct ProfilePage {
  @State private loading: boolean = true;
  @State private signingOut: boolean = false;
  @State private nickname: string = '';
  @State private role: string = '';
  @State private errorMessage: string = '';
  @State private requiresLogin: boolean = false;
  @State private signOutCleanupFailed: boolean = false;
  private readonly appClient: AppClient = AppClient.shared;
  private loadVersion: number = 0;
  onBack?: () => void;
  onSignedOut?: () => void;
  onRequireLogin?: () => void;

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

  build() {
    Column() {
      Row() {
        Button('返回')
          .fontSize(14)
          .fontColor(PortraTheme.primaryText)
          .backgroundColor(Color.Transparent)
          .onClick(() => this.onBack?.())
        Text('我的')
          .fontSize(PortraTheme.fontTitle)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)
          .margin({ left: 12 })
      }
      .width('100%')
      .height(56)
      .padding({ left: 16, right: 16 })

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
        Column({ space: 20 }) {
          Row({ space: 14 }) {
            PortraAvatar({ displayName: this.nickname, avatarSize: 60 })
            Column({ space: 6 }) {
              Text(this.nickname)
                .fontSize(20)
                .fontWeight(FontWeight.Bold)
                .fontColor(PortraTheme.primaryText)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
              Text(this.roleLabel())
                .fontSize(13)
                .fontColor(PortraTheme.secondaryText)
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)
          }
          .width('100%')
          .padding({ top: 14, bottom: 20 })

          Divider().color(PortraTheme.border)

          if (this.errorMessage.length > 0) {
            Text(this.errorMessage)
              .width('100%')
              .fontSize(13)
              .fontColor(PortraTheme.danger)
          }

          PortraButton({ label: '退出登录', loading: this.signingOut,
            onAction: () => this.signOut() })
        }
        .width('100%')
        .padding({ left: 24, right: 24, top: 20 })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
