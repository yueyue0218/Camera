import { AppClient } from '../app/AppClient';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { ContentChanges } from '../features/user/ContentChanges';
import { ImageUpload } from '../network/ImageUpload';
import { PortraGallery } from '../common/components/PortraGallery';
import { CreateServicePackagePayload, DemandSummary } from '../model/ApiModels';
import { CreateDemandPayload } from '../model/ApiModels';
import { ErrorKind, ErrorMapper, PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

class PublishImage {
  uri: string = '';
  fileId: number = 0;
  error: string = '';
}

@Component
export struct PublishPage {
  @Prop demandId: number = 0;
  @Prop serviceId: number = 0;
  @State private scene: string = '';
  @State private styles: string = '';
  @State private duration: string = '';
  @State private originals: string = '';
  @State private refined: string = '';
  @State private days: string = '';
  @State private fileIds: number[] = [];
  @State private uploading: boolean = false;
  @State private images: PublishImage[] = [];
  @State private completed: boolean = false;
  private originalDemand: DemandSummary | undefined = undefined;
  private generation: number = 0;
  private identity: number = -1;
  onServicePublished?: (id: number) => void;
  @State private title: string = '';
  @State private city: string = '';
  @State private place: string = '';
  @State private description: string = '';
  @State private minBudget: string = '';
  @State private maxBudget: string = '';
  @State private time: string = '';
  @State private submitting: boolean = false;
  @State private errorMessage: string = '';
  @State private role: string = '';
  @State private sessionLoading: boolean = true;
  private readonly appClient: AppClient = AppClient.shared;
  onBack?: () => void;
  onPublished?: (demandId: number) => void;

  aboutToAppear(): void {
    this.loadRole();
  }

  aboutToDisappear(): void {
    this.generation++;
    this.appClient.apiService.cancelCurrentSession();
  }

  private async loadRole(): Promise<void> {
    const generation = ++this.generation;
    this.identity = this.appClient.sessionManager.getSessionVersion();
    this.sessionLoading = true;
    this.role = '';
    this.errorMessage = '';
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.role = '';
      this.errorMessage = '请先登录后发布需求';
      this.sessionLoading = false;
      return;
    }
    try {
      const session = await this.appClient.apiService.currentSession();
      if (generation !== this.generation || this.identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
      this.role = session.role.trim().toUpperCase();
      if (this.demandId > 0) {
        const d = await this.appClient.apiService.getDemand(this.demandId);
        if (generation !== this.generation || this.identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (this.role !== 'CUSTOMER' || d.customerId !== session.userId || d.status !== 'OPEN') { throw new Error('当前身份不能编辑此需求'); }
        this.originalDemand = d;
        this.title = d.scene ?? ''; this.city = d.cityCode ?? ''; this.place = d.location ?? '';
        this.time = d.timeDescription ?? ''; this.description = d.description ?? '';
        this.minBudget = d.budgetMinCent === undefined ? '' : String(d.budgetMinCent / 100);
        this.maxBudget = d.budgetMaxCent === undefined ? '' : String(d.budgetMaxCent / 100);
        this.fileIds = d.referenceFileIds ?? []; this.styles = (d.styleTags ?? []).join(',');
      } else if (this.serviceId > 0) {
        const s = await this.appClient.apiService.getServicePackage(this.serviceId);
        if (generation !== this.generation || this.identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (this.role !== 'PROVIDER' || s.providerId !== session.userId) { throw new Error('当前身份不能编辑此橱窗'); }
        this.title = s.title ?? ''; this.city = s.cityCode ?? ''; this.place = s.serviceArea ?? '';
        this.time = s.timeDescription ?? ''; this.description = s.description ?? ''; this.scene = s.scene ?? '';
        this.minBudget = s.basePriceCent === undefined ? '' : String(s.basePriceCent / 100);
        this.duration = String(s.durationMinutes ?? ''); this.originals = String(s.originalCount ?? '');
        this.refined = String(s.refinedCount ?? ''); this.days = String(s.deliveryDays ?? '');
        this.fileIds = s.portfolioIds ?? []; this.styles = (s.styleTags ?? []).join(',');
      }
    } catch (error) {
      if (!this.isCurrent(generation)) { return; }
      this.role = '';
      this.errorMessage = (error as PortraError).message || '账号角色暂不可用';
    } finally {
      if (this.isCurrent(generation)) { this.sessionLoading = false; }
    }
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generation && this.identity === this.appClient.sessionManager.getSessionVersion();
  }

  private imageCount(): number {
    return this.fileIds.length + this.images.filter((item: PublishImage) => item.fileId === 0).length;
  }

  private async pickImage(): Promise<void> {
    if (this.uploading || this.submitting || this.completed || this.sessionLoading || !this.isCurrent(this.generation) || this.imageCount() >= 9) { return; }
    this.uploading = true; this.errorMessage = '';
    const generation = this.generation;
    try {
      const uris = await ImageUpload.select(9 - this.imageCount());
      if (!this.isCurrent(generation)) { return; }
      for (const uri of uris) {
        if (this.imageCount() >= 9) { break; }
        if (this.images.some((item: PublishImage) => item.uri === uri)) { continue; }
        const item = new PublishImage(); item.uri = uri;
        this.images = this.images.concat(item);
      }
      await this.uploadPending(generation);
    } catch (error) {
      if (this.isCurrent(generation)) { this.errorMessage = (error as Error).message || '无法打开相册，请重新选择'; }
    } finally { if (this.isCurrent(generation)) { this.uploading = false; } }
  }

  private async uploadPending(generation: number): Promise<void> {
    for (const item of this.images) {
      if (!this.isCurrent(generation)) { return; }
      if (item.fileId > 0) { continue; }
      try {
        const id = await ImageUpload.upload(item.uri, this.role === 'PROVIDER' ? 'SERVICE_PORTFOLIO' : 'DEMAND_REFERENCE', this.identity);
        if (!this.isCurrent(generation)) { return; }
        item.fileId = id; item.error = '';
        this.fileIds = this.fileIds.concat(id);
      } catch (error) {
        if (!this.isCurrent(generation)) { return; }
        item.error = (error as Error).message || '图片读取或上传失败，请重选或重试';
        this.errorMessage = item.error;
      }
      this.images = this.images.slice();
    }
  }

  private async retryImages(): Promise<void> {
    if (this.uploading || this.submitting || !this.isCurrent(this.generation)) { return; }
    const generation = this.generation;
    this.uploading = true; this.errorMessage = '';
    try { await this.uploadPending(generation); }
    finally { if (this.isCurrent(generation)) { this.uploading = false; } }
  }

  private removeImage(uri: string, id: number): void {
    if (this.uploading || this.submitting) { return; }
    this.images = this.images.filter((item: PublishImage) => item.uri !== uri);
    if (id > 0) { this.fileIds = this.fileIds.filter((value: number) => value !== id); }
  }

  private saveFailure(error: PortraError): string {
    if ([ErrorKind.TIMEOUT, ErrorKind.NETWORK, ErrorKind.PARSE].includes(error.kind) || error.httpStatus >= 500) {
      return '保存结果尚未确认，未自动重发。内容已保留，请先在个人主页或大厅核对是否已创建，再决定是否重试。';
    }
    return error.message || '保存失败，输入已保留';
  }

  private parseBudget(value: string): number | undefined {
    if (value.trim().length === 0) {
      return undefined;
    }
    const amount = Number(value.trim());
    const cents = Math.round(amount * 100);
    return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(cents) &&
      cents <= 2147483647 ? cents : undefined;
  }

  private async publish(): Promise<void> {
    if (this.submitting || this.uploading || this.completed) {
      return;
    }
    if (this.images.some((item: PublishImage) => item.fileId === 0)) { this.errorMessage = '请先重试上传失败的图片，或移除后再发布'; return; }
    if (this.identity !== this.appClient.sessionManager.getSessionVersion()) { this.role = ''; this.errorMessage = '账号已变化，请返回重新进入'; return; }
    if (this.role === 'PROVIDER' && !this.sessionLoading) { await this.publishService(); return; }
    if (this.sessionLoading) {
      this.errorMessage = '正在确认账号身份，请稍候';
      return;
    }
    if (this.role !== 'CUSTOMER') {
      this.errorMessage = this.role.length === 0 ?
        '账号身份读取失败，请点击“重试读取账号”后再试。' : '仅约拍用户可以发布需求；如需发布橱窗，请切换摄影师身份。';
      return;
    }
    const min = this.parseBudget(this.minBudget);
    const max = this.parseBudget(this.maxBudget);
    if (!this.title.trim() || !this.city.trim() || !this.place.trim() || !this.time.trim()) {
      this.errorMessage = '请填写标题、城市、地点和时间';
      return;
    }
    if ((this.minBudget.trim() && min === undefined) || (this.maxBudget.trim() && max === undefined) ||
      (min !== undefined && max !== undefined && min > max)) {
      this.errorMessage = '请检查预算金额';
      return;
    }
    const payload: CreateDemandPayload = {
      scene: this.title.trim(), cityCode: this.city.trim(), location: this.place.trim(),
      timeDescription: this.time.trim(), description: this.description.trim(),
      budgetMinCent: min, budgetMaxCent: max, referenceFileIds: this.fileIds,
      styleTags: this.styles.split(/[,，]/).map((v: string) => v.trim()).filter((v: string) => v.length > 0),
      expectedDate: this.originalDemand?.expectedDate, timeSlot: this.originalDemand?.timeSlot, timeTags: this.originalDemand?.timeTags
    };
    this.submitting = true;
    this.errorMessage = '';
    const generation = this.generation;
    try {
      const demand = this.demandId > 0 ? await this.appClient.apiService.updateDemand(this.demandId, payload) : await this.appClient.apiService.createDemand(payload);
      if (demand === null || !Number.isSafeInteger(demand.demandId) || demand.demandId <= 0) { throw ErrorMapper.parse(); }
      ContentChanges.publish();
      if (!this.isCurrent(generation)) { return; }
      this.completed = true;
      this.onPublished?.(demand.demandId);
    } catch (error) {
      if (this.isCurrent(generation)) { this.errorMessage = this.saveFailure(error as PortraError); }
    } finally {
      if (this.isCurrent(generation)) { this.submitting = false; }
    }
  }

  private async publishService(): Promise<void> {
    const price = this.parseBudget(this.minBudget);
    const duration = Number(this.duration), originals = Number(this.originals), refined = Number(this.refined), days = Number(this.days);
    if (!this.title.trim() || !this.city.trim() || !this.scene.trim() || !this.time.trim() || !price ||
      !Number.isInteger(duration) || duration <= 0 || !Number.isInteger(days) || days <= 0 ||
      !this.originals.trim() || !this.refined.trim() || !Number.isInteger(originals) || originals < 0 || !Number.isInteger(refined) || refined < 0 || this.fileIds.length === 0) {
      this.errorMessage = '请填写标题、城市、场景、时间、正数价格/时长/天数、非负张数，并上传至少一张图片'; return;
    }
    const payload: CreateServicePackagePayload = { title: this.title.trim(), cityCode: this.city.trim(), scene: this.scene.trim(),
      serviceArea: this.place.trim(), description: this.description.trim(), timeDescription: this.time.trim(), basePriceCent: price,
      durationMinutes: duration, originalCount: originals, refinedCount: refined, deliveryDays: days, portfolioIds: this.fileIds,
      styleTags: this.styles.split(/[,，]/).map((v: string) => v.trim()).filter((v: string) => v.length > 0) };
    this.submitting = true; this.errorMessage = '';
    const generation = this.generation;
    try {
      const result = this.serviceId > 0 ? await this.appClient.apiService.updateService(this.serviceId, payload) : await this.appClient.apiService.createServicePackage(payload);
      if (result === null || !Number.isSafeInteger(result.serviceId) || result.serviceId <= 0) { throw ErrorMapper.parse(); }
      ContentChanges.publish();
      if (!this.isCurrent(generation)) { return; }
      this.completed = true;
      this.onServicePublished?.(result.serviceId);
    } catch (error) { if (this.isCurrent(generation)) { this.errorMessage = this.saveFailure(error as PortraError); } }
    finally { if (this.isCurrent(generation)) { this.submitting = false; } }
  }

  @Builder
  private SectionTitle(number: string, title: string) {
    Row({ space: 9 }) {
      Text(number)
        .fontSize(11)
        .fontColor(PortraTheme.primary)
        .fontWeight(FontWeight.Bold)
      Text(title)
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
    }
    .width('100%')
    .padding({ top: 6, bottom: 6 })
  }

  @Builder
  private FieldLabel(label: string) {
    Text(label)
      .fontSize(12)
      .fontColor(PortraTheme.secondaryText)
      .width('100%')
  }

  build() {
    Column() {
      PortraPageHeading({ title: this.serviceId > 0 || this.demandId > 0 ? '编辑发布内容' : this.role === 'PROVIDER' ? '发布橱窗' : '发布需求', eyebrow: 'CREATE / REQUEST', onBack: () => { this.generation++; this.onBack?.(); } })
      Scroll() {
        Column({ space: 16 }) {
          if (this.role === 'PROVIDER') {
            Text('橱窗提交后是否公开取决于服务端审核和上下架状态。')
            TextInput({ text: this.scene, placeholder: '拍摄场景' }).onChange((v: string) => this.scene = v)
            TextInput({ text: this.duration, placeholder: '拍摄时长（分钟）' }).type(InputType.Number).onChange((v: string) => this.duration = v)
            TextInput({ text: this.originals, placeholder: '原片数量' }).type(InputType.Number).onChange((v: string) => this.originals = v)
            TextInput({ text: this.refined, placeholder: '精修数量' }).type(InputType.Number).onChange((v: string) => this.refined = v)
            TextInput({ text: this.days, placeholder: '交付天数' }).type(InputType.Number).onChange((v: string) => this.days = v)
          }
          this.SectionTitle('01', '基础信息')
          Column({ space: 9 }) {
            this.FieldLabel('拍摄主题')
            TextInput({ text: this.title, placeholder: '例如：想拍一组毕业照' })
              .height(48)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding({ left: 14, right: 14 })
              .onChange((value: string) => this.title = value)
            this.FieldLabel('城市')
            TextInput({ text: this.city, placeholder: '填写拍摄城市' })
              .height(48)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding({ left: 14, right: 14 })
              .onChange((value: string) => this.city = value)
            this.FieldLabel('具体地点')
            TextInput({ text: this.place, placeholder: '例如：学校、街区或公园' })
              .height(48)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding({ left: 14, right: 14 })
              .onChange((value: string) => this.place = value)
          }
          .width('100%')

          this.SectionTitle('02', '拍摄想法')
          Column({ space: 9 }) {
            this.FieldLabel('补充说明')
            TextArea({ text: this.description, placeholder: '氛围、人数、服装或其他想法' })
              .height(112)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding(14)
              .onChange((value: string) => this.description = value)
          }
          .width('100%')

          this.SectionTitle('03', '预算与时间')
          Row({ space: 10 }) {
            Column({ space: 8 }) {
              this.FieldLabel(this.role === 'PROVIDER' ? '基础价格（元）' : '预算下限（元）')
              TextInput({ text: this.minBudget, placeholder: '最低预算' })
                .type(InputType.Number)
                .height(48)
                .backgroundColor(PortraTheme.surface)
                .border({ width: 1, color: PortraTheme.border })
                .borderRadius(8)
                .padding({ left: 14, right: 14 })
                .onChange((value: string) => this.minBudget = value)
            }
            .layoutWeight(1)
            Column({ space: 8 }) {
              this.FieldLabel('预算上限（元，仅需求）')
              TextInput({ text: this.maxBudget, placeholder: '最高预算' })
                .type(InputType.Number)
                .height(48)
                .backgroundColor(PortraTheme.surface)
                .border({ width: 1, color: PortraTheme.border })
                .borderRadius(8)
                .padding({ left: 14, right: 14 })
                .onChange((value: string) => this.maxBudget = value)
            }
            .layoutWeight(1)
            .visibility(this.role === 'CUSTOMER' ? Visibility.Visible : Visibility.None)
          }
          .width('100%')
          Column({ space: 9 }) {
            this.FieldLabel('拍摄时间')
            TextInput({ text: this.time, placeholder: '例如：本周六下午 / 时间可协商' })
              .height(48)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding({ left: 14, right: 14 })
              .onChange((value: string) => this.time = value)
          }
          .width('100%')

          this.SectionTitle('04', '参考风格')
          Column() {
            Text(`添加图片 ${this.imageCount()}/9`)
              .fontSize(12)
              .fontColor(PortraTheme.secondaryText)
          }
          .width(108)
          .height(98)
          .justifyContent(FlexAlign.Center)
          .backgroundColor(PortraTheme.pageBackgroundDeep)
          .borderRadius(8)

          .onClick(() => this.pickImage())

          TextInput({ text: this.styles, placeholder: '风格，以逗号分隔' }).onChange((v: string) => this.styles = v)
          PortraGallery({ fileIds: this.fileIds })
          ForEach(this.images, (item: PublishImage) => {
            Row({ space: 8 }) {
              Image(item.uri).width(64).height(64).objectFit(ImageFit.Cover).borderRadius(8)
              Text(item.fileId > 0 ? '已上传' : item.error || '等待上传…').fontSize(12).layoutWeight(1)
              Button('删除').enabled(!this.uploading && !this.submitting).onClick(() => this.removeImage(item.uri, item.fileId))
            }
          }, (item: PublishImage) => `${item.uri}:${item.fileId}:${item.error}`)
          ForEach(this.fileIds.filter((id: number) => !this.images.some((item: PublishImage) => item.fileId === id)), (id: number) => {
            Button(`删除图片 ${id}`).onClick(() => this.fileIds = this.fileIds.filter((value: number) => value !== id))
          }, (id: number) => String(id))
          Button(this.uploading ? '上传中…' : '选择并上传图片').enabled(!this.uploading && !this.submitting && !this.sessionLoading && this.role.length > 0 && this.imageCount() < 9).onClick(() => this.pickImage())
          if (this.images.some((item: PublishImage) => item.fileId === 0)) {
            Button('重试未上传图片').enabled(!this.uploading && !this.submitting).onClick(() => this.retryImages())
          }
          Text('内容不会在离开页面后保存')
            .fontSize(11)
            .fontColor(PortraTheme.mutedText)
            .width('100%')
            .margin({ top: 8 })
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding({ left: 20, right: 20, top: 18, bottom: 28 })
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
      .enabled(!this.submitting && !this.uploading && !this.sessionLoading)

      Column({ space: 6 }) {
        if (!this.sessionLoading && this.role.length === 0) { Button('重试读取账号').onClick(() => this.loadRole()) }
        if (this.errorMessage.length > 0) {
          Text(this.errorMessage).fontSize(12).fontColor(PortraTheme.danger).width('100%')
        }
        Button(this.sessionLoading ? '正在确认账号…' :
          ['CUSTOMER', 'PROVIDER'].includes(this.role) ? (this.submitting ? '保存中…' : '提交保存') : '当前角色不可发布')
          .width('100%')
          .height(48)
          .fontSize(15)
          .fontColor(PortraTheme.white)
          .backgroundColor(PortraTheme.primary)
          .enabled(!this.completed && !this.submitting && !this.uploading && !this.sessionLoading && ['CUSTOMER', 'PROVIDER'].includes(this.role))
          .borderRadius(8)
          .onClick(() => this.publish())
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 12, bottom: 20 })
      .backgroundColor(PortraTheme.surface)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
