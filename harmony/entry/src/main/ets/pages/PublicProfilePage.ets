import { UiPerf } from '../common/performance/UiPerf';
import { ContentChanges } from '../features/user/ContentChanges';
import { DemandSummary, ServicePackageSummary } from '../model/ApiModels';
import { AppClient } from '../app/AppClient';
import { ProfileIdentity } from '../features/user/ProfileIdentity';
import { ProfileHeader } from '../features/user/ProfileHeader';
import { FollowAction } from '../features/user/FollowAction';
import { PortraImage } from '../common/components/PortraImage';
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
  private readonly changed: (kind?: string) => void = (kind?: string) => {
    if (kind !== 'relations') { this.load(); }
  };
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
  onOpenSelf?: () => void;
  @State private viewerId: number = 0;
  @State private viewerError: string = '';
  @State private followerCount: number = 0;
  private readonly scroller: Scroller = new Scroller();
  onRequireLogin?: () => void;

  aboutToAppear(): void {
    ContentChanges.observe(this.changed);
    UiPerf.mark('public.appear');
    this.active = true;
    this.load();
  }

  aboutToDisappear(): void {
    ContentChanges.unobserve(this.changed);
    this.active = false;
    this.appClient.apiService.cancelCurrentSession(`${this.requestKey}.viewer`);
    this.generation++;
    this.appClient.apiService.cancelPublicProfile(`${this.requestKey}.profile`, `${this.requestKey}.moments`);
    this.profile = undefined;
    this.moments = [];
    this.demands = [];
    this.services = [];
  }

  private onTargetChanged(): void {
    if (this.active) {
      this.scroller.scrollTo({ xOffset: 0, yOffset: 0 });
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
    this.viewerId = 0; this.viewerError = '';
    if (!Number.isSafeInteger(userId) || userId <= 0 || !['CUSTOMER', 'PROVIDER'].includes(role)) {
      this.loading = false;
      this.errorMessage = '无效的用户主页';
      return;
    }
    try {
      const profile = await UiPerf.request('public.profile', () => this.appClient.apiService.getPublicProfile(userId, role, `${this.requestKey}.profile`));
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
      UiPerf.mark('public.identity.ready');
      this.followerCount = profile.followerCount;
      this.loading = false;
      await this.loadViewer(token, sessionVersion, userId, role);
      if (!this.isCurrent(token, sessionVersion, userId, role) || this.viewerId === userId) { return; }
      await Promise.all([
        this.loadPublications(token, sessionVersion, userId, role),
        this.loadMoments(token, sessionVersion, userId, role)
      ]);
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

  private async loadViewer(token: number, sessionVersion: number, userId: number, role: string): Promise<void> {
    const start = Date.now(); UiPerf.mark('public.viewer.start');
    try {
      if (this.appClient.sessionManager.isAuthenticated()) {
        try {
          const viewer = await this.appClient.apiService.currentSession(`${this.requestKey}.viewer`);
          if (!this.isCurrent(token, sessionVersion, userId, role)) { return; }
          this.viewerId = viewer.userId;
          if (viewer.userId === userId) { this.onOpenSelf?.(); return; }
        } catch (error) {
          if (!this.isCurrent(token, sessionVersion, userId, role)) { return; }
          this.viewerError = '当前身份读取失败，暂不可关注';
        }
      }

    } finally { UiPerf.elapsed('public.viewer.end', start); }
  }

  private async loadPublications(token: number, sessionVersion: number, userId: number, role: string): Promise<void> {
    const start = Date.now(); UiPerf.mark('public.content.start');
    try {
      try {
        await this.loadContent(1, token, sessionVersion, userId, role);
      } catch (error) {
        if (!this.isCurrent(token, sessionVersion, userId, role)) { return; }
        this.errorMessage = (error as Error).message || '公开发布读取失败';
      }

    } finally { UiPerf.elapsed('public.content.end', start); }
  }

  private async loadMoments(token: number, sessionVersion: number, userId: number, role: string): Promise<void> {
    const start = Date.now(); UiPerf.mark('public.moments.start');
    try {
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
    } finally { UiPerf.elapsed('public.moments.end', start); }
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

  @Builder
  private PublicStat(value: string, label: string) {
    Row({ space: 4 }) {
      Text(value).fontSize(14).fontWeight(FontWeight.Bold).fontColor('#2C2D31')
      Text(label).fontSize(10.5).fontColor('#87817B')
    }
  }

  @Builder
  private PublicationText(title: string, city: string) {
    Column({ space: 5 }) {
      Text(title).fontSize(12.5).fontWeight(FontWeight.Medium).fontColor('#313236')
        .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
      if (city.length > 0) { Text(city).fontSize(10).fontColor('#918A84') }
      Text('查看详情 ›').fontSize(11).fontColor(PortraTheme.primary)
    }.layoutWeight(1).alignItems(HorizontalAlign.Start)
  }

  build() {
    Column({ space: 0 }) {
      ProfileHeader({ title: '用户主页', onBack: this.onBack })
      Scroll(this.scroller) {
          Column({ space: PortraTheme.spacingMd }) {
            if (this.loading && this.profile === undefined) { Text('正在读取用户主页…').fontColor(PortraTheme.secondaryText) }
            if (this.errorMessage.length > 0) {
              Text(this.errorMessage)
                .fontColor(PortraTheme.danger)
              Button(this.authenticationRequired ? '去登录' : '重新读取')
                .onClick(() => this.authenticationRequired ? this.onRequireLogin?.() : this.load())
            }
            if (this.profile !== undefined) {
              ProfileIdentity({ nickname: this.displayName(), userId: this.targetUserId,
                avatarFileId: this.profile.avatarFileId ?? 0, bio: this.profile.bio?.trim() ?? '',
                identityLine: this.targetRole === 'PROVIDER' ? '摄影师' : '约拍用户' })
              Row({ space: 28 }) {
                this.PublicStat(`${this.profile.followingCount}`, '关注')
                this.PublicStat(`${this.followerCount}`, '粉丝')
                this.PublicStat(`${this.profile.momentCount}`, '动态')
              }.width('100%').margin({ top: 12, bottom: 6 })
              if (this.viewerId > 0 && this.viewerId !== this.targetUserId) {
                FollowAction({ targetUserId: this.targetUserId, targetRole: this.targetRole,
                  initialProfile: this.profile, currentUserId: this.viewerId, onChanged: (count: number) => this.followerCount = count })
              } else if (this.viewerError.length > 0) {
                Text(this.viewerError).fontSize(12).fontColor(PortraTheme.danger)
                Button('重试').onClick(() => this.load())
              } else if (!this.appClient.sessionManager.isAuthenticated()) {
                Button('登录后关注').fontSize(12).height(36).fontColor(PortraTheme.primary)
                  .backgroundColor(PortraTheme.primarySoft).onClick(() => this.onRequireLogin?.())
              }
              Text(this.targetRole === 'PROVIDER' ? '公开橱窗' : '公开需求').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              if (!this.loading && this.services.length + this.demands.length === 0) { Text('暂无公开发布') }
              ForEach(this.services, (item: ServicePackageSummary) => {
                Row({ space: 11 }) {
                  PortraImage({ source: item.coverImage ?? '', imageWidth: 64, imageHeight: 68,
                    cornerRadius: 10, fallbackText: '橱窗', contentDescription: '公开橱窗封面' })
                  this.PublicationText(item.title?.trim() || '摄影橱窗', item.cityCode ?? '')
                }.width('100%').padding(12).backgroundColor(PortraTheme.surface)
                  .borderRadius(16).border({ width: 1, color: PortraTheme.border })
                  .onClick(() => this.onOpenService?.(item.serviceId))
              }, (item: ServicePackageSummary) => String(item.serviceId))
              ForEach(this.demands, (item: DemandSummary) => {
                Row({ space: 11 }) {
                  PortraImage({ fileId: item.referenceFileIds?.[0] ?? 0, imageWidth: 64, imageHeight: 68,
                    cornerRadius: 10, fallbackText: '需求', contentDescription: '公开需求图片' })
                  this.PublicationText(item.scene?.trim() || '约拍需求', item.cityCode ?? '')
                }.width('100%').padding(12).backgroundColor(PortraTheme.surface)
                  .borderRadius(16).border({ width: 1, color: PortraTheme.border })
                  .onClick(() => this.onOpenDemand?.(item.demandId))
              }, (item: DemandSummary) => String(item.demandId))
              if (this.more) { Button(this.loadingMore ? '加载中' : '加载更多发布').enabled(!this.loadingMore).onClick(() => this.nextPage()) }
              Text('近期动态')
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
          .padding({ left: 16, right: 16, top: 8, bottom: 32 })
          .alignItems(HorizontalAlign.Start)
        }
        .width('100%')
        .layoutWeight(1)
        .align(Alignment.TopStart)
        .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
    .onAreaChange(() => UiPerf.mark('public.layout'))
  }
}
