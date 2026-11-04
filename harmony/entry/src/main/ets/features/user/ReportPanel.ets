import { ReportDialogBody } from './ReportDialogBody';
import { AppClient } from '../../app/AppClient';
import { CreateReportPayload, ReportSummary } from '../../model/ApiModels';
import { ErrorMapper, PortraError } from '../../network/ErrorMapper';
import { PortraTheme } from '../../theme/PortraTheme';
import { createReportInstanceKey, ReportSubmissionRecord, ReportSubmissionStore } from './ReportSubmissionStore';

@Component
export struct ReportPanel {
  @Prop @Watch('onTargetChanged') targetType: string = '';
  @Prop @Watch('onTargetChanged') targetId: number = 0;
  @Prop @Watch('onTargetChanged') ownerId: number = 0;
  @Prop @Watch('onTargetChanged') currentUserId: number = 0;
  @State private expanded: boolean = false;
  @State private reason: string = '';
  @State private description: string = '';
  @State private busy: boolean = false;
  @State private submitted: boolean = false;
  @State private unconfirmed: boolean = false;
  @State private verificationMessage: string = '';
  @State private errorMessage: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  private readonly store: ReportSubmissionStore = ReportSubmissionStore.shared;
  private readonly instanceKey: string = createReportInstanceKey();
  private generation: number = 0;
  private active: boolean = true;
  private sessionVersion: number = -1;
  private identityBlocked: boolean = false;
  private createKey: string = '';
  private myKey: string = '';
  private record?: ReportSubmissionRecord;
  onRequireLogin?: () => void;

  aboutToAppear(): void {
    this.active = true;
    this.identityBlocked = false;
    this.sessionVersion = this.appClient.sessionManager.getSessionVersion();
    this.restoreSubmission();
  }

  aboutToDisappear(): void {
    this.active = false;
    this.invalidate();
    this.clearForm();
  }

  private onTargetChanged(): void {
    const changedAccount = this.sessionVersion >= 0 &&
      this.sessionVersion !== this.appClient.sessionManager.getSessionVersion();
    this.invalidate();
    this.clearForm();
    this.sessionVersion = this.appClient.sessionManager.getSessionVersion();
    if (changedAccount) {
      this.identityBlocked = true;
    }
    if (this.identityBlocked) {
      this.errorMessage = '登录身份已变化，请关闭并重新进入页面核实身份后再举报。';
      return;
    }
    this.restoreSubmission();
  }

  private synchronizeIdentity(): boolean {
    const current = this.appClient.sessionManager.getSessionVersion();
    if (this.sessionVersion < 0) {
      this.sessionVersion = current;
    }
    if (this.sessionVersion !== current) {
      this.invalidate();
      this.clearForm();
      this.sessionVersion = current;
      this.identityBlocked = true;
    }
    if (this.identityBlocked) {
      this.errorMessage = '登录身份已变化，请关闭并重新进入页面核实身份后再举报。';
    }
    return !this.identityBlocked;
  }

  private invalidate(): void {
    if (this.record !== undefined && this.busy) {
      this.store.markUnknown(this.record);
    }
    this.generation++;
    // Empty keys are instance-local too; never invoke the legacy global cancellation.
    this.appClient.apiService.cancelReports(this.createKey || `${this.instanceKey}.none.create`,
      this.myKey || `${this.instanceKey}.none.my`);
    this.createKey = '';
    this.myKey = '';
    this.busy = false;
  }

  private clearForm(): void {
    this.reason = '';
    this.description = '';
    this.errorMessage = '';
    this.verificationMessage = '';
    this.submitted = false;
    this.unconfirmed = false;
    this.expanded = false;
    this.record = undefined;
  }

  private restoreSubmission(): void {
    this.record = this.store.find(this.appClient.sessionManager.getSessionVersion(), this.currentUserId,
      this.targetType, this.targetId) ?? this.store.findUnconfirmed(this.currentUserId, this.targetType, this.targetId);
    this.submitted = this.record?.state === 'confirmed';
    this.unconfirmed = this.record !== undefined && !this.submitted;
    if (this.unconfirmed) {
      this.errorMessage = '举报请求可能已写入，请核实结果，不要重复提交。';
    }
  }

  private isCurrent(token: number, version: number, payload: CreateReportPayload, actorId: number): boolean {
    return this.active && this.synchronizeIdentity() && token === this.generation &&
      version === this.appClient.sessionManager.getSessionVersion() && actorId === this.currentUserId &&
      payload.targetType === this.targetType.trim().toUpperCase() && payload.targetId === this.targetId;
  }

  private validTargetType(): boolean {
    return ['USER', 'DEMAND', 'SERVICE_PACKAGE', 'MOMENT', 'REVIEW'].includes(
      this.targetType.trim().toUpperCase());
  }

  private validResult(result: ReportSummary, payload: CreateReportPayload, actorId: number): boolean {
    if (result === null || result === undefined || !Number.isSafeInteger(result.reportId) || result.reportId <= 0 ||
      result.targetType !== payload.targetType || result.targetId !== payload.targetId || result.reporterId !== actorId) {
      return false;
    }
    return result.status === 'PENDING' || result.status === 'RESOLVED';
  }

  private async submit(): Promise<void> {
    if (!this.active || !this.synchronizeIdentity() || this.busy || this.submitted) {
      return;
    }
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.onRequireLogin?.();
      return;
    }
    this.restoreSubmission();
    if (this.submitted || this.unconfirmed) {
      return;
    }
    const normalizedReason = this.reason.trim();
    const normalizedDescription = this.description.trim();
    if (!this.validTargetType() || !Number.isSafeInteger(this.targetId) || this.targetId <= 0 ||
      !Number.isSafeInteger(this.currentUserId) || this.currentUserId <= 0 || this.ownerId === this.currentUserId) {
      this.errorMessage = '举报对象或当前身份无效';
      return;
    }
    if (normalizedReason.length === 0 || normalizedReason.length > 500) {
      this.errorMessage = '请填写 1 至 500 字的举报原因';
      return;
    }
    if (this.description.length > 0 && normalizedDescription.length === 0) {
      this.errorMessage = '补充说明不能只包含空白字符。'; return;
    }
    if (normalizedDescription.length > 200) {
      this.errorMessage = '补充说明不能超过 200 字';
      return;
    }
    const payload: CreateReportPayload = { targetType: this.targetType.trim().toUpperCase(),
      targetId: this.targetId, reason: normalizedReason,
      description: normalizedDescription.length > 0 ? normalizedDescription : undefined };
    const version = this.appClient.sessionManager.getSessionVersion();
    const actorId = this.currentUserId;
    const token = ++this.generation;
    this.createKey = `${this.instanceKey}.create.${token}`;
    const record = this.store.begin(this.createKey, version, actorId, payload);
    this.record = record;
    this.busy = true;
    this.errorMessage = '';
    try {
      const result = await this.appClient.apiService.createReport(payload, record.key);
      if (!this.validResult(result, payload, actorId)) {
        throw ErrorMapper.parse();
      }
      // A known response may update only its old memory record; it never updates another view.
      this.store.confirm(record, result);
      if (!this.isCurrent(token, version, payload, actorId)) {
        return;
      }
      this.submitted = true;
      this.unconfirmed = false;
      this.expanded = false;
    } catch (error) {
      const mapped = error as PortraError;
      const rejected = (mapped.httpStatus >= 400 && mapped.httpStatus < 500) ||
        (mapped.kind === 'business' && mapped.businessCode >= 40000 && mapped.businessCode < 50000);
      if (rejected) {
        this.store.reject(record);
      } else {
        this.store.markUnknown(record);
      }
      if (!this.isCurrent(token, version, payload, actorId)) {
        return;
      }
      this.unconfirmed = !rejected;
      if (this.unconfirmed) { this.expanded = false; }
      this.errorMessage = rejected ? (mapped.message || '举报请求未被接受，请核对后重试。') :
        '举报结果未确认，服务器可能已写入。请核实结果，不要重复提交。';
    } finally {
      if (this.isCurrent(token, version, payload, actorId)) {
        this.busy = false;
      }
    }
  }

  private cancelForm(): void {
    this.invalidate();
    this.clearForm();
    this.restoreSubmission();
  }

  private async verifySubmission(): Promise<void> {
    if (!this.active || !this.synchronizeIdentity() || this.busy || !this.appClient.sessionManager.isAuthenticated()) {
      return;
    }
    this.restoreSubmission();
    const record = this.record;
    if (record === undefined || record.state === 'confirmed') {
      return;
    }
    const version = this.appClient.sessionManager.getSessionVersion();
    const token = ++this.generation;
    this.myKey = `${this.instanceKey}.my.${token}`;
    this.busy = true;
    this.verificationMessage = '';
    try {
      const reports = await this.appClient.apiService.listMyReports(this.myKey);
      if (!this.isCurrent(token, version, record.payload, record.actorId)) {
        return;
      }
      if (!Array.isArray(reports)) {
        throw ErrorMapper.parse();
      }
      const matches = reports.filter((item: ReportSummary) => this.validResult(item, record.payload, record.actorId) &&
        item.reason === record.payload.reason && (item.description ?? '') === (record.payload.description ?? ''));
      this.verificationMessage = matches.length > 0 ? matches.slice(0, 3).map((item: ReportSummary) =>
        `举报 #${item.reportId}，${item.status === 'PENDING' ? '待处理' : '已处理'}，${item.createdAt || '时间未知'}`).join('；') +
        '。请核对记录；同样原因也可能来自历史提交，仍不自动重发。' :
        '暂未查到匹配记录，不能据此判断未写入。请稍后再次核实或联系平台，不要重复提交。';
    } catch (error) {
      if (this.isCurrent(token, version, record.payload, record.actorId)) {
        this.verificationMessage = (error as PortraError).message || '核实失败，请稍后重试；不要重复提交。';
      }
    } finally {
      if (this.isCurrent(token, version, record.payload, record.actorId)) {
        this.busy = false;
      }
    }
  }

  build() {
    if (this.ownerId <= 0 || this.ownerId !== this.currentUserId) {
      Column({ space: 10 }) {
        if (this.submitted) {
          Text('举报已提交，平台将按流程处理').fontSize(13).fontColor(PortraTheme.secondaryText)
        } else if (this.unconfirmed) {
          Text('举报结果待核实，请勿重复提交').fontSize(13).fontColor(PortraTheme.secondaryText)
          Button(this.busy ? '核实中' : '核实结果').constraintSize({ minHeight: 44 }).enabled(!this.busy).onClick(() => this.verifySubmission())
          if (this.verificationMessage) { Text(this.verificationMessage).fontSize(13).fontColor(PortraTheme.secondaryText) }
        } else {
          Button(this.appClient.sessionManager.isAuthenticated() ? '举报此内容' : '登录后举报')
            .constraintSize({ minHeight: 44 }).fontSize(13).fontColor(PortraTheme.secondaryText).backgroundColor(PortraTheme.surface)
            .border({ width: 1, color: PortraTheme.border }).borderRadius(10)
            .onClick(() => {
              if (!this.synchronizeIdentity()) { return; }
              if (!this.appClient.sessionManager.isAuthenticated()) { this.onRequireLogin?.(); }
              else { this.expanded = true; }
            })
        }
        if (this.errorMessage && !this.expanded) { Text(this.errorMessage).fontSize(13).fontColor(PortraTheme.danger) }
      }.width('100%').alignItems(HorizontalAlign.Start).padding({ top: 10, bottom: 10 })
        .bindSheet(this.expanded, this.FormBody(), { height: SheetSize.LARGE, showClose: false,
          backgroundColor: PortraTheme.surface, keyboardAvoidMode: SheetKeyboardAvoidMode.RESIZE_ONLY,
          onWillDismiss: (action: DismissSheetAction) => { this.cancelForm(); action.dismiss(); } })
    }
  }
  @Builder private FormBody() {
    ReportDialogBody({ reason: this.reason, description: this.description, busy: this.busy,
      error: this.errorMessage, groupKey: this.instanceKey,
      onReason: (value: string) => { if (this.synchronizeIdentity() && !this.busy) { this.reason=value; this.errorMessage=''; } },
      onDescription: (value: string) => { if (this.synchronizeIdentity() && !this.busy) { this.description=value; this.errorMessage=''; } },
      onCancel: () => this.cancelForm(), onSubmit: () => this.submit() })
  }
}
