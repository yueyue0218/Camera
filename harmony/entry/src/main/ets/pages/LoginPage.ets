import { AppClient } from '../app/AppClient';
import { PhoneLoginPolicy } from '../auth/PhoneLoginPolicy';
import { PortraButton } from '../common/components/PortraButton';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct LoginPage {
  @Prop contextText: string = '';
  @State private phone: string = '';
  @State private code: string = '';
  @State private sendingCode: boolean = false;
  @State private signingIn: boolean = false;
  @State private cooldownSeconds: number = 0;
  @State private errorMessage: string = '';
  @State private notice: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private cooldownTimer: number = -1;
  onBack?: () => void;
  onSuccess?: () => void;

  aboutToAppear(): void {
    this.requestVersion++;
  }

  aboutToDisappear(): void {
    this.requestVersion++;
    this.appClient.apiService.cancelSendLoginCode();
    this.appClient.apiService.cancelVerifyLoginCode();
    this.stopCooldown();
    this.cooldownSeconds = 0;
  }

  private stopCooldown(): void {
    if (this.cooldownTimer >= 0) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = -1;
    }
  }

  private startCooldown(): void {
    this.stopCooldown();
    this.cooldownSeconds = 60;
    this.cooldownTimer = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) {
        this.stopCooldown();
      }
    }, 1000);
  }

  private async sendCode(): Promise<void> {
    if (this.sendingCode || this.signingIn || this.cooldownSeconds > 0) {
      return;
    }
    const normalizedPhone = PhoneLoginPolicy.normalizePhone(this.phone);
    if (normalizedPhone === undefined) {
      this.errorMessage = '请输入正确的手机号';
      return;
    }
    const deviceId = this.appClient.getDeviceId();
    if (deviceId.length === 0) {
      this.errorMessage = '设备信息初始化失败，请重新打开应用';
      return;
    }
    const version = this.requestVersion;
    this.errorMessage = '';
    this.notice = '';
    this.sendingCode = true;
    try {
      await this.appClient.apiService.sendLoginCode(normalizedPhone, deviceId);
      if (version !== this.requestVersion) {
        return;
      }
      this.notice = '验证码已发送';
      this.startCooldown();
    } catch (error) {
      if (version === this.requestVersion) {
        const mapped = error as PortraError;
        this.errorMessage = mapped.businessCode === 50001 ? '验证码暂时无法发送，请稍后重试' :
          (mapped.message || '发送失败，请稍后重试');
      }
    } finally {
      if (version === this.requestVersion) {
        this.sendingCode = false;
      }
    }
  }

  private async signIn(): Promise<void> {
    if (this.sendingCode || this.signingIn) {
      return;
    }
    const normalizedPhone = PhoneLoginPolicy.normalizePhone(this.phone);
    if (normalizedPhone === undefined) {
      this.errorMessage = '请输入正确的手机号';
      return;
    }
    if (!PhoneLoginPolicy.validCode(this.code)) {
      this.errorMessage = '请输入 6 位验证码';
      return;
    }
    const deviceId = this.appClient.getDeviceId();
    if (deviceId.length === 0) {
      this.errorMessage = '设备信息初始化失败，请重新打开应用';
      return;
    }
    const version = this.requestVersion;
    this.errorMessage = '';
    this.signingIn = true;
    try {
      const response = await this.appClient.apiService.verifyLoginCode(normalizedPhone, this.code, deviceId);
      if (version !== this.requestVersion) {
        return;
      }
      const saved = await this.appClient.sessionManager.signIn(response.accessToken, response.refreshToken);
      if (version !== this.requestVersion) {
        return;
      }
      if (!saved) {
        this.errorMessage = '登录信息保存失败，请重试';
        return;
      }
      this.code = '';
      this.onSuccess?.();
    } catch (error) {
      if (version === this.requestVersion) {
        const mapped = error as PortraError;
        this.errorMessage = mapped.businessCode === 40002 ? '验证码错误或已过期，请重新获取' :
          (mapped.message || '登录失败，请稍后重试');
      }
    } finally {
      if (version === this.requestVersion) {
        this.signingIn = false;
      }
    }
  }

  build() {
    Scroll() {
      Column({ space: 0 }) {
        Button('‹')
          .width(40)
          .height(40)
          .fontSize(27)
          .fontColor(PortraTheme.primaryText)
          .backgroundColor(Color.Transparent)
          .enabled(!this.signingIn)
          .alignSelf(ItemAlign.Start)
          .accessibilityText('返回')
          .onClick(() => this.onBack?.())

        Text('PORTRA')
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primary)
          .margin({ top: 44 })
        Row()
          .width(36)
          .height(4)
          .backgroundColor(PortraTheme.accent)
          .margin({ top: 9, bottom: 24 })

        Text('欢迎来到 Portra')
          .width('100%')
          .fontSize(27)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)
        Text('用手机号，继续你的约拍旅程')
          .width('100%')
          .fontSize(14)
          .fontColor(PortraTheme.secondaryText)
          .margin({ top: 9 })

        if (this.contextText.length > 0) {
          Text(this.contextText)
            .width('100%')
            .fontSize(12)
            .fontColor(PortraTheme.primary)
            .margin({ top: 15 })
        }

        Text('手机号')
          .width('100%')
          .fontSize(13)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.primaryText)
          .margin({ top: 48, bottom: 9 })

        TextInput({ text: this.phone, placeholder: '请输入中国大陆手机号' })
          .width('100%')
          .height(54)
          .type(InputType.PhoneNumber)
          .maxLength(32)
          .enabled(!this.sendingCode && !this.signingIn)
          .backgroundColor(PortraTheme.surface)
          .border({ width: 1, color: PortraTheme.border })
          .borderRadius(8)
          .padding({ left: 16, right: 16 })
          .onChange((value: string) => {
            this.phone = value;
            this.code = '';
            this.errorMessage = '';
            this.notice = '';
          })

        Text('验证码')
          .width('100%')
          .fontSize(13)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.primaryText)
          .margin({ top: 22, bottom: 9 })

        Row({ space: 8 }) {
          TextInput({ text: this.code, placeholder: '6 位验证码' })
            .layoutWeight(1)
            .height(54)
            .type(InputType.Number)
            .maxLength(6)
            .enabled(!this.signingIn)
            .backgroundColor(PortraTheme.surface)
            .border({ width: 1, color: PortraTheme.border })
            .borderRadius(8)
            .padding({ left: 16, right: 12 })
            .onChange((value: string) => {
              this.code = PhoneLoginPolicy.sanitizeCode(value);
              this.errorMessage = '';
            })

          Button(this.cooldownSeconds > 0 ? `${this.cooldownSeconds}s 后重试` : '获取验证码')
            .width(110)
            .height(54)
            .fontSize(12)
            .fontColor(PortraTheme.primary)
            .backgroundColor(PortraTheme.primarySoft)
            .borderRadius(8)
            .enabled(!this.sendingCode && !this.signingIn && this.cooldownSeconds === 0)
            .onClick(() => this.sendCode())
        }
        .width('100%')

        if (this.errorMessage.length > 0) {
          Text(this.errorMessage)
            .width('100%')
            .fontSize(13)
            .fontColor(PortraTheme.danger)
            .margin({ top: 14 })
        }
        if (this.notice.length > 0) {
          Text(this.notice)
            .width('100%')
            .fontSize(13)
            .fontColor(PortraTheme.primary)
            .margin({ top: 14 })
        }

        PortraButton({ label: '登录 / 注册', loading: this.signingIn, disabled: this.sendingCode,
          onAction: () => this.signIn() })
          .margin({ top: 28 })
        Text('未注册手机号验证成功后将自动创建账号')
          .width('100%')
          .fontSize(12)
          .fontColor(PortraTheme.secondaryText)
          .textAlign(TextAlign.Center)
          .margin({ top: 16 })
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .padding({ left: 24, right: 24, top: 20, bottom: 48 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
