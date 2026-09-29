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
      Column({ space: 16 }) {
        Button('返回')
          .fontSize(14)
          .fontColor(PortraTheme.primaryText)
          .backgroundColor(Color.Transparent)
          .enabled(!this.signingIn)
          .alignSelf(ItemAlign.Start)
          .onClick(() => this.onBack?.())

        Text('手机号登录')
          .width('100%')
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)
          .margin({ top: 28 })

        if (this.contextText.length > 0) {
          Text(this.contextText)
            .width('100%')
            .fontSize(14)
            .fontColor(PortraTheme.secondaryText)
        }

        Text('手机号')
          .width('100%')
          .fontSize(14)
          .fontColor(PortraTheme.primaryText)
          .margin({ top: 16 })

        TextInput({ text: this.phone, placeholder: '请输入手机号' })
          .width('100%')
          .height(48)
          .type(InputType.PhoneNumber)
          .maxLength(32)
          .enabled(!this.sendingCode && !this.signingIn)
          .backgroundColor(PortraTheme.surface)
          .border({ width: 1, color: PortraTheme.border })
          .borderRadius(PortraTheme.radius)
          .padding({ left: 14, right: 14 })
          .onChange((value: string) => {
            this.phone = value;
            this.code = '';
            this.errorMessage = '';
            this.notice = '';
          })

        Text('验证码')
          .width('100%')
          .fontSize(14)
          .fontColor(PortraTheme.primaryText)

        Row({ space: 10 }) {
          TextInput({ text: this.code, placeholder: '6 位验证码' })
            .layoutWeight(1)
            .height(48)
            .type(InputType.Number)
            .maxLength(6)
            .enabled(!this.signingIn)
            .backgroundColor(PortraTheme.surface)
            .border({ width: 1, color: PortraTheme.border })
            .borderRadius(PortraTheme.radius)
            .padding({ left: 14, right: 14 })
            .onChange((value: string) => {
              this.code = PhoneLoginPolicy.sanitizeCode(value);
              this.errorMessage = '';
            })

          Button(this.cooldownSeconds > 0 ? `${this.cooldownSeconds}s 后重试` : '获取验证码')
            .width(116)
            .height(48)
            .fontSize(13)
            .fontColor(PortraTheme.primary)
            .backgroundColor(PortraTheme.primarySoft)
            .borderRadius(PortraTheme.radius)
            .enabled(!this.sendingCode && !this.signingIn && this.cooldownSeconds === 0)
            .onClick(() => this.sendCode())
        }
        .width('100%')

        if (this.errorMessage.length > 0) {
          Text(this.errorMessage)
            .width('100%')
            .fontSize(13)
            .fontColor(PortraTheme.danger)
        }
        if (this.notice.length > 0) {
          Text(this.notice)
            .width('100%')
            .fontSize(13)
            .fontColor(PortraTheme.primary)
        }

        PortraButton({ label: '登录', loading: this.signingIn, disabled: this.sendingCode,
          onAction: () => this.signIn() })
          .margin({ top: 16 })
      }
      .width('100%')
      .padding({ left: 24, right: 24, top: 28, bottom: 40 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
