import { MomentSummary, SessionSummary } from '../../model/ApiModels';
import { ErrorMapper, PortraError } from '../../network/ErrorMapper';
import { MomentInteractionSession } from './MomentInteractions';
import { createMomentFeedRequestKey, MomentFeedCache, MomentFeedFormatter } from './MomentFeedModels';
import { MomentOwnerAttempts } from './MomentOwnerAttempts';

export interface MomentOwnerApi {
  currentSession(key?: string): Promise<SessionSummary>;
  cancelCurrentSession(key?: string): void;
  getMoment(id: number, key?: string): Promise<MomentSummary>;
  cancelMomentDetail(key?: string): void;
  deleteMoment(id: number, key?: string): Promise<void>;
  cancelMomentDelete(id: number, key?: string): void;
}
export class MomentOwnerSnapshot {
  actorId: number = 0;
  targetId: number = 0;
  canManage: boolean = false;
  canWrite: boolean = false;
  confirmation: boolean = false;
  deleting: boolean = false;
  verifying: boolean = false;
  uncertain: boolean = false;
  canVerify: boolean = false;
  message: string = '';
}
export class MomentOwnerActions {
  private readonly api: MomentOwnerApi;
  private readonly session: MomentInteractionSession;
  private readonly cache: MomentFeedCache;
  private readonly changed: (value: MomentOwnerSnapshot) => void;
  private readonly deleted: (id: number) => void;
  private readonly reconciled: (item: MomentSummary) => void;
  private state: MomentOwnerSnapshot = new MomentOwnerSnapshot();
  private active: boolean = false;
  private generation: number = 0;
  private version: number = -1;
  private readonly key: string = `${createMomentFeedRequestKey()}.owner`;
  private readonly attemptsChanged: () => void = () => { if (this.current(this.generation, this.version)) { this.emit(); } };
  constructor(api: MomentOwnerApi, session: MomentInteractionSession, cache: MomentFeedCache,
    changed: (value: MomentOwnerSnapshot) => void, deleted: (id: number) => void, reconciled: (item: MomentSummary) => void) {
    this.api = api; this.session = session; this.cache = cache; this.changed = changed; this.deleted = deleted; this.reconciled = reconciled;
  }
  close(): void {
    MomentOwnerAttempts.shared.unsubscribe(this.state.actorId, this.state.targetId, this.attemptsChanged);
    this.active = false; this.generation++;
    this.api.cancelCurrentSession(`${this.key}.identity`); this.api.cancelMomentDetail(`${this.key}.verify`);
    if (this.state.targetId > 0) { this.api.cancelMomentDelete(this.state.targetId, `${this.key}.delete`); }
    this.state = new MomentOwnerSnapshot(); this.emit();
  }
  async open(item: MomentSummary): Promise<void> {
    this.close();
    if (!this.session.isAuthenticated() || !MomentFeedFormatter.isValid(item) || item.status !== 'PUBLISHED') { return; }
    this.active = true; this.version = this.session.getSessionVersion();
    const view = this.generation, version = this.version;
    this.state.targetId = item.momentId;
    try {
      const actor = await this.api.currentSession(`${this.key}.identity`);
      if (!this.current(view, version)) { return; }
      if (!Number.isSafeInteger(actor?.userId) || actor.userId <= 0) { throw ErrorMapper.parse(); }
      if (actor.userId !== item.authorId) { return; }
      this.state.actorId = actor.userId; this.state.canManage = true;
      MomentOwnerAttempts.shared.subscribe(actor.userId, item.momentId, this.attemptsChanged);
    } catch (error) {
      if (this.current(view, version)) { this.state.message = '暂时无法确认动态管理权限，请重新读取。'; }
    } finally { if (this.current(view, version)) { this.emit(); } }
  }
  beginEdit(): boolean { return this.canWrite() && !this.state.confirmation; }
  requestDelete(): void { if (this.canWrite()) { this.state.confirmation = true; this.emit(); } }
  cancelDelete(): void { this.state.confirmation = false; this.emit(); }
  async deleteConfirmed(): Promise<void> {
    if (!this.state.confirmation || !this.canWrite()) { return; }
    const actor = this.state.actorId, id = this.state.targetId, view = this.generation, version = this.version;
    const attempt = MomentOwnerAttempts.shared.begin(actor, id);
    if (attempt === undefined) { return; }
    this.state.confirmation = false; this.state.deleting = true; this.state.message = ''; this.emit();
    try {
      const operation = this.api.deleteMoment(id, `${this.key}.delete`);
      this.cache.trackFavorite(operation, version); await operation;
      MomentOwnerAttempts.shared.finish(attempt, true); this.cache.clear();
      if (this.current(view, version)) { this.deleted(id); }
    } catch (error) {
      MomentOwnerAttempts.shared.finish(attempt, false); this.cache.clear();
      if (this.current(view, version)) { this.state.message = '删除结果未确认，请核实服务器状态后再操作。'; }
    } finally { if (this.current(view, version)) { this.state.deleting = false; this.emit(); } }
  }
  async verify(): Promise<void> {
    const record = MomentOwnerAttempts.shared.get(this.state.actorId, this.state.targetId);
    if (!this.ready() || record === undefined || record.pending || this.state.deleting || this.state.verifying) { return; }
    const actor = this.state.actorId, id = this.state.targetId, view = this.generation, version = this.version;
    this.state.verifying = true; this.emit();
    try {
      const item = await this.api.getMoment(id, `${this.key}.verify`);
      if (!this.current(view, version)) { return; }
      if (!MomentFeedFormatter.isValid(item) || item.momentId !== id || item.authorId !== actor) { throw ErrorMapper.parse(); }
      if (item.status === 'DELETED') {
        MomentOwnerAttempts.shared.verified(actor, id); this.cache.clear(); this.deleted(id); return;
      }
      MomentOwnerAttempts.shared.verified(actor, id); this.cache.clear();
      this.state.message = '已读取服务器最新状态，请核对后再操作。'; this.reconciled(item);
    } catch (error) {
      if (!this.current(view, version)) { return; }
      const mapped = error as PortraError;
      if (mapped.httpStatus === 404 || mapped.businessCode === 40401) {
        MomentOwnerAttempts.shared.verified(actor, id); this.cache.clear(); this.deleted(id);
      } else { this.state.message = '状态核实失败，请稍后重新核实；不会自动重发。'; }
    } finally { if (this.current(view, version)) { this.state.verifying = false; this.emit(); } }
  }
  private ready(): boolean { return this.current(this.generation, this.version) && this.state.canManage; }
  private canWrite(): boolean {
    return this.ready() && !this.state.deleting && !this.state.verifying && !this.cache.hasPendingFavorite(this.version) &&
      MomentOwnerAttempts.shared.get(this.state.actorId, this.state.targetId) === undefined;
  }
  private current(view: number, version: number): boolean {
    if (!this.active || view !== this.generation) { return false; }
    if (version !== this.session.getSessionVersion() || !this.session.isAuthenticated()) { this.close(); return false; }
    return true;
  }
  private emit(): void {
    const record = MomentOwnerAttempts.shared.get(this.state.actorId, this.state.targetId);
    this.changed({ actorId: this.state.actorId, targetId: this.state.targetId, canManage: this.state.canManage,
      canWrite: this.active && this.state.canManage && !this.state.deleting && !this.state.verifying &&
        record === undefined && !this.cache.hasPendingFavorite(this.version),
      confirmation: this.state.confirmation, deleting: this.state.deleting, verifying: this.state.verifying,
      uncertain: record !== undefined, canVerify: record !== undefined && !record.pending && !this.state.deleting && !this.state.verifying,
      message: record !== undefined && this.state.message.length === 0 ? '操作结果未确认，请先核实服务器状态。' : this.state.message });
  }
}
