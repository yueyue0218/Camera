import { MomentOwnerAttempts } from './MomentOwnerAttempts';
import { MomentDetailData } from './MomentInteractions';
import { MomentPublishLimits } from './MomentPublishLimits';
import { CreateMomentPayload, MomentSummary, SessionSummary } from '../../model/ApiModels';
import { ErrorMapper, PortraError } from '../../network/ErrorMapper';
import { InlineImagePolicy } from '../../common/components/ComponentPolicy';
import { createMomentFeedRequestKey, MomentFeedCache, MomentFeedFormatter } from './MomentFeedModels';
import { MomentInteractionSession } from './MomentInteractions';

export interface MomentPublishApi {
  currentSession(key?: string): Promise<SessionSummary>;
  cancelCurrentSession(key?: string): void;
  createMoment(payload: CreateMomentPayload, key?: string): Promise<MomentSummary>;
  cancelMomentCreate(key?: string): void;
  getMoment(id: number, key?: string): Promise<MomentSummary>;
  cancelMomentDetail(key?: string): void;
  updateMoment(id: number, payload: CreateMomentPayload, key?: string): Promise<MomentSummary>;
  cancelMomentUpdate(id: number, key?: string): void;
}

export class MomentPublishAttempts {
  static readonly shared: MomentPublishAttempts = new MomentPublishAttempts();
  private pending: Set<number> = new Set<number>();
  private unknown: Set<number> = new Set<number>();
  private listeners: Map<number, Set<() => void>> = new Map<number, Set<() => void>>();
  subscribe(actor: number, listener: () => void): void {
    const values = this.listeners.get(actor) ?? new Set<() => void>(); values.add(listener); this.listeners.set(actor, values);
  }
  unsubscribe(actor: number, listener: () => void): void {
    const values = this.listeners.get(actor); values?.delete(listener); if (values?.size === 0) { this.listeners.delete(actor); }
  }
  private notify(actor: number): void { this.listeners.get(actor)?.forEach((listener: () => void) => listener()); }
  isPending(actor: number): boolean { return this.pending.has(actor); }
  isUnknown(actor: number): boolean { return this.unknown.has(actor); }
  begin(actor: number): void { this.pending.add(actor); this.notify(actor); }
  markUnknown(actor: number): void { this.unknown.add(actor); this.notify(actor); }
  finish(actor: number, success: boolean): void {
    this.pending.delete(actor); if (success) { this.unknown.delete(actor); } else { this.unknown.add(actor); }
    this.notify(actor);
  }
  verifyAbsent(actor: number): void { if (!this.pending.has(actor)) { this.unknown.delete(actor); this.notify(actor); } }
}

export class MomentPublishSnapshot {
  actorId: number = 0;
  editingId: number = 0;
  title: string = '';
  content: string = '';
  images: string[] = [];
  loading: boolean = false;
  submitting: boolean = false;
  uncertain: boolean = false;
  canConfirmAbsent: boolean = false;
  canSubmit: boolean = false;
  message: string = '';
}

export class MomentPublishController {
  private readonly api: MomentPublishApi;
  private readonly session: MomentInteractionSession;
  private readonly cache: MomentFeedCache;
  private readonly changed: (state: MomentPublishSnapshot) => void;
  private readonly published: (item: MomentSummary) => void;
  private readonly key: string = `${createMomentFeedRequestKey()}.publish`;
  private state: MomentPublishSnapshot = new MomentPublishSnapshot();
  private active: boolean = false;
  private generation: number = 0;
  private version: number = -1;
  private role: string = '';
  private mentions: string[] = [];
  private readonly attemptsChanged: () => void = () => {
    if (!this.current(this.generation, this.version) || this.state.submitting || this.state.actorId <= 0) { return; }
    this.state.uncertain = this.hasUnconfirmed();
    this.state.message = this.state.uncertain ? this.unknownMessage() : '';
    this.emit();
  };
  constructor(api: MomentPublishApi, session: MomentInteractionSession, cache: MomentFeedCache,
    changed: (state: MomentPublishSnapshot) => void, published: (item: MomentSummary) => void) {
    this.api = api; this.session = session; this.cache = cache; this.changed = changed; this.published = published;
  }
  getViewVersion(): number { return this.generation; }
  close(): void {
    const actor = this.state.actorId, editing = this.state.editingId;
    const pending = this.state.submitting && MomentPublishAttempts.shared.isPending(actor);
    if (editing > 0) { MomentOwnerAttempts.shared.unsubscribe(actor, editing, this.attemptsChanged); }
    else { MomentPublishAttempts.shared.unsubscribe(actor, this.attemptsChanged); }
    this.active = false; this.generation++;
    if (editing === 0 && pending && actor > 0) { MomentPublishAttempts.shared.markUnknown(actor); }
    this.api.cancelCurrentSession(`${this.key}.identity`);
    if (editing > 0) {
      this.api.cancelMomentDetail(`${this.key}.detail`); this.api.cancelMomentUpdate(editing, `${this.key}.update`);
    } else { this.api.cancelMomentCreate(`${this.key}.create`); }
    this.mentions = []; this.state = new MomentPublishSnapshot(); this.emit();
  }
  async open(editingId: number = 0): Promise<void> {
    this.close(); this.active = true; this.version = this.session.getSessionVersion();
    if (!Number.isSafeInteger(editingId) || editingId < 0) { this.state.message = '动态编号无效，请返回后重试。'; this.emit(); return; }
    this.state.editingId = editingId;
    const view = this.generation, version = this.version;
    if (!this.session.isAuthenticated()) { this.state.message = '登录后可操作自己的动态'; this.emit(); return; }
    this.state.loading = true; this.emit();
    try {
      const actor = await this.api.currentSession(`${this.key}.identity`);
      if (!this.current(view, version)) { return; }
      if (!Number.isSafeInteger(actor?.userId) || actor.userId <= 0 || !['CUSTOMER', 'PROVIDER'].includes(actor.role)) { throw ErrorMapper.parse(); }
      this.state.actorId = actor.userId; this.role = actor.role;
      if (editingId > 0) {
        const detail = await this.api.getMoment(editingId, `${this.key}.detail`);
        if (!this.current(view, version)) { return; }
        if (!MomentFeedFormatter.isValid(detail) || detail.momentId !== editingId || detail.authorId !== actor.userId ||
          detail.status !== 'PUBLISHED' || !['CUSTOMER', 'PROVIDER'].includes(detail.authorRole)) {
          this.state.actorId = 0; this.state.message = '只能编辑自己已发布的动态。'; return;
        }
        this.role = detail.authorRole;
        this.state.title = typeof detail.title === 'string' ? detail.title : '';
        this.state.content = typeof detail.content === 'string' ? detail.content : '';
        this.state.images = MomentDetailData.images(detail);
        this.mentions = detail.mentions?.slice() ?? [];
        if (this.state.images.some((source: string) => !InlineImagePolicy.accepts(source))) { throw ErrorMapper.parse(); }
        MomentOwnerAttempts.shared.subscribe(actor.userId, editingId, this.attemptsChanged);
      } else { MomentPublishAttempts.shared.subscribe(actor.userId, this.attemptsChanged); }
      this.state.uncertain = this.hasUnconfirmed();
      if (this.state.uncertain) { this.state.message = this.unknownMessage(); }
      else if (this.state.content.length > 200) { this.state.message = '原正文超过200字，请调整后保存；尚未更改服务器内容。'; }
    } catch (error) {
      if (this.current(view, version)) {
        this.state.actorId = 0; this.state.message = (error as PortraError).message || '账号或动态暂不可用，请返回后重试。';
      }
    } finally { if (this.current(view, version)) { this.state.loading = false; this.emit(); } }
  }
  updateTitle(value: string): void { if (this.editable()) { this.state.title = value.slice(0, 50); this.emit(); } }
  updateContent(value: string): void { if (this.editable()) { this.state.content = value.slice(0, 200); this.emit(); } }
  addImages(images: string[], view: number): void {
    if (view !== this.generation || !this.editable()) { return; }
    const next = this.state.images.slice();
    let total = next.reduce((sum: number, source: string) => sum + MomentPublishLimits.bytes(source), 0);
    for (const source of images) {
      if (next.length >= 9) { break; }
      if (!source.startsWith('data:image/') || !InlineImagePolicy.accepts(source)) { continue; }
      const bytes = MomentPublishLimits.bytes(source);
      if (bytes > MomentPublishLimits.maxImageBytes || total + bytes > MomentPublishLimits.maxTotalBytes) {
        this.state.message = '照片数据偏大，请重新选择更小的照片。'; continue;
      }
      total += bytes; next.push(source);
    }
    this.state.images = next; this.emit();
  }
  removeImage(index: number): void {
    if (this.editable() && Number.isSafeInteger(index) && index >= 0) {
      this.state.images = this.state.images.filter((_source: string, position: number) => position !== index); this.emit();
    }
  }
  mediaError(message: string, view: number): void { if (view === this.generation && this.editable()) { this.state.message = message; this.emit(); } }
  confirmVerifiedAbsent(): void {
    if (this.state.editingId > 0 || !this.ready() || this.state.submitting || MomentPublishAttempts.shared.isPending(this.state.actorId)) { return; }
    MomentPublishAttempts.shared.verifyAbsent(this.state.actorId); this.state.uncertain = false; this.state.message = ''; this.emit();
  }
  async submit(): Promise<void> {
    if (!this.canSubmit()) { return; }
    const view = this.generation, version = this.version, actor = this.state.actorId, role = this.role, editing = this.state.editingId;
    const payload: CreateMomentPayload = { title: this.state.title.trim(), content: this.state.content.trim(),
      imageDataList: this.state.images.slice(), mentions: this.mentions.slice() };
    this.state.submitting = true; this.state.message = '';
    const attempt = editing > 0 ? MomentOwnerAttempts.shared.begin(actor, editing) : undefined;
    if (editing > 0 && attempt === undefined) { this.state.submitting = false; this.emit(); return; }
    if (editing === 0) { MomentPublishAttempts.shared.begin(actor); }
    this.emit();
    try {
      const request = editing > 0 ? this.api.updateMoment(editing, payload, `${this.key}.update`) : this.api.createMoment(payload, `${this.key}.create`);
      this.cache.trackFavorite(request, version); const result = await request;
      if (!MomentFeedFormatter.isValid(result) || result.authorId !== actor || result.authorRole !== role ||
        (editing > 0 && result.momentId !== editing)) { throw ErrorMapper.parse(); }
      if (attempt !== undefined) { MomentOwnerAttempts.shared.finish(attempt, true); }
      else { MomentPublishAttempts.shared.finish(actor, true); }
      this.cache.clear(); if (this.current(view, version)) { this.published(result); }
    } catch (error) {
      if (attempt !== undefined) { MomentOwnerAttempts.shared.finish(attempt, false); }
      else { MomentPublishAttempts.shared.finish(actor, false); }
      this.cache.clear();
      if (this.current(view, version)) { this.state.uncertain = true; this.state.message = this.unknownMessage(); }
    } finally { if (this.current(view, version)) { this.state.submitting = false; this.emit(); } }
  }
  private hasUnconfirmed(): boolean {
    return this.state.editingId > 0 ? MomentOwnerAttempts.shared.get(this.state.actorId, this.state.editingId) !== undefined :
      MomentPublishAttempts.shared.isPending(this.state.actorId) || MomentPublishAttempts.shared.isUnknown(this.state.actorId);
  }
  private unknownMessage(): string {
    return this.state.editingId > 0 ? '保存结果未确认，请返回详情核实服务器状态，避免重复操作。' : '上次发布结果未确认，请先返回动态查看，避免重复发布。';
  }
  private ready(): boolean {
    if (!this.active) { return false; }
    if (this.version !== this.session.getSessionVersion() || !this.session.isAuthenticated()) {
      this.close(); this.state.message = '身份已变化，请返回后重新打开表单。'; this.emit(); return false;
    }
    return this.state.actorId > 0 && !this.state.loading;
  }
  private editable(): boolean { return this.ready() && !this.state.submitting && !this.state.uncertain; }
  private validInput(): boolean {
    if (this.state.title.length > 50 || this.state.content.length > 200 || this.state.images.length > 9) { return false; }
    if (this.state.editingId > 0) { return this.state.title.trim().length > 0 || this.state.content.trim().length > 0 || this.state.images.length > 0; }
    return this.state.title.trim().length > 0 && this.state.content.trim().length > 0 && this.state.images.length > 0;
  }
  private canSubmit(): boolean {
    return this.ready() && !this.state.submitting && !this.state.uncertain && !this.hasUnconfirmed() &&
      !this.cache.hasPendingFavorite(this.version) && this.validInput();
  }
  private current(view: number, version: number): boolean {
    if (!this.active || view !== this.generation) { return false; }
    if (version !== this.session.getSessionVersion() || !this.session.isAuthenticated()) {
      this.close(); this.state.message = '身份已变化，请返回后重新打开表单。'; this.emit(); return false;
    }
    return true;
  }
  private emit(): void {
    const valid = this.active && this.version === this.session.getSessionVersion() && this.session.isAuthenticated() && this.state.actorId > 0 && !this.state.loading;
    this.changed({ actorId: this.state.actorId, editingId: this.state.editingId, title: this.state.title, content: this.state.content,
      images: this.state.images.slice(), loading: this.state.loading, submitting: this.state.submitting, uncertain: this.state.uncertain, message: this.state.message,
      canConfirmAbsent: valid && this.state.editingId === 0 && this.state.uncertain && !MomentPublishAttempts.shared.isPending(this.state.actorId),
      canSubmit: valid && !this.state.submitting && !this.state.uncertain && !this.hasUnconfirmed() &&
        !this.cache.hasPendingFavorite(this.version) && this.validInput() });
  }
}
