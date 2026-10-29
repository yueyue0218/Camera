import { DemandListQuery, DemandSummary, PageResult, ServicePackageListQuery, ServicePackageSummary, SessionSummary } from '../../model/ApiModels';
import { HallDataPolicy } from '../hall/HallDataPolicy';
import { NotificationSession } from '../notifications/NotificationController';
import { ErrorMapper, PortraError } from '../../network/ErrorMapper';

export interface HallSearchApi {
  currentSession(key: string): Promise<SessionSummary>;
  cancelCurrentSession(key: string): void;
  listServicePackagesByQuery(query: ServicePackageListQuery, key: string): Promise<PageResult<ServicePackageSummary>>;
  listDemandsByQuery(query: DemandListQuery, key: string): Promise<PageResult<DemandSummary>>;
  cancelServicePackages(key: string): void;
  cancelDemands(key: string): void;
}
export class HallSearchSnapshot {
  keyword: string = '';
  role: string = '';
  userId: number = 0;
  services: ServicePackageSummary[] = [];
  demands: DemandSummary[] = [];
  loading: boolean = false;
  loadingIdentity: boolean = false;
  loginRequired: boolean = false;
  searched: boolean = false;
  error: string = '';
  total: number = 0;
  page: number = 0;
  hasMore: boolean = false;
}
let searchInstance: number = 0;
export class HallSearchController {
  private state: HallSearchSnapshot = new HallSearchSnapshot();
  private readonly api: HallSearchApi;
  private readonly session: NotificationSession;
  private readonly onChange: (state: HallSearchSnapshot) => void;
  private readonly instanceKey: string = 'c.hallSearch.' + (++searchInstance);
  private active: boolean = true;
  private generation: number = 0;
  private accountVersion: number;
  private requestKey: string = '';
  private identityKey: string = '';
  private requestKind: string = '';
  private resumePromise?: Promise<void>;

  constructor(api: HallSearchApi, onChange: (state: HallSearchSnapshot) => void, session: NotificationSession) {
    this.api = api; this.onChange = onChange; this.session = session;
    this.accountVersion = session.getSessionVersion(); this.emit();
  }
  private emit(): void {
    const value = new HallSearchSnapshot();
    value.keyword = this.state.keyword; value.role = this.state.role; value.userId = this.state.userId;
    value.services = this.state.services.slice(); value.demands = this.state.demands.slice();
    value.loading = this.state.loading; value.loadingIdentity = this.state.loadingIdentity;
    value.loginRequired = this.state.loginRequired; value.searched = this.state.searched; value.error = this.state.error;
    value.total = this.state.total; value.page = this.state.page; value.hasMore = this.state.hasMore;
    this.onChange(value);
  }
  private invalidate(): void {
    this.generation++;
    if (this.requestKey.length > 0) {
      if (this.requestKind === 'services') { this.api.cancelServicePackages(this.requestKey); }
      else { this.api.cancelDemands(this.requestKey); }
    }
    if (this.identityKey.length > 0) { this.api.cancelCurrentSession(this.identityKey); }
    this.requestKey = ''; this.identityKey = ''; this.state.loading = false; this.state.loadingIdentity = false;
  }
  private clearResults(): void {
    this.state.services = []; this.state.demands = []; this.state.page = 0;
    this.state.total = 0; this.state.hasMore = false; this.state.error = ''; this.state.searched = false;
  }
  private identityCurrent(): boolean {
    if (this.accountVersion === this.session.getSessionVersion()) { return true; }
    this.invalidate(); this.state = new HallSearchSnapshot(); this.accountVersion = this.session.getSessionVersion();
    this.state.loginRequired = !this.session.isAuthenticated();
    this.state.error = this.state.loginRequired ? '' : '登录身份已变化，请关闭并重新搜索。'; this.emit(); return false;
  }
  private current(version: number, account: number): boolean {
    if (!this.active || version !== this.generation) { return false; }
    if (account !== this.session.getSessionVersion()) { this.identityCurrent(); return false; }
    return true;
  }
  setKeyword(value: string): void {
    if (!this.active || !this.identityCurrent() || value === this.state.keyword) { return; }
    this.invalidate(); this.clearResults(); this.state.keyword = value.slice(0, 100); this.emit();
  }
  async resume(): Promise<void> {
    if (this.resumePromise !== undefined) { return this.resumePromise; }
    this.active = true; this.invalidate(); this.accountVersion = this.session.getSessionVersion();
    this.state = new HallSearchSnapshot();
    if (!this.session.isAuthenticated()) { this.state.loginRequired = true; this.emit(); return; }
    const version = this.generation, account = this.accountVersion;
    this.state.loadingIdentity = true; this.emit();
    const reading = this.initializeIdentity(version, account); this.resumePromise = reading;
    await reading; if (this.resumePromise === reading) { this.resumePromise = undefined; }
  }
  private async initializeIdentity(version: number, account: number): Promise<void> {
    try { await this.readIdentity(version, account); }
    catch (error) { if (this.current(version, account)) { this.identityError(error as PortraError); } }
    finally { if (this.current(version, account)) { this.state.loadingIdentity = false; this.emit(); } }
  }
  private identityError(error: PortraError): void {
    this.clearResults(); this.state.role = ''; this.state.userId = 0;
    this.state.loginRequired = !this.session.isAuthenticated() || error.httpStatus === 401;
    this.state.error = this.state.loginRequired ? '' : (error.message || '暂时无法核对当前身份，请重试。');
  }
  private async readIdentity(version: number, account: number): Promise<boolean> {
    this.identityKey = this.instanceKey + '.session.' + version;
    const identity = await this.api.currentSession(this.identityKey);
    if (!this.current(version, account)) { return false; }
    const role = typeof identity?.role === 'string' ? identity.role.trim().toUpperCase() : '';
    if (!Number.isSafeInteger(identity?.userId) || identity.userId <= 0 || !['CUSTOMER', 'PROVIDER'].includes(role)) {
      throw new Error('当前身份暂不支持搜索，请核对登录身份。');
    }
    const changed = this.state.role.length > 0 && (this.state.role !== role || this.state.userId !== identity.userId);
    if (changed) { this.clearResults(); this.state.keyword = ''; }
    this.state.role = role; this.state.userId = identity.userId; this.state.loginRequired = false;
    if (changed) { this.state.error = '身份已变化，请重新输入关键词。'; return false; }
    return true;
  }
  async search(): Promise<void> {
    if (!this.active || !this.identityCurrent() || this.state.loading || this.state.loadingIdentity) { return; }
    if (!this.session.isAuthenticated()) { this.invalidate(); this.state = new HallSearchSnapshot(); this.state.loginRequired = true; this.emit(); return; }
    this.state.keyword = this.state.keyword.trim();
    if (this.state.keyword.length === 0) { this.invalidate(); this.clearResults(); this.emit(); return; }
    await this.load(1, false);
  }
  async loadMore(): Promise<void> {
    if (!this.active || !this.identityCurrent() || this.state.loading || !this.state.hasMore) { return; }
    await this.load(this.state.page + 1, true);
  }
  private async load(page: number, append: boolean): Promise<void> {
    this.invalidate(); const version = this.generation, account = this.accountVersion, keyword = this.state.keyword;
    if (!append) { this.clearResults(); }
    this.state.searched = true; this.state.loading = true; this.state.loadingIdentity = true; this.state.error = ''; this.emit();
    let identityRead = false;
    try {
      if (!await this.readIdentity(version, account)) { return; }
      identityRead = true; this.state.loadingIdentity = false;
      const kind = this.state.role === 'PROVIDER' ? 'demands' : 'services';
      this.requestKind = kind; this.requestKey = this.instanceKey + '.' + kind + '.' + version + '.' + page; this.emit();
      if (kind === 'services') {
        const query: ServicePackageListQuery = { page: page, size: 20, keyword: keyword, sort: 'latest' };
        const result = await this.api.listServicePackagesByQuery(query, this.requestKey);
        if (!this.current(version, account)) { return; }
        if (!HallDataPolicy.validPage(result) || result.page !== page) { throw ErrorMapper.parse(); }
        this.state.services = HallDataPolicy.mergeServices(append ? this.state.services : [], result.records);
        this.state.page = result.page; this.state.total = result.total;
        this.state.hasMore = HallDataPolicy.hasMore(this.state.services.length, result.total);
      } else {
        const query: DemandListQuery = { page: page, size: 20, keyword: keyword, sort: 'latest', status: 'OPEN' };
        const result = await this.api.listDemandsByQuery(query, this.requestKey);
        if (!this.current(version, account)) { return; }
        if (!HallDataPolicy.validPage(result) || result.page !== page) { throw ErrorMapper.parse(); }
        this.state.demands = HallDataPolicy.mergeDemands(append ? this.state.demands : [], result.records);
        this.state.page = result.page; this.state.total = result.total;
        this.state.hasMore = HallDataPolicy.hasMore(this.state.demands.length, result.total);
      }
    } catch (error) {
      if (this.current(version, account)) {
        if (!identityRead) { this.identityError(error as PortraError); }
        else { this.state.error = (error as PortraError).message || '搜索失败，请重试。'; }
      }
    } finally {
      if (this.current(version, account)) { this.state.loading = false; this.state.loadingIdentity = false; this.requestKey = ''; this.identityKey = ''; this.emit(); }
    }
  }
  canOpen(kind: string, id: number): boolean {
    if (!this.active || !this.identityCurrent() || this.state.loading || this.state.loadingIdentity || !this.session.isAuthenticated()) { return false; }
    return kind === 'services' ? this.state.role === 'CUSTOMER' && this.state.services.some((s: ServicePackageSummary) => s.serviceId === id) :
      kind === 'demands' && this.state.role === 'PROVIDER' && this.state.demands.some((d: DemandSummary) => d.demandId === id);
  }
  suspend(): void { this.invalidate(); this.active = false; this.resumePromise = undefined; this.state = new HallSearchSnapshot(); this.emit(); }
  close(): void { this.suspend(); }
}
