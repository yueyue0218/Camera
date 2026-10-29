import { AppClient } from '../app/AppClient';
import { PortraImage } from '../common/components/PortraImage';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { FollowAction } from '../features/user/FollowAction';
import { ReportPanel } from '../features/user/ReportPanel';
import { ServicePackageDetail, ServicePackageSummary } from '../model/ApiModels';
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
  @State private role: string = '';
  @State private userId: number = 0;
  @State private interested: boolean = false;
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
    this.actionError = '';
    this.role = '';
    this.userId = 0;
    this.interested = false;
    try {
      const result = await this.appClient.apiService.getServicePackage(this.serviceId);
      if (version === this.requestVersion) {
        this.detail = result;
        if (this.appClient.sessionManager.isAuthenticated()) {
          await this.restorePrivateState(version);
        }
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

  private async restorePrivateState(version: number): Promise<void> {
    try {
      const session = await this.appClient.apiService.currentSession();
      if (version !== this.requestVersion) {
        return;
      }
      this.userId = session.userId;
      this.role = session.role.trim().toUpperCase();
      if (this.role === 'CUSTOMER') {
        const interests = await this.appClient.apiService.listServicePackageInterests(1, 100);
        if (version === this.requestVersion && Array.isArray(interests.records)) {
          this.interested = interests.records.some((item: ServicePackageSummary) => item.serviceId === this.serviceId);
        }
      }
    } catch (error) {
      if (version === this.requestVersion) {
        this.actionError = (error as PortraError).message || '个人操作状态暂不可用';
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
    if (this.role !== 'CUSTOMER' || this.userId === this.detail?.providerId) {
      this.actionError = '仅单主可以咨询摄影橱窗';
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

  private async toggleInterest(): Promise<void> {
    if (this.busy) {
      return;
    }
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.onRequireLogin?.();
      return;
    }
    if (this.role !== 'CUSTOMER' || this.userId === this.detail?.providerId) {
      this.actionError = '仅单主可以标记橱窗意向';
      return;
    }
    this.busy = true;
    this.actionError = '';
    try {
      if (this.interested) {
        await this.appClient.apiService.cancelServicePackageInterest(this.serviceId);
        this.interested = false;
      } else {
        const result = await this.appClient.apiService.addServicePackageInterest(this.serviceId);
        if (result === null || result.serviceId !== this.serviceId) {
          throw new Error('意向结果缺少橱窗编号');
        }
        this.interested = true;
      }
    } catch (error) {
      this.actionError = (error as PortraError).message || '意向操作失败';
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
            PortraImage({
              source: this.detail.images?.[0] ?? '',
              imageWidth: '100%',
              imageHeight: 220,
              cornerRadius: 8,
              fallbackText: (this.detail.portfolioIds ?? []).length > 0 ?
                '作品图片需经文件下载边界读取' : '暂无橱窗图片',
              contentDescription: `${this.detail.title ?? '摄影橱窗'}封面`
            })
            Text(this.detail.title ?? '摄影服务')
              .fontSize(25).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText).width('100%')
            Text(this.detail.photographerNickname ?? `摄影师 #${this.detail.providerId ?? ''}`)
              .fontSize(14).fontColor(PortraTheme.secondaryText).width('100%')
            if (this.userId > 0 && this.detail.providerId !== undefined && this.userId !== this.detail.providerId) {
              FollowAction({
                targetUserId: this.detail.providerId,
                targetRole: 'PROVIDER',
                currentUserId: this.userId
              })
            }
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
            ReportPanel({
              targetType: 'SERVICE_PACKAGE',
              targetId: this.serviceId,
              ownerId: this.detail.providerId ?? 0,
              currentUserId: this.userId,
              onRequireLogin: this.onRequireLogin
            })
          }
          .width('100%').alignItems(HorizontalAlign.Start)
          .padding({ left: 20, right: 20, top: 22, bottom: 24 })
        }
        .layoutWeight(1)
        if (!this.appClient.sessionManager.isAuthenticated()) {
          Button('登录后咨询摄影师')
            .width('90%').height(48).borderRadius(8)
            .onClick(() => this.onRequireLogin?.())
            .margin({ bottom: 20 })
        } else if (this.role === 'CUSTOMER') {
          Row({ space: 10 }) {
            Button(this.interested ? '取消意向' : '加入意向')
              .layoutWeight(1).height(48).borderRadius(8)
              .enabled(!this.busy && this.detail.status === 'ONLINE' && this.detail.isAvailable === true)
              .onClick(() => this.toggleInterest())
            Button(this.busy ? '处理中' : '咨询摄影师')
              .layoutWeight(1).height(48).borderRadius(8)
              .enabled(!this.busy && this.detail.status === 'ONLINE' && this.detail.isAvailable === true)
              .onClick(() => this.startChat())
          }
          .width('90%').margin({ bottom: 20 })
        } else {
          Text('摄影师账号可浏览橱窗，但不能对橱窗发起意向或咨询')
            .fontSize(12).fontColor(PortraTheme.secondaryText)
            .width('90%').margin({ bottom: 20 })
        }
      }
    }
    .width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }
}
