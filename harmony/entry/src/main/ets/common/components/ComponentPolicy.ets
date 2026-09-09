/** Pure interaction and media rules shared by the temporary component shell. */
export class ActionClickGuard {
  private lastAcceptedAt: number = -1;
  private readonly cooldownMs: number;

  constructor(cooldownMs: number = 350) {
    this.cooldownMs = cooldownMs;
  }

  accept(timestampMs: number): boolean {
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
      return false;
    }
    if (this.lastAcceptedAt >= 0 && timestampMs - this.lastAcceptedAt < this.cooldownMs) {
      return false;
    }
    this.lastAcceptedAt = timestampMs;
    return true;
  }
}

export class PublicImagePolicy {
  /** String sources are deliberately limited to public HTTPS images. Local images use Resource values. */
  static accepts(source: string): boolean {
    const normalized = source.trim();
    if (!normalized.startsWith('https://') || /[\\\s#]/.test(normalized)) {
      return false;
    }

    const remainder = normalized.slice('https://'.length);
    const slashIndex = remainder.indexOf('/');
    const queryIndex = remainder.indexOf('?');
    let authorityEnd = remainder.length;
    if (slashIndex >= 0 && slashIndex < authorityEnd) {
      authorityEnd = slashIndex;
    }
    if (queryIndex >= 0 && queryIndex < authorityEnd) {
      authorityEnd = queryIndex;
    }
    const authority = remainder.slice(0, authorityEnd);
    return authority.length > 0 && !authority.includes('@');
  }
}

export class AvatarFallbackPolicy {
  static label(displayName: string): string {
    const normalized = displayName.trim();
    return normalized.length === 0 ? 'P' : normalized.slice(0, 1).toUpperCase();
  }
}
