import { ProvinceCatalog } from '../common/region/ProvinceCatalog';
import { common } from '@kit.AbilityKit';
import { promptAction } from '@kit.ArkUI';
import { PublishDraftStore } from '../features/publish/PublishDraftStore';
import { JournalText } from '../features/publish/JournalText';
import { HallFilterOption, HallFilterOptions } from '../features/hall/HallFilterOptions';
import { PortraImage } from '../common/components/PortraImage';
import { JournalStyle, JournalHeading, JournalKicker, JournalTitle, JournalFacts, JournalSection, JournalRow } from '../features/publish/JournalUI';
import { AppClient } from '../app/AppClient';
import { ContentChanges } from '../features/user/ContentChanges';
import { ImageUpload } from '../network/ImageUpload';
import { CreateServicePackagePayload, DemandSummary } from '../model/ApiModels';
import { CreateDemandPayload } from '../model/ApiModels';
import { ErrorKind, ErrorMapper, PortraError } from '../network/ErrorMapper';

class PublishImage {
  uri: string = '';
  sourceUri: string = '';
  uploading: boolean = false;
  fileId: number = 0;
  error: string = '';
}

class PublishDraft {
  title: string = '';
  city: string = '';
  place: string = '';
  description: string = '';
  minBudget: string = '';
  maxBudget: string = '';
  time: string = '';
  scene: string = '';
  styles: string = '';
  duration: string = '';
  originals: string = '';
  refined: string = '';
  days: string = '';
  subtitle: string = '';
  delivery: string = '';
  people: string = '';
  date: string = '';
  availableDates: string[] = [];
  negotiable: boolean = false;
  fileIds: number[] = [];
  images: PublishImage[] = [];
}

@Component
export struct PublishPage {
  @Prop demandId: number = 0;
  @Prop serviceId: number = 0;
  @State @Watch('scheduleDraft') private subtitle: string = '';
  @State @Watch('scheduleDraft') private delivery: string = '';
  @State @Watch('scheduleDraft') private people: string = '1 人';
  @State @Watch('scheduleDraft') private date: string = '';
  @State @Watch('scheduleDraft') private availableDates: string[] = [];
  @State @Watch('scheduleDraft') private negotiable: boolean = true;
  @State private preview: boolean = false;
  @State private draftNotice: string = '';
  private drafts?: PublishDraftStore;
  private draftReady: boolean = false;
  private draftTimer: number = -1;
  @State @Watch('scheduleDraft') private scene: string = '';
  @State @Watch('scheduleDraft') private styles: string = '';
  @State @Watch('scheduleDraft') private duration: string = '';
  @State @Watch('scheduleDraft') private originals: string = '';
  @State @Watch('scheduleDraft') private refined: string = '';
  @State @Watch('scheduleDraft') private days: string = '';
  @State private fileIds: number[] = [];
  @State private uploading: boolean = false;
  @State private images: PublishImage[] = [];
  @State private completed: boolean = false;
  private originalDemand: DemandSummary | undefined = undefined;
  private generation: number = 0;
  private identity: number = -1;
  onServicePublished?: (id: number) => void;
  @State @Watch('scheduleDraft') private title: string = '';
  @State @Watch('scheduleDraft') private city: string = '';
  @State @Watch('scheduleDraft') private place: string = '';
  @State @Watch('scheduleDraft') private description: string = '';
  @State @Watch('scheduleDraft') private minBudget: string = '';
  @State @Watch('scheduleDraft') private maxBudget: string = '';
  @State @Watch('scheduleDraft') private time: string = '时间可商量';
  @State private submitting: boolean = false;
  @State private errorMessage: string = '';
  @State private role: string = '';
  @State private sessionLoading: boolean = true;
  private readonly appClient: AppClient = AppClient.shared;
  onBack?: () => void;
  onBackHandler?: (handler: (() => boolean) | undefined) => void;
  onPublished?: (demandId: number) => void;

  aboutToAppear(): void {
    this.onBackHandler?.(() => {
      if (this.submitting) { return true; }
      if (this.preview) { this.preview = false; return true; }
      this.saveDraft(false);
      return false;
    });
    this.loadRole();
  }

  aboutToDisappear(): void {
    this.onBackHandler?.(undefined);
    if (this.draftTimer >= 0) { clearTimeout(this.draftTimer); this.draftTimer = -1; }
    if (!this.completed) { this.saveDraft(false); }
    this.generation++;
    this.appClient.apiService.cancelCurrentSession();
  }

  private async loadRole(): Promise<void> {
    this.draftReady = false;
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
      if (!['CUSTOMER', 'PROVIDER'].includes(this.role)) { throw new Error('当前账号没有发布权限'); }
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      this.drafts = new PublishDraftStore(context, session.userId, this.role, this.demandId || this.serviceId);
      if (this.role === 'PROVIDER') { this.time = '需提前沟通'; }
      if (this.demandId > 0) {
        const d = await this.appClient.apiService.getDemand(this.demandId);
        if (generation !== this.generation || this.identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (this.role !== 'CUSTOMER' || d.customerId !== session.userId || d.status !== 'OPEN') { throw new Error('当前身份不能编辑此需求'); }
        this.originalDemand = d;
        this.title = d.scene ?? ''; this.city = ProvinceCatalog.code(d.cityCode ?? ''); this.place = d.location ?? '';
        this.time = d.timeDescription ?? ''; this.description = d.description ?? '';
        this.minBudget = d.budgetMinCent === undefined ? '' : String(d.budgetMinCent / 100);
        this.maxBudget = d.budgetMaxCent === undefined ? '' : String(d.budgetMaxCent / 100);
        this.fileIds = d.referenceFileIds ?? []; this.styles = (d.styleTags ?? []).join(',');
      } else if (this.serviceId > 0) {
        const s = await this.appClient.apiService.getServicePackage(this.serviceId);
        if (generation !== this.generation || this.identity !== this.appClient.sessionManager.getSessionVersion()) { return; }
        if (this.role !== 'PROVIDER' || s.providerId !== session.userId) { throw new Error('当前身份不能编辑此橱窗'); }
        this.title = s.title ?? ''; this.city = ProvinceCatalog.code(s.cityCode ?? ''); this.place = s.serviceArea ?? '';
        this.time = s.timeDescription ?? ''; this.description = s.description ?? ''; this.scene = s.scene ?? '';
        this.minBudget = s.basePriceCent === undefined ? '' : String(s.basePriceCent / 100);
        this.duration = String(s.durationMinutes ?? ''); this.originals = String(s.originalCount ?? '');
        this.refined = String(s.refinedCount ?? ''); this.days = String(s.deliveryDays ?? '');
        this.fileIds = s.portfolioIds ?? []; this.styles = (s.styleTags ?? []).join(',');
        this.availableDates = (s.availableDates ?? []).slice();
      }
      const extra = JournalText.decode(this.description);
      this.description = extra.story; this.subtitle = extra.subtitle; this.delivery = extra.delivery;
      if (extra.people) { this.people = extra.people; }
      if (this.demandId > 0) { this.date = this.originalDemand?.expectedDate ?? ''; this.negotiable = extra.negotiable; }
      this.restoreDraft();
      this.draftReady = true;
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
        if (this.images.some((item: PublishImage) => item.sourceUri === uri || item.uri === uri)) { continue; }
        const item = new PublishImage(); item.sourceUri = uri;
        item.uri = this.drafts ? await this.drafts.keepPhoto(uri) : uri;
        if (!this.isCurrent(generation)) { this.drafts?.removePhoto(item.uri); return; }
        this.images = this.images.concat(item);
      }
      this.saveDraft(false);
      await this.uploadPending(generation);
    } catch (error) {
      if (this.isCurrent(generation)) { this.errorMessage = (error as Error).message || '无法打开相册，请重新选择'; }
    } finally { if (this.isCurrent(generation)) { this.uploading = false; } }
  }

  private async uploadPending(generation: number, onlyUri: string = ''): Promise<void> {
    for (const item of this.images) {
      if (!this.isCurrent(generation)) { return; }
      if (item.fileId > 0 || (onlyUri && item.uri !== onlyUri)) { continue; }
      item.uploading = true; this.images = this.images.slice();
      try {
        const id = await ImageUpload.upload(item.uri, this.role === 'PROVIDER' ? 'SERVICE_PORTFOLIO' : 'DEMAND_REFERENCE', this.identity);
        if (!this.isCurrent(generation)) { return; }
        item.fileId = id; item.error = '';
        this.syncImageIds();
      } catch (error) {
        if (!this.isCurrent(generation)) { return; }
        item.error = (error as Error).message || '图片读取或上传失败，请重选或重试';
        this.errorMessage = item.error;
      }
      item.uploading = false;
      this.images = this.images.slice();
      this.saveDraft(false);
    }
  }

  private async retryImages(onlyUri: string = ''): Promise<void> {
    if (this.uploading || this.submitting || !this.isCurrent(this.generation)) { return; }
    const generation = this.generation;
    this.uploading = true; this.errorMessage = '';
    try { await this.uploadPending(generation, onlyUri); }
    finally { if (this.isCurrent(generation)) { this.uploading = false; } }
  }

  private removeImage(uri: string, id: number): void {
    if (this.uploading || this.submitting) { return; }
    this.images = this.images.filter((item: PublishImage) => item.uri !== uri);
    if (id > 0) { this.fileIds = this.fileIds.filter((value: number) => value !== id); }
    if (this.saveDraft(false)) { this.drafts?.removePhoto(uri); }
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
      amount <= 99999 ? cents : undefined;
  }

  private async publish(): Promise<void> {
    if (this.submitting || this.uploading || this.completed) {
      return;
    }
    if (this.images.some((item: PublishImage) => item.fileId === 0)) { this.errorMessage = '请先重试上传失败的图片，或移除后再发布'; return; }
    if (this.identity !== this.appClient.sessionManager.getSessionVersion()) { this.role = ''; this.errorMessage = '账号已变化，请返回重新进入'; return; }
    const validation = this.validateForm();
    if (validation) { this.errorMessage = validation; this.preview = false; return; }
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
    if (!this.title.trim() || !this.city.trim() || !this.time.trim()) {
      this.errorMessage = '请填写标题、地区、地点和时间';
      return;
    }
    if ((this.minBudget.trim() && min === undefined) || (this.maxBudget.trim() && max === undefined) ||
      (min !== undefined && max !== undefined && min > max)) {
      this.errorMessage = '请检查预算金额';
      return;
    }
    const payload: CreateDemandPayload = {
      scene: this.title.trim(), cityCode: ProvinceCatalog.requireCode(this.city), location: this.place.trim() || '具体地点可沟通',
      timeDescription: this.time.trim(), description: this.descriptionPayload(),
      budgetMinCent: min, budgetMaxCent: max, referenceFileIds: this.fileIds,
      styleTags: this.styles.split(/[,，]/).map((v: string) => v.trim()).filter((v: string) => v.length > 0),
      expectedDate: this.date || undefined, timeSlot: this.time.trim(), timeTags: this.originalDemand?.timeTags
    };
    this.saveDraft(false);
    this.submitting = true;
    this.errorMessage = '';
    const generation = this.generation;
    try {
      const demand = this.demandId > 0 ? await this.appClient.apiService.updateDemand(this.demandId, payload) : await this.appClient.apiService.createDemand(payload);
      if (demand === null || !Number.isSafeInteger(demand.demandId) || demand.demandId <= 0 || this.demandId > 0 && demand.demandId !== this.demandId) { throw ErrorMapper.parse(); }
      ContentChanges.publish();
      if (!this.isCurrent(generation)) { return; }
      this.completed = true;
      this.clearDraft();
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
      this.errorMessage = '请填写标题、地区、场景、时间、正数价格/时长/天数、非负张数，并上传至少一张图片'; return;
    }
    const payload: CreateServicePackagePayload = { title: this.title.trim(), cityCode: ProvinceCatalog.requireCode(this.city), scene: this.scene.trim(),
      serviceArea: this.place.trim(), description: this.descriptionPayload(), timeDescription: this.time.trim(), basePriceCent: price,
      durationMinutes: duration, originalCount: originals, refinedCount: refined, deliveryDays: days, portfolioIds: this.fileIds,
      styleTags: this.styles.split(/[,，]/).map((v: string) => v.trim()).filter((v: string) => v.length > 0),
      availableDates: this.availableDates.slice() };
    this.saveDraft(false);
    this.submitting = true; this.errorMessage = '';
    const generation = this.generation;
    try {
      const result = this.serviceId > 0 ? await this.appClient.apiService.updateService(this.serviceId, payload) : await this.appClient.apiService.createServicePackage(payload);
      if (result === null || !Number.isSafeInteger(result.serviceId) || result.serviceId <= 0 || this.serviceId > 0 && result.serviceId !== this.serviceId) { throw ErrorMapper.parse(); }
      ContentChanges.publish();
      if (!this.isCurrent(generation)) { return; }
      this.completed = true;
      this.clearDraft();
      this.onServicePublished?.(result.serviceId);
    } catch (error) { if (this.isCurrent(generation)) { this.errorMessage = this.saveFailure(error as PortraError); } }
    finally { if (this.isCurrent(generation)) { this.submitting = false; } }
  }

  private descriptionPayload(): string {
    return JournalText.encode(this.description, this.role === 'PROVIDER' ? this.subtitle : '',
      this.role === 'PROVIDER' ? this.delivery : '', this.role === 'CUSTOMER' ? this.people : '',
      this.role === 'CUSTOMER' && this.negotiable);
  }

  private moveImageFirst(id: number): void {
    if (this.uploading || this.submitting || id <= 0 || !this.fileIds.includes(id)) { return; }
    this.fileIds = [id, ...this.fileIds.filter((value: number) => value !== id)];
    this.saveDraft(false);
  }

  private syncImageIds(): void {
    const uploadedIds = this.images.filter((item: PublishImage) => item.fileId > 0).map((item: PublishImage) => item.fileId);
    this.fileIds = this.fileIds.concat(uploadedIds.filter((id: number) => !this.fileIds.includes(id)));
  }

  private scheduleDraft(): void {
    if (!this.draftReady || this.completed) { return; }
    if (this.draftTimer >= 0) { clearTimeout(this.draftTimer); }
    this.draftTimer = setTimeout(() => { this.draftTimer = -1; this.saveDraft(false); }, 350);
  }

  private saveDraft(notify: boolean = true): boolean {
    if (!this.draftReady || !this.drafts || this.completed || !this.isCurrent(this.generation)) { return false; }
    const draft = new PublishDraft();
    draft.title = this.title;
    draft.city = this.city;
    draft.place = this.place;
    draft.description = this.description;
    draft.minBudget = this.minBudget;
    draft.maxBudget = this.maxBudget;
    draft.time = this.time;
    draft.scene = this.scene;
    draft.styles = this.styles;
    draft.duration = this.duration;
    draft.originals = this.originals;
    draft.refined = this.refined;
    draft.days = this.days;
    draft.subtitle = this.subtitle;
    draft.delivery = this.delivery;
    draft.people = this.people;
    draft.date = this.date;
    draft.availableDates = this.availableDates.slice();
    draft.negotiable = this.negotiable;
    draft.fileIds = this.fileIds; draft.images = this.images;
    try {
      this.drafts.write(JSON.stringify(draft));
      if (notify) { this.draftNotice = '草稿已保存在本机'; promptAction.showToast({ message: this.draftNotice }); }
      return true;
    } catch { this.errorMessage = '本机草稿保存失败，请保留页面后重试'; return false; }
  }

  private restoreDraft(): void {
    try {
      const value = this.drafts?.read() ?? '';
      if (!value) { return; }
      const draft = JSON.parse(value) as PublishDraft;
      if (typeof draft.title === 'string') { this.title = draft.title; }
      if (typeof draft.city === 'string') { this.city = ProvinceCatalog.code(draft.city); }
      if (typeof draft.place === 'string') { this.place = draft.place; }
      if (typeof draft.description === 'string') { this.description = draft.description; }
      if (typeof draft.minBudget === 'string') { this.minBudget = draft.minBudget; }
      if (typeof draft.maxBudget === 'string') { this.maxBudget = draft.maxBudget; }
      if (typeof draft.time === 'string') { this.time = draft.time; }
      if (typeof draft.scene === 'string') { this.scene = draft.scene; }
      if (typeof draft.styles === 'string') { this.styles = draft.styles; }
      if (typeof draft.duration === 'string') { this.duration = draft.duration; }
      if (typeof draft.originals === 'string') { this.originals = draft.originals; }
      if (typeof draft.refined === 'string') { this.refined = draft.refined; }
      if (typeof draft.days === 'string') { this.days = draft.days; }
      if (typeof draft.subtitle === 'string') { this.subtitle = draft.subtitle; }
      if (typeof draft.delivery === 'string') { this.delivery = draft.delivery; }
      if (typeof draft.people === 'string') { this.people = draft.people; }
      if (typeof draft.date === 'string') { this.date = draft.date; }
      if (Array.isArray(draft.availableDates)) { this.availableDates = draft.availableDates.filter((value: string) => typeof value === 'string'); }
      this.negotiable = draft.negotiable === true;
      this.fileIds = Array.isArray(draft.fileIds) ? draft.fileIds.filter((id: number) => Number.isSafeInteger(id) && id > 0).slice(0, 9) : [];
      this.images = Array.isArray(draft.images) ? draft.images.slice(0, 9).map((item: PublishImage) => {
        const restored = new PublishImage(); restored.uri = item.uri; restored.sourceUri = item.sourceUri;
        restored.fileId = this.fileIds.includes(item.fileId) ? item.fileId : 0;
        restored.error = restored.fileId > 0 ? '' : '上次上传未完成，请重试';
        if (this.drafts && !this.drafts.hasPhoto(restored.uri)) {
          if (restored.fileId === 0) { restored.error = '本地图片已不可用，请删除后重新选择'; }
          else { restored.uri = ''; }
        }
        return restored;
      }) : [];
      this.images = this.images.filter((item: PublishImage) => item.uri.length > 0);
      this.draftNotice = '已恢复本机草稿';
    } catch { this.errorMessage = '草稿读取失败，已保留原始草稿'; }
  }

  private clearDraft(): void {
    try { this.drafts?.clear(); } catch { this.draftNotice = '发布成功，但本机草稿清理失败'; return; }
    this.images.forEach((item: PublishImage) => this.drafts?.removePhoto(item.uri));
  }

  private selectedStyles(): string[] {
    return this.styles.split(/[,，]/).map((value: string) => value.trim()).filter((value: string) => value.length > 0);
  }

  private toggleStyle(value: string): void {
    const selected = this.selectedStyles();
    if (selected.includes(value)) { this.styles = selected.filter((item: string) => item !== value).join(','); }
    else if (selected.length < 3) { this.styles = selected.concat(value).join(','); }
    else { this.errorMessage = '最多选择 3 项拍摄风格'; }
  }

  private validDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }

  private chooseDate(service: boolean): void {
    if (this.submitting) { return; }
    const value = service ? this.availableDates[this.availableDates.length - 1] ?? '' : this.date;
    const selected = this.validDate(value) ? new Date(value + 'T12:00:00') : new Date();
    const version = this.generation;
    DatePickerDialog.show({ start: new Date(1900, 0, 1), end: new Date(2100, 11, 31), selected: selected,
      onAccept: (result: DatePickerResult) => {
        if (!this.isCurrent(version) || this.submitting || result.year === undefined || result.month === undefined || result.day === undefined) { return; }
        const date = `${result.year}-${String(result.month + 1).padStart(2, '0')}-${String(result.day).padStart(2, '0')}`;
        if (!this.validDate(date)) { return; }
        if (service) {
          if (!this.availableDates.includes(date)) { this.availableDates = this.availableDates.concat(date).sort(); }
        } else { this.date = date; }
      }
    });
  }

  private validateForm(): string {
    if (!this.title.trim() || this.title.trim().length > 30) { return '请填写标题，最多 30 字'; }
    if (!this.description.trim() || this.description.trim().length > 500) { return '请填写描述，最多 500 字'; }
    if (!ProvinceCatalog.code(this.city)) { return '请选择省级地区'; }
    if (this.selectedStyles().length > 3) { return '最多选择 3 项拍摄风格'; }
    if (this.imageCount() > 9) { return '最多添加 9 张图片'; }
    const min = this.parseBudget(this.minBudget), max = this.parseBudget(this.maxBudget);
    if (min === undefined) { return '请填写 0–99999 元范围内的金额'; }
    if (this.role === 'PROVIDER') {
      if (this.availableDates.some((value: string) => !this.validDate(value))) { return '请选择有效的可约日期'; }
      if (min === 0) { return '当前服务要求参考起价大于 0 元'; }
      if (this.subtitle.length > 80 || this.delivery.length > 300 || this.place.length > 70) { return '请检查介绍、服务范围和交付说明的长度'; }
      if (!this.scene.trim() || !this.time.trim()) { return '请选择拍摄类型和可约时间'; }
      if (!this.imageCount()) { return '请添加至少一张摄影作品'; }
      if (!Number.isInteger(Number(this.duration)) || Number(this.duration) <= 0 || Number(this.duration) > 2147483647 ||
        !Number.isInteger(Number(this.days)) || Number(this.days) <= 0 || Number(this.days) > 2147483647 ||
        !this.originals.trim() || !this.refined.trim() || !Number.isInteger(Number(this.originals)) || Number(this.originals) < 0 || Number(this.originals) > 2147483647 ||
        !Number.isInteger(Number(this.refined)) || Number(this.refined) < 0 || Number(this.refined) > 2147483647) {
        return '请填写正整数拍摄分钟数、交付天数和非负整数原片/精修张数';
      }
    } else {
      if (max === undefined || min > max) { return '请填写正确的预算范围：最低不大于最高，最高不超过 99999 元'; }
      if (this.place.length > 50) { return '拍摄地点最多 50 字'; }
      if (this.originalDemand?.expectedDate && !this.date) { return '已发布需求的日期暂不支持清空，请重新选择日期'; }
      if (this.date && !this.validDate(this.date)) {
        return '请选择有效日期，或留空';
      }
    }
    return '';
  }

  private showPreview(): void {
    if (this.sessionLoading || this.submitting || !['CUSTOMER', 'PROVIDER'].includes(this.role)) { return; }
    this.errorMessage = this.validateForm();
    if (this.errorMessage) { return; }
    this.saveDraft(false); this.preview = true;
  }

  private back(): void {
    if (this.submitting) { return; }
    if (this.preview) { this.preview = false; return; }
    this.saveDraft(false); this.onBack?.();
  }

  private budgetText(): string {
    return this.role === 'PROVIDER' ? '¥' + this.minBudget + ' 起' : '¥' + this.minBudget + '–' + this.maxBudget;
  }

  @Builder
  private SectionTitle(number: string, title: string, english: string) {
    Row({ space: 9 }) {
      Text(number).fontSize(12).fontColor(JournalStyle.blue).fontWeight(FontWeight.Bold)
      Text(title).fontSize(15).fontWeight(FontWeight.Bold).fontColor('#303036')
      Blank()
      Text(english).fontSize(10).fontColor('#AAA29C')
    }.width('100%').margin({ bottom: 6 })
  }

  @Builder
  private Field(label: string, value: string, placeholder: string, limit: number, change: (value: string) => void, numeric: boolean = false) {
    Column({ space: 8 }) {
      Row() {
        Text(label).fontSize(12).fontWeight(FontWeight.Medium).fontColor('#4A4745')
        Blank()
        if (!numeric) { Text(value.length + ' / ' + limit).fontSize(10).fontColor('#A29B93') }
      }.width('100%')
      TextInput({ text: value, placeholder: placeholder }).height(46).fontSize(13)
        .type(numeric ? InputType.Number : InputType.Normal).maxLength(limit)
        .backgroundColor('#FAF8F4').border({ width: 1, color: '#E8E1D9' }).borderRadius(11)
        .padding({ left: 13, right: 13 }).onChange(change)
    }.width('100%').alignItems(HorizontalAlign.Start).margin({ top: 9 })
  }

  @Builder
  private DateField(service: boolean) {
    Column({ space: 8 }) {
      Text(service ? '具体可约日期（可选，可多选）' : '期望日期（可选）').fontSize(12).fontWeight(FontWeight.Medium).fontColor('#4A4745')
      Button(service ? '请选择日期' : this.date || '请选择日期', { type: ButtonType.Normal })
        .width('100%').height(46).fontSize(13).fontColor(!service && this.date ? '#4A4745' : '#8E8780')
        .backgroundColor('#FAF8F4').border({ width: 1, color: '#E8E1D9' }).borderRadius(11)
        .padding({ left: 13, right: 13 }).onClick(() => this.chooseDate(service))
      if (service) {
        ForEach(this.availableDates, (value: string) => {
          Button(value + '  ×').fontSize(12).height(30).backgroundColor('#EEF0FC').fontColor(JournalStyle.blue)
            .onClick(() => { this.availableDates = this.availableDates.filter((date: string) => date !== value); })
        }, (value: string) => value)
        Text('具体日期用于大厅筛选；可约时间说明不会自动转换为日期。').fontSize(10).fontColor(JournalStyle.muted)
      } else if (this.date && !this.originalDemand?.expectedDate) {
        Text('清除日期').fontSize(11).fontColor(JournalStyle.blue).onClick(() => this.date = '')
      } else if (this.originalDemand?.expectedDate) {
        Text('已发布日期可重选，暂不支持清空').fontSize(10).fontColor(JournalStyle.muted)
      }
    }.width('100%').alignItems(HorizontalAlign.Start).margin({ top: 9 })
  }

  @Builder
  private Area(label: string, value: string, placeholder: string, limit: number, change: (value: string) => void) {
    Column({ space: 8 }) {
      Row() {
        Text(label).fontSize(12).fontWeight(FontWeight.Medium).fontColor('#4A4745')
        Blank()
        Text(value.length + ' / ' + limit).fontSize(10).fontColor('#A29B93')
      }.width('100%')
      TextArea({ text: value, placeholder: placeholder }).height(124).fontSize(13).maxLength(limit)
        .backgroundColor('#FAF8F4').border({ width: 1, color: '#E8E1D9' }).borderRadius(11).padding(13).onChange(change)
    }.width('100%').alignItems(HorizontalAlign.Start).margin({ top: 9 })
  }

  @Builder
  private Styles() {
    Column({ space: 8 }) {
      Row() {
        Text(this.role === 'PROVIDER' ? '我的拍摄风格' : '喜欢的拍摄风格').fontSize(12).fontWeight(FontWeight.Medium).fontColor('#4A4745')
        Blank()
        Text('最多选择 3 项').fontSize(10).fontColor('#AAA39D')
      }.width('100%')
      Flex({ wrap: FlexWrap.Wrap }) {
        ForEach(HallFilterOptions.styles().slice(1).map((option: HallFilterOption) => option.value), (style: string) => {
          Button((this.selectedStyles().includes(style) ? '✓ ' : '') + HallFilterOptions.styleLabel(style)).height(34).fontSize(11)
            .fontColor(this.selectedStyles().includes(style) ? JournalStyle.blue : '#716B66')
            .backgroundColor(this.selectedStyles().includes(style) ? '#EEF0FC' : '#F8F5F1')
            .border({ width: 1, color: this.selectedStyles().includes(style) ? '#8595DB' : '#E5DED4' })
            .borderRadius(11).padding({ left: 11, right: 11 }).margin({ right: 7, bottom: 8 }).onClick(() => this.toggleStyle(style))
        }, (style: string) => style)
      }.width('100%')
    }.width('100%').margin({ top: 15 })
  }

  @Builder
  private Editor() {
    Column() {
      Column({ space: 9 }) {
        Row() {
          Text(this.role === 'PROVIDER' ? 'PORTRA / CREATE A SHOWCASE' : 'PORTRA / MAKE A REQUEST')
            .fontSize(10).letterSpacing(1.2).fontWeight(FontWeight.Bold).fontColor(JournalStyle.blue)
          Blank()
          Text('NO. 01—04').fontSize(10).fontColor('#98928C')
        }.width('100%')
        Text(this.role === 'PROVIDER' ? '让作品说话，' : '你的下一帧，').fontSize(26).fontWeight(FontWeight.Bold).fontColor('#23252B')
        Text(this.role === 'PROVIDER' ? '让故事发生。' : '从这里开始。').fontSize(26).fontWeight(FontWeight.Bold)
          .fontColor(this.role === 'PROVIDER' ? JournalStyle.blue : '#23252B')
        Text(this.role === 'PROVIDER' ? '把你擅长的光影、服务与风格，整理成一扇可以被看见的橱窗。' :
          '说说你想拍什么。合适的摄影师，会循着这些细节找到你。').fontSize(12).lineHeight(22).fontColor('#89827D')
        if (this.draftNotice) { Text(this.draftNotice).fontSize(11).fontColor(JournalStyle.blue) }
      }.width('100%').alignItems(HorizontalAlign.Start).padding({ top: 24, bottom: 20, left: 4, right: 4 })

      Column({ space: 6 }) {
        this.SectionTitle('01', this.role === 'PROVIDER' ? '橱窗介绍' : '拍摄想法', this.role === 'PROVIDER' ? 'YOUR JOURNAL' : 'YOUR IDEA')
        this.Field(this.role === 'PROVIDER' ? '橱窗标题 *' : '需求标题 *', this.title, '为这次拍摄起一个标题', 30, (v: string) => this.title = v)
        if (this.role === 'PROVIDER') {
          this.Field('一句话介绍', this.subtitle, '用一句话介绍你的光影与风格', 80, (v: string) => this.subtitle = v)
        }
        this.Styles()
        this.Area(this.role === 'PROVIDER' ? '橱窗描述 *' : '详细说说你的需求 *', this.description,
          this.role === 'PROVIDER' ? '介绍你的拍摄理念、画面气质，以及一次拍摄会如何进行……' : '希望照片是什么感觉？有什么特别想记录的瞬间……',
          500, (v: string) => this.description = v)
      }.width('100%').padding(16).backgroundColor(JournalStyle.surface).borderRadius(19)
        .border({ width: 1, color: '#E6DED5' }).margin({ bottom: 16 })

      Column({ space: 6 }) {
        this.SectionTitle('02', this.role === 'PROVIDER' ? '拍摄服务' : '时间与地点', this.role === 'PROVIDER' ? 'SERVICE' : 'TIME & PLACE')
        Row({ space: 11 }) {
          Column() {
            Text(this.role === 'PROVIDER' ? '服务地区 *' : '拍摄地区 *').fontSize(12).fontColor('#4A4745').margin({ bottom: 8, top: 9 })
            Select(HallFilterOptions.cities(this.city ? [this.city] : []).slice(1).map((option: HallFilterOption): SelectOption => ({ value: option.label })))
              .value(this.city ? HallFilterOptions.cityLabel(this.city) : this.role === 'PROVIDER' ? '请选择服务地区' : '请选择拍摄地区')
              .width('100%').height(46).font({ size: 13 }).backgroundColor('#FAF8F4').borderRadius(11)
              .onSelect((index: number) => { this.city = HallFilterOptions.cities(this.city ? [this.city] : [])[index + 1].value; })
          }.layoutWeight(1)
          Column({ space: 8 }) {
            Text(this.role === 'PROVIDER' ? '主要拍摄类型 *' : '参与人数').fontSize(12).fontColor('#4A4745')
            if (this.role === 'PROVIDER') {
              Select([{ value: '校园写真' }, { value: '个人肖像' }, { value: '毕业纪念' }, { value: '城市街拍' }, { value: '情侣 / 双人' }, { value: '汉服古风' }, { value: '其他拍摄' }])
                .value(this.scene || '请选择').width('100%').height(46).font({ size: 13 }).backgroundColor('#FAF8F4').borderRadius(11)
                .onSelect((_index: number, value: string) => this.scene = value)
            } else {
              Select([{ value: '1 人' }, { value: '2 人' }, { value: '3 人' }, { value: '4 人' }, { value: '5 人及以上' }])
                .value(this.people).width('100%').height(46).font({ size: 13 }).backgroundColor('#FAF8F4').borderRadius(11).onSelect((_i: number, v: string) => this.people = v)
            }
          }.layoutWeight(1).alignItems(HorizontalAlign.Start).margin({ top: 9 })
        }.width('100%')
        this.Field(this.role === 'PROVIDER' ? '常拍地点 / 服务范围' : '希望在哪儿拍', this.place, '具体地点可沟通', this.role === 'PROVIDER' ? 70 : 50, (v: string) => this.place = v)
        if (this.role === 'PROVIDER') {
          this.Field('参考起价 *（元）', this.minBudget, '请输入参考起价', 8, (v: string) => this.minBudget = v, true)
          Text('仅展示服务参考起价，具体拍摄安排由双方在站内沟通确认。').fontSize(10).lineHeight(17).fontColor(JournalStyle.muted)
        } else {
          Row({ space: 11 }) {
            Column() { this.DateField(false) }.layoutWeight(1)
            Column({ space: 8 }) {
              Text('时间偏好').fontSize(12).fontColor('#4A4745')
              Select([{ value: '时间可商量' }, { value: '上午' }, { value: '下午' }, { value: '傍晚' }, { value: '周末优先' }])
                .value(this.time).width('100%').height(46).font({ size: 13 }).backgroundColor('#FAF8F4').borderRadius(11).onSelect((_i: number, v: string) => this.time = v)
            }.layoutWeight(1).alignItems(HorizontalAlign.Start).margin({ top: 9 })
          }.width('100%')
        }
      }.width('100%').padding(16).backgroundColor(JournalStyle.surface).borderRadius(19)
        .border({ width: 1, color: '#E6DED5' }).margin({ bottom: 16 })

      Column({ space: 6 }) {
        this.SectionTitle('03', this.role === 'PROVIDER' ? '预约与交付' : '预算预期', this.role === 'PROVIDER' ? 'THE DETAILS' : 'BUDGET')
        if (this.role === 'PROVIDER') {
          this.Field('参考拍摄时长 *（分钟）', this.duration, '填写拍摄分钟数', 10, (v: string) => this.duration = v, true)
          Text('可约时间 *').fontSize(12).fontColor('#4A4745').width('100%').margin({ top: 10 })
          Select([{ value: '周末可约' }, { value: '工作日可约' }, { value: '近期均可约' }, { value: '需提前沟通' }])
            .value(this.time).width('100%').font({ size: 13 }).backgroundColor('#FAF8F4').borderRadius(11).onSelect((_i: number, v: string) => this.time = v)
          this.DateField(true)
          this.Area('服务内容 / 交付说明', this.delivery, '说明服装妆造、精修、原片及交付周期', 300, (v: string) => this.delivery = v)
          Row({ space: 11 }) {
            Column() { this.Field('原片数量 *', this.originals, '原片张数', 10, (v: string) => this.originals = v, true) }.layoutWeight(1)
            Column() { this.Field('精修数量 *', this.refined, '精修张数', 10, (v: string) => this.refined = v, true) }.layoutWeight(1)
          }
          this.Field('交付周期 *（天）', this.days, '填写交付天数', 10, (v: string) => this.days = v, true)
        } else {
          Row({ space: 10 }) {
            Column() { this.Field('最低预算 *（元）', this.minBudget, '最低', 8, (v: string) => this.minBudget = v, true) }.layoutWeight(1)
            Column() { this.Field('最高预算 *（元）', this.maxBudget, '最高', 8, (v: string) => this.maxBudget = v, true) }.layoutWeight(1)
          }.width('100%')
          Row({ space: 6 }) {
            Checkbox().select(this.negotiable).selectedColor(JournalStyle.blue).onChange((v: boolean) => this.negotiable = v)
            Text('预算可以根据拍摄方案再沟通').fontSize(11).fontColor('#716B66').layoutWeight(1)
          }.width('100%')
          Text('预算仅供双方沟通参考，费用请与对方协商。').fontSize(10).lineHeight(17).fontColor(JournalStyle.muted)
        }
      }.width('100%').padding(16).backgroundColor(JournalStyle.surface).borderRadius(19)
        .border({ width: 1, color: '#E6DED5' }).margin({ bottom: 16 })

      Column({ space: 12 }) {
        this.SectionTitle('04', this.role === 'PROVIDER' ? '作品影集' : '灵感参考', this.imageCount() + ' / 9 PHOTOS')
        Button(this.uploading ? '正在上传 ' + this.fileIds.length + ' / ' + this.imageCount() :
          this.role === 'PROVIDER' ? '添加摄影作品 ＋' : '添加参考图片 ＋')
          .width('100%').height(76).fontSize(14).fontColor(JournalStyle.blue).backgroundColor('#F4F1EB')
          .border({ width: 1, color: '#D9D2C7', style: BorderStyle.Dashed }).borderRadius(12)
          .enabled(!this.uploading && this.imageCount() < 9).onClick(() => this.pickImage())
        Text('最多 9 张 · JPG / PNG / WebP · 单张不超过 10 MB').fontSize(10).fontColor(JournalStyle.muted)
        Flex({ wrap: FlexWrap.Wrap }) {
          ForEach(this.fileIds.filter((id: number) => !this.images.some((item: PublishImage) => item.fileId === id)), (id: number, index: number) => {
            Column({ space: 4 }) {
              Stack({ alignContent: Alignment.BottomStart }) {
                PortraImage({ fileId: id, imageWidth: '100%', imageHeight: 106, cornerRadius: 9 })
                if (this.fileIds[0] === id) { Text('封面').fontSize(10).fontColor(Color.White).padding(4).backgroundColor(JournalStyle.blue) }
                Button('×').width(24).height(24).padding(0).fontSize(17).fontColor(Color.White).backgroundColor('#99333333')
                  .align(Alignment.TopEnd).accessibilityText('删除图片').enabled(!this.uploading).onClick(() => this.removeImage('', id))
              }.width('100%').height(106)
              Text(this.fileIds[0] === id ? '封面 · 已上传' : '已上传').fontSize(10).fontColor(JournalStyle.muted)
              if (this.fileIds[0] !== id) { Button('设为封面').height(28).fontSize(10).enabled(!this.uploading).onClick(() => this.moveImageFirst(id)) }
            }.width('30%').margin({ right: '3%', bottom: 10 })
          }, (id: number) => id.toString())
          ForEach(this.images, (item: PublishImage, index: number) => {
            Column({ space: 4 }) {
              Stack({ alignContent: Alignment.BottomStart }) {
                Image(item.uri).width('100%').height(106).objectFit(ImageFit.Cover).borderRadius(9)
                if (this.fileIds[0] === item.fileId && item.fileId > 0 || this.fileIds.length === 0 && index === 0) {
                  Text('封面').fontSize(10).fontColor(Color.White).padding(4).backgroundColor(JournalStyle.blue)
                }
                Button('×').width(24).height(24).padding(0).fontSize(17).fontColor(Color.White).backgroundColor('#99333333')
                  .align(Alignment.TopEnd).accessibilityText('删除图片').enabled(!this.uploading).onClick(() => this.removeImage(item.uri, item.fileId))
              }.width('100%').height(106)
              Text(item.uploading ? '上传中…' : item.fileId > 0 ? '已上传' : item.error || '等待上传').fontSize(10)
                .fontColor(item.error ? '#A44532' : JournalStyle.muted).maxLines(2)
              if (item.fileId > 0 && this.fileIds[0] !== item.fileId) { Button('设为封面').height(28).fontSize(10).enabled(!this.uploading).onClick(() => this.moveImageFirst(item.fileId)) }
              if (item.fileId === 0 && !item.uploading) {
                Button('重试此图片').fontSize(10).height(28).padding(2).enabled(!this.uploading).onClick(() => this.retryImages(item.uri))
              }
            }.width('30%').margin({ right: '3%', bottom: 10 })
          }, (item: PublishImage) => item.uri + ':' + item.fileId + ':' + item.error + ':' + item.uploading)
        }.width('100%')
        Text(this.role === 'PROVIDER' ? '至少 1 张，第一张作为橱窗封面' : '可以不上传图片；第一张会用作需求封面').fontSize(10).fontColor(JournalStyle.muted)
      }.width('100%').padding(16).backgroundColor(JournalStyle.surface).borderRadius(19).border({ width: 1, color: '#E6DED5' })
      Text('发布内容将公开展示。请只上传有权分享的图片，请勿填写手机号、微信号、详细住址等私密联系方式。')
        .fontSize(11).lineHeight(19).fontColor(JournalStyle.muted).padding({ top: 16, bottom: 22 })
    }.width('100%').padding({ left: 17, right: 17 }).alignItems(HorizontalAlign.Start)
  }

  @Builder
  private Preview() {
    Column() {
      JournalKicker({ label: this.role === 'PROVIDER' ? '镜头档案' : '约拍档案', right: 'PREVIEW' })
      Column() {
        if (this.images.length > 0 && (this.fileIds.length === 0 || this.images.some((item: PublishImage) => item.fileId === this.fileIds[0]))) {
          Image(this.images.find((item: PublishImage) => item.fileId === this.fileIds[0])?.uri ?? this.images[0].uri)
            .width('100%').height(270).objectFit(ImageFit.Cover).borderRadius(18)
        } else if (this.fileIds.length > 0) {
          PortraImage({ fileId: this.fileIds[0], variant: 'medium', imageWidth: '100%', imageHeight: 270, cornerRadius: 18 })
        } else {
          Column({ space: 12 }) {
            Text('▧').fontSize(30).fontColor(Color.White)
            Text('还没有添加参考图片').fontSize(13).fontColor(Color.White)
          }.width('100%').height(270).justifyContent(FlexAlign.Center).backgroundColor('#B3BEBB').borderRadius(18)
        }
      }.width('100%').padding({ left: 15, right: 15 })
      JournalTitle({ service: this.role === 'PROVIDER', title: this.title, subtitle: this.role === 'PROVIDER' ? this.subtitle : this.description })
      Column() {
        JournalFacts({ service: this.role === 'PROVIDER', city: this.city, middleLabel: this.role === 'PROVIDER' ? '拍摄风格' : '期望时间',
          middle: this.role === 'PROVIDER' ? this.selectedStyles().join(' / ') : this.date || this.time, price: this.budgetText() })
        if (this.role === 'PROVIDER') {
          JournalSection({ title: '关于这扇橱窗', caption: 'YOUR JOURNAL' })
          Text(this.description).fontSize(13).lineHeight(23).fontColor('#6D6863').width('100%')
        }
        Column() {
          JournalRow({ label: '拍摄风格', value: this.selectedStyles().join(' / ') })
          JournalRow({ label: this.role === 'PROVIDER' ? '服务范围' : '拍摄地点', value: this.place || '具体地点可沟通' })
          if (this.role === 'PROVIDER') {
            JournalRow({ label: '拍摄类型', value: this.scene })
            JournalRow({ label: '具体可约日期', value: this.availableDates.join('、') || '未指定' })
            JournalRow({ label: '拍摄时长', value: this.duration + ' 分钟' })
            JournalRow({ label: '交付说明', value: this.delivery })
            JournalRow({ label: '交付数量', value: '原片 ' + this.originals + ' / 精修 ' + this.refined + ' 张' })
            JournalRow({ label: '交付周期', value: this.days + ' 天' })
          } else {
            JournalRow({ label: '参与人数', value: this.people })
          }
          JournalRow({ label: '时间安排', value: this.time })
          if (this.role === 'CUSTOMER' && this.negotiable) { JournalRow({ label: '预算说明', value: '可根据拍摄方案再沟通' }) }
        }.width('100%').padding({ left: 14, right: 14 }).margin({ top: 20, bottom: 18 })
          .backgroundColor(JournalStyle.surface).borderRadius(15).border({ width: 1, color: JournalStyle.line })
        ForEach(this.images, (item: PublishImage) => {
          Image(item.uri).width('100%').height(220).objectFit(ImageFit.Cover).borderRadius(12).margin({ bottom: 12 })
        }, (item: PublishImage) => item.uri)
        ForEach(this.fileIds.filter((id: number) => !this.images.some((item: PublishImage) => item.fileId === id)), (id: number) => {
          PortraImage({ fileId: id, imageWidth: '100%', imageHeight: 220, cornerRadius: 12 })
        }, (id: number) => id.toString())
        Text('这是发布前预览。确认发布将提交当前内容；图片全部上传成功后才可提交。').fontSize(11).lineHeight(19).fontColor(JournalStyle.muted).padding({ top: 12, bottom: 22 })
      }.width('100%').padding({ left: 19, right: 19 }).alignItems(HorizontalAlign.Start)
    }.width('100%')
  }

  build() {
    Column() {
      JournalHeading({ title: this.preview ? '发布预览' : this.serviceId > 0 || this.demandId > 0 ? '编辑发布内容' :
        this.role === 'PROVIDER' ? '发布摄影橱窗' : '发布拍摄需求', draft: !this.preview,
        onBack: () => this.back(), onDraft: () => this.saveDraft() })
      Scroll() {
        Column() {
          if (this.preview) { this.Preview() } else { this.Editor() }
        }.width('100%').enabled(!this.submitting && !this.sessionLoading && !this.completed)
      }.layoutWeight(1).scrollBar(BarState.Off)
      Column({ space: 6 }) {
        if (this.errorMessage) { Text(this.errorMessage).fontSize(12).fontColor('#A44532').width('100%') }
        if (!this.sessionLoading && this.role.length === 0) { Button('重试读取账号').onClick(() => this.loadRole()) }
        Row({ space: 10 }) {
          Button(this.preview ? '返回修改' : '存草稿').width(96).height(48).fontSize(12).fontColor('#716B66')
            .backgroundColor('#F8F5F1').borderRadius(12).border({ width: 1, color: JournalStyle.line })
            .enabled(!this.submitting).onClick(() => { if (this.preview) { this.preview = false; } else { this.saveDraft(); } })
          Button(this.sessionLoading ? '正在确认账号…' : this.submitting ? '提交中…' : this.preview ? (this.serviceId > 0 || this.demandId > 0 ? '保存修改 →' : '确认发布 →') :
            this.role === 'PROVIDER' ? '预览橱窗 →' : '预览需求 →')
            .layoutWeight(1).height(48).fontSize(13).fontWeight(FontWeight.Bold).fontColor(Color.White)
            .backgroundColor(JournalStyle.blue).borderRadius(13)
            .enabled(!this.completed && !this.submitting && !this.uploading && !this.sessionLoading && ['CUSTOMER', 'PROVIDER'].includes(this.role))
            .onClick(() => { if (this.preview) { this.publish(); } else { this.showPreview(); } })
        }.width('100%')
      }.width('100%').padding({ left: 17, right: 17, top: 11, bottom: 15 })
        .backgroundColor(JournalStyle.surface).border({ width: { top: 1 }, color: JournalStyle.line })
    }.width('100%').height('100%').backgroundColor(JournalStyle.paper)
  }
}
