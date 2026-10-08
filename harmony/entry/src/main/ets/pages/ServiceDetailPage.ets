import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { ServicePackageDetail } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct ServiceDetailPage {
  @Prop serviceId: number = 0;
  @State private detail: ServicePackageDetail | null = null;
  @State private loading: boolean = true;
  @State private busy: boolean = false;
  @State private errorMessage: string = '';
  @State private actionError: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  onBack?: () => void;
  onRequireLogin?: () => void;
  onOpenConversation?: (conversationId: number) => void;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.requestVersion++;
    this.appClient.apiService.cancelServiceDetail(this.serviceId);
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.errorMessage = '';
    try {
      const result = await this.appClient.apiService.getServicePackage(this.serviceId);
      if (version === this.requestVersion) {
        this.detail = result;
      }
    } catch (error) {
      if (version === this.requestVersion) {
        this.errorMessage = (error as PortraError).message || '橱窗加载失败';
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  private async startChat(): Promise<void> {
    if (this.busy) {
      return;
    }
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.onRequireLogin?.();
      return;
    }
    this.busy = true;
    this.actionError = '';
    try {
      const result = await this.appClient.apiService.startServiceChat(this.serviceId);
      if (!Number.isSafeInteger(result.conversationId) || result.conversationId <= 0) {
        throw new Error('未返回会话编号');
      }
      this.onOpenConversation?.(result.conversationId);
    } catch (error) {
      this.actionError = (error as PortraError).message || '发起咨询失败';
    } finally {
      this.busy = false;
    }
  }

  build() {
    Column() {
      PortraPageHeading({ title: '摄影橱窗', eyebrow: 'PORTRA / SERVICE', onBack: this.onBack })
      if (this.loading) {
        PortraLoading({ label: '正在加载橱窗' })
      } else if (this.errorMessage.length > 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() })
      } else if (this.detail !== null) {
        Scroll() {
          Column({ space: 16 }) {
            Text(this.detail.title ?? '摄影服务')
              .fontSize(25).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText).width('100%')
            Text(this.detail.photographerNickname ?? `摄影师 #${this.detail.providerId ?? ''}`)
              .fontSize(14).fontColor(PortraTheme.secondaryText).width('100%')
            Text(this.detail.basePriceCent === undefined ? '价格面议' :
              `¥${(this.detail.basePriceCent / 100).toFixed(0)} 起`)
              .fontSize(20).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primary).width('100%')
            Divider().color(PortraTheme.border)
            Text(this.detail.description ?? '暂无服务说明')
              .fontSize(14).lineHeight(23).fontColor(PortraTheme.primaryText).width('100%')
            Text(`城市  ${this.detail.cityCode ?? '待沟通'}`)
              .fontSize(13).fontColor(PortraTheme.secondaryText).width('100%')
            Text(`服务区域  ${this.detail.serviceArea ?? '待沟通'}`)
              .fontSize(13).fontColor(PortraTheme.secondaryText).width('100%')
            Text(`拍摄时长  ${this.detail.durationMinutes ?? 0} 分钟`)
              .fontSize(13).fontColor(PortraTheme.secondaryText).width('100%')
            if (this.actionError.length > 0) {
              Text(this.actionError).fontSize(12).fontColor(PortraTheme.danger).width('100%')
            }
          }
          .width('100%').alignItems(HorizontalAlign.Start)
          .padding({ left: 20, right: 20, top: 22, bottom: 24 })
        }
        .layoutWeight(1)
        Button(this.busy ? '正在开启会话' : '咨询摄影师')
          .width('90%').height(48).borderRadius(8)
          .enabled(!this.busy && this.detail.status === 'ONLINE' && this.detail.isAvailable === true)
          .onClick(() => this.startChat())
          .margin({ bottom: 20 })
      }
    }
    .width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }
}
