export class MomentOwnerAttempt {
  readonly actor: number;
  readonly moment: number;
  pending: boolean = true;
  constructor(actor: number, moment: number) { this.actor = actor; this.moment = moment; }
}

/** A closed view cannot discard a write whose server outcome is still unknown. */
export class MomentOwnerAttempts {
  static readonly shared: MomentOwnerAttempts = new MomentOwnerAttempts();
  private records: Map<string, MomentOwnerAttempt> = new Map<string, MomentOwnerAttempt>();
  private listeners: Map<string, Set<() => void>> = new Map<string, Set<() => void>>();
  private key(actor: number, moment: number): string { return `${actor}:${moment}`; }
  get(actor: number, moment: number): MomentOwnerAttempt | undefined { return this.records.get(this.key(actor, moment)); }
  subscribe(actor: number, moment: number, listener: () => void): void {
    const key = this.key(actor, moment), listeners = this.listeners.get(key) ?? new Set<() => void>();
    listeners.add(listener); this.listeners.set(key, listeners);
  }
  unsubscribe(actor: number, moment: number, listener: () => void): void {
    const key = this.key(actor, moment), listeners = this.listeners.get(key);
    listeners?.delete(listener); if (listeners?.size === 0) { this.listeners.delete(key); }
  }
  private notify(actor: number, moment: number): void { this.listeners.get(this.key(actor, moment))?.forEach((listener: () => void) => listener()); }
  begin(actor: number, moment: number): MomentOwnerAttempt | undefined {
    if (this.get(actor, moment) !== undefined) { return undefined; }
    const record = new MomentOwnerAttempt(actor, moment); this.records.set(this.key(actor, moment), record); this.notify(actor, moment); return record;
  }
  finish(record: MomentOwnerAttempt, confirmed: boolean): void {
    if (this.get(record.actor, record.moment) !== record) { return; }
    record.pending = false;
    if (confirmed) { this.records.delete(this.key(record.actor, record.moment)); }
    this.notify(record.actor, record.moment);
  }
  verified(actor: number, moment: number): boolean {
    if (this.get(actor, moment)?.pending) { return false; }
    this.records.delete(this.key(actor, moment)); this.notify(actor, moment); return true;
  }
}
