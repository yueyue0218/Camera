import { PublicationActions } from '../features/publish/PublicationActions';
import { JournalText } from '../features/publish/JournalText';
import { JournalBrief, JournalStyle, JournalHeading, JournalKicker, JournalTitle, JournalFacts, JournalPerson, JournalSection, JournalRow, JournalActions } from '../features/publish/JournalUI';
import { PortraGallery } from '../common/components/PortraGallery';
import { AppClient } from '../app/AppClient';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { HallTextFormatter } from '../features/hall/HallUiModels';
import { FollowAction } from '../features/user/FollowAction';
import { ReportPanel } from '../features/user/ReportPanel';
import { DemandResponseSummary, DemandSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct DemandDetailPage {
  @Prop @Watch('load') demandId: number = 0;
  @Prop @Watch('onVisibleEpoch') visibleEpoch: number = 0;
  @State private loading: boolean = true;
  @State private demand: DemandSummary | null = null;
  @State private errorMessage: string = '';
  @State private actionError: string = '';
  @State private actionNotice: string = '';
  @State private actionBusy: boolean = false;
  @State private userId: number = 0;
  @State private role: string = '';
  @State private responses: DemandResponseSummary[] = [];
  @State private ownResponse: DemandResponseSummary | null = null;
  @State private responseMessage: string = '';
  @State private responsePrice: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  onEdit?: (id: number) => void;
  onOpenAuthor?: (id: number, role: string) => void;
  onBack?: () => void;
  onRequireLogin?: () => void;
  onOpenConversation?: (conversationId: number) => void;

  aboutToAppear(): void {
    this.load();
  }

  private onVisibleEpoch(): void {
    if (this.visibleEpoch > 0) { this.load(); } else { this.requestVersion++; }
  }

  aboutToDisappear(): void {
    this.requestVersion++;
    this.appClient.apiService.cancelDemandDetail();
    this.appClient.apiService.cancelDemandActions(this.demandId);
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.demand = null;
    this.actionBusy = false;
    this.responseMessage = '';
    this.responsePrice = '';
    this.errorMessage = '';
    this.actionError = '';
    this.actionNotice = '';
    this.userId = 0;
    this.role = '';
    this.responses = [];
    this.ownResponse = null;
    try {
      const result = await this.appClient.apiService.getDemand(this.demandId);
      if (version === this.requestVersion) {
        this.demand = result;
        if (this.appClient.sessionManager.isAuthenticated()) {
          const sessionVersion = this.appClient.sessionManager.getSessionVersion();
          try {
            const session = await this.appClient.apiService.currentSession();
            if (version === this.requestVersion &&
              sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
              this.userId = session.userId;
              this.role = session.role;
              if (session.userId === result.customerId) {
                const responses = await this.appClient.apiService.listDemandResponses(this.demandId);
                if (version === this.requestVersion &&
                  sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
                  this.responses = Array.isArray(responses) ? responses : [];
                }
              } else if (this.role.trim().toUpperCase() === 'PROVIDER') {
                const responses = await this.appClient.apiService.listMyDemandResponses();
                if (version === this.requestVersion &&
                  sessionVersion === this.appClient.sessionManager.getSessionVersion() && Array.isArray(responses)) {
                  this.ownResponse = responses.find((item: DemandResponseSummary) =>
                    item.demandId === this.demandId) ?? null;
                }
              }
            }
          } catch {
            if (version === this.requestVersion &&
              sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
              this.actionError = '响应信息暂不可用，请重试';
            }
          }
        }
      }
    } catch (error) {
      if (version === this.requestVersion) {
        this.errorMessage = (error as PortraError).message || '需求加载失败';
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  private async respond(): Promise<void> {
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
      else if (this.errorMessage) { PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() }) }
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
          actionsEnabled: !this.actionBusy, notice: this.actionError, onChat: () => this.startChat(),
          onStar: () => { this.actionError = '需求收藏暂未开放，当前未保存意向'; } })
      }
    }.width('100%').height('100%').backgroundColor(JournalStyle.paper)
  }
}
