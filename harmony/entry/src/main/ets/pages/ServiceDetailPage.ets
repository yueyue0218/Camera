import { PublicationActions } from '../features/publish/PublicationActions';
import { promptAction } from '@kit.ArkUI';
import { ContentChanges } from '../features/user/ContentChanges';
import { JournalText } from '../features/publish/JournalText';
import { JournalStyle, JournalHeading, JournalKicker, JournalTitle, JournalFacts, JournalPerson, JournalSection, JournalRow, JournalActions } from '../features/publish/JournalUI';
import { AppClient } from '../app/AppClient';
import { PortraGallery } from '../common/components/PortraGallery';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { FollowAction } from '../features/user/FollowAction';
import { ReportPanel } from '../features/user/ReportPanel';
import { ServicePackageDetail, ServicePackageSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';

@Component
export struct ServiceDetailPage {
  @Prop @Watch('load') serviceId: number = 0;
  @Prop @Watch('onVisibleEpoch') visibleEpoch: number = 0;
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
    this.appClient.apiService.cancelServiceDetail(this.serviceId);
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.detail = null;
    this.busy = false;
    this.errorMessage = '';
    this.actionError = '';
    this.role = '';
    this.userId = 0;
    this.interested = false;
    try {
      const result = await this.appClient.apiService.getServicePackage(this.serviceId);
      if (version === this.requestVersion) {
        if (!result || result.serviceId !== this.serviceId) { throw new Error('橱窗编号不匹配'); }
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
    const sessionVersion = this.appClient.sessionManager.getSessionVersion();
    try {
      const session = await this.appClient.apiService.currentSession();
      if (version !== this.requestVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      this.userId = session.userId;
      this.role = session.role.trim().toUpperCase();
      if (this.role === 'CUSTOMER') {
        let page = 1;
        while (version === this.requestVersion && sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
          const interests = await this.appClient.apiService.listServicePackageInterests(page, 100);
          if (version !== this.requestVersion || sessionVersion !== this.appClient.sessionManager.getSessionVersion()) { return; }
          if (!interests || !Array.isArray(interests.records) || !Number.isSafeInteger(interests.size) || interests.size <= 0 ||
            !Number.isSafeInteger(interests.total) || interests.total < 0) { throw new Error('意向状态读取失败'); }
          if (interests.records.some((item: ServicePackageSummary) => item.serviceId === this.serviceId)) {
            this.interested = true; break;
          }
          if (interests.records.length === 0 || page * interests.size >= interests.total) { break; }
          page++;
        }

      }
    } catch (error) {
      if (version === this.requestVersion && sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
        this.actionError = (error as PortraError).message || '个人操作状态暂不可用';
      }
    }
  }

  private async startChat(): Promise<void> {
    if (this.busy) { return; }
    if (!this.appClient.sessionManager.isAuthenticated()) { this.onRequireLogin?.(); return; }
    if (this.role !== 'CUSTOMER' || this.userId === this.detail?.providerId) { this.actionError = '仅单主可以咨询其他摄影师的橱窗'; return; }
    if (this.detail?.status !== 'ONLINE' || this.detail.isAvailable !== true) { this.actionError = '此橱窗当前不可咨询'; return; }
    const version = this.requestVersion;
    const identity = this.appClient.sessionManager.getSessionVersion();
    this.busy = true; this.actionError = '';
    try {
      const result = await this.appClient.apiService.startServiceChat(this.serviceId);
      if (version !== this.requestVersion || identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      if (!result || result.serviceId !== this.serviceId || !Number.isSafeInteger(result.conversationId) || result.conversationId <= 0) { throw new Error('未返回有效会话'); }
      this.onOpenConversation?.(result.conversationId);
    } catch (error) {
      if (version === this.requestVersion && identity === this.appClient.sessionManager.getSessionVersion()) {
        this.actionError = (error as PortraError).message || '发起咨询失败';
      }
    } finally { if (version === this.requestVersion) { this.busy = false; } }
  }

  private async toggleInterest(): Promise<void> {
    if (this.busy) { return; }
    if (!this.appClient.sessionManager.isAuthenticated()) { this.onRequireLogin?.(); return; }
    if (this.role !== 'CUSTOMER' || this.userId === this.detail?.providerId) { this.actionError = '仅单主可以标记其他摄影师的橱窗意向'; return; }
    if (this.detail?.status !== 'ONLINE' || this.detail.isAvailable !== true) { this.actionError = '此橱窗当前不可收藏'; return; }
    const version = this.requestVersion;
    const identity = this.appClient.sessionManager.getSessionVersion();
    this.busy = true; this.actionError = '';
    const next = !this.interested;
    try {
      if (next) {
        const result = await this.appClient.apiService.addServicePackageInterest(this.serviceId);
        if (!result || result.serviceId !== this.serviceId) { throw new Error('意向结果缺少橱窗编号'); }
      } else { await this.appClient.apiService.cancelServicePackageInterest(this.serviceId); }
      if (version !== this.requestVersion || identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      this.interested = next;
      ContentChanges.publish();
      promptAction.showToast({ message: next ? '已加入我的意向' : '已移出我的意向' });
    } catch (error) {
      if (version === this.requestVersion && identity === this.appClient.sessionManager.getSessionVersion()) {
        this.actionError = (error as PortraError).message || '意向操作失败';
      }
    } finally { if (version === this.requestVersion) { this.busy = false; } }
  }

  private price(): string {
    return this.detail?.basePriceCent === undefined ? '待沟通' : '¥' + (this.detail.basePriceCent / 100).toString() + ' 起';
  }

  build() {
    Column() {
      JournalHeading({ title: this.detail?.title ?? '摄影橱窗', onBack: this.onBack })
      if (this.loading) { PortraLoading({ label: '正在加载橱窗' }) }
      else if (this.errorMessage) { PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() }) }
      else if (this.detail !== null) {
        Scroll() {
          Column() {
            JournalKicker({ label: '镜头档案', right: 'PHOTOGRAPHY' })
            Column() {
              PortraGallery({ journal: true, moduleHeight: 304, fileIds: this.detail.portfolioIds ?? [],
                sources: this.detail.images ?? (this.detail.coverImage ? [this.detail.coverImage] : []) })
            }.padding({ left: 15, right: 15 }).width('100%')
            JournalTitle({ title: this.detail.title ?? '未填写标题', subtitle: JournalText.decode(this.detail.description).subtitle })
            Column() {
              JournalFacts({ city: this.detail.cityCode ?? '', middle: (this.detail.styleTags ?? []).join(' / '), price: this.price() })
              JournalPerson({ name: this.detail.photographerNickname ?? '', avatar: this.detail.photographerAvatarFileId ?? 0,
                onOpen: () => { if ((this.detail?.providerId ?? 0) > 0) { this.onOpenAuthor?.(this.detail?.providerId ?? 0, 'PROVIDER'); } } })
              JournalSection({ title: '作品影集', caption: 'SELECTED' })
              PortraGallery({ journal: true, thumbnails: true, fileIds: this.detail.portfolioIds ?? [], sources: this.detail.images ?? [] })
              JournalSection({ title: '关于这次拍摄', caption: 'BEHIND THE FRAME' })
              Text(JournalText.decode(this.detail.description).story || '暂无拍摄介绍').width('100%').fontSize(12.5).lineHeight(23).fontColor('#6D6863')
              JournalSection({ title: '拍摄参考', caption: 'AT A GLANCE' })
              Column() {
                JournalRow({ label: '适合场景', value: this.detail.scene ?? '' })
                JournalRow({ label: '拍摄地点', value: this.detail.serviceArea ?? '' })
                JournalRow({ label: '费用说明', value: this.price() })
                JournalRow({ label: '拍摄时长', value: this.detail.durationMinutes ? this.detail.durationMinutes + ' 分钟' : '' })
                JournalRow({ label: '可约时间', value: this.detail.timeDescription ?? '' })
                JournalRow({ label: '交付说明', value: JournalText.decode(this.detail.description).delivery })
                JournalRow({ label: '交付数量', value: this.detail.originalCount === undefined ? '' :
                  '原片 ' + this.detail.originalCount + ' / 精修 ' + (this.detail.refinedCount ?? 0) + ' 张' })
                JournalRow({ label: '交付周期', value: this.detail.deliveryDays ? this.detail.deliveryDays + ' 天' : '' })
              }.padding({ left: 14, right: 14 }).backgroundColor(JournalStyle.surface).borderRadius(15).border({ width: 1, color: JournalStyle.line })
              Text('拍摄时间、交付内容及最终价格，以双方实际沟通确认的约定为准。').fontSize(10.5).lineHeight(18).fontColor(JournalStyle.muted).margin({ top: 12 })
              if (this.userId > 0 && this.detail.providerId !== undefined && this.userId !== this.detail.providerId) {
                FollowAction({ targetUserId: this.detail.providerId, targetRole: 'PROVIDER', currentUserId: this.userId })
              }
              PublicationActions({ service: true, contentId: this.serviceId,
                ownerId: this.detail.providerId ?? 0, currentUserId: this.userId, role: this.role, status: this.detail.status ?? '',
                onEdit: this.onEdit, onChanged: () => this.load() })
              ReportPanel({ targetType: 'SERVICE_PACKAGE', targetId: this.serviceId, ownerId: this.detail.providerId ?? 0,
                currentUserId: this.userId, onRequireLogin: this.onRequireLogin })
              Text('Portra · frame your moments.').fontSize(14).fontColor('#AFA8A1').padding({ top: 34, bottom: 28 })
            }.width('100%').padding({ left: 17, right: 17 }).alignItems(HorizontalAlign.Start)
          }.width('100%')
        }.layoutWeight(1).scrollBar(BarState.Off)
        JournalActions({ price: this.price(), selected: this.interested, actionsEnabled: !this.busy, notice: this.actionError,
          onStar: () => this.toggleInterest(), onChat: () => this.startChat() })
      }
    }.width('100%').height('100%').backgroundColor(JournalStyle.paper)
  }
}
