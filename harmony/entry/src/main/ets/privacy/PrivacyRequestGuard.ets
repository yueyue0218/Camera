import { ErrorMapper } from '../network/ErrorMapper';

export interface ConsentEvidence {
  current: boolean;
  acceptedAtEpochMs: number;
  crossBorderConsentVersion: string;
  installationId: string;
}

/** Injected into the one production HTTP client, including uploads and refresh retries. */
export class PrivacyRequestGuard {
  private suspended: boolean = false;
  private accountChecked: boolean = false;
  private readonly listeners: Set<() => void> = new Set<() => void>();
  private readonly evidence: () => ConsentEvidence;
  private readonly onViolation?: () => void;
  constructor(evidence: () => ConsentEvidence, onViolation?: () => void) {
    this.evidence = evidence; this.onViolation = onViolation;
  }

  observe(listener: () => void): void { this.listeners.add(listener); }
  unobserve(listener: () => void): void { this.listeners.delete(listener); }
  private changed(): void { this.listeners.forEach((listener: () => void) => listener()); }
  suspend(): void { this.suspended = true; this.changed(); }
  violate(): void { this.suspend(); this.onViolation?.(); }
  verified(): void { this.accountChecked = true; this.suspended = false; this.changed(); }
  identityChanged(): void { this.accountChecked = false; this.changed(); }
  allowed(authenticated: boolean = false): boolean {
    return this.evidence().current && !this.suspended && (!authenticated || this.accountChecked);
  }
  static necessary(path: string): boolean {
    return /^\/privacy\/(consent|rights|account-closure(?:\/code)?)(?:\?|$)/.test(path) ||
      path === '/auth/native/refresh' || path === '/auth/native/logout';
  }
  assertRequest(path: string, hasIdentity: boolean): void {
    if (!PrivacyRequestGuard.necessary(path) && !this.allowed(hasIdentity)) {
      throw ErrorMapper.config('请先完成中国香港个人信息出境授权；仍可查看协议和提交个人信息权利申请。');
    }
  }
  headers(): Record<string, string> {
    const value = this.evidence();
    const headers: Record<string, string> = { 'X-Portra-Consent-Version': value.crossBorderConsentVersion };
    if (value.current) {
      headers['X-Portra-Consent-Accepted-At'] = String(value.acceptedAtEpochMs);
      headers['X-Portra-Installation-Id'] = value.installationId;
    }
    return headers;
  }
}
