import { HttpClient } from '../network/HttpClient';

export interface ServerConsent {
  status: string;
  consentType: string;
  privacyPolicyVersion?: string;
  crossBorderConsentVersion?: string;
  occurredAt?: string;
  installationId?: string;
}
export interface ConsentUpdate {
  status: string;
  privacyPolicyVersion: string;
  crossBorderConsentVersion: string;
  installationId: string;
  acceptedAtEpochMs: number;
}
export interface InformationRight {
  id: number;
  type: string;
  description: string;
  status: string;
  submittedAt: string;
  responseDueAt?: string;
  resolutionNote?: string;
}
export interface InformationRightsPage {
  records: InformationRight[];
  total: number;
  page: number;
  size: number;
}
export interface RightsSubmission { type: string; description: string; idempotencyKey: string; }
export interface AccountClosureResult { status: string; closedAt: string; retainedDataNotice: string; }
interface ClosureCodePayload { phone: string; deviceId: string; }
interface AccountClosurePayload { phone: string; code: string; confirmed: boolean; }

export class PrivacyApi {
  private readonly client: HttpClient;
  constructor(client: HttpClient) { this.client = client; }
  consent(): Promise<ServerConsent> { return this.client.get<ServerConsent>('/privacy/consent', 'privacy.consent'); }
  updateConsent(body: ConsentUpdate): Promise<ServerConsent> {
    return this.client.put<ServerConsent>('/privacy/consent', body, 'privacy.consent.update');
  }
  rights(page: number = 1): Promise<InformationRightsPage> {
    return this.client.get<InformationRightsPage>(`/privacy/rights?page=${page}&size=20`, 'privacy.rights');
  }
  submitRight(body: RightsSubmission): Promise<InformationRight> {
    return this.client.post<InformationRight>('/privacy/rights', body, 'privacy.rights.submit');
  }
  closureCode(phone: string, deviceId: string): Promise<boolean> {
    const payload: ClosureCodePayload = { phone: phone, deviceId: deviceId };
    return this.client.post<boolean>('/privacy/account-closure/code', payload, 'privacy.closure.code');
  }
  closeAccount(phone: string, code: string): Promise<AccountClosureResult> {
    const payload: AccountClosurePayload = { phone: phone, code: code, confirmed: true };
    return this.client.post<AccountClosureResult>('/privacy/account-closure', payload, 'privacy.closure');
  }
  cancelReads(): void {
    this.client.cancelRequest('privacy.consent');
    this.client.cancelRequest('privacy.rights');
  }
}
