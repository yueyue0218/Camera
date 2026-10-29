import { MomentSummary } from '../../model/ApiModels';

let nextFeedInstanceId: number = 0;

export function createMomentFeedRequestKey(): string {
  nextFeedInstanceId++;
  return `moments.c.feed.${nextFeedInstanceId}`;
}

export class MomentFeedFormatter {
  static title(item: MomentSummary): string {
    return MomentFeedFormatter.nonEmpty(item.title, '未填写标题');
  }

  static content(item: MomentSummary): string {
    return MomentFeedFormatter.nonEmpty(item.content, '未填写正文');
  }

  static author(item: MomentSummary): string {
    const role = item.authorRole === 'PROVIDER' ? '摄影师' : '约拍用户';
    return `${role} #${item.authorId}`;
  }

  static time(value: string | undefined): string {
    const normalized = value?.trim() ?? '';
    if (normalized.length === 0) {
      return '时间未知';
    }
    return normalized.replace('T', ' ').slice(0, 16);
  }

  static images(item: MomentSummary): string[] {
    const source = item.imageDataList !== undefined && item.imageDataList.length > 0
      ? item.imageDataList
      : item.imageData === undefined ? [] : [item.imageData];
    const seen = new Set<string>();
    const result: string[] = [];
    source.forEach((value: string) => {
      const normalized = value.trim();
      if (normalized.length > 0 && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    });
    return result;
  }

  static mentions(item: MomentSummary): string {
    if (item.mentions === undefined) {
      return '';
    }
    return item.mentions
      .map((value: string) => value.trim().replace(/^@+/, ''))
      .filter((value: string) => value.length > 0)
      .map((value: string) => `@${value}`)
      .join('  ');
  }

  static isValid(item: MomentSummary): boolean {
    return item !== null && item !== undefined && Number.isSafeInteger(item.momentId) && item.momentId > 0 &&
      Number.isSafeInteger(item.authorId) && item.authorId > 0 && typeof item.authorRole === 'string' &&
      Number.isSafeInteger(item.likeCount) && item.likeCount >= 0 &&
      Number.isSafeInteger(item.favoriteCount) && item.favoriteCount >= 0 &&
      typeof item.likedByCurrentUser === 'boolean' && typeof item.favoritedByCurrentUser === 'boolean';
  }

  static deduplicate(items: MomentSummary[]): MomentSummary[] {
    const seen = new Set<number>();
    const result: MomentSummary[] = [];
    items.forEach((item: MomentSummary) => {
      if (!seen.has(item.momentId)) {
        seen.add(item.momentId);
        result.push(item);
      }
    });
    return result;
  }

  private static nonEmpty(value: string | undefined, fallback: string): string {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : fallback;
  }
}

class MomentFeedCacheEntry {
  records: MomentSummary[];
  loadedAtMs: number;
  sessionVersion: number;

  constructor(items: MomentSummary[], nowMs: number, sessionVersion: number) {
    this.records = items.slice();
    this.loadedAtMs = nowMs;
    this.sessionVersion = sessionVersion;
  }
}

/** Short-lived snapshots, isolated by scope and authentication session. */
export class MomentFeedCache {
  static readonly shared: MomentFeedCache = new MomentFeedCache();
  private readonly ttlMs: number;
  private entries: Map<string, MomentFeedCacheEntry> = new Map<string, MomentFeedCacheEntry>();
  private pendingFavorites: Map<number, Promise<void>> = new Map<number, Promise<void>>();
  private uncertainFavorites: Map<number, Set<number>> = new Map<number, Set<number>>();
  private uncertainLikes: Map<number, Set<number>> = new Map<number, Set<number>>();
  private writeRevisions: Map<number, number> = new Map<number, number>();

  constructor(ttlMs: number = 60000) {
    this.ttlMs = ttlMs;
  }

  read(nowMs: number, sessionVersion: number, scope: string = 'latest'): MomentSummary[] | undefined {
    const entry = this.entries.get(scope);
    if (this.hasPendingFavorite(sessionVersion) || entry === undefined || !Number.isFinite(nowMs) || nowMs < entry.loadedAtMs ||
      sessionVersion !== entry.sessionVersion || nowMs - entry.loadedAtMs > this.ttlMs) {
      return undefined;
    }
    return entry.records.slice();
  }

  write(items: MomentSummary[], nowMs: number, sessionVersion: number, scope: string = 'latest'): void {
    this.entries.set(scope, new MomentFeedCacheEntry(items, nowMs, sessionVersion));
  }

  hasPendingFavorite(sessionVersion: number): boolean {
    return this.pendingFavorites.has(sessionVersion);
  }

  getWriteRevision(sessionVersion: number): number {
    return this.writeRevisions.get(sessionVersion) ?? 0;
  }

  hasUncertainLike(sessionVersion: number, momentId: number): boolean {
    return this.uncertainLikes.get(sessionVersion)?.has(momentId) ?? false;
  }

  markUncertainLike(sessionVersion: number, momentId: number): void {
    const ids = this.uncertainLikes.get(sessionVersion) ?? new Set<number>();
    ids.add(momentId);
    this.uncertainLikes.set(sessionVersion, ids);
  }

  clearUncertainLike(sessionVersion: number, momentId: number): void {
    const ids = this.uncertainLikes.get(sessionVersion);
    ids?.delete(momentId);
    if (ids?.size === 0) {
      this.uncertainLikes.delete(sessionVersion);
    }
  }

  hasUncertainFavorite(sessionVersion: number, momentId: number): boolean {
    return this.uncertainFavorites.get(sessionVersion)?.has(momentId) ?? false;
  }
  markUncertainFavorite(sessionVersion: number, momentId: number): void {
    const ids = this.uncertainFavorites.get(sessionVersion) ?? new Set<number>();
    ids.add(momentId); this.uncertainFavorites.set(sessionVersion, ids);
  }
  clearUncertainFavorite(sessionVersion: number, momentId: number): void {
    const ids = this.uncertainFavorites.get(sessionVersion); ids?.delete(momentId);
    if (ids?.size === 0) { this.uncertainFavorites.delete(sessionVersion); }
  }

  waitForFavorite(sessionVersion: number): Promise<void> {
    return this.pendingFavorites.get(sessionVersion) ?? Promise.resolve();
  }

  /** A destroyed view must not discard a write that is still running on the server. */
  trackFavorite<T>(request: Promise<T>, sessionVersion: number): void {
    this.writeRevisions.set(sessionVersion, this.getWriteRevision(sessionVersion) + 1);
    const pending = request.then(() => this.finishFavorite(sessionVersion),
      () => this.finishFavorite(sessionVersion));
    this.pendingFavorites.set(sessionVersion, pending);
  }

  private finishFavorite(sessionVersion: number): void {
    this.entries.forEach((entry: MomentFeedCacheEntry, scope: string) => {
      if (entry.sessionVersion === sessionVersion) {
        this.entries.delete(scope);
      }
    });
    this.pendingFavorites.delete(sessionVersion);
  }

  clear(): void {
    this.entries.clear();
  }
}
