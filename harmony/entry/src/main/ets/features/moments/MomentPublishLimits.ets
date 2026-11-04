export class MomentPublishLimits {
  static readonly maxImageBytes: number = 160 * 1024;
  static readonly maxTotalBytes: number = 1536 * 1024;
  static bytes(source: string): number {
    const comma = source.indexOf(','); if (comma < 0) { return 0; }
    const padding = source.endsWith('==') ? 2 : source.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((source.length - comma - 1) * 3 / 4) - padding);
  }
}
