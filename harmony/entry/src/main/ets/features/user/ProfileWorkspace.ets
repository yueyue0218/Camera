import { AppClient } from '../../app/AppClient';
import { DemandSummary, ServicePackageSummary, UserProfileSummary, UpdateProfilePayload } from '../../model/ApiModels';
import { PortraError } from '../../network/ErrorMapper';
import { ImageUpload } from '../../network/ImageUpload';
import { PortraAvatar } from '../../common/components/PortraAvatar';
import { PortraImage } from '../../common/components/PortraImage';
import { PortraTheme } from '../../theme/PortraTheme';
import { ContentChanges } from './ContentChanges';

@Component
export struct ProfileWorkspace {
  @Prop @Watch('onProfileChanged') profile: UserProfileSummary;
  @Prop editOnly: boolean = false;
  @State private demands: DemandSummary[] = [];
  @State private services: ServicePackageSummary[] = [];
  @State private page: number = 0;
  @State private total: number = 0;
  @State private loading: boolean = false;
  @State private busy: boolean = false;
  @State private error: string = '';
  @State private editing: boolean = false;
  @State private name: string = '';
  @State private bio: string = '';
  @State private avatar: number = 0;
  @State private location: string = '';
  @State private locationVisible: boolean = false;
  @State private birthdayVisible: boolean = false;
  private generation: number = 0;
  private readonly app: AppClient = AppClient.shared;
  private readonly changed: () => void = () => { if (!this.editOnly) { this.load(); } };
  onSaved?: () => void;
  onOpenDemand?: (id: number) => void;
  onOpenService?: (id: number) => void;
  onEditDemand?: (id: number) => void;
  onEditService?: (id: number) => void;
  onPublish?: () => void;

  private onProfileChanged(): void {
    this.generation++;
    this.editing = false;
    this.name = '';
    this.bio = '';
    this.avatar = 0;
    this.busy = false;
    if (this.editOnly) { this.beginEdit(); } else { this.load(); }
  }
  aboutToAppear(): void { ContentChanges.observe(this.changed); if (this.editOnly) { this.beginEdit(); } else { this.load(); } }
  aboutToDisappear(): void { this.generation++; ContentChanges.unobserve(this.changed); }
  private async load(append: boolean = false): Promise<void> {
    if (append && this.loading) { return; }
    const next = append ? this.page + 1 : 1;
    const generation = ++this.generation;
    const epoch = this.app.sessionManager.getSessionVersion();
    this.loading = true; this.error = '';
    if (!append) { this.demands = []; this.services = []; this.page = 0; this.total = 0; }
    try {
      if (this.profile.currentRole === 'CUSTOMER') {
        const result = await this.app.apiService.listMyDemands(next, 'workspace.demands');
        if (generation !== this.generation || epoch !== this.app.sessionManager.getSessionVersion()) { return; }
        if (result === null || !Array.isArray(result.records) || !Number.isSafeInteger(result.total) || result.total < 0 ||
          result.page !== next || result.records.some((row: DemandSummary) => row === null || row.customerId !== this.profile.id ||
            !Number.isSafeInteger(row.demandId) || row.demandId <= 0)) { throw new Error('本人需求分页数据异常'); }
        const rows = result.records;
        this.demands = this.demands.concat(rows.filter((row: DemandSummary) => !this.demands.some((old: DemandSummary) => old.demandId === row.demandId)));
        this.page = next; this.total = result.total;
      } else if (this.profile.currentRole === 'PROVIDER') {
        const result = await this.app.apiService.listMyServices(next, 'workspace.services');
        if (generation !== this.generation || epoch !== this.app.sessionManager.getSessionVersion()) { return; }
        if (result === null || !Array.isArray(result.records) || !Number.isSafeInteger(result.total) || result.total < 0 ||
          result.page !== next || result.records.some((row: ServicePackageSummary) => row === null || row.providerId !== this.profile.id ||
            !Number.isSafeInteger(row.serviceId) || row.serviceId <= 0)) { throw new Error('本人橱窗分页数据异常'); }
        const rows = result.records;
        this.services = this.services.concat(rows.filter((row: ServicePackageSummary) => !this.services.some((old: ServicePackageSummary) => old.serviceId === row.serviceId)));
        this.page = next; this.total = result.total;
      }
    } catch (error) {
      if (generation === this.generation && epoch === this.app.sessionManager.getSessionVersion()) { this.error = (error as Error).message || '读取失败'; }
    } finally { if (generation === this.generation) { this.loading = false; } }
  }
  private beginEdit(): void {
    this.name = (this.profile.currentRole === 'PROVIDER' ? this.profile.providerNickname : this.profile.customerNickname) ?? this.profile.nickname ?? '';
    this.bio = (this.profile.currentRole === 'PROVIDER' ? this.profile.providerBio : this.profile.customerBio) ?? this.profile.bio ?? '';
    this.avatar = (this.profile.currentRole === 'PROVIDER' ? this.profile.providerAvatarFileId : this.profile.customerAvatarFileId) ?? this.profile.avatarFileId ?? 0;
    this.location = this.profile.locationDisplay ?? '';
    this.locationVisible = this.profile.locationVisible === true;
    this.birthdayVisible = this.profile.birthdayVisible === true;
    this.editing = true;
  }
  private async pickAvatar(): Promise<void> {
    if (this.busy) { return; }
    this.busy = true; this.error = '';
    const generation = this.generation;
    const epoch = this.app.sessionManager.getSessionVersion();
    try {
      const id = await ImageUpload.pick('AVATAR');
      if (generation === this.generation && epoch === this.app.sessionManager.getSessionVersion() && id !== undefined) { this.avatar = id; }
    } catch (error) { if (generation === this.generation && epoch === this.app.sessionManager.getSessionVersion()) { this.error = (error as Error).message || '上传失败'; } }
    finally { if (generation === this.generation) { this.busy = false; } }
  }
  private async save(): Promise<void> {
    if (this.busy || !this.name.trim()) { return; }
    const generation = this.generation;
    const epoch = this.app.sessionManager.getSessionVersion();
    this.busy = true; this.error = '';
    try {
      const payload: UpdateProfilePayload = { nickname: this.name.trim(), bio: this.bio.trim(), role: this.profile.currentRole,
        avatarFileId: this.avatar > 0 ? this.avatar : undefined, locationDisplay: this.location.trim(),
        locationVisible: this.locationVisible, birthdayVisible: this.birthdayVisible };
      await this.app.apiService.updateMyProfile(payload);
      if (generation !== this.generation || epoch !== this.app.sessionManager.getSessionVersion()) { return; }
      this.editing = false; ContentChanges.publish(); this.onSaved?.();
    } catch (error) { if (generation === this.generation && epoch === this.app.sessionManager.getSessionVersion()) { this.error = (error as PortraError).message || '保存失败，输入已保留'; } }
    finally { if (generation === this.generation) { this.busy = false; } }
  }
  private confirmClose(id: number, service: boolean): void {
    if (this.busy) { return; }
    AlertDialog.show({ title: service ? '下架橱窗？' : '关闭需求？', message: '停止公开展示，已有响应、会话和订单将保留。',
      primaryButton: { value: '取消', action: () => {} },
      secondaryButton: { value: '确认', action: () => this.close(id, service) } });
  }
  private async close(id: number, service: boolean): Promise<void> {
    if (this.busy) { return; }
    this.busy = true; this.error = '';
    const generation = this.generation;
    const epoch = this.app.sessionManager.getSessionVersion();
    try {
      if (service) { await this.app.apiService.offlineService(id); } else { await this.app.apiService.closeDemand(id); }
      if (generation !== this.generation || epoch !== this.app.sessionManager.getSessionVersion()) { return; }
      this.busy = false;
      ContentChanges.publish();
    } catch (error) { if (generation === this.generation && epoch === this.app.sessionManager.getSessionVersion()) { this.error = (error as PortraError).message || '操作失败'; } }
    finally { if (generation === this.generation) { this.busy = false; } }
  }
  // Visual contract: v39 .profile-settings-form + two .profile-menu-row elements.
  // Account privacy is persisted by PATCH /users/me for both identities.
  @Builder
  private Editor() {
    Column({ space: 0 }) {
      Column({ space: 0 }) {
        Text('昵称').width('100%').fontSize(11).fontColor('#908984')
          .margin({ bottom: 6 })
        TextInput({ text: this.name, placeholder: '填写昵称' })
          .width('100%').height(38).fontSize(13).maxLength(50)
          .backgroundColor('#FFFDF9')
          .border({ width: 1, color: '#E7E0D9' }).borderRadius(12)
          .enabled(!this.busy).onChange((value: string) => this.name = value)
          .margin({ bottom: 12 })
        Text('个人简介').width('100%').fontSize(11).fontColor('#908984')
          .margin({ bottom: 6 })
        TextArea({ text: this.bio, placeholder: '介绍你的拍摄风格或需求' })
          .width('100%').height(68).fontSize(13).maxLength(1000)
          .backgroundColor('#FFFDF9')
          .border({ width: 1, color: '#E7E0D9' }).borderRadius(12)
          .enabled(!this.busy).onChange((value: string) => this.bio = value)
          .margin({ bottom: 12 })
        Text('所在地区').width('100%').fontSize(11).fontColor('#908984')
          .margin({ bottom: 6 })
        TextInput({ text: this.location, placeholder: '填写所在地区' })
          .width('100%').height(38).fontSize(13)
          .backgroundColor('#F6F3EE').fontColor('#77736F')
          .border({ width: 1, color: '#E7E0D9' }).borderRadius(12)
          .enabled(!this.busy).maxLength(100).onChange((value: string) => this.location = value)
          .margin({ bottom: 10 })
        Row({ space: 8 }) {
          Text(this.birthdayVisible ? '☑ 展示年龄' : '□ 展示年龄')
            .fontSize(11).fontColor('#77736F').layoutWeight(1)
            .height(38).padding({ left: 12, top: 11 })
            .border({ width: 1, color: '#E7E0D9' }).borderRadius(12)
            .enabled(!this.busy).onClick(() => this.birthdayVisible = !this.birthdayVisible)
          Text(this.locationVisible ? '☑ 展示地区' : '□ 展示地区')
            .fontSize(11).fontColor('#77736F').layoutWeight(1)
            .height(38).padding({ left: 12, top: 11 })
            .border({ width: 1, color: '#E7E0D9' }).borderRadius(12)
            .enabled(!this.busy).onClick(() => this.locationVisible = !this.locationVisible)
        }.width('100%')
        Button(this.busy ? '保存中…' : '保存资料')
          .width('100%').height(42).margin({ top: 13 })
          .fontSize(13).fontWeight(FontWeight.Bold).fontColor('#FFFFFF')
          .backgroundColor('#1735B9').borderRadius(22)
          .enabled(!this.busy && this.name.trim().length > 0)
          .onClick(() => this.save())
      }.width('100%').padding(15).backgroundColor('#FFFDF9')
        .borderRadius(20).border({ width: 1, color: '#E5DED7' })
      // Keep avatar upload on the real encrypted/fileId pipeline.
      Row({ space: 10 }) {
        PortraAvatar({ fileId: this.avatar, displayName: this.name, avatarSize: 26 })
        Column({ space: 2 }) {
          Text('更换头像').fontSize(12.5).fontWeight(FontWeight.Medium)
            .fontColor('#333337')
          Text('支持 JPG、PNG').fontSize(9.5).fontColor('#A09993')
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        Text('›').fontSize(18).fontColor('#AAA39D')
      }.width('100%').height(51).padding({ left: 4, right: 4 })
        .border({ width: 1, color: '#E8E2DB' })
        .onClick(() => this.pickAvatar())
      Row({ space: 10 }) {
        Text('♧').fontSize(21).fontColor('#77716B').width(26)
        Column({ space: 2 }) {
          Text('隐私设置').fontSize(12.5).fontWeight(FontWeight.Medium)
            .fontColor('#333337')
          Text('管理公开资料范围').fontSize(9.5).fontColor('#A09993')
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        Text('›').fontSize(18).fontColor('#AAA39D')
      }.width('100%').height(51).padding({ left: 4, right: 4 })
        .border({ width: 1, color: '#E8E2DB' })
        .onClick(() => AlertDialog.show({
          title: '隐私设置',
          message: '在上方勾选展示年龄、展示地区，再点击保存资料。未填写生日时不会展示年龄。',
          confirm: { value: '知道了', action: () => {} }
        }))
    }.width('100%').alignItems(HorizontalAlign.Start)
  }

  @Builder
  private DemandRow(item: DemandSummary) {
    Column({ space: 9 }) {
      Row({ space: 12 }) {
        PortraImage({ fileId: item.referenceFileIds?.[0] ?? 0, imageWidth: 76, imageHeight: 88,
          cornerRadius: 10, fallbackText: '需求', contentDescription: '需求参考图片' })
        Column({ space: 6 }) {
          Text(item.scene?.trim() || `拍摄需求 #${item.demandId}`).fontSize(14)
            .fontWeight(FontWeight.Medium).fontColor(PortraTheme.primaryText)
            .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(`${item.location ?? item.cityCode ?? '地点未填写'} · ${item.status ?? '状态未知'}`)
            .fontSize(11).fontColor(PortraTheme.secondaryText).maxLines(1)
          Text(item.moderation?.status ?? '审核状态以后台为准')
            .fontSize(10).fontColor(PortraTheme.primary)
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Text('›').fontSize(24).fontColor(PortraTheme.mutedText)
      }.width('100%').onClick(() => this.onOpenDemand?.(item.demandId))
      Row({ space: 10 }) {
        Button('查看详情').fontSize(12).height(33).fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft).onClick(() => this.onOpenDemand?.(item.demandId))
        if (item.status === 'OPEN') {
          Button('编辑').height(33).fontSize(12).enabled(!this.busy)
            .fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
            .onClick(() => this.onEditDemand?.(item.demandId))
          Button('关闭').height(33).fontSize(12).enabled(!this.busy)
            .fontColor(PortraTheme.danger).backgroundColor(PortraTheme.pageBackground)
            .onClick(() => this.confirmClose(item.demandId, false))
        }
      }.width('100%')
    }.width('100%').alignItems(HorizontalAlign.Start).padding(12)
      .backgroundColor(PortraTheme.surface).borderRadius(15)
      .border({ width: 1, color: PortraTheme.border })
  }

  @Builder
  private ServiceRow(item: ServicePackageSummary) {
    Column({ space: 9 }) {
      Row({ space: 12 }) {
        PortraImage({ source: item.coverImage ?? '', imageWidth: 76, imageHeight: 88,
          cornerRadius: 10, fallbackText: '橱窗', contentDescription: '橱窗封面' })
        Column({ space: 6 }) {
          Text(item.title?.trim() || `摄影橱窗 #${item.serviceId}`).fontSize(14)
            .fontWeight(FontWeight.Medium).fontColor(PortraTheme.primaryText).maxLines(2)
          Text(`${item.cityCode ?? '地区未填写'} · ${item.status ?? '状态未知'}`)
            .fontSize(11).fontColor(PortraTheme.secondaryText)
          Text(item.moderation?.status ?? '审核状态以后台为准')
            .fontSize(10).fontColor(PortraTheme.primary)
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Text('›').fontSize(24).fontColor(PortraTheme.mutedText)
      }.width('100%').onClick(() => this.onOpenService?.(item.serviceId))
      Row({ space: 10 }) {
        Button('查看详情').fontSize(12).height(33).fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft).onClick(() => this.onOpenService?.(item.serviceId))
        Button('编辑').fontSize(12).height(33).enabled(!this.busy)
          .fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
          .onClick(() => this.onEditService?.(item.serviceId))
        if (item.status === 'ONLINE') {
          Button('下架').fontSize(12).height(33).enabled(!this.busy)
            .fontColor(PortraTheme.danger).backgroundColor(PortraTheme.pageBackground)
            .onClick(() => this.confirmClose(item.serviceId, true))
        }
      }.width('100%')
    }.width('100%').alignItems(HorizontalAlign.Start).padding(12)
      .backgroundColor(PortraTheme.surface).borderRadius(15)
      .border({ width: 1, color: PortraTheme.border })
  }

  build() {
    Column({ space: 12 }) {
      if (this.editOnly) {
        this.Editor()
      } else {
        Row({ space: 12 }) {
          Column({ space: 4 }) {
            Text(this.profile.currentRole === 'PROVIDER' ? '我的橱窗' : '我的需求')
              .fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
            Text('已发布内容与管理').fontSize(11).fontColor(PortraTheme.secondaryText)
          }.layoutWeight(1).alignItems(HorizontalAlign.Start)
          Button('＋ 新发布').height(36).fontSize(12).fontColor(PortraTheme.primary)
            .backgroundColor(PortraTheme.primarySoft).enabled(!this.busy)
            .onClick(() => this.onPublish?.())
        }.width('100%')
        if (this.loading) { Text('正在读取发布记录…').fontColor(PortraTheme.secondaryText) }
        if (this.error.length > 0) {
          Text(this.error).fontSize(12).fontColor(PortraTheme.danger)
          Button('重试读取').onClick(() => this.load())
        }
        if (!this.loading && this.error.length === 0 && this.demands.length + this.services.length === 0) {
          Text('暂时没有发布内容').fontSize(13).fontColor(PortraTheme.secondaryText)
            .width('100%').padding(18)
        }
        ForEach(this.demands, (item: DemandSummary) => { this.DemandRow(item) },
          (item: DemandSummary) => `${item.demandId}:${item.status}`)
        ForEach(this.services, (item: ServicePackageSummary) => { this.ServiceRow(item) },
          (item: ServicePackageSummary) => `${item.serviceId}:${item.status}`)
        if (this.demands.length + this.services.length < this.total) {
          Button(this.loading ? '加载中…' : '加载更多').width('100%').height(39)
            .enabled(!this.loading && !this.busy).fontColor(PortraTheme.primary)
            .backgroundColor(PortraTheme.primarySoft).onClick(() => this.load(true))
        }
      }
      if (this.error.length > 0 && this.editOnly) {
        Text(this.error).fontSize(12).fontColor(PortraTheme.danger)
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}
