/** Home notification badge: authoritative server count, never inferred from list length. */
export interface HallUnreadApi {
  unreadNotificationCount(requestKey: string): Promise<number>;
  cancelNotificationRequests(requestKeys: string[]): void;
}

export interface HallUnreadSession {
  getSessionVersion(): number;
  isAuthenticated(): boolean;
}

let nextHallUnreadInstance: number = 0;

export class HallUnreadCounter {
  private readonly key: string = `hall.notifications.unread.${++nextHallUnreadInstance}`;
  private readonly api: HallUnreadApi;
  private readonly session: HallUnreadSession;
  private readonly changed: (count: number, arrivalEpoch: number) => void;
  private timer: number = -1;
  private running: boolean = false;
  private inFlight: boolean = false;
  private generation: number = 0;
  private sessionVersion: number = -1;
  private hasBaseline: boolean = false;
  private unread: number = 0;
  private arrivalEpoch: number = 0;

  constructor(api: HallUnreadApi, session: HallUnreadSession,
    changed: (count: number, arrivalEpoch: number) => void) {
    this.api = api;
    this.session = session;
    this.changed = changed;
  }

  start(): void {
    if (this.running) { return; }
    this.running = true;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 15000);
  }

  stop(): void {
    if (!this.running) { return; }
    this.running = false;
    this.generation++;
    this.inFlight = false;
    this.hasBaseline = false;
    this.unread = 0;
    if (this.timer >= 0) { clearInterval(this.timer); this.timer = -1; }
    this.api.cancelNotificationRequests([this.key]);
    this.changed(0, this.arrivalEpoch);
  }

  async refresh(): Promise<void> {
    if (!this.running) { return; }
    const sessionVersion = this.session.getSessionVersion();
    if (this.sessionVersion !== sessionVersion) {
      this.sessionVersion = sessionVersion;
      this.generation++;
      this.inFlight = false;
      this.hasBaseline = false;
      this.unread = 0;
      this.api.cancelNotificationRequests([this.key]);
      this.changed(0, this.arrivalEpoch);
    }
    if (!this.session.isAuthenticated()) {
      if (this.hasBaseline || this.unread !== 0) {
        this.generation++;
        this.inFlight = false;
        this.hasBaseline = false;
        this.unread = 0;
        this.api.cancelNotificationRequests([this.key]);
        this.changed(0, this.arrivalEpoch);
      }
      return;
    }
    if (this.inFlight) { return; }
    this.inFlight = true;
    const generation = this.generation;
    try {
      const count = await this.api.unreadNotificationCount(this.key);
      if (!this.running || generation !== this.generation ||
        sessionVersion !== this.session.getSessionVersion() || !this.session.isAuthenticated()) { return; }
      if (!Number.isSafeInteger(count) || count < 0) { return; }
      if (this.hasBaseline && count > this.unread) { this.arrivalEpoch++; }
      this.unread = count;
      this.hasBaseline = true;
      this.changed(this.unread, this.arrivalEpoch);
    } catch (_) {
      // Keep the last confirmed count on transient network errors.
      if (this.running && generation === this.generation && !this.session.isAuthenticated()) {
        this.generation++;
        this.hasBaseline = false;
        this.unread = 0;
        this.changed(0, this.arrivalEpoch);
      }
    } finally {
      if (generation === this.generation) { this.inFlight = false; }
    }
  }
}
