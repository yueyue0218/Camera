import { AppClient } from '../../app/AppClient';
import { CreateReportPayload, ReportSummary } from '../../model/ApiModels';
import { PortraError } from '../../network/ErrorMapper';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct ReportPanel {
  @Prop targetType: string = '';
  @Prop targetId: number = 0;
  @Prop ownerId: number = 0;
  @Prop currentUserId: number = 0;
  @State private expanded: boolean = false;
  @State private reason: string = '';
  @State private description: string = '';
  @State private busy: boolean = false;
  @State private submitted: boolean = false;
  @State private errorMessage: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  onRequireLogin?: () => void;

  aboutToDisappear(): void {
    this.appClient.apiService.cancelReports();
  }

  private validTargetType(): boolean {
    return ['USER', 'DEMAND', 'SERVICE_PACKAGE', 'MOMENT', 'REVIEW'].includes(
      this.targetType.trim().toUpperCase());
  }

  private async submit(): Promise<void> {
    if (this.busy || this.submitted) {
      return;
    }
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.onRequireLogin?.();
      return;
    }
    const normalizedReason = this.reason.trim();
    const normalizedDescription = this.description.trim();
    if (!this.validTargetType() || !Number.isSafeInteger(this.targetId) || this.targetId <= 0) {
      this.errorMessage = '举报对象无效';
      return;
    }
    if (normalizedReason.length === 0 || normalizedReason.length > 500) {
      this.errorMessage = '请填写 1 至 500 字的举报原因';
      return;
    }
    if (normalizedDescription.length > 1000) {
      this.errorMessage = '补充说明不能超过 1000 字';
      return;
    }
    this.busy = true;
    this.errorMessage = '';
    const payload: CreateReportPayload = {
      targetType: this.targetType.trim().toUpperCase(),
      targetId: this.targetId,
      reason: normalizedReason,
      description: normalizedDescription.length > 0 ? normalizedDescription : undefined
    };
    try {
      const result: ReportSummary = await this.appClient.apiService.createReport(payload);
      if (result === null || !Number.isSafeInteger(result.reportId) || result.reportId <= 0 ||
        result.targetType !== payload.targetType || result.targetId !== payload.targetId ||
        result.status.trim().length === 0) {
        throw new Error('举报结果格式异常');
      }
      this.submitted = true;
      this.expanded = false;
    } catch (error) {
      this.errorMessage = (error as PortraError).message || '举报提交失败';
    } finally {
      this.busy = false;
    }
  }

  build() {
    if (this.ownerId <= 0 || this.ownerId !== this.currentUserId) {
      Column({ space: 10 }) {
        if (this.submitted) {
          Text('举报已提交，平台将按流程处理')
            .width('100%')
            .fontSize(12)
            .fontColor(PortraTheme.secondaryText)
        } else if (!this.expanded) {
          Button(this.appClient.sessionManager.isAuthenticated() ? '举报此内容' : '登录后举报')
            .height(36)
            .fontSize(12)
            .fontColor(PortraTheme.secondaryText)
            .backgroundColor(PortraTheme.surface)
            .border({ width: 1, color: PortraTheme.border })
            .onClick(() => {
              if (!this.appClient.sessionManager.isAuthenticated()) {
                this.onRequireLogin?.();
              } else {
                this.expanded = true;
              }
            })
        } else {
          TextInput({ text: this.reason, placeholder: '举报原因（必填）' })
            .height(44)
            .backgroundColor(PortraTheme.surface)
            .borderRadius(8)
            .onChange((value: string) => this.reason = value)
          TextArea({ text: this.description, placeholder: '补充说明（可选）' })
            .height(82)
            .backgroundColor(PortraTheme.surface)
            .borderRadius(8)
            .onChange((value: string) => this.description = value)
          Row({ space: 10 }) {
            Button('取消')
              .layoutWeight(1)
              .height(40)
              .backgroundColor(PortraTheme.surface)
              .fontColor(PortraTheme.secondaryText)
              .onClick(() => {
                this.expanded = false;
                this.errorMessage = '';
              })
            Button(this.busy ? '提交中' : '提交举报')
              .layoutWeight(1)
              .height(40)
              .enabled(!this.busy)
              .onClick(() => this.submit())
          }
          .width('100%')
        }
        if (this.errorMessage.length > 0) {
          Text(this.errorMessage)
            .width('100%')
            .fontSize(12)
            .fontColor(PortraTheme.danger)
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .padding({ top: 10, bottom: 10 })
    }
  }
}
