import { AppClient } from '../../app/AppClient';
import { PortraAvatar } from '../../common/components/PortraAvatar';
import { MomentSummary, PublicUserProfile } from '../../model/ApiModels';
import { createMomentFeedRequestKey, MomentFeedFormatter } from './MomentFeedModels';

@Component
export struct MomentAuthor {
  @Prop @Watch('onTargetChanged') item: MomentSummary;
  @Prop dark: boolean = false;
  @Prop disabled: boolean = false;
  @State private profile: PublicUserProfile | undefined = undefined;
  private active: boolean = false;
  private generation: number = 0;
  private version: number = -1;
  private target: string = '';
  private readonly app: AppClient = AppClient.shared;
  private readonly profileRequestKey: string = `${createMomentFeedRequestKey()}.author`;
  onOpenAuthor?: (item: MomentSummary) => void;

  aboutToAppear(): void { this.active = true; this.load(); }
  aboutToDisappear(): void {
    this.active = false; this.generation++; this.profile = undefined;
    this.app.apiService.cancelPublicProfile(this.profileRequestKey, `${this.profileRequestKey}.unused`);
  }
  private onTargetChanged(): void { if (this.active) { this.load(); } }
  private async load(): Promise<void> {
    const target = `${this.item.authorId}:${this.item.authorRole}`;
    const version = this.app.sessionManager.getSessionVersion();
    if (target === this.target && version === this.version && this.profile !== undefined) { return; }
    this.target = target; this.version = version; const generation = ++this.generation;
    this.profile = undefined; this.app.apiService.cancelPublicProfile(this.profileRequestKey, `${this.profileRequestKey}.unused`);
    const id = this.item.authorId; const role = this.item.authorRole;
    if (!this.app.sessionManager.isAuthenticated() || !Number.isSafeInteger(id) || id <= 0 ||
      !['CUSTOMER', 'PROVIDER'].includes(role)) { return; }
    try {
      const result = await this.app.apiService.getPublicProfile(id, role, this.profileRequestKey);
      if (this.active && generation === this.generation && version === this.app.sessionManager.getSessionVersion() &&
        result?.userId === id && result.currentRole === role) { this.profile = result; }
    } catch { /* Truthful role/id fallback; never invent a nickname or avatar URL. */ }
  }
  private currentProfile(): PublicUserProfile | undefined {
    return this.active && this.app.sessionManager.isAuthenticated() &&
      this.version === this.app.sessionManager.getSessionVersion() &&
      this.profile?.userId === this.item.authorId && this.profile.currentRole === this.item.authorRole ?
      this.profile : undefined;
  }
  private name(): string {
    return this.currentProfile()?.nickname?.trim() || MomentFeedFormatter.author(this.item);
  }
  private avatarFileId(): number {
    const id = this.currentProfile()?.avatarFileId ?? 0;
    return Number.isSafeInteger(id) && id > 0 ? id : 0;
  }
  private open(): void {
    if (!this.active || this.disabled || this.version !== this.app.sessionManager.getSessionVersion() ||
      !this.app.sessionManager.isAuthenticated()) { return; }
    this.onOpenAuthor?.(this.item);
  }
  build() {
    Button({ type: ButtonType.Normal }) {
      Row({ space: 10 }) {
        PortraAvatar({ fileId: this.avatarFileId(), displayName: this.name(), avatarSize: 36 })
        Column({ space: 4 }) {
          Text(this.name()).fontSize(14).fontWeight(FontWeight.Medium)
            .fontColor(this.dark ? '#FFFFFF' : '#1746C5').maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(MomentFeedFormatter.time(this.item.createdAt)).fontSize(10)
            .fontColor(this.dark ? '#BBB7B0' : '#67615A').maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
      }.width('100%')
    }.width('100%').height(48).padding(0).backgroundColor(Color.Transparent).stateEffect(false)
      .enabled(this.onOpenAuthor !== undefined && !this.disabled)
      .accessibilityText(`${this.name()}的头像和昵称，打开作者主页`).onClick(() => this.open())
  }
}
