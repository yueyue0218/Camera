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
  private readonly attemptsChanged: () => void = () => {
    if (!this.current(this.generation, this.version) || this.state.submitting || this.state.actorId <= 0) { return; }
    const attempts = MomentPublishAttempts.shared;
    this.state.uncertain = attempts.isPending(this.state.actorId) || attempts.isUnknown(this.state.actorId);
    this.state.message = this.state.uncertain ? '上次发布结果未确认，请先返回动态查看，避免重复发布。' : '';
    this.emit();
  };

  constructor(api: MomentPublishApi, session: MomentInteractionSession, cache: MomentFeedCache,
    changed: (state: MomentPublishSnapshot) => void, published: (item: MomentSummary) => void) {
    this.api = api; this.session = session; this.cache = cache; this.changed = changed; this.published = published;
  }
  getViewVersion(): number { return this.generation; }
  close(): void {
    const actor = this.state.actorId;
    const pending = this.state.submitting && MomentPublishAttempts.shared.isPending(actor);
    MomentPublishAttempts.shared.unsubscribe(actor, this.attemptsChanged);
    this.active = false; this.generation++;
    if (pending && actor > 0) { MomentPublishAttempts.shared.markUnknown(actor); }
    this.api.cancelCurrentSession(`${this.key}.identity`); this.api.cancelMomentCreate(`${this.key}.create`);
    this.state = new MomentPublishSnapshot(); this.emit();
  }
  async open(): Promise<void> {
    this.close(); this.active = true; this.version = this.session.getSessionVersion();
    const view = this.generation, version = this.version;
    if (!this.session.isAuthenticated()) { this.state.message = '登录后可发布动态'; this.emit(); return; }
    this.state.loading = true; this.emit();
    try {
      const actor = await this.api.currentSession(`${this.key}.identity`);
      if (!this.current(view, version)) { return; }
      if (!Number.isSafeInteger(actor?.userId) || actor.userId <= 0 || !['CUSTOMER', 'PROVIDER'].includes(actor.role)) { throw ErrorMapper.parse(); }
      this.state.actorId = actor.userId; this.role = actor.role;
      MomentPublishAttempts.shared.subscribe(actor.userId, this.attemptsChanged);
      this.state.uncertain = MomentPublishAttempts.shared.isUnknown(actor.userId) || MomentPublishAttempts.shared.isPending(actor.userId);
      if (this.state.uncertain) { this.state.message = '上次发布结果未确认，请先返回动态查看，避免重复发布。'; }
    } catch (error) {
      if (this.current(view, version)) { this.state.message = (error as PortraError).message || '账号暂不可用，请返回后重试。'; }
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
  mediaError(message: string, view: number): void {
    if (view === this.generation && this.editable()) { this.state.message = message; this.emit(); }
  }
  confirmVerifiedAbsent(): void {
    if (!this.ready() || this.state.submitting || MomentPublishAttempts.shared.isPending(this.state.actorId)) { return; }
    MomentPublishAttempts.shared.verifyAbsent(this.state.actorId); this.state.uncertain = false; this.state.message = ''; this.emit();
  }
  async submit(): Promise<void> {
    if (!this.canSubmit()) { return; }
    const view = this.generation, version = this.version, actor = this.state.actorId, role = this.role;
    const payload: CreateMomentPayload = { title: this.state.title.trim(), content: this.state.content.trim(),
      imageDataList: this.state.images.slice(), mentions: [] };
    this.state.submitting = true; this.state.message = ''; MomentPublishAttempts.shared.begin(actor); this.emit();
    try {
      const request = this.api.createMoment(payload, `${this.key}.create`);
      this.cache.trackFavorite(request, version);
      const result = await request;
      if (!MomentFeedFormatter.isValid(result) || result.authorId !== actor || result.authorRole !== role) { throw ErrorMapper.parse(); }
      MomentPublishAttempts.shared.finish(actor, true); this.cache.clear();
      if (this.current(view, version)) { this.published(result); }
    } catch (error) {
      MomentPublishAttempts.shared.finish(actor, false); this.cache.clear();
      if (this.current(view, version)) {
        this.state.uncertain = true; this.state.message = '发布结果未确认，请先返回动态查看，避免重复发布。';
      }
    } finally { if (this.current(view, version)) { this.state.submitting = false; this.emit(); } }
  }
  private ready(): boolean {
    if (!this.active) { return false; }
    if (this.version !== this.session.getSessionVersion() || !this.session.isAuthenticated()) {
      this.close(); this.state.message = '身份已变化，请返回后重新打开发布页。'; this.emit(); return false;
    }
    return this.state.actorId > 0 && !this.state.loading;
  }
  private editable(): boolean { return this.ready() && !this.state.submitting && !this.state.uncertain; }
  private canSubmit(): boolean {
    return this.ready() && !this.state.submitting && !this.state.uncertain &&
      !MomentPublishAttempts.shared.isPending(this.state.actorId) && !MomentPublishAttempts.shared.isUnknown(this.state.actorId) &&
      !this.cache.hasPendingFavorite(this.version) && this.state.title.trim().length > 0 && this.state.content.trim().length > 0 &&
      this.state.images.length > 0 && this.state.images.length <= 9;
  }
  private current(view: number, version: number): boolean {
    if (!this.active || view !== this.generation) { return false; }
    if (version !== this.session.getSessionVersion() || !this.session.isAuthenticated()) {
      this.close(); this.state.message = '身份已变化，请返回后重新打开发布页。'; this.emit(); return false;
    }
    return true;
  }
  private emit(): void {
    // Publishing a closed/reset state must not call ready(), which would reset recursively.
    const valid = this.active && this.version === this.session.getSessionVersion() && this.session.isAuthenticated() &&
      this.state.actorId > 0 && !this.state.loading;
    const attempts = MomentPublishAttempts.shared;
    this.changed({ actorId: this.state.actorId, title: this.state.title, content: this.state.content, images: this.state.images.slice(),
      loading: this.state.loading, submitting: this.state.submitting, uncertain: this.state.uncertain, message: this.state.message,
      canConfirmAbsent: valid && this.state.uncertain && !attempts.isPending(this.state.actorId),
      canSubmit: valid && !this.state.submitting && !this.state.uncertain && !attempts.isPending(this.state.actorId) &&
        !attempts.isUnknown(this.state.actorId) && !this.cache.hasPendingFavorite(this.version) &&
        this.state.title.trim().length > 0 && this.state.content.trim().length > 0 && this.state.images.length > 0 && this.state.images.length <= 9 });
  }
}
