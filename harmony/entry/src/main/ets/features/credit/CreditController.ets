import { CreditRecordSummary, CreditSummary, SessionSummary } from '../../model/ApiModels';
import { NotificationSession } from '../notifications/NotificationController';
export interface CreditApi {
  currentSession(key?: string): Promise<SessionSummary>;
  cancelCurrentSession(key?: string): void;
  getCreditSummary(id: number, key: string): Promise<CreditSummary>;
  listCreditRecords(id: number, key: string): Promise<CreditRecordSummary[]>;
  cancelCreditRequests(keys: string[]): void;
}
export class CreditSnapshot {
  summary?: CreditSummary;
  records: CreditRecordSummary[] = [];
  loading: boolean = false;
  error: string = '';
  recordsError: string = '';
  loginRequired: boolean = false;
  userId: number = 0;
}
export class CreditFormat {
  static score(value?: number | null): string { return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '待积累'; }
  static metric(value?: number | null): string { return typeof value === 'number' && Number.isFinite(value) ? `${value}` : '暂无数据'; }
  static percent(value?: number | null): string { return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : '待积累'; }
  static level(item?: CreditSummary): string {
    if (item?.creditLevel?.trim()) { return item.creditLevel.trim(); }
    return '待积累';
  }
  static delta(item: CreditRecordSummary): number {
    if (typeof item.appliedScoreChange === 'number') { return item.appliedScoreChange; }
    const after = item.afterScore ?? item.scoreAfter;
    if (typeof item.beforeScore === 'number' && typeof after === 'number') { return after - item.beforeScore; }
    return item.scoreChange ?? 0;
  }
}
let nextCreditInstance: number = 0;
export class CreditController {
  private state: CreditSnapshot = new CreditSnapshot();
  private active: boolean = false;
  private generation: number = 0;
  private readonly key: string = `credit.c.${++nextCreditInstance}`;
  private readonly api: CreditApi;
  private readonly session: NotificationSession;
  private readonly changed: (state: CreditSnapshot) => void;
  constructor(api: CreditApi, session: NotificationSession, changed: (state: CreditSnapshot) => void) {
    this.api = api; this.session = session; this.changed = changed;
  }
  resume(): void { this.active = true; this.state.loginRequired = !this.session.isAuthenticated(); this.publish(); }
  suspend(): void {
    this.active = false; this.generation++;
    this.api.cancelCreditRequests([`${this.key}.summary`, `${this.key}.records`]);
    this.api.cancelCurrentSession(`${this.key}.session`);
    this.state = new CreditSnapshot(); this.publish();
  }
  private publish(): void {
    const next = new CreditSnapshot(); next.summary = this.state.summary; next.records = this.state.records.slice();
    next.loading = this.state.loading; next.error = this.state.error; next.recordsError = this.state.recordsError;
    next.loginRequired = this.state.loginRequired; next.userId = this.state.userId; this.changed(next);
  }
  private current(epoch: number, version: number): boolean {
    if (epoch !== this.generation) { return false; }
    if (version !== this.session.getSessionVersion()) { this.suspend(); this.resume(); return false; }
    return this.active && epoch === this.generation;
  }
  async load(): Promise<void> {
    if (!this.active || this.state.loading) { return; }
    if (!this.session.isAuthenticated()) { this.suspend(); this.resume(); return; }
    const epoch = ++this.generation; const version = this.session.getSessionVersion();
    this.state = new CreditSnapshot(); this.state.loading = true; this.publish();
    try {
      const identity = await this.api.currentSession(`${this.key}.session`);
      if (!this.current(epoch, version)) { return; }
      if (!Number.isSafeInteger(identity.userId) || identity.userId <= 0) { throw new Error('身份数据异常'); }
      this.state.userId = identity.userId;
      await Promise.all([this.readSummary(epoch, version, identity.userId), this.readRecords(epoch, version, identity.userId)]);
    } catch (_) {
      if (this.current(epoch, version)) { this.state.error = '信用页暂时打不开，请稍后再试。'; }
    } finally {
      if (this.current(epoch, version)) { this.state.loading = false; this.publish(); }
    }
  }
  private async readSummary(epoch: number, version: number, id: number): Promise<void> {
    try {
      const item = await this.api.getCreditSummary(id, `${this.key}.summary`);
      if (!this.current(epoch, version)) { return; }
      if (item === null || item.userId !== id || (item.creditScore !== null && item.creditScore !== undefined &&
        (typeof item.creditScore !== 'number' || !Number.isFinite(item.creditScore)))) {
        throw new Error('信用数据异常');
      }
      this.state.summary = item;
    } catch (_) {
      if (this.current(epoch, version)) { this.state.error = '暂时看不到信用分，请稍后重试。'; }
    }
  }
  private async readRecords(epoch: number, version: number, id: number): Promise<void> {
    try {
      const items = await this.api.listCreditRecords(id, `${this.key}.records`);
      if (!this.current(epoch, version)) { return; }
      if (!Array.isArray(items) || items.some((item: CreditRecordSummary) => item.userId !== id ||
        !Number.isSafeInteger(item.recordId) || item.recordId <= 0)) { throw new Error('信用记录异常'); }
      this.state.records = items;
    } catch (_) {
      if (this.current(epoch, version)) { this.state.recordsError = '分数变化记录暂时加载失败，请重试。'; }
    }
  }
}
