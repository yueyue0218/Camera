import { ContentChanges } from '../features/user/ContentChanges';
import { DemandSummary, ServicePackageSummary } from '../model/ApiModels';
import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraLoading } from '../common/components/PortraLoading';
import { MomentCard } from '../features/moments/MomentCard';
import { MomentFeedFormatter } from '../features/moments/MomentFeedModels';
import { MomentSummary, PublicUserProfile } from '../model/ApiModels';
import { ErrorMapper, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

let nextPublicProfileInstance: number = 0;

/** B-owned public view of the existing user system, never a second identity store. */
@Component
export struct PublicProfilePage {
  @Prop @Watch('onTargetChanged') targetUserId: number = 0;
  @Prop @Watch('onTargetChanged') targetRole: string = '';
  @State private profile: PublicUserProfile | undefined = undefined;
  @State private moments: MomentSummary[] = [];
  @State private demands: DemandSummary[] = [];
  @State private services: ServicePackageSummary[] = [];
  @State private page: number = 0;
  @State private more: boolean = false;
  @State private loadingMore: boolean = false;
  private readonly changed: () => void = () => this.load();
  onOpenDemand?: (id: number) => void;
  onOpenService?: (id: number) => void;
  onOpenMoment?: (id: number) => void;
  @State private loading: boolean = true;
  @State private errorMessage: string = '';
  @State private momentError: string = '';
  @State private authenticationRequired: boolean = false;
  private readonly appClient: AppClient = AppClient.shared;
  private readonly requestKey: string = `users.public.instance.${++nextPublicProfileInstance}`;
  private generation: number = 0;
  private active: boolean = false;
  onBack?: () => void;
  onRequireLogin?: () => void;

  aboutToAppear(): void {
    ContentChanges.observe(this.changed);
    this.active = true;
    this.load();
  }

  aboutToDisappear(): void {
    ContentChanges.unobserve(this.changed);
    this.active = false;
    this.generation++;
    this.appClient.apiService.cancelPublicProfile(`${this.requestKey}.profile`, `${this.requestKey}.moments`);
    this.profile = undefined;
    this.moments = [];
    this.demands = [];
    this.services = [];
  }

  private onTargetChanged(): void {
    if (this.active) {
      this.load();
    }
  }

  private isCurrent(token: number, sessionVersion: number, userId: number, role: string): boolean {
    if (!this.active || token !== this.generation || this.targetUserId !== userId ||
      this.targetRole.trim().toUpperCase() !== role) {
      return false;
    }
    if (sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
      this.generation++;
      this.appClient.apiService.cancelPublicProfile(`${this.requestKey}.profile`, `${this.requestKey}.moments`);
      this.profile = undefined;
      this.moments = [];
      this.loading = false;
      this.authenticationRequired = !this.appClient.sessionManager.isAuthenticated();
      this.errorMessage = '身份已变化，请重新读取用户主页。';
      return false;
    }
    return true;
  }

  private async load(): Promise<void> {
    const token = ++this.generation;
    const sessionVersion = this.appClient.sessionManager.getSessionVersion();
    const userId = this.targetUserId;
    const role = this.targetRole.trim().toUpperCase();
    this.appClient.apiService.cancelPublicProfile(`${this.requestKey}.profile`, `${this.requestKey}.moments`);
    this.profile = undefined;
    this.moments = [];
    this.loading = true;
    this.demands = []; this.services = []; this.page = 0; this.more = false; this.loadingMore = false;
    this.errorMessage = '';
    this.momentError = '';
    this.authenticationRequired = false;
    if (!Number.isSafeInteger(userId) || userId <= 0 || !['CUSTOMER', 'PROVIDER'].includes(role)) {
      this.loading = false;
      this.errorMessage = '无效的用户主页';
      return;
    }
    try {
      const profile = await this.appClient.apiService.getPublicProfile(userId, role, `${this.requestKey}.profile`);
      if (!this.isCurrent(token, sessionVersion, userId, role)) {
        return;
      }
      if (profile === null || profile.userId !== userId || profile.currentRole !== role ||
        !Number.isSafeInteger(profile.followerCount) || profile.followerCount < 0 ||
        !Number.isSafeInteger(profile.followingCount) || profile.followingCount < 0 ||
        !Number.isSafeInteger(profile.momentCount) || profile.momentCount < 0) {
        throw ErrorMapper.parse();
      }
      this.profile = profile;
      // The primary purpose of this page is to show the author's public offerings.
      // A failure in the optional moment feed must not prevent loading those offerings.
      try {
        await this.loadContent(1, token, sessionVersion, userId, role);
      } catch (error) {
        if (!this.isCurrent(token, sessionVersion, userId, role)) { return; }
        this.errorMessage = (error as Error).message || '公开发布读取失败';
      }
      if (!this.isCurrent(token, sessionVersion, userId, role)) { return; }
      try {
        const page = await this.appClient.apiService.listPublicMoments(userId, role, 1, `${this.requestKey}.moments`);
        if (!this.isCurrent(token, sessionVersion, userId, role)) { return; }
        if (page === null || !Array.isArray(page.records) ||
          page.records.some((item: MomentSummary) => !MomentFeedFormatter.isValid(item) ||
            item.authorId !== userId || item.authorRole !== role)) {
          throw ErrorMapper.parse();
        }
        this.moments = MomentFeedFormatter.deduplicate(page.records);
      } catch (momentError) {
        if (this.isCurrent(token, sessionVersion, userId, role)) {
          this.momentError = (momentError as PortraError).message || '动态读取失败';
        }
      }
    } catch (error) {
      if (!this.isCurrent(token, sessionVersion, userId, role)) {
        return;
      }
      const mapped = error as PortraError;
      this.authenticationRequired = ErrorMapper.isAuthenticationExpired(mapped);
      this.errorMessage = mapped.message || '用户主页读取失败';
      if (this.authenticationRequired) {
        this.profile = undefined;
        this.moments = [];
      }
    } finally {
      if (this.isCurrent(token, sessionVersion, userId, role)) {
        this.loading = false;
      }
    }
  }

  private async loadContent(page: number, token: number, epoch: number, userId: number, role: string): Promise<void> {
    if (role === 'PROVIDER') {
      const result = await this.appClient.apiService.listPublicServices(userId, page, `${this.requestKey}.content`);
      if (!this.isCurrent(token, epoch, userId, role)) { return; }
      if (!Array.isArray(result.records) || result.records.some((row: ServicePackageSummary) => row.providerId !== userId)) { throw ErrorMapper.parse(); }
      this.services = this.services.concat(result.records.filter((row: ServicePackageSummary) => !this.services.some((old: ServicePackageSummary) => old.serviceId === row.serviceId)));
      this.more = this.services.length < result.total;
    } else {
      const result = await this.appClient.apiService.listPublicDemands(userId, page, `${this.requestKey}.content`);
      if (!this.isCurrent(token, epoch, userId, role)) { return; }
      if (!Array.isArray(result.records) || result.records.some((row: DemandSummary) => row.customerId !== userId)) { throw ErrorMapper.parse(); }
      this.demands = this.demands.concat(result.records.filter((row: DemandSummary) => !this.demands.some((old: DemandSummary) => old.demandId === row.demandId)));
      this.more = this.demands.length < result.total;
    }
    this.page = page;
  }
  private async nextPage(): Promise<void> {
    if (this.loadingMore || !this.more) { return; }
    this.loadingMore = true;
    const token = this.generation, epoch = this.appClient.sessionManager.getSessionVersion();
    try { await this.loadContent(this.page + 1, token, epoch, this.targetUserId, this.targetRole.trim().toUpperCase()); }
    catch (error) { if (token === this.generation) { this.errorMessage = (error as Error).message || '读取失败'; } }
    finally { if (token === this.generation) { this.loadingMore = false; } }
  }

  private displayName(): string {
    return this.profile?.nickname?.trim() || `用户 #${this.targetUserId}`;
  }

  build() {
    Column({ space: PortraTheme.spacingMd }) {
      Row() {
        Button('返回')
          .onClick(() => this.onBack?.())
        Text('用户主页')
          .layoutWeight(1)
          .fontSize(PortraTheme.fontTitle)
          .fontWeight(FontWeight.Bold)
      }
      .width('100%')
      .padding(PortraTheme.spacingLg)
      if (this.loading) {
        PortraLoading({ label: '正在读取用户主页' })
      } else {
        Scroll() {
          Column({ space: PortraTheme.spacingMd }) {
            if (this.errorMessage.length > 0) {
              Text(this.errorMessage)
                .fontColor(PortraTheme.danger)
              Button(this.authenticationRequired ? '去登录' : '重新读取')
                .onClick(() => this.authenticationRequired ? this.onRequireLogin?.() : this.load())
            }
            if (this.profile !== undefined) {
              PortraAvatar({ displayName: this.displayName(), fileId: this.profile.avatarFileId ?? 0, avatarSize: 56 })
              Text(this.displayName())
                .fontSize(PortraTheme.fontTitle)
                .fontWeight(FontWeight.Bold)
              Text(`${this.targetRole === 'PROVIDER' ? '摄影师' : '约拍用户'} #${this.targetUserId}`)
                .fontColor(PortraTheme.secondaryText)
              if ((this.profile.bio?.trim().length ?? 0) > 0) {
                Text(this.profile.bio || '')
                  .width('100%')
              }
              Text(`关注者 ${this.profile.followerCount} · 关注 ${this.profile.followingCount} · 动态 ${this.profile.momentCount}`)
                .fontColor(PortraTheme.secondaryText)
              Text(this.targetRole === 'PROVIDER' ? '公开橱窗' : '公开需求').fontSize(20)
              if (this.services.length + this.demands.length === 0) { Text('暂无公开发布') }
              ForEach(this.services, (item: ServicePackageSummary) => {
                Button(item.title ?? '橱窗').onClick(() => this.onOpenService?.(item.serviceId))
              }, (item: ServicePackageSummary) => String(item.serviceId))
              ForEach(this.demands, (item: DemandSummary) => {
                Button(item.scene ?? '需求').onClick(() => this.onOpenDemand?.(item.demandId))
              }, (item: DemandSummary) => String(item.demandId))
              if (this.more) { Button(this.loadingMore ? '加载中' : '加载更多发布').enabled(!this.loadingMore).onClick(() => this.nextPage()) }
              Text('近期动态（最多 12 条）')
                .fontSize(PortraTheme.fontTitle)
              if (this.momentError.length > 0) {
                Text(this.momentError).fontColor(PortraTheme.danger)
                Button('重新读取').onClick(() => this.load())
              }
              if (this.moments.length === 0 && this.momentError.length === 0) {
                Text('暂无可展示的动态')
                  .fontColor(PortraTheme.secondaryText)
              } else {
                ForEach(this.moments, (item: MomentSummary) => {
                  MomentCard({ item: item, onOpenDetail: (moment: MomentSummary) => this.onOpenMoment?.(moment.momentId) })
                }, (item: MomentSummary) => JSON.stringify(item))
              }
            }
          }
          .width('100%')
          .padding(PortraTheme.spacingLg)
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
