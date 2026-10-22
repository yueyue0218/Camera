import { MomentSummary } from '../../model/ApiModels';

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
    return item !== null && Number.isSafeInteger(item.momentId) && item.momentId > 0 &&
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

/** Short-lived, session-scoped memory cache for tab re-entry. */
export class MomentFeedCache {
  static readonly shared: MomentFeedCache = new MomentFeedCache();
  private readonly ttlMs: number;
  private records: MomentSummary[] = [];
  private loadedAtMs: number = -1;
  private sessionVersion: number = -1;

  constructor(ttlMs: number = 60000) {
    this.ttlMs = ttlMs;
  }

  read(nowMs: number, sessionVersion: number): MomentSummary[] | undefined {
    if (!Number.isFinite(nowMs) || nowMs < 0 || sessionVersion !== this.sessionVersion ||
      this.loadedAtMs < 0 || nowMs - this.loadedAtMs > this.ttlMs) {
      return undefined;
    }
    return this.records.slice();
  }

  write(items: MomentSummary[], nowMs: number, sessionVersion: number): void {
    this.records = items.slice();
    this.loadedAtMs = nowMs;
    this.sessionVersion = sessionVersion;
  }

  clear(): void {
    this.records = [];
    this.loadedAtMs = -1;
    this.sessionVersion = -1;
  }
}
