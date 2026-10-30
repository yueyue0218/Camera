import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { util } from '@kit.ArkTS';
import { AppClient } from '../app/AppClient';
import { PortraTheme } from '../theme/PortraTheme';
import { PortraError } from '../network/ErrorMapper';
import { InformationRight, ServerConsent } from './PrivacyApi';
import { LegalDocumentKind, LegalSection, USER_AGREEMENT_TITLE, USER_AGREEMENT_SECTIONS,
  PRIVACY_POLICY_TITLE, PRIVACY_POLICY_SECTIONS, CROSS_BORDER_CONSENT_TITLE,
  CROSS_BORDER_CONSENT_SECTIONS } from './LegalDocumentContent';

@Extend(Button)
function privacyAction() {
  .width('100%').height(46).fontSize(14).fontColor(PortraTheme.primaryText)
    .backgroundColor(PortraTheme.surface).borderRadius(12)
}

@Component
export struct PrivacySettingsPage {
  @Prop initialView: string = 'privacy';
  @State private view: string = 'privacy';
  @State private document: LegalDocumentKind = LegalDocumentKind.NONE;
  @State private consent: ServerConsent | undefined = undefined;
  @State private error: string = '';
  @State private notice: string = '';
  @State private loading: boolean = false;
  @State private busy: boolean = false;
  @State private authenticated: boolean = false;
  @State private confirmWithdrawal: boolean = false;
  @State private confirmClosure: boolean = false;
  @State private accountClosed: boolean = false;
  @State private typeIndex: number = 0;
  @State private description: string = '';
  @State private records: InformationRight[] = [];
  @State private total: number = 0;
  @State private page: number = 0;
  @State private phone: string = '';
  @State private code: string = '';
  @State private cooldown: number = 0;
  private timer: number = -1;
  private generation: number = 0;
  private readonly app: AppClient = AppClient.shared;
  private readonly types: string[] = ['ACCESS', 'COPY', 'CORRECT', 'DELETE'];
  private readonly labels: string[] = ['申请查询个人信息', '申请复制个人信息', '申请更正个人信息', '申请删除个人信息'];
  onBack?: () => void;
  onWithdrawn?: () => void;
  onClosed?: () => void;

  aboutToAppear(): void { this.view = this.initialView; this.load(); }
  aboutToDisappear(): void {
    this.generation++;
    this.app.privacyApi.cancelReads();
    if (this.timer >= 0) { clearInterval(this.timer); this.timer = -1; }
  }

  private title(): string {
    return this.view === 'rights' ? '个人信息权利申请' : this.view === 'closure' ? '注销账号' : '隐私与授权管理';
  }
  private message(error: Object): string {
    return (error as PortraError).message || '请求失败，请检查网络后重试；状态以服务器记录为准。';
  }
  private async load(more: boolean = false): Promise<void> {
    if (this.loading || this.busy) { return; }
    const version = ++this.generation;
    this.error = ''; this.loading = true;
    try {
      // Refresh is restricted to authentication recovery for necessary privacy channels.
      await this.app.restoreForPrivacyRights();
      if (version !== this.generation) { return; }
      this.authenticated = this.app.sessionManager.isAuthenticated();
      if (!this.authenticated) { return; }
      if (this.view === 'privacy') {
        const value = await this.app.privacyApi.consent();
        if (value === null || !['GRANTED', 'WITHDRAWN', 'NOT_RECORDED'].includes(value.status) ||
          value.consentType !== 'CROSS_BORDER_HK') { throw new Error('服务端授权状态异常，请重试'); }
        if (version === this.generation) { this.consent = value; }
      } else if (this.view === 'rights') {
        const value = await this.app.privacyApi.rights(more ? this.page + 1 : 1);
        if (version !== this.generation) { return; }
        if (!Array.isArray(value.records) || !Number.isInteger(value.page) || value.page < 1 ||
          !Number.isInteger(value.total) || value.total < 0 || value.records.some((item: InformationRight) =>
            !item || !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.description !== 'string' ||
            !this.types.includes(item.type) || !['SUBMITTED', 'PROCESSING', 'COMPLETED', 'REJECTED'].includes(item.status))) {
          throw new Error('申请列表返回格式异常');
        }
        this.records = more ? this.records.concat(value.records) : value.records;
        this.total = value.total; this.page = value.page;
      }
    } catch (error) { if (version === this.generation) { this.error = this.message(error); } }
    finally { if (version === this.generation) { this.loading = false; } }
  }

  private async withdraw(): Promise<void> {
    if (this.busy || !this.authenticated || !this.confirmWithdrawal) { return; }
    const version = this.generation;
    this.busy = true; this.error = ''; this.notice = '';
    try {
      const result = await this.app.withdrawRequiredPrivacyConsent();
      if (version !== this.generation) { return; }
      this.consent = result; this.confirmWithdrawal = false;
      this.notice = '服务器已记录撤回。登录、消息和约拍等业务已暂停，仍可提交权利申请。';
      this.onWithdrawn?.();
    } catch (error) {
      if (version === this.generation) { this.error = this.message(error) + ' 业务请求已暂时停止，请刷新授权状态后重试。'; }
    } finally { if (version === this.generation) { this.busy = false; } }
  }

  private submissionKey(): string {
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    const store = preferences.getPreferencesSync(context, { name: 'portra_privacy_right_submission' });
    // Keep only an opaque retry key and fingerprint; never save the application text on disk.
    let hash = 0;
    const value = this.types[this.typeIndex] + ':' + this.description.trim();
    for (let index = 0; index < value.length; index++) { hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0; }
    const saved = store.getSync('key', '');
    if (store.getSync('fingerprint', '') === String(hash) && typeof saved === 'string' && saved.length > 0) { return saved; }
    const key = util.generateRandomUUID();
    store.putSync('key', key); store.putSync('fingerprint', String(hash)); store.flushSync();
    return key;
  }
  private acknowledgeSubmission(): void {
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    const store = preferences.getPreferencesSync(context, { name: 'portra_privacy_right_submission' });
    store.deleteSync('key'); store.deleteSync('fingerprint'); store.flushSync();
  }
  private async submit(): Promise<void> {
    if (this.busy || this.loading || !this.authenticated || this.description.trim().length < 5) { return; }
    const version = this.generation;
    this.busy = true; this.error = ''; this.notice = '';
    try {
      const result = await this.app.privacyApi.submitRight({ type: this.types[this.typeIndex],
        description: this.description.trim(), idempotencyKey: this.submissionKey() });
      if (version !== this.generation) { return; }
      if (!Number.isSafeInteger(result.id) || result.id <= 0) { throw new Error('服务器未确认申请记录'); }
      this.notice = `申请已提交（编号 ${result.id}），受理结果请在下方刷新查询。提交删除申请不代表信息已删除。`;
      this.description = '';
      try { this.acknowledgeSubmission(); } catch { /* Keep the retry key; server already confirmed persistence. */ }
    } catch (error) { if (version === this.generation) { this.error = this.message(error); } }
    finally { if (version === this.generation) { this.busy = false; } }
    if (version === this.generation && this.notice.length > 0) { await this.load(); }
  }

  private validPhone(): boolean { return /^1[3-9]\d{9}$/.test(this.phone.trim()); }
  private async sendCode(): Promise<void> {
    if (this.busy || !this.authenticated || this.cooldown > 0 || !this.validPhone()) { return; }
    this.busy = true; this.error = ''; this.notice = '';
    const version = this.generation;
    try {
      const sent = await this.app.privacyApi.closureCode(this.phone.trim(), this.app.getDeviceId());
      if (sent !== true) { throw new Error('服务器未确认验证码发送成功，请重试'); }
      if (version !== this.generation) { return; }
      this.notice = '注销验证码已发送至账号绑定手机号。'; this.cooldown = 60;
      this.timer = setInterval(() => {
        this.cooldown--;
        if (this.cooldown <= 0) { clearInterval(this.timer); this.timer = -1; }
      }, 1000);
    } catch (error) { if (version === this.generation) { this.error = this.message(error); } }
    finally { if (version === this.generation) { this.busy = false; } }
  }
  private async closeAccount(): Promise<void> {
    if (this.busy || !this.authenticated || !this.confirmClosure || !this.validPhone() || !/^\d{6}$/.test(this.code)) { return; }
    const version = this.generation;
    this.busy = true; this.error = ''; this.notice = '';
    try {
      const result = await this.app.privacyApi.closeAccount(this.phone.trim(), this.code);
      if (result.status !== 'CLOSED') { throw new Error('服务器未确认账号注销，请勿重复操作，联系运营者核实。'); }
      await this.app.finishAccountClosure();
      if (version !== this.generation) { return; }
      this.authenticated = false; this.code = ''; this.phone = ''; this.confirmClosure = false;
      this.accountClosed = true;
      this.notice = '账号已由服务器注销，旧登录凭据已撤销。' + (result.retainedDataNotice || '必要业务记录依受控流程处理。');
    } catch (error) { if (version === this.generation) { this.error = this.message(error); } }
    finally { if (version === this.generation) { this.busy = false; } }
  }
  private statusLabel(value: string): string {
    if (value === 'SUBMITTED') { return '已提交'; }
    if (value === 'PROCESSING') { return '处理中'; }
    if (value === 'COMPLETED') { return '已完成'; }
    if (value === 'REJECTED') { return '已拒绝'; }
    return '状态待核实';
  }
  private documentTitle(): string {
    return this.document === LegalDocumentKind.USER_AGREEMENT ? USER_AGREEMENT_TITLE :
      this.document === LegalDocumentKind.PRIVACY_POLICY ? PRIVACY_POLICY_TITLE : CROSS_BORDER_CONSENT_TITLE;
  }
  private sections(): LegalSection[] {
    return this.document === LegalDocumentKind.USER_AGREEMENT ? USER_AGREEMENT_SECTIONS :
      this.document === LegalDocumentKind.PRIVACY_POLICY ? PRIVACY_POLICY_SECTIONS : CROSS_BORDER_CONSENT_SECTIONS;
  }

  @Builder
  private PrivacyView() {
    Button('查看《Portra 隐私政策》').privacyAction().onClick(() => this.document = LegalDocumentKind.PRIVACY_POLICY)
    Button('查看《Portra 用户协议》').privacyAction().onClick(() => this.document = LegalDocumentKind.USER_AGREEMENT)
    Button('查看《个人信息出境单独同意书》').privacyAction().onClick(() => this.document = LegalDocumentKind.CROSS_BORDER_CONSENT)
    Text(`中国香港数据出境授权：${this.consent === undefined ? '尚未取得服务端状态' :
      this.consent.status === 'GRANTED' ? '已同意' : this.consent.status === 'WITHDRAWN' ? '已撤回' : '尚无有效记录'}`)
      .width('100%').fontSize(15).fontColor(PortraTheme.primaryText)
    if (this.consent?.occurredAt) { Text(`服务端记录时间：${this.consent?.occurredAt}`).fontSize(12) }
    if (this.confirmWithdrawal) {
      Text('确认撤回中国香港数据出境同意？依赖香港服务器的登录、消息、约拍和图片等服务将暂停。需求、橱窗、动态和公开图片将停止公开展示，重新同意不会自动恢复。撤回不删除全部账号数据；必要保存、删除和限制处理事项可通过权利申请办理。')
        .fontSize(14).lineHeight(23).fontColor(PortraTheme.primaryText)
      Button(this.busy ? '正在向服务器撤回…' : '再次确认撤回').privacyAction().enabled(!this.busy).fontColor(PortraTheme.danger)
        .onClick(() => this.withdraw())
      Button('暂不撤回').privacyAction().enabled(!this.busy).onClick(() => this.confirmWithdrawal = false)
    } else {
      Button('撤回中国香港数据出境同意').privacyAction().enabled(this.authenticated && !this.loading && !this.busy && this.consent?.status === 'GRANTED')
        .fontColor(PortraTheme.danger).onClick(() => this.confirmWithdrawal = true)
    }
    Button('刷新授权状态').privacyAction().enabled(!this.busy && !this.loading).onClick(() => this.load())
    Button('个人信息权利申请').privacyAction().enabled(!this.busy).onClick(() => { this.view = 'rights'; this.error = ''; this.notice = ''; this.load(); })
  }

  @Builder
  private RightsView() {
    Text('可申请查询、复制、更正或删除个人信息。运营者会核验身份并反馈处理结果；涉及他人权益或需要保留的记录将分别处理。请勿提交密码、验证码或无关证件。')
      .fontSize(13).lineHeight(22).fontColor(PortraTheme.secondaryText)
    Select(this.labels.map((label: string): SelectOption => { return { value: label }; }))
      .selected(this.typeIndex).value(this.labels[this.typeIndex]).enabled(!this.busy)
      .onSelect((index: number) => this.typeIndex = index)
    TextArea({ text: this.description, placeholder: '请描述涉及的信息、范围和期望处理方式（至少5字）' })
      .height(120).maxLength(2000).enabled(!this.busy).onChange((value: string) => this.description = value)
    Button(this.busy ? '正在提交…' : '提交申请').privacyAction().enabled(this.authenticated && !this.busy && !this.loading && this.description.trim().length >= 5)
      .onClick(() => this.submit())
    Button('刷新申请状态').privacyAction().enabled(!this.busy && !this.loading).onClick(() => this.load())
    ForEach(this.records, (item: InformationRight) => {
      Column({ space: 7 }) {
        Text(`#${item.id} · ${this.statusLabel(item.status)}`).fontWeight(FontWeight.Bold)
        Text(this.labels[this.types.indexOf(item.type)] || '个人信息权利申请').fontSize(14)
        Text(item.description).fontSize(13).fontColor(PortraTheme.secondaryText)
        Text(`提交：${item.submittedAt}`).fontSize(11)
        if (item.responseDueAt) { Text(`预计反馈期限：${item.responseDueAt}`).fontSize(11) }
        if (item.resolutionNote) { Text(`处理反馈：${item.resolutionNote}`).fontSize(13).fontColor(PortraTheme.primaryText) }
      }.width('100%').padding(16).alignItems(HorizontalAlign.Start).backgroundColor(PortraTheme.surface).borderRadius(12)
    }, (item: InformationRight) => String(item.id))
    if (this.records.length === 0 && !this.loading) { Text('暂无申请记录').fontSize(13) }
    if (this.records.length < this.total) { Button('加载更多申请').privacyAction().enabled(!this.loading && !this.busy).onClick(() => this.load(true)) }
  }

  @Builder
  private ClosureView() {
    Text('注销后将无法继续使用该账号。账号资料及相关个人信息将按处理规则删除或匿名化；涉及其他用户权益、争议处理及必要保存的业务和安全记录会限制处理。未完成的约拍约定可能阻止注销，请先处理。注销不等于退出登录。')
      .fontSize(14).lineHeight(24).fontColor(PortraTheme.primaryText)
    TextInput({ text: this.phone, placeholder: '输入账号绑定的手机号' }).type(InputType.PhoneNumber).maxLength(11)
      .enabled(!this.busy).onChange((value: string) => { this.phone = value; this.confirmClosure = false; })
    Button(this.cooldown > 0 ? `${this.cooldown}秒后重发` : '发送注销验证码').privacyAction()
      .enabled(this.authenticated && !this.busy && this.cooldown === 0 && this.validPhone()).onClick(() => this.sendCode())
    TextInput({ text: this.code, placeholder: '6位注销验证码' }).type(InputType.Number).maxLength(6)
      .enabled(!this.busy).onChange((value: string) => this.code = value)
    if (this.confirmClosure) {
      Text('请再次确认：账号将终止服务，公开内容下线，旧 Token 和 Refresh Token 撤销。此操作不能通过重新登录恢复。')
        .fontColor(PortraTheme.danger).fontSize(14).lineHeight(23)
      Button(this.busy ? '服务器正在处理…' : '再次确认并注销账号').privacyAction().fontColor(PortraTheme.danger)
        .enabled(!this.busy).onClick(() => this.closeAccount())
      Button('暂不注销').privacyAction().enabled(!this.busy).onClick(() => this.confirmClosure = false)
    } else {
      Button('我已了解，继续注销').privacyAction().fontColor(PortraTheme.danger)
        .enabled(this.authenticated && !this.busy && this.validPhone() && /^\d{6}$/.test(this.code))
        .onClick(() => this.confirmClosure = true)
    }
  }

  build() {
    Column() {
      Row({ space: 10 }) {
        Button('‹').privacyAction().width(38).height(38).fontSize(29).backgroundColor(Color.Transparent)
          .fontColor(PortraTheme.primaryText).enabled(!this.busy)
          .onClick(() => { if (this.document !== LegalDocumentKind.NONE) { this.document = LegalDocumentKind.NONE; }
            else if (this.accountClosed) { this.onClosed?.(); } else { this.onBack?.(); } })
        Text(this.document === LegalDocumentKind.NONE ? this.title() : this.documentTitle())
          .layoutWeight(1).fontSize(21).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      }.width('100%').padding(14)
      Scroll() {
        Column({ space: 16 }) {
          if (this.document !== LegalDocumentKind.NONE) {
            ForEach(this.sections(), (item: LegalSection) => {
              Text(item.title).width('100%').fontSize(17).fontWeight(FontWeight.Bold)
              Text(item.body).width('100%').fontSize(13).lineHeight(22).fontColor(PortraTheme.secondaryText)
            }, (item: LegalSection) => item.title)
          } else {
            if (this.loading) { Text('正在读取服务器记录…').fontSize(13) }
            if (!this.loading && !this.authenticated) {
              Text('在线申请和账号操作需要验证账号。未登录或不同意使用香港服务器时，可联系运营者：王雯，3336578810@qq.com，说明权利申请事项；请勿发送密码或验证码。')
                .fontSize(13).lineHeight(22).fontColor(PortraTheme.secondaryText)
            }
            if (this.accountClosed) {
              Text('账号已注销').width('100%').fontSize(22).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              Button('完成并返回').privacyAction().onClick(() => this.onClosed?.())
            } else if (this.view === 'rights') { this.RightsView() }
            else if (this.view === 'closure') { this.ClosureView() }
            else { this.PrivacyView() }
            if (this.error.length > 0) {
              Text(this.error).width('100%').fontSize(13).lineHeight(21).fontColor(PortraTheme.danger)
              Button('重新查询').privacyAction().enabled(!this.busy && !this.loading).onClick(() => this.load())
            }
            if (this.notice.length > 0) { Text(this.notice).width('100%').fontSize(13).lineHeight(22).fontColor(PortraTheme.primary) }
          }
        }.width('100%').padding({ left: 20, right: 20, bottom: 36 }).alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).width('100%')
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }
}
