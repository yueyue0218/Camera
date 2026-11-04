import { UiPerf } from '../../common/performance/UiPerf';
import { ContentChanges } from './ContentChanges';
import { AppClient } from '../../app/AppClient';
import { PublicUserProfile, SocialUserBrief } from '../../model/ApiModels';
import { PortraError } from '../../network/ErrorMapper';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct FollowAction {
  @Prop targetUserId: number = 0;
  @Prop targetRole: string = '';
  @Prop initialProfile: PublicUserProfile | undefined = undefined;
  @Prop currentUserId: number = 0;
  @State private loading: boolean = true;
  @State private busy: boolean = false;
  @State private followed: boolean = false;
  @State private followerCount: number = 0;
  @State private errorMessage: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  onChanged?: (followerCount: number) => void;
  private requestVersion: number = 0;
  private sessionVersion: number = -1;

  aboutToAppear(): void {
    this.busy = false;
    this.load();
  }

  aboutToDisappear(): void {
    this.requestVersion++;
    this.appClient.apiService.cancelSocialUserRequests(this.targetUserId, this.targetRole);
    this.appClient.apiService.cancelSocialUserRequests(this.currentUserId, this.targetRole);
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    const sessionVersion = this.appClient.sessionManager.getSessionVersion();
    this.sessionVersion = sessionVersion;
    this.loading = true;
    this.errorMessage = '';
    try {
      const result: PublicUserProfile = this.initialProfile !== undefined &&
        this.initialProfile.userId === this.targetUserId && this.initialProfile.currentRole === this.targetRole ?
        this.initialProfile : await this.appClient.apiService.getPublicProfile(this.targetUserId, this.targetRole);
      if (version !== this.requestVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      const following = await UiPerf.request('follow.relationship', () => this.appClient.apiService.listFollowing(this.currentUserId, this.targetRole));
      if (version !== this.requestVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (result === null || result.userId !== this.targetUserId ||
        result.currentRole.trim().toUpperCase() !== this.targetRole.trim().toUpperCase() ||
        !Number.isSafeInteger(result.followerCount) || result.followerCount < 0) {
        throw new Error('关注状态格式异常');
      }
      if (!Array.isArray(following)) {
        throw new Error('关注列表格式异常');
      }
      this.followed = following.some((item: SocialUserBrief) =>
        item !== null && item.userId === this.targetUserId);
      this.followerCount = result.followerCount;
      this.onChanged?.(result.followerCount);
    } catch (error) {
      if (version === this.requestVersion &&
        sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
        this.errorMessage = (error as PortraError).message || '关注状态暂不可用';
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
        if (sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
          this.followed = false;
          this.followerCount = 0;
          this.errorMessage = '账号状态已变化，请重新打开页面';
        }
      }
    }
  }

  private async toggle(): Promise<void> {
    if (this.loading || this.busy) {
      return;
    }
    const version = this.requestVersion;
    const sessionVersion = this.sessionVersion;
    if (sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
      this.errorMessage = '账号状态已变化，请重新打开页面';
      return;
    }
    this.busy = true;
    this.errorMessage = '';
    try {
      const result = this.followed ?
        await this.appClient.apiService.unfollowUser(this.targetUserId, this.targetRole) :
        await this.appClient.apiService.followUser(this.targetUserId, this.targetRole);
      if (version !== this.requestVersion ||
        sessionVersion !== this.appClient.sessionManager.getSessionVersion()) {
        return;
      }
      if (result === null || result.targetUserId !== this.targetUserId ||
        result.followed === this.followed || !Number.isSafeInteger(result.followerCount) ||
        result.followerCount < 0) {
        throw new Error('关注操作结果异常');
      }
      this.followed = result.followed;
      this.followerCount = result.followerCount;
      this.onChanged?.(result.followerCount);
      ContentChanges.publish('relations');
    } catch (error) {
      if (version === this.requestVersion &&
        sessionVersion === this.appClient.sessionManager.getSessionVersion()) {
        this.errorMessage = (error as PortraError).message || '关注操作失败';
      }
    } finally {
      if (version === this.requestVersion) {
        this.busy = false;
      }
    }
  }

  build() {
    Column({ space: 6 }) {
      Row({ space: 10 }) {
        Text(`${this.followerCount} 位关注者`)
          .layoutWeight(1)
          .fontSize(12)
          .fontColor(PortraTheme.secondaryText)
        Button(this.loading ? '读取中' : this.busy ? '处理中' : this.followed ? '已关注' : '关注')
          .height(34)
          .fontSize(12)
          .fontColor(this.followed ? PortraTheme.primary : PortraTheme.white)
          .backgroundColor(this.followed ? PortraTheme.primarySoft : PortraTheme.primary)
          .borderRadius(17)
          .enabled(!this.loading && !this.busy && this.errorMessage.length === 0)
          .onClick(() => this.toggle())
      }
      .width('100%')
      if (this.errorMessage.length > 0) {
        Text(this.errorMessage)
          .width('100%')
          .fontSize(11)
          .fontColor(PortraTheme.danger)
        Button('重试关注状态').fontSize(11).height(32).onClick(() => this.load())
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
