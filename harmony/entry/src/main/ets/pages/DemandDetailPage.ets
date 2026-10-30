import { DetailVisibility } from '../common/performance/DetailVisibility';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { UiPerf } from '../common/performance/UiPerf';
import { promptAction } from '@kit.ArkUI';
import { PublicationActions } from '../features/publish/PublicationActions';
import { JournalText } from '../features/publish/JournalText';
import { JournalBrief, JournalStyle, JournalHeading, JournalKicker, JournalTitle, JournalFacts, JournalPerson, JournalSection, JournalRow, JournalActions } from '../features/publish/JournalUI';
import { PortraGallery } from '../common/components/PortraGallery';
import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { HallTextFormatter } from '../features/hall/HallUiModels';
import { FollowAction } from '../features/user/FollowAction';
import { ContentChanges } from '../features/user/ContentChanges';
import { ReportPanel } from '../features/user/ReportPanel';
import { DemandResponseSummary, DemandSummary } from '../model/ApiModels';
import { ErrorKind, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct DemandDetailPage {
  @Prop @Watch('onTargetChanged') demandId: number = 0;
  @Prop visibleEpoch: number = 0;
  @State private loading: boolean = true;
  @State private demand: DemandSummary | null = null;
  @State private errorMessage: string = '';
  @State private actionError: string = '';
  @State private actionNotice: string = '';
  @State private actionBusy: boolean = false;
  @State private interestBusy: boolean = false;
  @State private interestReady: boolean = false;
  @State private interested: boolean = false;
  @State private userId: number = 0;
  @State private role: string = '';
  @State private responses: DemandResponseSummary[] = [];
  @State private ownResponse: DemandResponseSummary | null = null;
  @State private responseMessage: string = '';
  @State private responsePrice: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  private lifecycle?: MomentFeedLifecycle;
  private active: boolean = false;
  private inFlight: boolean = false;
  private loadedIdentity: number = -1;
  private loadedId: number = 0;
  @State private secondaryLoading: boolean = false;
  @State private secondaryReady: boolean = false;
  private readonly identityChanged: () => void = () => { this.invalidate(); };

  onEdit?: (id: number) => void;
  onOpenAuthor?: (id: number, role: string) => void;
  onBack?: () => void;
  onRequireLogin?: () => void;
  onOpenConversation?: (conversationId: number) => void;

  private readonly contentChanged: (kind?: string) => void = (kind?: string) => {
    if (kind === 'content') { this.onTargetChanged(); }
  };

  aboutToAppear(): void {
    // A detached instance missed identity events; invalidate before ArkUI renders its retained body.
    if (this.loadedIdentity !== -1 && (this.loadedIdentity !== this.appClient.sessionManager.getSessionVersion() ||
      this.loadedId !== this.demandId)) { this.invalidate(); }
    ContentChanges.observe(this.contentChanged);
    this.appClient.sessionManager.observeIdentity(this.identityChanged);
  }

  private invalidate(): void {
    this.requestVersion++;
    this.inFlight = false;
    this.demand = null;
    this.userId = 0; this.role = ''; this.responses = []; this.ownResponse = null;
    this.responseMessage = ''; this.responsePrice = ''; this.actionNotice = '';
    this.secondaryReady = false;
    this.secondaryLoading = false;
    this.loadedIdentity = -1;
    this.loading = false;
    this.errorMessage = '内容状态已变化，请刷新';
  }

  private onTargetChanged(): void {
    this.invalidate();
    if (this.active) { this.load(); }
  }

  private observe(): void {
    if (this.lifecycle !== undefined) { return; }
    try {
      this.lifecycle = DetailVisibility.create(this.getUIContext(), () => this.queryNavigationInfo(),
        () => this.queryNavDestinationInfo(), (visible: boolean) => {
          this.active = visible;
          if (visible) { UiPerf.mark('DemandDetailPage.shown'); this.load(); }
          else { this.requestVersion++; this.inFlight = false; this.secondaryReady = false; }
        }, () => { this.active = false; this.lifecycle = undefined; this.invalidate(); });
      this.lifecycle.start();
    } catch { this.active = false; this.lifecycle = undefined; this.invalidate(); }
  }

  aboutToDisappear(): void {
    ContentChanges.unobserve(this.contentChanged);
    this.lifecycle?.stop();
    this.lifecycle = undefined;
    this.active = false;
    this.requestVersion++;
    this.inFlight = false;
    this.appClient.sessionManager.unobserveIdentity(this.identityChanged);
  }

  private current(version: number, identity: number): boolean {
    return this.active && version === this.requestVersion &&
      identity === this.appClient.sessionManager.getSessionVersion();
  }

  private async loadDemand(version: number): Promise<DemandSummary> {
    const demandId = this.demandId;
    const identity = this.appClient.sessionManager.getSessionVersion();
    try { return await this.appClient.apiService.getDemand(demandId); }
    catch (error) {
      // Closed intentions retain a read-only history, with access decided again by the server.
      if (version === this.requestVersion && identity === this.appClient.sessionManager.getSessionVersion() &&
        this.appClient.sessionManager.isAuthenticated()) {
        try {
          const state = await this.appClient.apiService.getDemandInterest(demandId);
          if (state?.interested === true && state.targetType === 'DEMAND' &&
            state.demandId === demandId && state.demand?.demandId === demandId) { return state.demand; }
        } catch (historyError) {
          // A failed fallback must not turn a primary denial/deletion into a retainable transport error.
          const primary = error as PortraError;
          if (primary.kind === ErrorKind.NETWORK || primary.kind === ErrorKind.TIMEOUT) {
            throw historyError as PortraError;
          }
        }
      }
      throw error as PortraError;
    }
  }

  private async load(): Promise<void> {
    if (!this.active) { return; }
    const identity = this.appClient.sessionManager.getSessionVersion();
    const same = this.loadedIdentity === identity && this.loadedId === this.demandId;
    if (this.inFlight && same) { return; }
    if (!same) { this.invalidate(); }
    const version = ++this.requestVersion;
    this.loadedIdentity = identity; this.loadedId = this.demandId;
    this.inFlight = true;
    this.loading = this.demand === null;
    this.secondaryLoading = false; this.secondaryReady = false;
    this.actionBusy = false; this.interestBusy = false; this.interestReady = false; this.responses = []; this.ownResponse = null;
    this.userId = 0; this.role = ''; this.interested = false;
    this.errorMessage = ''; this.actionError = '';
    try {
      const result = await this.loadDemand(version);
      if (!this.current(version, identity)) { return; }
      if (!result || result.demandId !== this.demandId) { throw new Error('详情编号不匹配'); }
      this.demand = result;
      this.loading = false;
      UiPerf.mark('DemandDetailPage.primaryReady');
      this.secondaryLoading = this.appClient.sessionManager.isAuthenticated();
      if (!this.appClient.sessionManager.isAuthenticated()) { this.secondaryReady = true; }
      if (this.appClient.sessionManager.isAuthenticated()) { await this.restorePrivateState(version, result); }
      if (this.current(version, identity)) { UiPerf.mark('DemandDetailPage.secondaryDone'); }
    } catch (error) {
      if (this.current(version, identity)) {
        const failure = error as PortraError;
        // Only transient failures may retain a previously public body. Private history fails closed.
        if ((failure.kind !== ErrorKind.NETWORK && failure.kind !== ErrorKind.TIMEOUT) || !(this.demand?.status === 'OPEN')) {
          this.demand = null;
        }
        this.errorMessage = failure.message || '详情加载失败';
        this.actionError = this.errorMessage;
      }
    } finally {
      if (this.current(version, identity)) {
        this.loading = false; this.inFlight = false; this.secondaryLoading = false;
        if (same) { UiPerf.mark('DemandDetailPage.refreshDone'); }
      }
    }
  }

  private async restorePrivateState(version: number, result: DemandSummary): Promise<void> {
    if (this.appClient.sessionManager.isAuthenticated()) {
      const sessionVersion = this.appClient.sessionManager.getSessionVersion();
      try {
        const session = await this.appClient.apiService.currentSession('demand.detail.identity');
        if (version === this.requestVersion &&
          sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
          this.userId = session.userId;
          this.role = session.role;
          if (session.userId === result.customerId) {
            const responses = await this.appClient.apiService.listDemandResponses(this.demandId);
            if (version === this.requestVersion &&
              sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
              if (!Array.isArray(responses)) { throw new Error('响应数据异常'); }
              this.responses = responses;
            }
          } else if (this.role.trim().toUpperCase() === 'PROVIDER') {
            const state = await this.appClient.apiService.getDemandInterest(this.demandId);
            if (version !== this.requestVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
            if (!state || state.demandId !== this.demandId || state.targetType !== 'DEMAND' ||
              typeof state.interested !== 'boolean') { throw new Error('需求意向状态异常'); }
            this.interested = state.interested; this.interestReady = true;
            const responses = await this.appClient.apiService.listMyDemandResponses();
            if (!this.current(version, sessionVersion)) { return; }
            if (!Array.isArray(responses)) { throw new Error('响应数据异常'); }
            if (version === this.requestVersion &&
              sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
              this.ownResponse = responses.find((item: DemandResponseSummary) =>
                item.demandId === this.demandId) ?? null;
            }
          }
          if (this.current(version, sessionVersion)) { this.secondaryReady = true; }
        }
      } catch {
        if (version === this.requestVersion &&
          sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
          this.userId = 0; this.role = ''; this.secondaryReady = false;
          this.actionError = '响应信息暂不可用，请重试';
        }
      }
    }
  }

  private async toggleInterest(): Promise<void> {
    if (this.appClient.sessionManager.isAuthenticated() && (!this.secondaryReady || this.loadedIdentity !== this.appClient.sessionManager.getSessionVersion())) { return; }
    if (this.interestBusy) { return; }
    if (!this.appClient.sessionManager.isAuthenticated()) { this.onRequireLogin?.(); return; }
    if (this.role.trim().toUpperCase() !== 'PROVIDER' || this.userId === this.demand?.customerId) {
      this.actionError = '仅摄影师可以将其他用户的需求加入意向'; return;
    }
    if (!this.interestReady) { this.actionError = '意向状态尚未读取，请刷新详情后重试'; return; }
    if (!this.interested && this.demand?.status !== 'OPEN') { this.actionError = '此需求当前不可加入意向'; return; }
    const version = this.requestVersion;
    const identity = this.appClient.sessionManager.getSessionVersion();
    const next = !this.interested;
    this.interestBusy = true; this.actionError = '';
    try {
      if (next) {
        const result = await this.appClient.apiService.addDemandInterest(this.demandId);
        if (!result || result.demandId !== this.demandId || result.targetType !== 'DEMAND' || result.interested !== true ||
          !Number.isSafeInteger(result.interestId ?? 0) || (result.interestId ?? 0) <= 0) { throw new Error('需求意向结果异常'); }
      } else { await this.appClient.apiService.removeDemandInterest(this.demandId); }
      if (version !== this.requestVersion || identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      this.interested = next;
      ContentChanges.publish('demand-interest');
      promptAction.showToast({ message: next ? '已加入我的意向' : '已移出我的意向' });
    } catch (error) {
      if (version === this.requestVersion && identity === this.appClient.sessionManager.getSessionVersion()) {
        this.actionError = (error as PortraError).message || '意向操作失败，请刷新确认状态';
      }
    } finally { if (version === this.requestVersion) { this.interestBusy = false; } }
  }

  private async respond(): Promise<void> {
    if (this.appClient.sessionManager.isAuthenticated() && (!this.secondaryReady || this.loadedIdentity !== this.appClient.sessionManager.getSessionVersion())) { return; }
    if (!this.appClient.sessionManager.isAuthenticated()) { this.onRequireLogin?.(); return; }
    if (this.role.trim().toUpperCase() !== 'PROVIDER' || this.userId === this.demand?.customerId || this.demand?.status !== 'OPEN' || this.ownResponse !== null) {
      this.actionError = '当前不能响应此需求'; return;
    }
    if (this.actionBusy || !this.responseMessage.trim()) {
      this.actionError = '请先填写响应内容';
      return;
    }
    let priceCent: number | undefined = undefined;
    if (this.responsePrice.trim()) {
      const amount = Number(this.responsePrice.trim());
      priceCent = Math.round(amount * 100);
      if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(priceCent) ||
        priceCent > 2147483647) {
        this.actionError = '请检查预期价格';
        return;
      }
    }
    const version = this.requestVersion;
    const identity = this.appClient.sessionManager.getSessionVersion();
    this.actionBusy = true;
    this.actionError = '';
    try {
      const response = await this.appClient.apiService.respondToDemand(
        this.demandId, this.responseMessage.trim(), priceCent);
      if (response === null || response.demandId !== this.demandId || !Number.isSafeInteger(response.responseId) ||
        response.responseId <= 0) {
        throw new Error('响应结果缺少有效编号');
      }
      if (version !== this.requestVersion || identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      this.ownResponse = response;
      this.actionNotice = response.status === 'PENDING_CUSTOMER_ACCEPT' ?
        '已发送响应，等待客户接受' : `响应状态：${response.status}`;
      this.responseMessage = '';
    } catch (error) {
      if (version !== this.requestVersion || identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      this.actionError = (error as PortraError).message || '响应失败';
    } finally {
      if (version === this.requestVersion) { this.actionBusy = false; }
    }
  }

  private async accept(responseId: number): Promise<void> {
    if (this.appClient.sessionManager.isAuthenticated() && (!this.secondaryReady || this.loadedIdentity !== this.appClient.sessionManager.getSessionVersion())) { return; }
    if (!this.appClient.sessionManager.isAuthenticated()) { this.onRequireLogin?.(); return; }
    if (this.userId !== this.demand?.customerId || !this.responses.some((item: DemandResponseSummary) =>
      item.responseId === responseId && item.status === 'PENDING_CUSTOMER_ACCEPT')) { this.actionError = '当前不能接受此响应'; return; }
    if (this.actionBusy) {
      return;
    }
    const version = this.requestVersion;
    const identity = this.appClient.sessionManager.getSessionVersion();
    this.actionBusy = true;
    this.actionError = '';
    try {
      const result = await this.appClient.apiService.acceptDemandResponse(this.demandId, responseId);
      if (result === null || result.responseId !== responseId || result.demandId !== this.demandId ||
        result.responseStatus !== 'ACCEPTED' || !Number.isSafeInteger(result.conversationId) ||
        result.conversationId <= 0) {
        throw new Error('接受结果缺少有效会话');
      }
      if (version !== this.requestVersion || identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      this.responses = this.responses.map((item: DemandResponseSummary) => item.responseId === responseId ?
        { responseId: item.responseId, demandId: item.demandId, providerId: item.providerId,
          providerProfileId: item.providerProfileId, message: item.message,
          expectedPriceCent: item.expectedPriceCent, status: result.responseStatus,
          rejectReason: item.rejectReason, responseTime: item.responseTime } : item);
      this.onOpenConversation?.(result.conversationId);
    } catch (error) {
      if (version !== this.requestVersion || identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      this.actionError = (error as PortraError).message || '接受失败';
    } finally {
      if (version === this.requestVersion) { this.actionBusy = false; }
    }
  }

  private readonly scroll: Scroller = new Scroller();
  private async startChat(): Promise<void> {
    if (this.appClient.sessionManager.isAuthenticated() && (!this.secondaryReady || this.loadedIdentity !== this.appClient.sessionManager.getSessionVersion())) { return; }
    if (this.actionBusy) { return; }
    if (!this.appClient.sessionManager.isAuthenticated()) { this.onRequireLogin?.(); return; }
    if (this.userId === this.demand?.customerId) { this.actionError = '这是你发布的需求，请在下方选择摄影师响应'; this.scroll.scrollEdge(Edge.Bottom); return; }
    if (this.role.trim().toUpperCase() !== 'PROVIDER') { this.actionError = '仅摄影师可以响应此需求'; return; }
    if (this.ownResponse?.status !== 'ACCEPTED') {
      this.actionError = this.ownResponse ? '响应尚未被接受，接受后即可聊天' : '请先填写拍摄方案并发送响应，需求方接受后即可聊天';
      this.scroll.scrollEdge(Edge.Bottom); return;
    }
    const version = this.requestVersion;
    const identity = this.appClient.sessionManager.getSessionVersion();
    this.actionBusy = true; this.actionError = '';
    try {
      const result = await this.appClient.apiService.openAcceptedDemandChat(this.ownResponse.responseId);
      if (version !== this.requestVersion || identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      if (!result || !Number.isSafeInteger(result.conversationId) || result.conversationId <= 0) { throw new Error('未返回有效会话'); }
      this.onOpenConversation?.(result.conversationId);
    } catch (error) {
      if (version === this.requestVersion && identity === this.appClient.sessionManager.getSessionVersion()) {
        this.actionError = (error as PortraError).message || '会话暂不可用';
      }
    } finally { if (version === this.requestVersion) { this.actionBusy = false; } }
  }

  @Builder
  private ResponseActions() {
    Column({ space: 12 }) {
      Text('约拍响应').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      if (this.actionError.length > 0) {
        Text(this.actionError).fontSize(12).fontColor(PortraTheme.danger)
      }
      if (this.actionNotice.length > 0) {
        Text(this.actionNotice).fontSize(12).fontColor(PortraTheme.primary)
      }
      if (!this.appClient.sessionManager.isAuthenticated()) {
        Button('登录后响应').onClick(() => this.onRequireLogin?.())
      } else if (!this.secondaryReady) {
        Text(this.secondaryLoading ? '正在读取响应信息…' : '响应信息不可用，请刷新详情').fontSize(13)
        Button('重试').enabled(!this.secondaryLoading).onClick(() => this.load())
      } else if (this.userId === this.demand?.customerId) {
        if (this.responses.length === 0) {
          Text('暂无响应').fontSize(13).fontColor(PortraTheme.secondaryText)
        }
        ForEach(this.responses, (item: DemandResponseSummary) => {
          Column({ space: 8 }) {
            Text(`摄影师 #${item.providerId}`).fontSize(14).fontWeight(FontWeight.Bold)
            Text(item.message).fontSize(13).fontColor(PortraTheme.secondaryText)
            Text(item.status === 'ACCEPTED' ? '已接受' : item.status === 'REJECTED' ? '已拒绝' : '等待选择')
              .fontSize(12).fontColor(PortraTheme.primary)
            if (item.status === 'PENDING_CUSTOMER_ACCEPT') {
              Button(this.actionBusy ? '处理中' : '接受并开启会话')
                .enabled(!this.actionBusy)
                .onClick(() => this.accept(item.responseId))
            }
          }
          .width('100%').alignItems(HorizontalAlign.Start)
          .padding(12).backgroundColor(PortraTheme.surface).borderRadius(8)
        }, (item: DemandResponseSummary) => item.responseId.toString())
      } else if (this.role.trim().toUpperCase() === 'PROVIDER' && this.ownResponse !== null) {
        Text(this.ownResponse.status === 'PENDING_CUSTOMER_ACCEPT' ? '已响应，等待单主选择' :
          this.ownResponse.status === 'ACCEPTED' ? '你的响应已被接受' : '本次响应已结束')
          .fontSize(13).fontColor(PortraTheme.primary)
        Text(this.ownResponse.message).fontSize(13).fontColor(PortraTheme.secondaryText)
        if (this.ownResponse.expectedPriceCent !== undefined) {
          Text(`预期价格 ¥${(this.ownResponse.expectedPriceCent / 100).toFixed(2)}`)
            .fontSize(12).fontColor(PortraTheme.secondaryText)
        }
      } else if (this.role.trim().toUpperCase() === 'PROVIDER' && this.demand?.status === 'OPEN') {
        TextArea({ text: this.responseMessage, placeholder: '介绍你的拍摄方案与可约时间' })
          .height(92).backgroundColor(PortraTheme.surface).borderRadius(8)
          .onChange((value: string) => this.responseMessage = value)
        TextInput({ text: this.responsePrice, placeholder: '预期价格（元，可选）' })
          .type(InputType.Number).height(46).backgroundColor(PortraTheme.surface).borderRadius(8)
          .onChange((value: string) => this.responsePrice = value)
        Button(this.actionBusy ? '发送中' : '发送响应')
          .enabled(!this.actionBusy && this.actionNotice.length === 0)
          .onClick(() => this.respond())
      } else if (this.role.trim().toUpperCase() === 'PROVIDER') {
        Text('当前需求已关闭，不能继续响应').fontSize(13).fontColor(PortraTheme.secondaryText)
      }
    }
    .width('100%').alignItems(HorizontalAlign.Start)
    .padding({ top: 12, bottom: 24 })
  }

  build() {
    Column() {
      JournalHeading({ title: this.demand?.scene ?? '约拍需求', onBack: this.onBack })
      if (this.loading) { PortraLoading({ label: '正在加载需求' }) }
      else if (this.errorMessage && this.demand === null) { PortraErrorView({ message: this.errorMessage, onRetry: () => { if (this.lifecycle === undefined) { this.observe(); } else { this.load(); } } }) }
      else if (this.demand !== null) {
        Scroll(this.scroll) {
          Column() {
            JournalKicker({ label: '约拍档案', right: 'REQUEST' })
            Column() {
              PortraGallery({ journal: true, moduleHeight: 304, fileIds: this.demand.referenceFileIds ?? [] })
            }.width('100%').padding({ left: 15, right: 15 })
            JournalTitle({ service: false, title: this.demand.scene ?? '未填写标题', subtitle: JournalText.decode(this.demand.description).story })
            Column() {
              JournalFacts({ service: false, city: this.demand.cityCode ?? '', middleLabel: '期望时间',
                middle: this.demand.expectedDate || this.demand.timeDescription || '待沟通',
                price: HallTextFormatter.budget(this.demand.budgetMinCent, this.demand.budgetMaxCent) })
              JournalBrief({ styles: (this.demand.styleTags ?? []).join(' / '), place: this.demand.location ?? '',
                people: JournalText.decode(this.demand.description).people, description: JournalText.decode(this.demand.description).story })
              JournalPerson({ service: false, name: this.demand.customerNickname ?? '', avatar: this.demand.customerAvatarFileId ?? 0,
                onOpen: () => { if ((this.demand?.customerId ?? 0) > 0) { this.onOpenAuthor?.(this.demand?.customerId ?? 0, 'CUSTOMER'); } } })
              JournalSection({ title: '灵感参考', caption: 'REFERENCE' })
              PortraGallery({ journal: true, thumbnails: true, fileIds: this.demand.referenceFileIds ?? [] })
              Text('参考图片仅用于表达拍摄氛围，不代表摄影师作品或最终交付内容。').fontSize(10.5).lineHeight(18).fontColor(JournalStyle.muted).margin({ top: 12 })
              JournalSection({ title: '约拍补充', caption: 'BEFORE WE SHOOT' })
              Column() {
                JournalRow({ label: '时间安排', value: this.demand.timeDescription ?? '' })
                JournalRow({ label: '准备情况', value: '未说明，请与需求方沟通' })
                JournalRow({ label: '备注', value: JournalText.decode(this.demand.description).negotiable ? '预算可根据拍摄方案再沟通' : '具体拍摄与报价以双方沟通为准' })
              }.padding({ left: 14, right: 14 }).backgroundColor(JournalStyle.surface).borderRadius(15).border({ width: 1, color: JournalStyle.line })
              this.ResponseActions()
              if (this.userId > 0 && this.demand.customerId !== undefined && this.userId !== this.demand.customerId) {
                FollowAction({ targetUserId: this.demand.customerId, targetRole: 'CUSTOMER', currentUserId: this.userId })
              }
              PublicationActions({ service: false, contentId: this.demandId,
                ownerId: this.demand.customerId ?? 0, currentUserId: this.userId, role: this.role, status: this.demand.status ?? '',
                onEdit: this.onEdit, onChanged: () => this.load() })
              ReportPanel({ targetType: 'DEMAND', targetId: this.demandId, ownerId: this.demand.customerId ?? 0,
                currentUserId: this.userId, onRequireLogin: this.onRequireLogin })
              Text('Portra · find your frame.').fontSize(14).fontColor('#AFA8A1').padding({ top: 34, bottom: 28 })
            }.width('100%').padding({ left: 17, right: 17 }).alignItems(HorizontalAlign.Start)
          }.width('100%')
        }.layoutWeight(1).scrollBar(BarState.Off)
        JournalActions({ service: false, price: HallTextFormatter.budget(this.demand.budgetMinCent, this.demand.budgetMaxCent),
          selected: this.interested, starEnabled: !this.interestBusy && this.secondaryReady,
          chatEnabled: !this.actionBusy && this.secondaryReady && (this.demand.status === 'OPEN' || this.ownResponse?.status === 'ACCEPTED'),
          notice: this.secondaryLoading ? '正在确认操作状态…' : this.actionError, onChat: () => this.startChat(),
          onStar: () => this.toggleInterest() })
      }
    }.width('100%').height('100%').backgroundColor(JournalStyle.paper).onAppear(() => this.observe())
  }
}
