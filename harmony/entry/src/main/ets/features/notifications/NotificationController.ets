import { NotificationSummary, PageResult, SessionSummary } from '../../model/ApiModels';

export interface NotificationApi {
  currentSession(requestKey?: string): Promise<SessionSummary>;
  cancelCurrentSession(requestKey?: string): void;
  listNotifications(page: number, size: number, key: string): Promise<PageResult<NotificationSummary>>;
  unreadNotificationCount(key: string): Promise<number>;
  markNotificationRead(id: number, key: string): Promise<NotificationSummary>;
  markAllNotificationsRead(key: string): Promise<NotificationSummary[]>;
  cancelNotificationRequests(keys: string[]): void;
}
export interface NotificationSession { getSessionVersion(): number; isAuthenticated(): boolean; }
let nextNotificationInstance: number = 0;
export class NotificationSnapshot {
  items: NotificationSummary[] = [];
  loading: boolean = false;
  loadingMore: boolean = false;
  busy: boolean = false;
  uncertain: boolean = false;
  loginRequired: boolean = false;
  error: string = '';
  unread: number = 0;
  total: number = 0;
  page: number = 0;
}
export class NotificationFormat {
  static category(item: NotificationSummary): string {
    const types = `${item.type} ${item.eventType ?? ''} ${item.relatedType ?? ''} ${item.targetType ?? ''}`.toUpperCase();
    if(item.type==='MODERATION_RESULT'||item.eventType==='MODERATION_RESULT'){return 'moderation';}
    if(item.type==='REPORT_RESOLVED'||item.eventType==='REPORT_RESOLVED'){return 'report';}
    if (types.includes('REVIEW_COMPLAINT') || types.includes('DISPUTE')) { return 'appeal'; }
    if (types.includes('ORDER_') || types.includes('DEMAND_RESPONSE_') || types.includes('CONVERSATION_STARTED') ||
      types.includes('DELIVERY_UPLOADED')) { return 'order'; }
    if (types.includes('REVIEW_')) { return 'review'; }
    if (types.includes('MOMENT') || types.includes('FOLLOWED')) { return 'dynamic'; }
    return 'other';
  }
  static label(item: NotificationSummary): string {
    const category = NotificationFormat.category(item);
    if(category==='report'){return '举报';}if(category==='moderation'){return '平台处理';}
    if(category==='appeal') {
      const type = `${item.type} ${item.eventType ?? ''} ${item.relatedType ?? ''}`.toUpperCase();
      return type.includes('REVIEW_COMPLAINT') ? '评价投诉' : '订单投诉';
    }
    return category === 'order' ? '订单' : category === 'review' ? '评价' :
      category === 'dynamic' ? '动态' : item.type.includes('CREDIT') ? '信用' : '通知';
  }
  static time(value?: string): string { return value ? value.replace('T', ' ').slice(0, 16) : '时间未知'; }
}

/** C view logic only: all transport/authentication remains in the existing shared client. */
export class NotificationController {
  private state: NotificationSnapshot = new NotificationSnapshot();
  private active: boolean = false;
  private generation: number = 0;
  private readVersion: number = 0;
  private actorId: number = 0;
  private accountVersion: number = -1;
  private readonly key: string = `notifications.c.${++nextNotificationInstance}`;
  private readonly api: NotificationApi;
  private readonly session: NotificationSession;
  private readonly changed: (state: NotificationSnapshot) => void;
  constructor(api: NotificationApi, session: NotificationSession, changed: (state: NotificationSnapshot) => void) {
    this.api = api; this.session = session; this.changed = changed;
  }

  resume(): void {
    if (this.accountVersion !== this.session.getSessionVersion()) {
      this.generation++; this.readVersion++; this.actorId = 0; this.state = new NotificationSnapshot();
      this.accountVersion = this.session.getSessionVersion();
    }
    this.active = true; this.state.loginRequired = !this.session.isAuthenticated(); this.publish();
  }
  private identityCurrent(): boolean {
    if (this.accountVersion !== this.session.getSessionVersion()) { this.suspend(); this.resume(); return false; }
    return true;
  }
  suspend(): void {
    this.active = false; this.generation++; this.readVersion++; this.actorId = 0;
    this.api.cancelNotificationRequests([`${this.key}.list`, `${this.key}.count`, `${this.key}.write`]);
    this.api.cancelCurrentSession(`${this.key}.session`);
    this.state = new NotificationSnapshot(); this.publish();
  }
  private current(epoch: number, version: number): boolean {
    if (epoch !== this.generation) { return false; }
    if (version !== this.session.getSessionVersion()) {
      this.suspend(); this.resume(); return false;
    }
    return this.active && epoch === this.generation;
  }
  private publish(): void {
    const next = new NotificationSnapshot();
    next.items = this.state.items.slice(); next.loading = this.state.loading; next.loadingMore = this.state.loadingMore;
    next.busy = this.state.busy; next.uncertain = this.state.uncertain; next.loginRequired = this.state.loginRequired;
    next.error = this.state.error; next.unread = this.state.unread; next.total = this.state.total; next.page = this.state.page;
    this.changed(next);
  }
  private valid(item: NotificationSummary): boolean {
    return item !== null && item !== undefined && Number.isSafeInteger(item.notificationId) && item.notificationId > 0 &&
      item.recipientUserId === this.actorId && typeof item.isRead === 'boolean' && typeof item.type === 'string' &&
      typeof item.title === 'string' && typeof item.content === 'string';
  }
  async load(): Promise<void> {
    if (!this.active || !this.identityCurrent() || this.state.busy) { return; }
    if (!this.session.isAuthenticated()) { this.suspend(); this.resume(); return; }
    const epoch = this.generation; const version = this.session.getSessionVersion(); const read = ++this.readVersion;
    this.state.loading = true; this.state.loadingMore = false; this.state.error = ''; this.state.items = [];
    this.publish();
    try {
      const identity = await this.api.currentSession(`${this.key}.session`);
      if (!this.current(epoch, version) || read !== this.readVersion) { return; }
      if (!Number.isSafeInteger(identity.userId) || identity.userId <= 0) { throw new Error('身份数据异常'); }
      this.actorId = identity.userId;
      const values = await Promise.all([this.api.listNotifications(0, 20, `${this.key}.list`),
        this.api.unreadNotificationCount(`${this.key}.count`)]);
      if (!this.current(epoch, version) || read !== this.readVersion) { return; }
      const page = values[0] as PageResult<NotificationSummary>; const count = values[1] as number;
      if (!Array.isArray(page.records) || page.records.some((item: NotificationSummary) => !this.valid(item)) ||
        !Number.isSafeInteger(page.total) || page.total < 0 || page.page !== 0 ||
        !Number.isSafeInteger(count) || count < 0) { throw new Error('通知数据异常'); }
      this.state.items = this.deduplicate(page.records); this.state.total = page.total; this.state.page = 0;
      this.state.unread = count; this.state.uncertain = false;
    } catch (_) {
      if (this.current(epoch, version) && read === this.readVersion) { this.state.error = '通知暂时加载失败，请稍后再试。'; }
    } finally {
      if (this.current(epoch, version) && read === this.readVersion) { this.state.loading = false; this.publish(); }
    }
  }
  private deduplicate(items: NotificationSummary[]): NotificationSummary[] {
    const result: NotificationSummary[] = [];
    items.forEach((item: NotificationSummary) => {
      if (!result.some((entry: NotificationSummary) => entry.notificationId === item.notificationId)) { result.push(item); }
    });
    return result;
  }
  async loadMore(): Promise<void> {
    if (!this.active || !this.identityCurrent() || this.state.loading || this.state.loadingMore || this.state.busy ||
      this.state.items.length >= this.state.total) { return; }
    const epoch = this.generation; const version = this.session.getSessionVersion(); const read = ++this.readVersion;
    const next = this.state.page + 1; this.state.loadingMore = true; this.publish();
    try {
      const page = await this.api.listNotifications(next, 20, `${this.key}.list`);
      if (!this.current(epoch, version) || read !== this.readVersion) { return; }
      if (!Array.isArray(page.records) || page.records.some((item: NotificationSummary) => !this.valid(item)) ||
        page.page !== next || !Number.isSafeInteger(page.total) || page.total < 0) { throw new Error('通知数据异常'); }
      this.state.items = this.deduplicate(this.state.items.concat(page.records)); this.state.page = next; this.state.total = page.total;
    } catch (_) {
      if (this.current(epoch, version) && read === this.readVersion) { this.state.error = '更多通知加载失败，请重试。'; }
    } finally {
      if (this.current(epoch, version) && read === this.readVersion) { this.state.loadingMore = false; this.publish(); }
    }
  }
  canOpenReports(): boolean {
    return this.active && this.identityCurrent() && this.session.isAuthenticated();
  }
  canOpen(id: number): boolean {
    if (!this.active || !this.identityCurrent() || !this.session.isAuthenticated() || this.state.loading || this.state.busy) { return false; }
    return this.state.items.some((item: NotificationSummary) => item.notificationId === id && item.isRead && this.valid(item));
  }
  async markRead(id: number): Promise<void> { await this.mutate(id); }
  async markAllRead(): Promise<void> { await this.mutate(0); }
  private async mutate(id: number): Promise<void> {
    if (!this.active || !this.identityCurrent() || !this.session.isAuthenticated() || this.state.busy || this.state.loading ||
      this.state.loadingMore || this.state.uncertain) { return; }
    const item = this.state.items.find((entry: NotificationSummary) => entry.notificationId === id);
    if (id !== 0 && (item === undefined || item.isRead)) { return; }
    if (id === 0 && this.state.unread === 0) { return; }
    const epoch = this.generation; const version = this.session.getSessionVersion(); this.readVersion++;
    this.state.busy = true; this.state.error = ''; this.publish();
    let refresh = false;
    try {
      if (id === 0) {
        const result = await this.api.markAllNotificationsRead(`${this.key}.write`);
        if (!this.current(epoch, version)) { return; }
        if (!Array.isArray(result) || result.some((entry: NotificationSummary) => !this.valid(entry) || !entry.isRead)) {
          throw new Error('已读数据异常');
        }
      } else {
        const result = await this.api.markNotificationRead(id, `${this.key}.write`);
        if (!this.current(epoch, version)) { return; }
        if (!this.valid(result) || result.notificationId !== id || !result.isRead) { throw new Error('已读数据异常'); }
      }
      refresh = true;
    } catch (_) {
      if (this.current(epoch, version)) {
        this.state.uncertain = true; this.state.error = '已读结果未确认，请刷新核实后再操作。';
      }
    } finally {
      if (this.current(epoch, version)) { this.state.busy = false; this.publish(); }
    }
    if (refresh && this.current(epoch, version)) { await this.load(); }
  }
}
